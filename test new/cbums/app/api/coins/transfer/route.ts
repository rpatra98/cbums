import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, TransactionReason, EmployeeSubrole } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { ActivityAction } from "@/prisma/enums";

async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { toUserId, amount, reason, notes } = body;
    
    // Validate request data
    if (!toUserId) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400 }
      );
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }
    
    const fromUserId = session.user.id;
    
    // Cannot transfer to self
    if (fromUserId === toUserId) {
      return NextResponse.json(
        { error: "Cannot transfer coins to yourself" },
        { status: 400 }
      );
    }
    
    // Get detailed sender info
    const sender = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { 
        id: true,
        name: true,
        role: true, 
        subrole: true,
        coins: true 
      },
    });
    
    if (!sender) {
      return NextResponse.json(
        { error: "Sender not found" },
        { status: 404 }
      );
    }
    
    // Get detailed recipient info
    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { 
        id: true,
        name: true,
        role: true, 
        subrole: true,
        createdById: true
      },
    });
    
    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }
    
    // Based on the specification, only Admin can transfer coins to Operators
    let isAuthorized = false;
    
    if (sender.role === UserRole.ADMIN && 
        recipient.role === UserRole.EMPLOYEE && 
        recipient.subrole === EmployeeSubrole.OPERATOR) {
      // Admin can only transfer to operators they created
      isAuthorized = recipient.createdById === sender.id;
    }
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to transfer coins to this user. Only admins can transfer coins to operators they created." },
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
    
    // Perform the transaction within a Prisma transaction
    const transaction = await prisma.$transaction(async (prisma) => {
      // Deduct coins from sender
      const updatedSender = await prisma.user.update({
        where: { id: fromUserId },
        data: {
          coins: { decrement: amount },
        },
      });
      
      // Add coins to recipient
      const updatedRecipient = await prisma.user.update({
        where: { id: toUserId },
        data: {
          coins: { increment: amount },
        },
      });
      
      // Record the transaction using COIN_ALLOCATION reason
      const coinTransaction = await prisma.coinTransaction.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          reason: TransactionReason.COIN_ALLOCATION,
          reasonText: notes || `Admin transfer to Operator: ${recipient.name}`,
        },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
            },
          },
          toUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      return { updatedSender, updatedRecipient, coinTransaction };
    });
    
    // Log the activity as ALLOCATE instead of TRANSFER
    await addActivityLog({
      userId: fromUserId,
      action: ActivityAction.ALLOCATE,
      details: {
        amount,
        recipientId: toUserId,
        recipientName: transaction.coinTransaction.toUser.name,
        reasonText: notes || "Admin transfer to Operator",
      },
      targetUserId: toUserId,
      targetResourceId: transaction.coinTransaction.id,
      targetResourceType: "COIN_TRANSACTION",
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${amount} coins to ${transaction.coinTransaction.toUser.name}`,
      transaction: transaction.coinTransaction,
    });
  } catch (error) {
    console.error("Error allocating coins:", error);
    return NextResponse.json(
      { error: "Failed to allocate coins", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Only Admin can transfer coins to Operators
export const POST = withAuth(handler, [
  UserRole.ADMIN,
]); 