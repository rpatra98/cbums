import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { getActivityLogs } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { Prisma, ActivityLog } from "@prisma/client";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const userId = url.searchParams.get("userId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const targetResourceType = url.searchParams.get("targetResourceType") || undefined;
    const targetResourceId = url.searchParams.get("targetResourceId") || undefined;
    const deviceType = url.searchParams.get("deviceType") || undefined;
    
    // Parse date parameters if provided
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (url.searchParams.get("fromDate")) {
      fromDate = new Date(url.searchParams.get("fromDate")!);
    }
    
    if (url.searchParams.get("toDate")) {
      toDate = new Date(url.searchParams.get("toDate")!);
    }
    
    // Filter options based on user role
    const userIds: string[] = [];
    
    // SUPERADMIN can see activity for all users - no filtering needed
    if (session.user.role === UserRole.SUPERADMIN) {
      // If a specific userId filter was requested, use that
      if (userId) {
        userIds.push(userId);
      }
    }
    // ADMIN can see activity for users they created, so get those user IDs
    else if (session.user.role === UserRole.ADMIN) {
      if (userId) {
        // Check if this admin created the requested user
        const requestedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdById: true }
        });
        
        if (requestedUser?.createdById === session.user.id) {
          userIds.push(userId);
        } else {
          // If they didn't create this user, they can't see their activity
          return NextResponse.json({
            logs: [],
            meta: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false,
            }
          });
        }
      } else {
        // Get all users created by this admin
        const createdUsers = await prisma.user.findMany({
          where: { createdById: session.user.id },
          select: { id: true }
        });
        
        // Add admin's own ID plus IDs of users they created
        userIds.push(session.user.id, ...createdUsers.map(user => user.id));
      }
    }
    // COMPANY can see activity for their employees
    else if (session.user.role === UserRole.COMPANY) {
      if (userId) {
        // Check if this employee belongs to this company
        const employee = await prisma.user.findUnique({
          where: { 
            id: userId,
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        if (employee) {
          userIds.push(userId);
        } else {
          // If this isn't their employee, they should only see their own activity
          userIds.push(session.user.id);
        }
      } else {
        // Get all employees for this company
        const employees = await prisma.user.findMany({
          where: { 
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        // Add company's own ID plus IDs of their employees
        userIds.push(session.user.id, ...employees.map(emp => emp.id));
      }
    }
    // EMPLOYEE can only see their own activity
    else {
      userIds.push(session.user.id);
    }
    
    // Get activity logs based on filtered user IDs
    let result: {
      logs: ActivityLog[];
      meta: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };

    if (userIds.length > 0) {
      // Custom filtering for deviceType if provided
      let customWhere: Prisma.ActivityLogWhereInput | undefined = undefined;
      
      if (deviceType && (deviceType === 'mobile' || deviceType === 'desktop')) {
        // We need a custom where clause for this because it's within JSON
        customWhere = {
          OR: [
            {
              // Check device type in details JSON field (for newer format)
              details: {
                path: ['device'],
                equals: deviceType
              }
            },
            {
              // For login/logout activity with specific device type
              AND: [
                {
                  action: {
                    in: ['LOGIN', 'LOGOUT']
                  }
                },
                {
                  // Filter by userAgent for legacy records
                  userAgent: deviceType === 'mobile' 
                    ? { contains: 'mobile|android|iphone|ipad|ipod|blackberry', mode: 'insensitive' }
                    : { not: { contains: 'mobile|android|iphone|ipad|ipod|blackberry' } }
                }
              ]
            }
          ]
        };
      }
      
      // Log the query parameters to debug
      console.log("Activity logs query parameters:", {
        userId: userIds.length === 1 ? userIds[0] : undefined,
        userIds: userIds.length > 1 ? userIds : undefined,
        action,
        fromDate,
        toDate,
        deviceType
      });
      
      result = await getActivityLogs({
        action: action as ActivityAction | undefined,
        fromDate,
        toDate,
        targetResourceId,
        targetResourceType,
        page,
        limit,
        // Use the userIds we've collected based on permissions
        userId: userIds.length === 1 ? userIds[0] : undefined,
        // Only set if we have multiple IDs
        userIds: userIds.length > 1 ? userIds : undefined,
        // Pass the custom where clause for device type filtering
        customWhere,
        // CRITICAL: Always include auth activities by default
        includeAuthActivities: true
      });
    } else {
      // No visible users, return empty result
      result = {
        logs: [],
        meta: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: false,
        }
      };
    }
    
    // Debug log to help diagnose the issue
    if (result && result.logs) {
      console.log(`Returning ${result.logs.length} logs. Types:`, 
        [...new Set(result.logs.map((log: ActivityLog) => log.action))].join(', '));
      
      // Check specifically for login/logout activities
      const authActivities = result.logs.filter((log: ActivityLog) => 
        log.action === ActivityAction.LOGIN || log.action === ActivityAction.LOGOUT);
      console.log(`Auth activities in results: ${authActivities.length}`);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// Allow only authenticated users
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 