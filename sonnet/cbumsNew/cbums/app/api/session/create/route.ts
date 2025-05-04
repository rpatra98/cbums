import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole, SessionStatus, TransactionReason, UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { source, destination, barcode } = body;

    // Validation
    if (!source || !destination || !barcode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Only operators can create sessions
    if (session?.user.subrole !== EmployeeSubrole.OPERATOR) {
      return NextResponse.json(
        { error: "Only operators can create sessions" },
        { status: 403 }
      );
    }

    // Get operator's company
    const operator = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    });

    if (!operator || !operator.companyId) {
      return NextResponse.json(
        { error: "Operator must belong to a company" },
        { status: 400 }
      );
    }

    // Check if operator's company has enough coins (minimum 1 coin needed)
    const company = await prisma.user.findUnique({
      where: { id: operator.companyId },
    });

    if (!company || company.coins < 1) {
      return NextResponse.json(
        { error: "Insufficient coins to create a session" },
        { status: 400 }
      );
    }

    // Find a system admin to attribute the coin to
    const systemAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SUPERADMIN },
      select: { id: true }
    });

    if (!systemAdmin || !systemAdmin.id) {
      return NextResponse.json(
        { error: "System configuration error: No system admin found" },
        { status: 500 }
      );
    }

    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coin from company
      const updatedCompany = await tx.user.update({
        where: { id: operator.companyId as string },
        data: { coins: { decrement: 1 } }
      });

      // Create the session first to get its ID
      const newSession = await tx.session.create({
        data: {
          createdById: session.user.id,
          companyId: operator.companyId as string,
          source,
          destination,
          status: SessionStatus.PENDING,
          seal: {
            create: {
              barcode
            }
          }
        },
        include: { seal: true }
      });

      // Create coin transaction record with session reference
      const coinTransaction = await tx.coinTransaction.create({
        data: {
          fromUserId: operator.companyId as string,
          toUserId: systemAdmin.id,
          amount: 1,
          reason: TransactionReason.SESSION_START,
          reasonText: `Session ID: ${newSession.id} - From ${source} to ${destination} with barcode ${barcode}`
        }
      });

      // Log the activity
      await addActivityLog({
        userId: session.user.id,
        action: ActivityAction.CREATE,
        details: {
          entityType: "SESSION",
          sessionId: newSession.id,
          source,
          destination,
          barcode,
          cost: "1 coin"
        },
        targetResourceId: newSession.id,
        targetResourceType: "SESSION"
      });

      return { 
        session: newSession, 
        transaction: coinTransaction,
        company: {
          id: company.id,
          remainingCoins: company.coins - 1
        }
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    
    // Check for specific error types
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: "Duplicate barcode detected" },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// Only employees with OPERATOR subrole can create sessions
export const POST = withAuth(handler, [UserRole.EMPLOYEE]); 