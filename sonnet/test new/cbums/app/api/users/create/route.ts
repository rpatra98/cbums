import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { hash } from "bcrypt";
import { addActivityLog } from "@/lib/activity-logger";

// Generate a random password with 12 characters
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const body = await req.json();
      
      // Validate required fields
      if (!body.email || !body.name || !body.role) {
        return NextResponse.json(
          { error: "Email, name, and role are required" },
          { status: 400 }
        );
      }
      
      // Get user role and company ID
      const userRole = session?.user.role;
      const userId = session?.user.id;
      
      // Only SuperAdmin and Admin can create users
      if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Only SuperAdmin and Admin can create users" },
          { status: 403 }
        );
      }
      
      // Validate role hierarchy
      if (userRole === UserRole.ADMIN) {
        // Admin can only create COMPANY users
        if (body.role !== UserRole.COMPANY) {
          return NextResponse.json(
            { error: "Admin can only create COMPANY users" },
            { status: 403 }
          );
        }
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email }
      });
      
      if (existingUser) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        );
      }
      
      // Generate a random password
      const password = generateRandomPassword();
      
      // Hash the password
      const hashedPassword = await hash(password, 10);
      
      // Create user with role-specific data
      let userData: any = {
        email: body.email,
        name: body.name,
        password: hashedPassword,
        role: body.role,
        createdById: userId,
      };
      
      // Add role-specific fields
      switch (body.role) {
        case UserRole.COMPANY:
          userData = {
            ...userData,
            company: {
              create: {
                name: body.companyName || body.name,
                address: body.companyAddress || "",
                phone: body.companyPhone || "",
                gstin: body.companyGstin || "",
              }
            }
          };
          break;
          
        case UserRole.EMPLOYEE:
          if (!body.companyId) {
            return NextResponse.json(
              { error: "Company ID is required for employee creation" },
              { status: 400 }
            );
          }
          
          // Verify company exists and is created by this admin
          if (userRole === UserRole.ADMIN) {
            const company = await prisma.user.findFirst({
              where: {
                id: body.companyId,
                role: UserRole.COMPANY,
                createdById: userId
              }
            });
            
            if (!company) {
              return NextResponse.json(
                { error: "Invalid company ID or unauthorized" },
                { status: 400 }
              );
            }
          }
          
          userData = {
            ...userData,
            companyId: body.companyId,
            subrole: body.subrole || EmployeeSubrole.OPERATOR,
            coins: 0
          };
          break;
      }
      
      // Create the user
      const newUser = await prisma.user.create({
        data: userData,
        include: {
          company: true
        }
      });
      
      // Log the activity
      await addActivityLog({
        userId: userId as string,
        action: ActivityAction.CREATE,
        details: {
          entityType: "USER",
          userId: newUser.id,
          userRole: newUser.role,
          userEmail: newUser.email
        },
        targetResourceId: newUser.id,
        targetResourceType: "USER"
      });
      
      // Return success with the generated password
      return NextResponse.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          company: newUser.company
        },
        password // Include the generated password in the response
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN]
); 