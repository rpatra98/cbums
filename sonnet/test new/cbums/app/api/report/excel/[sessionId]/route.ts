import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import ExcelJS from "exceljs";
import { Comment } from "@prisma/client";

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
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CBUMS System";
    workbook.created = new Date();
    
    // Session details worksheet
    const sessionSheet = workbook.addWorksheet("Session Details");
    
    // Add title
    sessionSheet.addRow(["Session Report"]);
    sessionSheet.mergeCells("A1:G1");
    sessionSheet.getCell("A1").font = { bold: true, size: 16 };
    sessionSheet.getCell("A1").alignment = { horizontal: "center" };
    sessionSheet.addRow([]);
    
    // Session information
    sessionSheet.addRow(["Session Information"]);
    sessionSheet.getCell("A3").font = { bold: true, size: 14 };
    sessionSheet.addRow(["ID", session.id]);
    sessionSheet.addRow(["Created At", session.createdAt.toLocaleString()]);
    sessionSheet.addRow(["Status", session.status]);
    sessionSheet.addRow(["Source", session.source]);
    sessionSheet.addRow(["Destination", session.destination]);
    sessionSheet.addRow([]);
    
    // Company information
    sessionSheet.addRow(["Company Information"]);
    sessionSheet.getCell("A9").font = { bold: true, size: 14 };
    sessionSheet.addRow(["Name", session.company.name]);
    sessionSheet.addRow(["Email", session.company.email]);
    if (session.company.phone) {
      sessionSheet.addRow(["Phone", session.company.phone]);
    }
    if (session.company.address) {
      sessionSheet.addRow(["Address", session.company.address]);
    }
    sessionSheet.addRow([]);
    
    // Creator information
    sessionSheet.addRow(["Created By"]);
    sessionSheet.getCell("A14").font = { bold: true, size: 14 };
    sessionSheet.addRow(["Name", session.createdBy.name]);
    sessionSheet.addRow(["Email", session.createdBy.email]);
    sessionSheet.addRow(["Role", session.createdBy.subrole]);
    sessionSheet.addRow([]);
    
    // Seal information
    sessionSheet.addRow(["Seal Information"]);
    sessionSheet.getCell("A19").font = { bold: true, size: 14 };
    sessionSheet.addRow(["Barcode", session.seal?.barcode || "N/A"]);
    sessionSheet.addRow(["Verified", session.seal?.verified ? "Yes" : "No"]);
    if (session.seal?.scannedAt) {
      sessionSheet.addRow(["Scanned At", session.seal.scannedAt.toLocaleString()]);
    }
    if (session.seal?.verifiedBy) {
      sessionSheet.addRow(["Verified By", `${session.seal.verifiedBy.name} (${session.seal.verifiedBy.subrole})`]);
    }
    
    // Format columns
    sessionSheet.columns.forEach(column => {
      column.width = 25;
    });
    
    // Add comments worksheet if there are comments
    if (session.comments.length > 0) {
      const commentsSheet = workbook.addWorksheet("Comments");
      
      // Add headers
      commentsSheet.addRow(["User", "Role", "Date", "Comment"]);
      commentsSheet.getRow(1).font = { bold: true };
      
      // Add comment data
      session.comments.forEach((comment: Comment & {
        user: {
          name: string;
          role: string;
        };
      }) => {
        commentsSheet.addRow([
          comment.user.name,
          comment.user.role,
          comment.createdAt.toLocaleString(),
          comment.message
        ]);
      });
      
      // Format columns
      commentsSheet.getColumn("A").width = 20;
      commentsSheet.getColumn("B").width = 15;
      commentsSheet.getColumn("C").width = 25;
      commentsSheet.getColumn("D").width = 50;
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set response headers and return Excel file
    const response = new NextResponse(buffer);
    response.headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.headers.set("Content-Disposition", `attachment; filename="session-${sessionId}.xlsx"`);
    
    return response;
  } catch (error: unknown) {
    console.error("Error generating Excel report:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel report" },
      { status: 500 }
    );
  }
}

// Users with these roles can access Excel reports
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
]); 