import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";

// Type definition for our withAuth middleware
type WithAuthHandlerFn = (
  req: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

// Middleware to protect API routes by role
export function withAuth(handler: WithAuthHandlerFn, allowedRoles: UserRole[]) {
  return async (
    req: NextRequest,
    context?: any
  ) => {
    try {
      const session = await getServerSession(authOptions);
      
      console.log("Auth middleware session:", session ? "Valid" : "None", 
                  "User:", session?.user?.email,
                  "Role:", session?.user?.role);

      if (!session || !session.user) {
        console.error("Auth failed: No session or user");
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Check if user has the required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role as UserRole)) {
        console.error(`Auth failed: Role ${session.user.role} not in allowed roles:`, allowedRoles);
        return NextResponse.json(
          { error: "You don't have permission to access this resource" },
          { status: 403 }
        );
      }

      // User is authenticated and has the required role, proceed
      return handler(req, context);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Authentication error occurred" },
        { status: 500 }
      );
    }
  };
}

// Check if user has a specific role
export function hasRole(role: UserRole, session: any) {
  return session?.user?.role === role;
}

// Check if user has any of the specified roles
export function hasAnyRole(roles: UserRole[], session: any) {
  return session?.user?.role && roles.includes(session.user.role as UserRole);
} 