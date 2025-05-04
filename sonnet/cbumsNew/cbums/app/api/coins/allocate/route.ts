import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { ActivityAction, TransactionReason, UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const fromUserId = session.user.id;
    
    const body = await req.json();
    const { toUserId, amount, reasonText } = body;

    if (!toUserId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing required fields or invalid amount" },
        { status: 400 }
      );
    }

    // Check if sender exists
    const sender = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
      },
    });

    if (!sender) {
      return NextResponse.json(
        { error: "Sender not found" },
        { status: 404 }
      );
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: toUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdById: true,
      },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      );
    }

    // Perform authorization checks
    // 1. SuperAdmin can allocate to Admins
    // 2. Admins can allocate to Companies and their Employees
    let isAuthorized = false;
    let transactionReason = TransactionReason.COIN_ALLOCATION;

    if (sender.role === UserRole.SUPERADMIN && receiver.role === UserRole.ADMIN) {
      isAuthorized = true;
    } else if (sender.role === UserRole.ADMIN) {
      if (receiver.role === UserRole.COMPANY || receiver.role === UserRole.EMPLOYEE) {
        // For employees, check if they belong to a company created by this admin
        if (receiver.role === UserRole.EMPLOYEE) {
          // Check if the employee's company was created by this admin
          // or if the employee was directly created by this admin
          isAuthorized = receiver.createdById === sender.id;
        } else {
          // For companies, check if they were created by this admin
          isAuthorized = receiver.createdById === sender.id;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to allocate coins to this user" },
        { status: 403 }
      );
    }

    // Check if sender has enough coins
    if (sender.coins < amount) {
      return NextResponse.json(
        { error: "Insufficient coins" },
        { status: 400 }
      );
    }

    // Create transaction using Prisma transaction to ensure data consistency
    const transaction = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update sender's balance
      const updatedSender = await tx.user.update({
        where: { id: fromUserId },
        data: { coins: { decrement: amount } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          coins: true,
        },
      });

      // Update receiver's balance
      const updatedReceiver = await tx.user.update({
        where: { id: toUserId },
        data: { coins: { increment: amount } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          coins: true,
        },
      });

      // Create transaction record
      const coinTransaction = await tx.coinTransaction.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          reasonText,
          reason: transactionReason,
        },
      });

      return {
        sender: updatedSender,
        receiver: updatedReceiver,
        transaction: coinTransaction,
      };
    });

    // Prepare the details object for activity logging
    const logDetails: Record<string, any> = {
      recipient: { 
        id: toUserId, 
        name: transaction.receiver?.name || "Unknown" 
      },
      amount,
      reason: String(transactionReason)
    };

    // Add reasonText if it exists
    if (reasonText) {
      logDetails.reasonText = reasonText;
    }

    // Log the activity
    await addActivityLog({
      userId: fromUserId,
      action: ActivityAction.ALLOCATE,
      details: logDetails,
      targetUserId: toUserId,
    });

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error("Error allocating coins:", error);
    return NextResponse.json(
      { error: "Failed to allocate coins" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin and Admin can allocate coins
export const POST = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
]); 