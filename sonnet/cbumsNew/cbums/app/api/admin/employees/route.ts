import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the requester is an admin or superadmin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Get query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");

    // Build the query
    const where: any = {
      role: UserRole.EMPLOYEE,
    };

    // Filter by company if specified
    if (companyId) {
      where.companyId = companyId;
    }

    // Fetch all employees
    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
        companyId: true,
        createdAt: true,
        coins: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`Found ${employees.length} employees`);
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 