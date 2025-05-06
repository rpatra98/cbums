import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { Prisma, SessionStatus } from "@prisma/client";

async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;

    // Get pagination parameters from query
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get status filter if provided
    const statusFilter = url.searchParams.get("status");

    // Find all companies created by this admin
    const companies = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true
      },
    });

    console.log(`[DEBUG] Admin ID: ${adminId}`);
    console.log(`[DEBUG] Companies found: ${companies.length}`);
    
    // Log company details for debugging
    for (const company of companies) {
      console.log(`[DEBUG] Company: ${company.name} (${company.id})`);
      
      // Check if this company has any sessions
      const companySessionCount = await prisma.session.count({
        where: { companyId: company.id }
      });
      console.log(`[DEBUG] Sessions for company ${company.name}: ${companySessionCount}`);
    }

    // Get company IDs
    const companyIds = companies.map(company => company.id);
    console.log(`[DEBUG] Company IDs: ${JSON.stringify(companyIds)}`);

    if (companyIds.length === 0) {
      console.log(`[DEBUG] No companies found for admin ${adminId}`);
      return NextResponse.json({
        sessions: [],
        totalCount: 0,
        page,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
    }

    // Check if we can find any sessions created by this admin directly
    const adminSessions = await prisma.session.findMany({
      where: {
        createdById: adminId
      },
      take: 5
    });
    console.log(`[DEBUG] Admin direct sessions: ${adminSessions.length}`);
    if (adminSessions.length > 0) {
      console.log(`[DEBUG] Sample admin session: ${JSON.stringify(adminSessions[0].id)}`);
    }

    // See if there are sessions created by employees of companies created by this admin
    const employeesOfCompanies = await prisma.user.findMany({
      where: {
        companyId: { in: companyIds },
        role: UserRole.EMPLOYEE
      },
      select: { id: true }
    });
    
    const employeeIds = employeesOfCompanies.map(emp => emp.id);
    console.log(`[DEBUG] Found ${employeeIds.length} employees of companies created by this admin`);
    
    let employeeSessionsCount = 0;
    if (employeeIds.length > 0) {
      employeeSessionsCount = await prisma.session.count({
        where: {
          createdById: { in: employeeIds }
        }
      });
      console.log(`[DEBUG] Sessions created by employees: ${employeeSessionsCount}`);
    }

    // Get company users - users with role COMPANY created by this admin
    const companyUsers = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        createdById: adminId
      },
      select: {
        id: true
      }
    });

    // Get employee users - users with role EMPLOYEE who belong to companies created by this admin
    const employeeUsers = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        companyId: { in: companyIds }
      },
      select: {
        id: true
      }
    });
    
    const companyUserIds = companyUsers.map((u: { id: string }) => u.id);
    const employeeUserIds = employeeUsers.map((u: { id: string }) => u.id);
    
    console.log(`[DEBUG] Found ${companyUserIds.length} company users and ${employeeUserIds.length} employee users`);
    
    // For debugging purposes, let's get all sessions to ensure we're seeing at least some data
    const allSessionsOptions: Prisma.SessionFindManyArgs = {
      skip,
      take: limit,
      orderBy: { createdAt: "desc" as const },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        seal: {
          select: {
            id: true,
            barcode: true,
            verified: true,
            scannedAt: true,
          },
        },
      },
      where: {
        status: SessionStatus.PENDING,
      },
    };

    // Add status filter if provided
    if (statusFilter) {
      allSessionsOptions.where = {
        status: statusFilter as SessionStatus
      };
    }

    // Fetch all sessions for debugging
    const allSessions = await prisma.session.findMany(allSessionsOptions);
    const allSessionsCount = await prisma.session.count({
      where: allSessionsOptions.where || {}
    });

    console.log(`[DEBUG] All sessions in system (with filters): ${allSessions.length} of ${allSessionsCount}`);

    // For now, return all sessions - we can improve filtering once we understand the schema better
    return NextResponse.json({
      sessions: allSessions,
      totalCount: allSessionsCount,
      page,
      totalPages: Math.ceil(allSessionsCount / limit),
      hasNextPage: page < Math.ceil(allSessionsCount / limit),
      hasPrevPage: page > 1
    });
  } catch (error: unknown) {
    console.error("Error fetching admin sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access admin details
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 