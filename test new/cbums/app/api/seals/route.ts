import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const seal = await prisma.seal.findUnique({
      where: { sessionId },
      include: {
        session: true,
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(seal);
  } catch (error) {
    console.error("Error fetching seal:", error);
    return NextResponse.json(
      { error: "Failed to fetch seal" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, barcode } = await req.json();

    if (!sessionId || !barcode) {
      return NextResponse.json(
        { error: "Session ID and barcode are required" },
        { status: 400 }
      );
    }

    // Check if the session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if the session already has a seal
    const existingSeal = await prisma.seal.findUnique({
      where: { sessionId },
    });

    if (existingSeal) {
      return NextResponse.json(
        { error: "Session already has a seal assigned" },
        { status: 400 }
      );
    }

    // Create the seal
    const seal = await prisma.seal.create({
      data: {
        sessionId,
        barcode,
      },
    });

    // Update session status to IN_PROGRESS
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json(seal);
  } catch (error) {
    console.error("Error creating seal:", error);
    return NextResponse.json(
      { error: "Failed to create seal" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can verify seals
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    const { sealId, verificationData } = await req.json();

    if (!sealId) {
      return NextResponse.json(
        { error: "Seal ID is required" },
        { status: 400 }
      );
    }

    // Validate verification data is present
    if (!verificationData) {
      console.error("Missing verification data in request:", { sealId });
      return NextResponse.json(
        { error: "Verification data is required" },
        { status: 400 }
      );
    }

    // Check if the seal exists
    const existingSeal = await prisma.seal.findUnique({
      where: { id: sealId },
      include: { session: true }
    });

    if (!existingSeal) {
      return NextResponse.json(
        { error: "Seal not found" },
        { status: 404 }
      );
    }

    // Check if the seal is already verified
    if (existingSeal.verified) {
      return NextResponse.json(
        { error: "Seal is already verified" },
        { status: 400 }
      );
    }

    // Update the seal as verified
    const updatedSeal = await prisma.seal.update({
      where: { id: sealId },
      data: {
        verified: true,
        verifiedById: user.id,
        scannedAt: new Date(),
      },
      include: {
        session: true,
      },
    });

    // Update session status to COMPLETED
    await prisma.session.update({
      where: { id: updatedSeal.sessionId },
      data: { 
        status: "COMPLETED" 
      },
    });

    // Store verification data in activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        targetResourceId: updatedSeal.sessionId,
        targetResourceType: "session",
        details: {
          verification: {
            timestamp: new Date().toISOString(),
            sealId: sealId,
            fieldVerifications: verificationData.fieldVerifications,
            imageVerifications: verificationData.imageVerifications,
            allMatch: verificationData.allMatch
          }
        }
      }
    });

    return NextResponse.json({
      ...updatedSeal,
      verificationDetails: {
        allMatch: verificationData.allMatch,
        fieldVerifications: verificationData.fieldVerifications
      }
    });
  } catch (error) {
    console.error("Error verifying seal:", error);
    return NextResponse.json(
      { error: "Failed to verify seal" },
      { status: 500 }
    );
  }
} 