import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@/prisma/enums";

export async function GET() {
  try {
    // Check if we already have a company
    const existingCompanies = await prisma.user.findMany({
      where: {
        role: "COMPANY"
      },
      take: 5
    });

    // If there are already companies, just return them
    if (existingCompanies.length > 0) {
      return NextResponse.json({
        message: "Companies already exist",
        companies: existingCompanies.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          url: `/dashboard/companies/${c.id}`
        }))
      });
    }

    // Create a test company
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const newCompany = await prisma.user.create({
      data: {
        name: "Test Company",
        email: "test@company.com",
        password: hashedPassword,
        role: "COMPANY",
        coins: 0
      }
    });

    return NextResponse.json({
      message: "Test company created successfully",
      company: {
        id: newCompany.id,
        name: newCompany.name,
        email: newCompany.email,
        url: `/dashboard/companies/${newCompany.id}`
      }
    });
  } catch (error) {
    console.error("Error in debug setup:", error);
    return NextResponse.json(
      {
        error: "Failed to set up debug data",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 