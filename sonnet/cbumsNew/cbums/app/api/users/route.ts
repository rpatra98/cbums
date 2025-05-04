import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    const userRole = session.user.role;
    
    // Parse query parameters
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const roleFilter = url.searchParams.get("role") || "";
    const companyId = url.searchParams.get("companyId") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const skip = (page - 1) * limit;
    
    // Build the where clause based on filters
    let whereClause: any = {
      // Exclude the current user
      id: { not: userId },
    };
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Add role filter if provided
    if (roleFilter && Object.values(UserRole).includes(roleFilter as UserRole)) {
      whereClause.role = roleFilter;
    }
    
    // Filter by company for COMPANY role users
    if (userRole === UserRole.COMPANY) {
      // Company users can only see their employees
      whereClause.companyId = session.user.companyId;
    } else if (companyId) {
      // Others can filter by company if provided
      whereClause.companyId = companyId;
    }
    
    // Count total users for pagination
    const totalCount = await prisma.user.count({ where: whereClause });
    
    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    });
    
    // Log the user list view activity
    await addActivityLog({
      userId: userId,
      action: ActivityAction.VIEW,
      details: {
        resourceType: "USER_LIST",
        filters: {
          search: search || undefined,
          role: roleFilter || undefined,
          companyId: companyId || undefined,
          page,
          limit
        },
        resultCount: users.length,
        totalCount
      },
      targetResourceType: "USER_LIST"
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    
    return NextResponse.json({
      users,
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
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// Allow all authenticated users to access this endpoint
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 