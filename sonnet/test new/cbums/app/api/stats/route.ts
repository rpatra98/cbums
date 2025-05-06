import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler() {
  try {
    // Get total sessions count
    const totalSessions = await prisma.session.count();
    
    // Get sessions by status
    const sessionsByStatus = await prisma.session.groupBy({
      by: ['status'],
      _count: true
    });
    
    // Get total users count
    const totalUsers = await prisma.user.count();
    
    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });
    
    // Get total companies count
    const totalCompanies = await prisma.user.count({
      where: {
        role: UserRole.COMPANY
      }
    });
    
    // Get total seals count
    const totalSeals = await prisma.seal.count();
    
    // Get verified vs unverified seals
    const sealsByVerification = await prisma.seal.groupBy({
      by: ['verified'],
      _count: true
    });
    
    return NextResponse.json({
      sessions: {
        total: totalSessions,
        byStatus: sessionsByStatus
      },
      users: {
        total: totalUsers,
        byRole: usersByRole
      },
      companies: {
        total: totalCompanies
      },
      seals: {
        total: totalSeals,
        byVerification: sealsByVerification
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

// Only superadmins can access stats
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 