import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

// Generate a simple text-based report for session
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      if (!context || !context.params.id) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      
      const sessionId = context.params.id;
      
      // Fetch the session with ALL related data
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              subrole: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  subrole: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 10,
          },
        },
      });

      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Check authorization - only SUPERADMIN, ADMIN and COMPANY can download reports
      if (
        userRole !== UserRole.SUPERADMIN && 
        userRole !== UserRole.ADMIN && 
        userRole !== UserRole.COMPANY
      ) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      // Format date helper
      const formatDate = (date: Date | string) => {
        try {
          return new Date(date).toLocaleString();
        } catch (e) {
          return String(date);
        }
      };
      
      // Fetch activity log data for the session to get trip details
      const activityLog = await prisma.activityLog.findFirst({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'CREATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      // Extract trip details from activity log
      let tripDetails = {};
      
      if (activityLog?.details) {
        const details = activityLog.details as any;
        
        // Extract trip details
        if (details.tripDetails) {
          tripDetails = details.tripDetails;
        }
      }
      
      // Fetch verification activity logs
      const verificationLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'UPDATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              subrole: true
            }
          }
        }
      });
      
      // Build text report sections
      const sections = [];
      
      // Title
      sections.push("============================================");
      sections.push("              SESSION REPORT               ");
      sections.push("============================================");
      sections.push("");
      
      // Session Information
      sections.push("SESSION INFORMATION");
      sections.push("-------------------");
      sections.push(`Session ID: ${sessionData.id}`);
      sections.push(`Status: ${sessionData.status}`);
      sections.push(`Created At: ${formatDate(sessionData.createdAt)}`);
      sections.push(`Source: ${sessionData.source || 'N/A'}`);
      sections.push(`Destination: ${sessionData.destination || 'N/A'}`);
      sections.push(`Company: ${sessionData.company?.name || 'N/A'}`);
      sections.push(`Created By: ${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`);
      sections.push("");
      
      // Seal Information
      sections.push("SEAL INFORMATION");
      sections.push("----------------");
      if (sessionData.seal) {
        sections.push(`Barcode: ${sessionData.seal.barcode || 'N/A'}`);
        sections.push(`Status: ${sessionData.seal.verified ? 'Verified' : 'Not Verified'}`);
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          sections.push(`Verified By: ${sessionData.seal.verifiedBy.name || 'N/A'}`);
          if (sessionData.seal.scannedAt) {
            sections.push(`Verified At: ${formatDate(sessionData.seal.scannedAt)}`);
          }
        }
      } else {
        sections.push("No seal information available");
      }
      sections.push("");
      
      // Trip Details
      sections.push("TRIP DETAILS");
      sections.push("------------");
      if (Object.keys(tripDetails).length > 0) {
        // Define comprehensive list of trip detail fields with labels
        const fieldLabels = {
          transporterName: "Transporter Name",
          materialName: "Material Name",
          vehicleNumber: "Vehicle Number",
          gpsImeiNumber: "GPS IMEI Number",
          driverName: "Driver Name",
          driverContactNumber: "Driver Contact Number",
          loaderName: "Loader Name",
          loaderMobileNumber: "Loader Mobile Number",
          challanRoyaltyNumber: "Challan/Royalty Number",
          doNumber: "DO Number",
          tpNumber: "TP Number",
          qualityOfMaterials: "Quality of Materials",
          freight: "Freight",
          grossWeight: "Gross Weight (kg)",
          tareWeight: "Tare Weight (kg)",
          netMaterialWeight: "Net Material Weight (kg)",
          loadingSite: "Loading Site",
          receiverPartyName: "Receiver Party Name"
        };
        
        // First add fields from our known list
        for (const [key, label] of Object.entries(fieldLabels)) {
          if (key in tripDetails) {
            const value = (tripDetails as Record<string, any>)[key];
            sections.push(`${label}: ${value !== null && value !== undefined ? value : 'N/A'}`);
          }
        }
        
        // Then add any other fields that might exist
        for (const [key, value] of Object.entries(tripDetails as Record<string, any>)) {
          if (!(key in fieldLabels)) {
            // Format key from camelCase to Title Case with spaces
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            sections.push(`${formattedKey}: ${value !== null && value !== undefined ? value : 'N/A'}`);
          }
        }
      } else {
        sections.push("No trip details available");
      }
      sections.push("");
      
      // Verification Results
      sections.push("VERIFICATION RESULTS");
      sections.push("--------------------");
      const verificationDetails = verificationLogs.find(log => 
        log.details && typeof log.details === 'object' && 'verification' in log.details
      );
      
      if (verificationDetails && verificationDetails.details) {
        const verification = (verificationDetails.details as any).verification;
        
        if (verification && verification.fieldVerifications) {
          sections.push(`Overall Match: ${verification.allMatch ? 'All Fields Match' : 'Some Fields Do Not Match'}`);
          sections.push("");
          
          // List each field verification
          for (const [field, data] of Object.entries(verification.fieldVerifications)) {
            const fieldData = data as any;
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            const match = fieldData.operatorValue === fieldData.guardValue ? 'YES' : 'NO';
            
            sections.push(`Field: ${formattedField}`);
            sections.push(`  Operator Value: ${fieldData.operatorValue}`);
            sections.push(`  Guard Value: ${fieldData.guardValue}`);
            sections.push(`  Match: ${match}`);
            if (fieldData.comment) {
              sections.push(`  Comment: ${fieldData.comment}`);
            }
            sections.push("");
          }
        }
      } else {
        sections.push("No verification data available");
        sections.push("");
      }
      
      // Comments
      if (sessionData.comments && sessionData.comments.length > 0) {
        sections.push("COMMENTS");
        sections.push("--------");
        sessionData.comments.forEach(comment => {
          sections.push(`[${formatDate(comment.createdAt)}] ${comment.user.name}:`);
          sections.push(`  ${comment.message}`);
          sections.push("");
        });
      }
      
      // Footer
      sections.push("============================================");
      sections.push(`Report generated on: ${new Date().toLocaleString()}`);
      sections.push("============================================");
      
      // Join all sections into the final report text
      const reportText = sections.join("\n");

      // Convert text to UTF-8 encoded Buffer
      const reportBuffer = Buffer.from(reportText, 'utf-8');
      
      // Return plain text response
      const response = new NextResponse(reportBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="session-${sessionId}-report.txt"`,
          'Content-Length': reportBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });
      
      return response;
    } catch (error) {
      console.error("Error generating report:", error);
      return NextResponse.json(
        { error: "Failed to generate report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 