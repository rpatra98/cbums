import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest) {
  try {
    // Update the existing superadmin's coin balance
    const updatedUser = await prisma.user.updateMany({
      where: {
        role: UserRole.SUPERADMIN,
      },
      data: {
        coins: 1000000, // Set to 1 million
      },
    });

    return NextResponse.json({
      success: true,
      message: "SuperAdmin coin balance updated to 1 million",
      updatedCount: updatedUser.count
    });
  } catch (error) {
    console.error("Error updating SuperAdmin coins:", error);
    return NextResponse.json(
      { error: "Failed to update SuperAdmin coin balance" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access this endpoint
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 