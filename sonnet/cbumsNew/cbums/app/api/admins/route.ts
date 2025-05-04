import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    // Fetch all admin users
    const admins = await prisma.user.findMany({
      where: {
        role: UserRole.ADMIN
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdUsers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      admins: admins.map(admin => ({
        ...admin,
        hasCreatedResources: admin._count.createdUsers > 0
      }))
    });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access list of admins
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 