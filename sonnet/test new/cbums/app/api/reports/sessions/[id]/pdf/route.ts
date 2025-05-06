import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import PDFDocument from 'pdfkit';

interface TripDetails {
  transporterName?: string;
  materialName?: string;
  vehicleNumber?: string;
  gpsImeiNumber?: string;
  driverName?: string;
  driverContactNumber?: string;
  loaderName?: string;
  loaderMobileNumber?: string;
  challanRoyaltyNumber?: string;
  doNumber?: string;
  tpNumber?: string;
  qualityOfMaterials?: string;
  freight?: number;
  grossWeight?: number;
  tareWeight?: number;
  netMaterialWeight?: number;
  loadingSite?: string;
  receiverPartyName?: string;
  [key: string]: unknown;
}

// Helper function to format dates
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Helper function to safely handle text
const safeText = (text: string | number | boolean | null | undefined): string => {
  if (text === null || text === undefined) return 'N/A';
  return String(text).replace(/[^\x20-\x7E]/g, ''); // Only keep printable ASCII
};

// Generate PDF report for session
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
      
      // Fetch the session with related data
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
            take: 10, // Limit comments to avoid large PDFs
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
      
      // If COMPANY user, check if they own the session
      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }
      
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
      let tripDetails: TripDetails = {};
      
      if (activityLog?.details) {
        const details = activityLog.details as { tripDetails?: TripDetails };
        
        // Extract trip details
        if (details.tripDetails) {
          tripDetails = details.tripDetails;
        }
      }
      
      try {
        // Create a PDF document with simpler options
        const doc = new PDFDocument({ 
          margin: 50, 
          size: 'A4',
          info: {
            Title: `Session Report - ${sessionId}`,
            Author: 'CBUMS System',
          }
        });
        
        const chunks: Buffer[] = [];
        
        // Collect data chunks
        doc.on('data', chunk => chunks.push(chunk));
        
        // Add content to the PDF document
        doc.fontSize(20).text('Session Report', { align: 'center' });
        doc.moveDown();
        
        // Session Basic Info
        doc.fontSize(16).text('Session Information');
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Session ID: ${safeText(sessionData.id)}`);
        doc.text(`Status: ${safeText(sessionData.status)}`);
        doc.text(`Created At: ${formatDate(sessionData.createdAt)}`);
        doc.text(`Source: ${safeText(sessionData.source) || 'N/A'}`);
        doc.text(`Destination: ${safeText(sessionData.destination) || 'N/A'}`);
        doc.text(`Company: ${safeText(sessionData.company.name) || 'N/A'}`);
        doc.text(`Created By: ${safeText(sessionData.createdBy.name) || 'N/A'} (${safeText(sessionData.createdBy.email) || 'N/A'})`);
        doc.moveDown();
        
        // Trip Details
        if (Object.keys(tripDetails).length > 0) {
          doc.fontSize(16).text('Trip Details');
          doc.moveDown(0.5);
          doc.fontSize(12);
          
          for (const [key, value] of Object.entries(tripDetails)) {
            try {
              // Format key from camelCase to Title Case with spaces
              const formattedKey = key.replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              doc.text(`${formattedKey}: ${safeText(value as string | number | boolean | null | undefined)}`);
            } catch {
              console.error(`Error processing trip detail ${key}`);
              // Skip this field if there's an error
              continue;
            }
          }
          doc.moveDown();
        }
        
        // Seal Information
        if (sessionData.seal) {
          doc.fontSize(16).text('Seal Information');
          doc.moveDown(0.5);
          doc.fontSize(12);
          doc.text(`Barcode: ${safeText(sessionData.seal.barcode) || 'N/A'}`);
          doc.text(`Status: ${sessionData.seal.verified ? 'Verified' : 'Not Verified'}`);
          
          if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
            doc.text(`Verified By: ${safeText(sessionData.seal.verifiedBy.name) || 'N/A'}`);
            if (sessionData.seal.scannedAt) {
              doc.text(`Verified At: ${formatDate(sessionData.seal.scannedAt)}`);
            }
          }
          doc.moveDown();
        }
        
        // Comments section if available
        if (sessionData.comments && sessionData.comments.length > 0) {
          doc.fontSize(16).text('Comments');
          doc.moveDown(0.5);
          doc.fontSize(12);
          
          for (let i = 0; i < Math.min(sessionData.comments.length, 5); i++) {
            try {
              const comment = sessionData.comments[i];
              const userName = comment.user?.name || 'Unknown';
              const commentDate = formatDate(comment.createdAt);
              const commentText = comment.message || '(No text)';
              
              doc.text(`${userName} on ${commentDate}:`);
              doc.text(commentText, { indent: 20 });
              doc.moveDown(0.5);
            } catch {
              console.error(`Error processing comment ${i}`);
              continue;
            }
          }
        }
        
        // Finalize PDF
        doc.end();
        
        return new Promise<NextResponse>((resolve, reject) => {
          doc.on('end', () => {
            try {
              const pdfBuffer = Buffer.concat(chunks);
              
              if (!pdfBuffer || pdfBuffer.length === 0) {
                reject(new Error('Generated PDF is empty'));
                return;
              }
              
              const response = new NextResponse(pdfBuffer);
              
              response.headers.set('Content-Type', 'application/pdf');
              response.headers.set('Content-Disposition', `attachment; filename="session-${sessionId}.pdf"`);
              response.headers.set('Content-Length', pdfBuffer.length.toString());
              response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
              response.headers.set('Pragma', 'no-cache');
              response.headers.set('Expires', '0');
              
              resolve(response);
            } catch (err) {
              console.error("Error creating response:", err);
              reject(err);
            }
          });
          
          doc.on('error', (err) => {
            console.error("PDF document error:", err);
            reject(err);
          });
        });
      } catch (docError: unknown) {
        console.error("Error creating PDF document:", docError);
        return NextResponse.json(
          { error: "Failed to create PDF document", details: docError instanceof Error ? docError.message : String(docError) },
          { status: 500 }
        );
      }
    } catch (error: unknown) {
      console.error("Error generating PDF report:", error);
      return NextResponse.json(
        { error: "Failed to generate PDF report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 