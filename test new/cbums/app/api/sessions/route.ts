import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";

interface QueryOptions {
  skip: number;
  take: number;
  orderBy: { createdAt: "desc" };
  include: {
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
        subrole: true;
      };
    };
    company: {
      select: {
        id: true;
        name: true;
      };
    };
    seal: true;
  };
  where?: Record<string, unknown>;
}

interface SessionWithSeal {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: Date;
  seal: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: Date | null;
  } | null;
}

interface ActivityLogDetails {
  tripDetails?: Record<string, unknown>;
  images?: Record<string, string>;
  timestamps?: Record<string, string>;
  qrCodes?: Record<string, string>;
  verification?: {
    status: string;
    timestamp: string;
    verifiedBy: string;
  };
}

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userRole = session.user.role;
    const userId = session.user.id;
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    // Build where clause based on user role
    let whereClause = {};
    
    if (userRole === UserRole.SUPERADMIN) {
      // SuperAdmin can see all sessions
      whereClause = {};
    } else if (userRole === UserRole.ADMIN) {
      // Admin can only see sessions from companies they created
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
      
      const companyIds = companiesCreatedByAdmin
        .filter(company => company.companyId)
        .map(company => company.companyId);
        
      const companyUserIds = companiesCreatedByAdmin.map(company => company.id);
      
      whereClause = {
        companyId: {
          in: [...new Set([...companyIds, ...companyUserIds])].filter(Boolean)
        }
      };
    } else if (userRole === UserRole.COMPANY) {
      // Company can only see their own sessions
      whereClause = {
        OR: [
          { companyId: userId },
          { createdById: userId }
        ]
      };
    } else if (userRole === UserRole.EMPLOYEE) {
      // Employee can only see sessions they created or are involved with
      whereClause = {
        OR: [
          { createdById: userId },
          { 'seal.verifiedById': userId }
        ]
      };
    }
    
    // Add status filter if provided
    if (status) {
      whereClause = {
        ...whereClause,
        status
      };
    }
    
    // Add search filter if provided
    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { source: { contains: search, mode: 'insensitive' } },
          { destination: { contains: search, mode: 'insensitive' } },
          { 'seal.barcode': { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    
    // Get total count for pagination
    const total = await prisma.session.count({
      where: whereClause
    });
    
    // Get sessions with pagination
    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        seal: {
          select: {
            id: true,
            barcode: true,
            verified: true,
            scannedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });
    
    // Get activity logs for trip details
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: {
          in: sessions.map(s => s.id)
        },
        targetResourceType: 'session',
        action: 'CREATE'
      }
    });
    
    // Enhance sessions with trip details
    const enhancedSessions = sessions.map(session => {
      const activityLog = activityLogs.find(log => log.targetResourceId === session.id);
      const details = activityLog?.details as ActivityLogDetails | undefined;
      
      return {
        ...session,
        tripDetails: details?.tripDetails || {}
      };
    });
    
    return NextResponse.json({
      sessions: enhancedSessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// All authenticated users can access sessions list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE
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
  for (const key of formData.keys()) {
    if (key.startsWith(prefix)) {
      count++;
    }
  }
  return count;
} 