import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EmployeeSubrole, SessionStatus, UserRole } from "@/prisma/enums";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { barcode } = body;

    // Validation
    if (!barcode) {
      return NextResponse.json(
        { error: "Barcode is required" },
        { status: 400 }
      );
    }

    // Only guards can verify seals
    if (session?.user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    // Find the seal by barcode
    const seal = await prisma.seal.findFirst({
      where: { barcode },
      include: { session: true }
    });

    if (!seal) {
      return NextResponse.json(
        { error: "Seal not found" },
        { status: 404 }
      );
    }

    if (seal.verified) {
      return NextResponse.json(
        { error: "Seal has already been verified" },
        { status: 400 }
      );
    }

    // Update the seal status
    const updatedSeal = await prisma.seal.update({
      where: { id: seal.id },
      data: {
        verified: true,
        verifiedById: session.user.id,
        scannedAt: new Date()
      }
    });

    // Update the session status to COMPLETED
    const updatedSession = await prisma.session.update({
      where: { id: seal.sessionId },
      data: { status: SessionStatus.COMPLETED }
    });

    return NextResponse.json(
      { 
        message: "Seal verified successfully", 
        seal: updatedSeal,
        session: updatedSession
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying seal:", error);
    return NextResponse.json(
      { error: "Failed to verify seal" },
      { status: 500 }
    );
  }
}

// Only employees with GUARD subrole can verify seals
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const userId = session?.user.id;
      const userRole = session?.user.role;
      const userSubrole = session?.user.subrole;
      const body = await req.json();
      const { barcode } = body;

      // Validation
      if (!barcode) {
        return NextResponse.json(
          { error: "Barcode is required" },
          { status: 400 }
        );
      }

      // Only guards can verify seals
      if (userSubrole !== EmployeeSubrole.GUARD) {
        return NextResponse.json(
          { error: "Only guards can verify seals" },
          { status: 403 }
        );
      }

      // Find the seal by barcode
      const seal = await prisma.seal.findFirst({
        where: { barcode },
        include: { session: true }
      });

      if (!seal) {
        return NextResponse.json(
          { error: "Seal not found" },
          { status: 404 }
        );
      }

      if (seal.verified) {
        return NextResponse.json(
          { error: "Seal has already been verified" },
          { status: 400 }
        );
      }

      // Update the seal status
      const updatedSeal = await prisma.seal.update({
        where: { id: seal.id },
        data: {
          verified: true,
          verifiedById: userId,
          scannedAt: new Date()
        }
      });

      // Update the session status to COMPLETED
      const updatedSession = await prisma.session.update({
        where: { id: seal.sessionId },
        data: { status: SessionStatus.COMPLETED }
      });

      return NextResponse.json(
        { 
          message: "Seal verified successfully", 
          seal: updatedSeal,
          session: updatedSession
        }, 
        { status: 200 }
      );
    } catch (error) {
      console.error("Error verifying seal:", error);
      return NextResponse.json(
        { error: "Failed to verify seal" },
        { status: 500 }
      );
    }
  },
  [UserRole.EMPLOYEE]
); 