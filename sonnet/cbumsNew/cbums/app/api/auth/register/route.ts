import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, subrole, companyId } = body;

    // Validation
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Role-based validation and logic
    const session = await getServerSession(authOptions);
    
    // If no session, only allow SuperAdmin creation (first user)
    if (!session) {
      const userCount = await prisma.user.count();
      if (userCount > 0 || role !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Unauthorized to create this user type" },
          { status: 401 }
        );
      }
    } else {
      // Role-based access control
      const currentUserRole = session.user.role;

      // RULE: Only SuperAdmin can create Admin
      if (role === UserRole.ADMIN && currentUserRole !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Only SuperAdmin can create Admin users" },
          { status: 403 }
        );
      }

      // RULE: Only Admin can create Companies or Employees
      if (
        (role === UserRole.COMPANY || role === UserRole.EMPLOYEE) && 
        currentUserRole !== UserRole.ADMIN
      ) {
        return NextResponse.json(
          { error: "Only Admin can create Companies or Employees" },
          { status: 403 }
        );
      }

      // RULE: Employees must belong to a company
      if (role === UserRole.EMPLOYEE && !companyId) {
        return NextResponse.json(
          { error: "Employees must belong to a company" },
          { status: 400 }
        );
      }

      // RULE: Employees must have a valid subrole
      if (role === UserRole.EMPLOYEE && !subrole) {
        return NextResponse.json(
          { error: "Employees must have a subrole" },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        subrole: role === UserRole.EMPLOYEE ? subrole as EmployeeSubrole : null,
        companyId: role === UserRole.EMPLOYEE ? companyId : null,
        createdById: session?.user.id,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
} 