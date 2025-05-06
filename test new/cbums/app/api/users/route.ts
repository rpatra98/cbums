import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";

interface WhereClause {
  role?: UserRole;
  companyId?: string | { in: string[] };
  createdById?: string;
  OR?: Array<{
    role?: UserRole;
    companyId?: string | { in: string[] };
    createdById?: string;
    name?: { contains: string; mode: 'insensitive' };
    email?: { contains: string; mode: 'insensitive' };
  }>;
}

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userRole = session.user.role;
    const userId = session.user.id;
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const role = searchParams.get('role') as UserRole | null;
    const search = searchParams.get('search');
    
    // Build where clause based on user role
    const whereClause: WhereClause = {};
    
    if (userRole === UserRole.SUPERADMIN) {
      // SuperAdmin can see all users
      whereClause.role = role || undefined;
    } else if (userRole === UserRole.ADMIN) {
      // Admin can only see users from companies they created
      const companiesCreatedByAdmin = await prisma.user.findMany({
        where: {
          role: UserRole.COMPANY,
          createdById: userId,
        },
        select: {
          id: true,
          companyId: true,
        }
      });
      
      const companyIds = companiesCreatedByAdmin
        .filter(company => company.companyId)
        .map(company => company.companyId);
        
      const companyUserIds = companiesCreatedByAdmin.map(company => company.id);
      
      whereClause.OR = [
        { role: UserRole.COMPANY, createdById: userId },
        { role: UserRole.EMPLOYEE, companyId: { in: [...new Set([...companyIds, ...companyUserIds])].filter(Boolean) as string[] } }
      ];
      
      if (role) {
        whereClause.role = role;
      }
    } else if (userRole === UserRole.COMPANY) {
      // Company can only see their employees
      whereClause.role = UserRole.EMPLOYEE;
      whereClause.companyId = userId;
    }
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count for pagination
    const total = await prisma.user.count({
      where: whereClause
    });
    
    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });
    
    // Remove sensitive fields
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    // Log the user list view activity
    await addActivityLog({
      userId: userId,
      action: ActivityAction.VIEW,
      details: {
        resourceType: "USER_LIST",
        filters: {
          search: search || undefined,
          role: role || undefined,
          page,
          limit
        },
        resultCount: users.length,
        totalCount: total
      },
      targetResourceType: "USER_LIST"
    });
    
    return NextResponse.json({
      users: usersWithoutPassword,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// All authenticated users can access users list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY
]); 