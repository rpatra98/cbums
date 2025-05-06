import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import PDFDocument from "pdfkit";

// Helper function to format dates safely
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

async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    const sessionId = context.params.sessionId;

    // Get the session with all related data
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        company: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
          },
        },
        seal: {
          include: {
            verifiedBy: {
              select: {
                id: true,
                name: true,
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

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    try {
      // Create PDF document with better options
      const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4',
        info: {
          Title: `Session Report - ${sessionId}`,
          Author: 'CBUMS System',
        }
      });
    
    // Set response headers
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    // Generate PDF content
    // Header
    doc.fontSize(20).text("Session Report", { align: "center" });
    doc.moveDown();
    
    // Session details
    doc.fontSize(16).text("Session Details");
    doc.moveDown(0.5);
    doc.fontSize(12);
      doc.text(`Session ID: ${safeText(session.id)}`);
      doc.text(`Created on: ${formatDate(session.createdAt)}`);
      doc.text(`Status: ${safeText(session.status)}`);
      doc.text(`Source: ${safeText(session.source)}`);
      doc.text(`Destination: ${safeText(session.destination)}`);
    doc.moveDown();
    
    // Company details
    doc.fontSize(16).text("Company Information");
    doc.moveDown(0.5);
    doc.fontSize(12);
      doc.text(`Company: ${safeText(session.company.name)}`);
      doc.text(`Email: ${safeText(session.company.email)}`);
    if (session.company.phone) {
        doc.text(`Phone: ${safeText(session.company.phone)}`);
    }
    if (session.company.address) {
        doc.text(`Address: ${safeText(session.company.address)}`);
    }
    doc.moveDown();
    
    // Creator details
    doc.fontSize(16).text("Created By");
    doc.moveDown(0.5);
    doc.fontSize(12);
      doc.text(`Name: ${safeText(session.createdBy.name)}`);
      doc.text(`Email: ${safeText(session.createdBy.email)}`);
      doc.text(`Role: ${safeText(session.createdBy.subrole)}`);
    doc.moveDown();
    
    // Seal information
    doc.fontSize(16).text("Seal Information");
    doc.moveDown(0.5);
    doc.fontSize(12);
      doc.text(`Barcode: ${safeText(session.seal?.barcode) || 'N/A'}`);
    doc.text(`Verified: ${session.seal?.verified ? "Yes" : "No"}`);
    if (session.seal?.scannedAt) {
        doc.text(`Scanned at: ${formatDate(session.seal.scannedAt)}`);
    }
    if (session.seal?.verifiedBy) {
        doc.text(`Verified by: ${safeText(session.seal.verifiedBy.name)} (${safeText(session.seal.verifiedBy.subrole)})`);
    }
    doc.moveDown();
    
    // Comments
    if (session.comments.length > 0) {
      doc.fontSize(16).text("Comments");
      doc.moveDown(0.5);
      doc.fontSize(12);
      
        for (let i = 0; i < Math.min(session.comments.length, 5); i++) {
          try {
            const comment = session.comments[i];
            const userName = comment.user?.name || 'Unknown';
            const userRole = comment.user?.role || '';
            const commentDate = formatDate(comment.createdAt);
            
            doc.text(`${safeText(userName)} (${safeText(userRole)}) on ${commentDate}:`, { continued: false });
            doc.text(safeText(comment.message), { indent: 20 });
        doc.moveDown(0.5);
          } catch (error: unknown) {
            console.error("Error processing comment:", error);
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
    } catch (docError) {
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
}

// Users with these roles can access PDF reports
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
]); 