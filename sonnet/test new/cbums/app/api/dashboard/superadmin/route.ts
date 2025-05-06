import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler() {
  try {
    // Get recent sessions with status breakdown
    const sessions = await prisma.session.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
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
    });

    // Get session status counts
    const pendingCount = await prisma.session.count({
      where: { status: "PENDING" },
    });

    const inProgressCount = await prisma.session.count({
      where: { status: "IN_PROGRESS" },
    });

    const completedCount = await prisma.session.count({
      where: { status: "COMPLETED" },
    });

    // Get total sessions count
    const totalSessions = await prisma.session.count();

    // Get coin transaction logs
    const coinTransactions = await prisma.coinTransaction.findMany({
      take: 20,
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

    // Get system stats
    const totalAdmins = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });

    const totalCompanies = await prisma.user.count({
      where: { role: UserRole.COMPANY },
    });

    const totalEmployees = await prisma.user.count({
      where: { role: UserRole.EMPLOYEE },
    });

    // Total coins in the system
    const totalCoins = await prisma.user.aggregate({
      _sum: {
        coins: true,
      },
    });

    return NextResponse.json({
      sessions: {
        recent: sessions,
        stats: {
          total: totalSessions,
          pending: pendingCount,
          inProgress: inProgressCount,
          completed: completedCount,
        },
      },
      coinFlow: {
        recent: coinTransactions,
        totalCoins: totalCoins._sum.coins || 0,
      },
      systemStats: {
        admins: totalAdmins,
        companies: totalCompanies,
        employees: totalEmployees,
      },
    });
  } catch (error) {
    console.error("Error fetching superadmin dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access this dashboard
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 