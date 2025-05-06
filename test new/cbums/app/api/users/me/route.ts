import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/lib/types";

export const GET = withAuth(
  async () => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Get user details with company info
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          company: true
        }
      });
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      // Remove sensitive fields
      const { password, ...userWithoutPassword } = user;
      
      return NextResponse.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user details:", error);
      return NextResponse.json(
        { error: "Failed to fetch user details" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 