import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler() {
  try {
    // Get all superadmins
    const superadmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPERADMIN
      }
    });

    // Update coins for each superadmin
    const updatePromises = superadmins.map(superadmin => 
      prisma.user.update({
        where: { id: superadmin.id },
        data: { coins: 1000 } // Set to 1000 coins
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: "Superadmin coins updated successfully",
      updatedCount: superadmins.length
    });
  } catch (error) {
    console.error("Error updating superadmin coins:", error);
    return NextResponse.json(
      { error: "Failed to update superadmin coins" },
      { status: 500 }
    );
  }
}

// Only superadmins can update superadmin coins
export const POST = withAuth(handler, [UserRole.SUPERADMIN]); 