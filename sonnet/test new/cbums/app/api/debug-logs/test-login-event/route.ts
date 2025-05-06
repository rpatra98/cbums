import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { detectDevice } from "@/lib/utils";

/**
 * Debug endpoint to create test login/logout events
 */
async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get the action type from query params (defaults to LOGIN)
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") === "LOGOUT" 
      ? ActivityAction.LOGOUT 
      : ActivityAction.LOGIN;
    
    const userAgent = req.headers.get("user-agent") || "unknown";
    const deviceInfo = detectDevice(userAgent);
    
    // Create a test login/logout event for the current user
    const activityLog = await addActivityLog({
      userId: session.user.id,
      action: action,
      details: {
        method: "test-event",
        device: deviceInfo.type,
        deviceDetails: deviceInfo
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: userAgent
    });
    
    return NextResponse.json({
      success: true,
      message: `Created test ${action} activity`,
      log: activityLog
    });
  } catch (error) {
    console.error("Error creating test activity:", error);
    return NextResponse.json(
      { error: "Failed to create test activity", details: String(error) },
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