import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";
import { CoinTransaction, User } from "@prisma/client";

type TransactionWithUsers = CoinTransaction & {
  fromUser: Pick<User, 'id' | 'name' | 'role'>;
  toUser: Pick<User, 'id' | 'name' | 'role'>;
};

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Parse query parameters
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId") || userId;
    
    // Users can only check their own balance unless they're admins/superadmins
    if (targetUserId !== userId && 
        session.user.role !== UserRole.SUPERADMIN && 
        session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Not authorized to view this user's balance" },
        { status: 403 }
      );
    }
    
    // Get user with coin balance
    const userIdToCheck = targetUserId;
    const user = await prisma.user.findUnique({
      where: { id: userIdToCheck },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Also get recent transactions for the user if requesting own balance
    let recentTransactions: TransactionWithUsers[] = [];
    
    if (!targetUserId || targetUserId === userId) {
      recentTransactions = await prisma.coinTransaction.findMany({
        where: {
          OR: [
            { fromUserId: userIdToCheck },
            { toUserId: userIdToCheck },
          ],
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          fromUser: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          toUser: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });
    }
    
    return NextResponse.json({
      balance: user.coins,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      recentTransactions: targetUserId === userId ? recentTransactions : undefined,
    });
  } catch (error: unknown) {
    console.error("Error retrieving coin balance:", error);
    return NextResponse.json(
      { error: "Failed to retrieve coin balance" },
      { status: 500 }
    );
  }
}

// Allow roles that need to view coin balances
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 