import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session.user.id;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const userRole = session.user.role;
    const currentUserId = session.user.id;

    // Check if the user has permission to see this user's transactions
    if (userId !== currentUserId && userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "You don't have permission to view this user's transactions" },
        { status: 403 }
      );
    }

    // Query transactions
    const whereClause = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
    };

    // Get total count for pagination
    const totalCount = await prisma.coinTransaction.count({
      where: whereClause,
    });

    // Get transactions with pagination
    const transactions = await prisma.coinTransaction.findMany({
      where: whereClause,
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching coin transaction history:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch coin transaction history",
        transactions: [],
        pagination: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }
      },
      { status: 500 }
    );
  }
}

// Allow all authenticated users to access transaction history
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 