import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

// Define the company type
interface Company {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the current user's details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Different query based on user role
    let companies: Company[] = [];
    
    // SUPERADMIN can see all companies
    if (currentUser.role === UserRole.SUPERADMIN) {
      companies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });
    } 
    // ADMIN should only see companies they created
    else if (currentUser.role === UserRole.ADMIN) {
      // Find companies created by this admin
      const companyUsers = await prisma.user.findMany({
        where: {
          role: UserRole.COMPANY,
          createdById: currentUser.id,
        },
        select: {
          id: true,
          companyId: true,
        }
      });
      
      // Get the company IDs associated with these users
      const companyIds = companyUsers
        .filter(user => user.companyId)
        .map(user => user.companyId);

      companies = await prisma.company.findMany({
        where: {
          id: {
            in: companyIds as string[]
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });
    } 
    // Other roles (like COMPANY) should see only their company
    else {
      if (currentUser.role === UserRole.COMPANY) {
        const companyUser = await prisma.user.findUnique({
          where: { id: currentUser.id },
          select: { companyId: true }
        });
        
        if (companyUser?.companyId) {
          const company = await prisma.company.findUnique({
            where: { id: companyUser.companyId },
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            }
          });
          
          if (company) {
            companies = [company];
          }
        }
      }
    }

    // Find company users and add them to the company data
    const companiesWithUsers = await Promise.all(
      companies.map(async (company) => {
        // Find the company user
        const companyUser = await prisma.user.findFirst({
          where: {
            companyId: company.id,
            role: UserRole.COMPANY,
          },
          select: {
            id: true,
          },
        });

        // Count employees for this company
        const employeeCount = await prisma.user.count({
          where: {
            companyId: company.id,
            role: UserRole.EMPLOYEE,
          }
        });

        return {
          id: company.id, // The actual company ID from the companies table
          companyUserId: companyUser?.id, // The User ID with role=COMPANY - important for links
          name: company.name,
          email: company.email,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          _count: {
            employees: employeeCount
          }
        };
      })
    );

    return NextResponse.json(companiesWithUsers);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

// Admin, SuperAdmin, and Employees can view the list of companies
export const GET = withAuth(handler, [
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
  UserRole.EMPLOYEE,
  UserRole.COMPANY
]); 