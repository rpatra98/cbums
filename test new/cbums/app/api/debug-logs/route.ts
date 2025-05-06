import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import prisma from "@/lib/prisma";

/**
 * Debug endpoint to check if login/logout activities exist in the database
 */
async function handler() {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow all user roles to use this endpoint during debugging
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check for login/logout activities in the database
    const loginActivities = await prisma.activityLog.findMany({
      where: { action: ActivityAction.LOGIN },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    const logoutActivities = await prisma.activityLog.findMany({
      where: { action: ActivityAction.LOGOUT },
      take: 10, 
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    // Count total login/logout activities
    const loginCount = await prisma.activityLog.count({
      where: { action: ActivityAction.LOGIN }
    });
    
    const logoutCount = await prisma.activityLog.count({
      where: { action: ActivityAction.LOGOUT }
    });
    
    // Get the current user's activities, regardless of the role-based permissions
    // This helps determine if the issue is with permissions or data
    const currentUserActivities = await prisma.activityLog.findMany({
      where: { 
        userId: session.user.id,
        action: { in: [ActivityAction.LOGIN, ActivityAction.LOGOUT] }  
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    
    // Return comprehensive debug information
    return NextResponse.json({
      loginActivities: loginActivities.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name,
        email: log.user?.email,
        createdAt: log.createdAt,
        details: log.details,
        userAgent: log.userAgent
      })),
      logoutActivities: logoutActivities.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.user?.name,
        email: log.user?.email,
        createdAt: log.createdAt,
        details: log.details,
        userAgent: log.userAgent
      })),
      currentUserActivities,
      counts: {
        login: loginCount,
        logout: logoutCount
      },
      currentUser: {
        id: session.user.id,
        role: session.user.role
      }
    });
  } catch (error) {
    console.error("Error checking activity logs:", error);
    return NextResponse.json(
      { error: "Failed to check activity logs", details: String(error) },
      { status: 500 }
    );
  }
}

// Allow all authenticated users during debugging
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE
]); 