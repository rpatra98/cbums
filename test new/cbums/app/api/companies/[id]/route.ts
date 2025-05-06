import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // First, check if this is a direct company ID
    let company = await prisma.company.findUnique({
      where: { id },
      include: {
        employees: {
          where: { role: UserRole.EMPLOYEE },
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
            coins: true,
            createdAt: true
          }
        }
      }
    });

    // If not found, this might be a User ID with role=COMPANY, so look it up that way
    if (!company) {
      const companyUser = await prisma.user.findFirst({
        where: {
          id,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          name: true,
          email: true,
          companyId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // If we found a company user, get the actual company data
      if (companyUser?.companyId) {
        company = await prisma.company.findUnique({
          where: { id: companyUser.companyId },
          include: {
            employees: {
              where: { role: UserRole.EMPLOYEE },
              select: {
                id: true,
                name: true,
                email: true,
                subrole: true,
                coins: true,
                createdAt: true
              }
            }
          }
        });
      }

      // If we found a company user but no company, create a synthetic company object
      if (companyUser && !company) {
        return NextResponse.json({
          id: companyUser.id,
          companyId: companyUser.companyId,
          name: companyUser.name,
          email: companyUser.email,
          createdAt: companyUser.createdAt,
          updatedAt: companyUser.updatedAt,
          employees: [],
          _synthetic: true
        });
      }
    }

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Failed to fetch company", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 