import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user.role;
    const userId = session?.user.id;
    const userSubrole = session?.user.subrole;
    
    console.log("[API DEBUG] Sessions API called by:", {
      userId,
      userRole,
      userSubrole
    });
    
    // Get pagination parameters from query
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get filter parameters
    const statusFilter = url.searchParams.get("status");
    const needsVerification = url.searchParams.get("needsVerification") === "true";
    const companyIdFilter = url.searchParams.get("companyId");

    console.log("[API DEBUG] Query parameters:", {
      page,
      limit,
      statusFilter,
      needsVerification,
      companyIdFilter,
      url: req.url
    });

    // Base query options with proper typing
    const queryOptions: any = {
      skip,
      take: limit,
      orderBy: { createdAt: "desc" as const },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        seal: true, // Include the full seal for debugging
      },
    };

    try {
      // Initialize where clause
      queryOptions.where = {};
      
      // Special case: needsVerification takes priority
      if (needsVerification) {
        console.log("[API DEBUG] Processing needsVerification filter");
        
        // Basic filter for IN_PROGRESS status
        queryOptions.where.status = "IN_PROGRESS";
        
        // Add company filter if provided
        if (companyIdFilter) {
          queryOptions.where.companyId = companyIdFilter;
          console.log(`[API DEBUG] Filtering by company ID: ${companyIdFilter}`);
        }
        
        console.log("[API DEBUG] Final needsVerification filter:", JSON.stringify(queryOptions.where, null, 2));
      } else {
        // Standard filtering
        // Add status filter if provided
        if (statusFilter) {
          queryOptions.where.status = statusFilter;
        }
        
        // Add company filter if provided
        if (companyIdFilter) {
          queryOptions.where.companyId = companyIdFilter;
        }
      }
    } catch (error) {
      console.error("[API DEBUG] Error setting up query options:", error);
      return NextResponse.json(
        { error: "Failed to set up query parameters" },
        { status: 500 }
      );
    }

    // For GUARD users, fetch sessions from their company that need verification
    if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.GUARD && !needsVerification) {
      try {
        // Get the Guard's company ID
        const guard = await prisma.user.findUnique({
          where: { id: userId },
          select: { companyId: true }
        });
        
        console.log("[API DEBUG] Guard user details:", {
          guardId: userId,
          companyId: guard?.companyId
        });
        
        if (guard?.companyId) {
          // GUARD should see sessions from their company with IN_PROGRESS status
          queryOptions.where = {
            ...queryOptions.where,
            companyId: guard.companyId,
          };
          
          // If status filter wasn't already set, default to IN_PROGRESS for guards
          if (!statusFilter && !queryOptions.where.status) {
            queryOptions.where.status = "IN_PROGRESS";
          }
          
          console.log("[API DEBUG] Modified query for GUARD:", JSON.stringify(queryOptions.where, null, 2));
        }
      } catch (error) {
        console.error("[API DEBUG] Error setting up GUARD query:", error);
        return NextResponse.json(
          { error: "Failed to set up guard-specific query" },
          { status: 500 }
        );
      }
    }

    let sessions;
    let totalCount;

    try {
      // Apply role-based filtering
      switch (userRole) {
        case UserRole.SUPERADMIN:
          // SuperAdmin can see all sessions (with applied filters)
          sessions = await prisma.session.findMany(queryOptions);
          totalCount = await prisma.session.count({
            where: queryOptions.where
          });
          break;

        case UserRole.ADMIN:
          // Admin can see sessions from companies they manage (with applied filters)
          try {
            // Find companies created by this admin
            const companiesCreatedByAdmin = await prisma.user.findMany({
              where: {
                role: UserRole.COMPANY,
                createdById: userId,
              },
              select: {
                id: true,
                companyId: true,
              }
            });
            
            console.log("[API DEBUG] Admin user:", userId);
            console.log("[API DEBUG] Companies created by admin:", companiesCreatedByAdmin.length);
            
            // Get the company IDs for filtering
            const companyIds = companiesCreatedByAdmin
              .filter(company => company.companyId)
              .map(company => company.companyId);
              
            // Also include company user IDs in case they're used as companyId
            const companyUserIds = companiesCreatedByAdmin.map(company => company.id);
            
            // Combined array of IDs to check against companyId
            const allCompanyIds = [...new Set([...companyIds, ...companyUserIds])].filter(Boolean);
            
            console.log("[API DEBUG] Filtering sessions by company IDs:", allCompanyIds);
            
            // Only get sessions for companies created by this admin
            if (allCompanyIds.length > 0) {
              queryOptions.where = {
                ...queryOptions.where,
                companyId: {
                  in: allCompanyIds as string[]
                }
              };
            } else {
              // If admin hasn't created any companies, show no sessions
              queryOptions.where = {
                ...queryOptions.where,
                id: "NONE" // This will ensure no results
              };
            }
          } catch (error) {
            console.error("[API DEBUG] Error filtering sessions for admin:", error);
          }
          
          sessions = await prisma.session.findMany(queryOptions);
          totalCount = await prisma.session.count({
            where: queryOptions.where
          });
          break;

        case UserRole.COMPANY:
          // Get the COMPANY user's company relationship
          console.log("[API DEBUG] Looking up COMPANY user:", userId);
          
          // Approach 1: Try to find directly by ID
          queryOptions.where = {
            ...queryOptions.where,
            companyId: userId, // Direct match with companyId
          };
          
          console.log("[API DEBUG] Using direct companyId match:", JSON.stringify(queryOptions.where));
          
          sessions = await prisma.session.findMany(queryOptions);
          console.log("[API DEBUG] Sessions found with direct match:", sessions.length);
          
          // If no sessions found with direct match, try looking up by company relation
          if (sessions.length === 0) {
            console.log("[API DEBUG] No sessions found with direct ID match, trying different approach");
            
            // Get company records associated with this user ID (in case this is the company owner)
            const companyRecords = await prisma.company.findMany({
              where: {
                employees: {
                  some: {
                    id: userId,
                    role: UserRole.COMPANY
                  }
                }
              }
            });
            
            console.log("[API DEBUG] Found company records:", companyRecords.length);
            
            if (companyRecords.length > 0) {
              // Use the first company ID found
              const companyId = companyRecords[0].id;
              console.log("[API DEBUG] Using company ID:", companyId);
              
              queryOptions.where = {
                ...queryOptions.where,
                companyId: companyId
              };
              
              sessions = await prisma.session.findMany(queryOptions);
              console.log("[API DEBUG] Sessions found with company relation:", sessions.length);
            }
            
            // If still no sessions, try another approach by looking up the user's company relationship
            if (sessions.length === 0) {
              console.log("[API DEBUG] Still no sessions found, trying user's companyId");
              
              // Look up the COMPANY user to see if they have a companyId field
              const companyUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { company: true }
              });
              
              console.log("[API DEBUG] Company user lookup:", { 
                found: !!companyUser,
                hasCompanyId: !!companyUser?.companyId,
                hasCompany: !!companyUser?.company,
                companyId: companyUser?.companyId,
                companyName: companyUser?.company?.name
              });
              
              if (companyUser?.companyId) {
                // Try using the companyId from the user record
                queryOptions.where = {
                  ...queryOptions.where,
                  companyId: companyUser.companyId
                };
                
                sessions = await prisma.session.findMany(queryOptions);
                console.log("[API DEBUG] Sessions found with user's companyId:", sessions.length);
              }
            }
            
            // If still no sessions, try getting a sample of all sessions for debugging
            if (sessions.length === 0) {
              console.log("[API DEBUG] Still no sessions found, checking all sessions");
              
              // Remove companyId filter and check a sample
              delete queryOptions.where.companyId;
              
              const sampleSessions = await prisma.session.findMany({
                ...queryOptions,
                take: 5 // Just a small sample
              });
              
              console.log("[API DEBUG] Sample sessions:", 
                sampleSessions.map(s => ({ id: s.id, companyId: s.companyId })));
              
              // Restore the filter for the actual response
              queryOptions.where.companyId = userId;
              sessions = await prisma.session.findMany(queryOptions);
            }
          }
          
          totalCount = await prisma.session.count({
            where: queryOptions.where
          });
          break;

        case UserRole.EMPLOYEE:
          // Check if we're already using the needsVerification filter
          if (!needsVerification) {
            if (userSubrole !== EmployeeSubrole.GUARD) {
              // For non-GUARD employees
              queryOptions.where = {
                ...queryOptions.where,
                OR: [
                  { createdById: userId },
                  { seal: { verifiedById: userId } },
                ],
              };
            }
            // For GUARD employees using the normal API, we've already set their custom filter above
          }
          // When using needsVerification, the filter is already set properly above
          
          console.log("[API DEBUG] Final query for EMPLOYEE:", JSON.stringify(queryOptions.where, null, 2));
          sessions = await prisma.session.findMany(queryOptions);
          console.log("[API DEBUG] Sessions found:", sessions.length);
          
          totalCount = await prisma.session.count({
            where: queryOptions.where
          });
          break;

        default:
          return NextResponse.json(
            { error: "Invalid user role" },
            { status: 400 }
          );
      }

      // Post-processing: For needsVerification, filter sessions client-side to ensure they need verification
      if (needsVerification) {
        sessions = sessions.filter(session => {
          // Type assertion to handle the seal property
          const sessionWithSeal = session as any;
          return sessionWithSeal.seal && !sessionWithSeal.seal.verified;
        });
        
        console.log(`[API DEBUG] After post-processing: ${sessions.length} sessions needing verification`);
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return NextResponse.json({
        sessions,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error: any) {
      console.error("Error executing session query:", error);
      return NextResponse.json(
        { error: `Failed to fetch sessions: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in sessions API:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// All authenticated users can access the sessions list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]);

// Add POST handler for session creation
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const userId = session?.user.id;
      const userRole = session?.user.role;
      const userSubrole = session?.user.subrole;

      // Only OPERATORS can create sessions
      if (userRole !== UserRole.EMPLOYEE || userSubrole !== EmployeeSubrole.OPERATOR) {
        return NextResponse.json(
          { error: "Unauthorized. Only operators can create sessions" },
          { status: 403 }
        );
      }

      // Extract basic session data
      const formData = await req.formData();
      
      // Extract only the fields that exist in the Session model
      const sessionData = {
        source: formData.get('loadingSite') as string, 
        destination: formData.get('receiverPartyName') as string,
        createdById: userId as string,
      };

      // Get timestamps data
      const loadingDetailsTimestamps = formData.get('loadingDetailsTimestamps');
      const imagesFormTimestamps = formData.get('imagesFormTimestamps');

      // Extract all form data for storing in activity log
      const tripDetails = {
        transporterName: formData.get('transporterName') as string,
        materialName: formData.get('materialName') as string,
        receiverPartyName: formData.get('receiverPartyName') as string,
        vehicleNumber: formData.get('vehicleNumber') as string,
        gpsImeiNumber: formData.get('gpsImeiNumber') as string,
        driverName: formData.get('driverName') as string,
        driverContactNumber: formData.get('driverContactNumber') as string,
        loaderName: formData.get('loaderName') as string,
        challanRoyaltyNumber: formData.get('challanRoyaltyNumber') as string,
        doNumber: formData.get('doNumber') as string,
        freight: parseFloat(formData.get('freight') as string) || 0,
        qualityOfMaterials: formData.get('qualityOfMaterials') as string,
        tpNumber: formData.get('tpNumber') as string,
        grossWeight: parseFloat(formData.get('grossWeight') as string) || 0,
        tareWeight: parseFloat(formData.get('tareWeight') as string) || 0,
        netMaterialWeight: parseFloat(formData.get('netMaterialWeight') as string) || 0,
        loaderMobileNumber: formData.get('loaderMobileNumber') as string,
      };

      // Handle scanned codes
      const scannedCodesJson = formData.get('scannedCodes') as string;
      const scannedCodes = scannedCodesJson ? JSON.parse(scannedCodesJson) : [];

      // Extract files information
      const gpsImeiPicture = formData.get('gpsImeiPicture') as File;
      const vehicleNumberPlatePicture = formData.get('vehicleNumberPlatePicture') as File;
      const driverPicture = formData.get('driverPicture') as File;
      
      // Get employee data to determine company association
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true }
      });
      
      if (!employee || !employee.companyId) {
        return NextResponse.json(
          { error: "Employee is not associated with any company" },
          { status: 400 }
        );
      }
      
      // Create session with a seal in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // First create the session with only the fields in the schema
        const newSession = await tx.session.create({
          data: {
            ...sessionData,
            companyId: employee.companyId || "", // Ensure companyId is not null
            status: "IN_PROGRESS", // Set to IN_PROGRESS directly since we're creating a seal
          },
        });
        
        // Then create the seal associated with the session
        const seal = await tx.seal.create({
          data: {
            barcode: scannedCodes.length > 0 ? scannedCodes[0] : `SEAL-${Date.now()}`,
            sessionId: newSession.id, // Link the seal to the session
          },
        });

        // Store all the trip details in the activity log
        await tx.activityLog.create({
          data: {
            userId: userId as string,
            action: "CREATE",
            targetResourceId: newSession.id,
            targetResourceType: "session",
            details: {
              tripDetails: {
                ...tripDetails,
              },
              images: {
                gpsImeiPicture: gpsImeiPicture ? `/api/images/${newSession.id}/gpsImei` : null,
                vehicleNumberPlatePicture: vehicleNumberPlatePicture ? `/api/images/${newSession.id}/vehicleNumber` : null,
                driverPicture: driverPicture ? `/api/images/${newSession.id}/driver` : null,
                sealingImages: Array.from({ length: getFileCountFromFormData(formData, 'sealingImages') }, 
                  (_, i) => `/api/images/${newSession.id}/sealing/${i}`),
                vehicleImages: Array.from({ length: getFileCountFromFormData(formData, 'vehicleImages') }, 
                  (_, i) => `/api/images/${newSession.id}/vehicle/${i}`),
                additionalImages: Array.from({ length: getFileCountFromFormData(formData, 'additionalImages') }, 
                  (_, i) => `/api/images/${newSession.id}/additional/${i}`),
              },
              timestamps: {
                loadingDetails: loadingDetailsTimestamps ? JSON.parse(loadingDetailsTimestamps as string) : {},
                imagesForm: imagesFormTimestamps ? JSON.parse(imagesFormTimestamps as string) : {},
              },
              qrCodes: {
                primaryBarcode: scannedCodes.length > 0 ? scannedCodes[0] : `SEAL-${Date.now()}`,
                additionalBarcodes: scannedCodes.length > 1 ? scannedCodes.slice(1) : []
              }
            }
          }
        });
        
        return { session: newSession, seal };
      });
      
      // In a real application, you would upload the files to storage here
      // For now we just acknowledge receipt of the files
      
      return NextResponse.json({
        success: true,
        sessionId: result.session.id,
        message: "Session created successfully",
      });
    } catch (error) {
      console.error("Error creating session:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }
  },
  [UserRole.EMPLOYEE]
);

// Helper function to count files with a specific prefix
function getFileCountFromFormData(formData: FormData, prefix: string): number {
  let count = 0;
  for (const key of Array.from(formData.keys())) {
    if (key.startsWith(`${prefix}[`)) {
      count++;
    }
  }
  return count;
} 