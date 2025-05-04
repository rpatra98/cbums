import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { ActivityAction, EmployeeSubrole, UserRole } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { name, email, password, role, subrole, companyId, phone, address } = body;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const currentUserId = session.user.id;

    // Validation
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Email duplicate check
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Role-based validation
    const currentUserRole = session?.user.role;

    // Only SuperAdmin can create Admin
    if (role === UserRole.ADMIN && currentUserRole !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "Only SuperAdmin can create Admin users" },
        { status: 403 }
      );
    }

    // Only Admin can create Companies and Employees
    if (
      (role === UserRole.COMPANY || role === UserRole.EMPLOYEE) &&
      currentUserRole !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Only Admin can create Companies or Employees" },
        { status: 403 }
      );
    }

    // For Companies, create both a Company record and a User
    if (role === UserRole.COMPANY) {
      // Create the Company record
      const company = await prisma.company.create({
        data: {
          name,
          email,
          address,
          phone,
        },
      });

      // Hash the password
      const hashedPassword = await hash(password, 12);

      // Create the User for the company
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: UserRole.COMPANY,
          companyId: company.id,
          createdById: currentUserId,
        },
      });

      // Log company creation
      await addActivityLog({
        userId: currentUserId,
        action: ActivityAction.CREATE,
        details: {
          role: UserRole.COMPANY,
          companyName: name,
          companyId: company.id,
        },
        targetUserId: user.id,
        targetResourceId: user.id,
        targetResourceType: "USER",
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json(
        { user: userWithoutPassword, company },
        { status: 201 }
      );
    } 
    // For Employees
    else if (role === UserRole.EMPLOYEE) {
      // Validate
      if (!companyId) {
        return NextResponse.json(
          { error: "Company ID is required for employees" },
          { status: 400 }
        );
      }

      if (!subrole) {
        return NextResponse.json(
          { error: "Subrole is required for employees" },
          { status: 400 }
        );
      }

      // Check if company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }

      // Hash password
      const hashedPassword = await hash(password, 12);

      // Create the employee
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: UserRole.EMPLOYEE,
          subrole: subrole as EmployeeSubrole,
          companyId,
          createdById: currentUserId,
        },
      });

      // Log employee creation
      await addActivityLog({
        userId: currentUserId,
        action: ActivityAction.CREATE,
        details: {
          role: UserRole.EMPLOYEE,
          subrole: subrole,
          companyId: companyId,
          companyName: company.name,
        },
        targetUserId: user.id,
        targetResourceId: user.id,
        targetResourceType: "USER",
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json(userWithoutPassword, { status: 201 });
    } 
    // For Admin or SuperAdmin
    else {
      // Hash password
      const hashedPassword = await hash(password, 12);

      // Create admin or superadmin
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          createdById: currentUserId,
        },
      });

      // Log admin creation
      await addActivityLog({
        userId: currentUserId,
        action: ActivityAction.CREATE,
        details: {
          role: role,
        },
        targetUserId: user.id,
        targetResourceId: user.id,
        targetResourceType: "USER",
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json(userWithoutPassword, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// Protect this route - only authenticated users with specific roles can access it
export const POST = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
]); 