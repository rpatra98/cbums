import prisma from "@/lib/prisma";
import { ActivityAction } from "@/prisma/enums";

type ActivityLogParams = {
  userId: string;
  action: ActivityAction;
  details?: Record<string, any>;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Adds an entry to the activity log
 */
export async function addActivityLog({
  userId,
  action,
  details = {},
  targetUserId,
  targetResourceId,
  targetResourceType,
  ipAddress,
  userAgent,
}: ActivityLogParams) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        targetUserId,
        targetResourceId,
        targetResourceType,
        ipAddress,
        userAgent,
      },
    });
    
    return log;
  } catch (error) {
    console.error("Failed to create activity log:", error);
    // We don't want to fail the main operation if logging fails
    return null;
  }
}

/**
 * Wraps a database operation with activity logging
 * @param operation The database operation to perform
 * @param logParams Parameters for the activity log
 * @returns The result of the database operation
 */
export async function withActivityLog<T>(
  operation: () => Promise<T>,
  logParams: ActivityLogParams
): Promise<T> {
  try {
    // Perform the database operation
    const result = await operation();
    
    // Log the activity (don't await to avoid blocking)
    addActivityLog(logParams).catch(error => {
      console.error("Failed to log activity:", error);
    });
    
    return result;
  } catch (error) {
    // If the operation fails, we still want to propagate the error
    throw error;
  }
}

/**
 * Gets activity logs with flexible filtering
 */
export async function getActivityLogs({
  userId,
  userIds,
  action,
  fromDate,
  toDate,
  targetUserId,
  targetResourceId,
  targetResourceType,
  page = 1,
  limit = 20,
  customWhere,
  includeAuthActivities = true,
}: {
  userId?: string;
  userIds?: string[];
  action?: ActivityAction;
  fromDate?: Date;
  toDate?: Date;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  page?: number;
  limit?: number;
  customWhere?: any;
  includeAuthActivities?: boolean;
}) {
  const skip = (page - 1) * limit;
  
  const whereClause: any = {};
  
  // Handle user ID filtering - either single ID or multiple IDs
  if (userId) {
    whereClause.userId = userId;
  } else if (userIds && userIds.length > 0) {
    whereClause.userId = {
      in: userIds
    };
  }
  
  // Special handling for action to ensure LOGIN/LOGOUT are included
  if (action) {
    whereClause.action = action;
  } else if (!includeAuthActivities) {
    // If includeAuthActivities is false, exclude LOGIN/LOGOUT activities
    whereClause.action = {
      notIn: [ActivityAction.LOGIN, ActivityAction.LOGOUT]
    };
  }
  // Otherwise, if includeAuthActivities is true and no specific action is requested,
  // don't add any action filter - this allows all action types including LOGIN/LOGOUT
  
  if (targetUserId) {
    whereClause.targetUserId = targetUserId;
  }
  
  if (targetResourceId) {
    whereClause.targetResourceId = targetResourceId;
  }
  
  if (targetResourceType) {
    whereClause.targetResourceType = targetResourceType;
  }
  
  if (fromDate || toDate) {
    whereClause.createdAt = {};
    
    if (fromDate) {
      whereClause.createdAt.gte = fromDate;
    }
    
    if (toDate) {
      whereClause.createdAt.lte = toDate;
    }
  }
  
  // If we have a custom where clause, merge it with our existing conditions
  let finalWhereClause = whereClause;
  if (customWhere) {
    finalWhereClause = {
      AND: [
        whereClause,
        customWhere
      ]
    };
  }
  
  // Log the final query for debugging
  console.log("Final activity logs query:", JSON.stringify(finalWhereClause, null, 2));
  
  // Additional debug to check for LOGIN/LOGOUT activities regardless of filters
  const loginActivitiesCount = await prisma.activityLog.count({
    where: { action: ActivityAction.LOGIN },
  });
  
  const logoutActivitiesCount = await prisma.activityLog.count({
    where: { action: ActivityAction.LOGOUT },
  });
  
  console.log(`Database contains: ${loginActivitiesCount} LOGIN and ${logoutActivitiesCount} LOGOUT activities`);
  
  const [logs, totalCount] = await Promise.all([
    prisma.activityLog.findMany({
      where: finalWhereClause,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where: finalWhereClause }),
  ]);
  
  // Log what we found for debugging
  console.log(`Found ${logs.length} logs, actions:`, logs.map(log => log.action));
  
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    logs,
    meta: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
} 