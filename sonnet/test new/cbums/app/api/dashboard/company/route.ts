import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SessionStatus, UserRole } from "@/prisma/enums";

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    const companyId = session?.user.id;

    // Get company details
    const company = await prisma.user.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
        coins: true,
        createdAt: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get employee count
    const employeeCount = await prisma.user.count({
      where: {
        companyId: companyId,
        role: UserRole.EMPLOYEE,
      },
    });

    // Get sessions by status
    const pendingSessions = await prisma.session.count({
      where: {
        companyId: companyId,
        status: SessionStatus.PENDING,
      },
    });

    const inProgressSessions = await prisma.session.count({
      where: {
        companyId: companyId,
        status: SessionStatus.IN_PROGRESS,
      },
    });

    const completedSessions = await prisma.session.count({
      where: {
        companyId: companyId,
        status: SessionStatus.COMPLETED,
      },
    });

    // Get recent sessions
    const recentSessions = await prisma.session.findMany({
      where: { companyId: companyId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            subrole: true,
          },
        },
        seal: true,
      },
    });

    // Get seal stats
    const verifiedSealsCount = await prisma.seal.count({
      where: {
        session: { companyId: companyId },
        verified: true,
      },
    });

    const unverifiedSealsCount = await prisma.seal.count({
      where: {
        session: { companyId: companyId },
        verified: false,
      },
    });

    // Get recent comments on company's sessions
    const recentComments = await prisma.comment.findMany({
      where: {
        session: { companyId: companyId },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        session: {
          select: {
            id: true,
            source: true,
            destination: true,
          },
        },
      },
    });

    // Get coin transactions
    const coinTransactions = await prisma.coinTransaction.findMany({
      where: {
        OR: [
          { fromUserId: companyId },
          { toUserId: companyId },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      company,
      employees: {
        count: employeeCount,
      },
      sessions: {
        summary: {
          pending: pendingSessions,
          inProgress: inProgressSessions,
          completed: completedSessions,
          total: pendingSessions + inProgressSessions + completedSessions,
        },
        recent: recentSessions,
      },
      seals: {
        verified: verifiedSealsCount,
        unverified: unverifiedSealsCount,
        total: verifiedSealsCount + unverifiedSealsCount,
      },
      comments: recentComments,
      coins: {
        balance: company.coins,
        recentTransactions: coinTransactions,
      },
    });
  } catch (error) {
    console.error("Error fetching company dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only Company users can access this dashboard
export const GET = withAuth(handler, [UserRole.COMPANY]); 