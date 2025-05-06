import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    
    const companyId = context.params.id;
    
    // Check if the company exists
    const company = await prisma.user.findUnique({
      where: { 
        id: companyId,
        role: UserRole.COMPANY 
      },
    });
    
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Only allow access to the company itself or admins/superadmins
    if (
      session.user.id !== companyId && 
      session.user.role !== UserRole.SUPERADMIN && 
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Not authorized to view this company's employees" },
        { status: 403 }
      );
    }
    
    // Get employees for the company
    const employees = await prisma.user.findMany({
      where: {
        companyId: companyId,
        role: UserRole.EMPLOYEE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
        coins: true,
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching company employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

// Allow access to authenticated users with appropriate roles
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
]); 