import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole, SessionStatus } from "@/prisma/enums";

// API route specifically for GUARD users to get sessions they should have access to
async function handler(req: NextRequest) {
  try {
    console.log("[API DEBUG] Guard sessions API called");
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This endpoint is only for GUARD users
    if (session.user.role !== UserRole.EMPLOYEE || session.user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "This endpoint is only for GUARD users" },
        { status: 403 }
      );
    }

    // Get the guard's company ID
    const guard = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        companyId: true,
        company: {
          select: { id: true }
        }
      }
    });

    // Get companyId from either direct property or relation
    const guardCompanyId = guard?.companyId || guard?.company?.id;
    
    if (!guardCompanyId) {
      return NextResponse.json(
        { error: "GUARD user is not associated with a company" },
        { status: 400 }
      );
    }

    console.log("[API DEBUG] Guard company ID:", guardCompanyId);

    // Get pagination parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get filter parameters and validate status is a valid enum value
    const statusParamRaw = url.searchParams.get("status");
    // Check if the provided status is a valid SessionStatus enum value
    const statusParam = statusParamRaw && Object.values(SessionStatus).includes(statusParamRaw as SessionStatus)
      ? (statusParamRaw as SessionStatus)
      : SessionStatus.IN_PROGRESS;
    
    // Query for sessions this guard should have access to
    const sessions = await prisma.session.findMany({
      where: {
        companyId: guardCompanyId,
        status: statusParam
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        seal: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }
    });
    
    const totalCount = await prisma.session.count({
      where: {
        companyId: guardCompanyId,
        status: statusParam
      }
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });

  } catch (error) {
    console.error("[API ERROR] Error fetching guard sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard sessions" },
      { status: 500 }
    );
  }
}

// GUARD users can access this endpoint
export const GET = withAuth(handler, [UserRole.EMPLOYEE]); 