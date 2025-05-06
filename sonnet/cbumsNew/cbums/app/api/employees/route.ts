import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    // First check if there are any employees at all in the database
    try {
      const totalEmployeeCount = await prisma.user.count({
        where: {
          role: UserRole.EMPLOYEE,
        },
      });
      console.log("Total employees in database:", totalEmployeeCount);
    } catch (countErr) {
      console.error("Error counting employees:", countErr);
    }
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from database to access all their properties
    const user = await prisma.user.findUnique({
      where: { 
        id: session.user.id 
      },
      select: {
        id: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log specific user role information for debugging
    console.log("User role information:");
    console.log("- user.role:", user.role);
    console.log("- user.role type:", typeof user.role);
    console.log("- UserRole.ADMIN:", UserRole.ADMIN);
    console.log("- UserRole.ADMIN type:", typeof UserRole.ADMIN);
    console.log("- user.role === UserRole.ADMIN:", user.role === UserRole.ADMIN);
    console.log("- user.role === 'ADMIN':", user.role === 'ADMIN');
    console.log("- roles are string comparison:", String(user.role) === String(UserRole.ADMIN));

    // Get the company ID from the query parameters or determine from the session
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId");
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    console.log(`User role: ${user.role}, User ID: ${user.id}, User companyId: ${user.companyId}`);
    console.log(`Requested companyId from query: ${companyId}`);

    // For SUPERADMIN, allow fetching all employees if no companyId is specified
    if ((!companyId) && (user.role === UserRole.SUPERADMIN)) {
      console.log("SuperAdmin fetching all employees");
      
      try {
        const allEmployees = await prisma.user.findMany({
          where: {
            role: UserRole.EMPLOYEE,
          },
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
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
        
        console.log(`Found ${allEmployees.length} employees total`);
        return NextResponse.json(allEmployees);
      } catch (dbError) {
        console.error("Database error fetching all employees:", dbError);
        throw dbError;
      }
    }
    
    // For ADMIN, only fetch employees they created if no companyId specified
    if ((!companyId) && (user.role === UserRole.ADMIN)) {
      console.log("Admin fetching their created employees");
      
      try {
        // Find companies created by this admin
        const createdCompanyUsers = await prisma.user.findMany({
          where: {
            role: UserRole.COMPANY,
            createdById: user.id,
          },
          select: {
            companyId: true,
          }
        });
        
        // Get the company IDs associated with these users
        const companyIds = createdCompanyUsers
          .filter(companyUser => companyUser.companyId)
          .map(companyUser => companyUser.companyId);
        
        // Find employees for these companies or directly created by admin
        const adminEmployees = await prisma.user.findMany({
          where: {
            role: UserRole.EMPLOYEE,
            OR: [
              // Employees whose company was created by this admin
              {
                companyId: {
                  in: companyIds as string[]
                }
              },
              // Employees directly created by this admin
              {
                createdById: user.id
              }
            ]
          },
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
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
        
        console.log(`Found ${adminEmployees.length} employees for admin ${user.id}`);
        return NextResponse.json(adminEmployees);
      } catch (dbError) {
        console.error("Database error fetching admin employees:", dbError);
        throw dbError;
      }
    }

    // Handle different user roles to determine the company ID
    if (!companyId) {
      if (user.role === UserRole.COMPANY) {
        // For COMPANY role, we need to:
        // 1. Find the actual company ID since the user.id is not the company ID
        // 2. Find all employees associated with this company
        
        const companyUser = await prisma.user.findFirst({
          where: { 
            id: user.id,
            role: UserRole.COMPANY
          },
          select: {
            companyId: true,
          }
        });
        
        if (companyUser && companyUser.companyId) {
          companyId = companyUser.companyId;
        } else {
          // If no companyId found, use the user's ID as they might be directly
          // associated with a company
          companyId = user.id;
        }
        
        console.log("Company user, using companyId:", companyId);
      } else if (user.role === UserRole.EMPLOYEE && user.companyId) {
        // If the user is an employee, use their company ID
        companyId = user.companyId;
        console.log("Employee user, using companyId:", companyId);
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    // If an admin requests specific company's employees, ensure they created that company
    if (user.role === UserRole.ADMIN && companyId) {
      const companyUser = await prisma.user.findFirst({
        where: {
          companyId: companyId,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          createdById: true
        }
      });
      
      // Only allow access if admin created this company
      if (companyUser && companyUser.createdById !== user.id) {
        return NextResponse.json({ error: "You don't have permission to view employees for this company" }, { status: 403 });
      }
    }

    // Check if the requesting user has permission to view these employees
    const hasPermission = 
      user.role === UserRole.SUPERADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.COMPANY && (user.id === companyId || user.companyId === companyId)) ||
      (user.role === UserRole.EMPLOYEE && user.companyId === companyId);

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("Fetching employees for company:", companyId);

    // Fetch employees for the company
    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        companyId: companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
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

    console.log(`Found ${employees.length} employees for company ${companyId}`);
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 