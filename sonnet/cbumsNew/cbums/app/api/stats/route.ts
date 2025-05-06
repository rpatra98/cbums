import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest) {
  try {
    // Get total users count by role
    const totalAdmins = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });

    const totalCompanies = await prisma.user.count({
      where: { role: UserRole.COMPANY },
    });

    const totalEmployees = await prisma.user.count({
      where: { role: UserRole.EMPLOYEE },
    });

    const totalUsers = totalAdmins + totalCompanies + totalEmployees + 1; // +1 for superadmin

    // Total coins in the system
    const totalCoins = await prisma.user.aggregate({
      _sum: {
        coins: true,
      },
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        totalAdmins,
        totalCompanies,
        totalEmployees,
        totalCoins: totalCoins._sum.coins || 0,
      }
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch system stats" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access system stats
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 