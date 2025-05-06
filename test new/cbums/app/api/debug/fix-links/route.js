import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * This endpoint scans for and attempts to fix broken company links in sessions and elsewhere.
 * It helps recover from situations where the application has links to companies that don't exist.
 */
export async function GET() {
  try {
    // Find all valid companies
    const companies = await prisma.user.findMany({
      where: {
        role: "COMPANY",
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (companies.length === 0) {
      return NextResponse.json({
        message: "No companies found in the database",
        suggestion: "Create a company first by visiting /api/debug/setup"
      });
    }

    // Find all sessions that reference non-existent companies
    const sessionsWithMissingCompanies = await prisma.session.findMany({
      where: {
        companyId: {
          notIn: companies.map(c => c.id)
        }
      },
      select: {
        id: true,
        companyId: true,
      }
    });

    // Find all employees with missing company references
    const employeesWithMissingCompanies = await prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        companyId: {
          notIn: [...companies.map(c => c.id), null]
        }
      },
      select: {
        id: true,
        name: true,
        companyId: true,
      }
    });

    // Use the first valid company as fallback
    const fallbackCompany = companies[0];
    const updates = [];

    // Fix sessions with broken company references
    if (sessionsWithMissingCompanies.length > 0) {
      const updateSessions = await prisma.session.updateMany({
        where: {
          id: {
            in: sessionsWithMissingCompanies.map(s => s.id)
          }
        },
        data: {
          companyId: fallbackCompany.id
        }
      });
      
      updates.push({
        type: "sessions",
        count: updateSessions.count,
        newCompanyId: fallbackCompany.id
      });
    }

    // Fix employees with broken company references
    if (employeesWithMissingCompanies.length > 0) {
      const updateEmployees = await prisma.user.updateMany({
        where: {
          id: {
            in: employeesWithMissingCompanies.map(e => e.id)
          }
        },
        data: {
          companyId: fallbackCompany.id
        }
      });
      
      updates.push({
        type: "employees",
        count: updateEmployees.count,
        newCompanyId: fallbackCompany.id
      });
    }

    return NextResponse.json({
      message: "Link check and repair complete",
      companies,
      fixes: {
        sessionsFixed: sessionsWithMissingCompanies.length,
        employeesFixed: employeesWithMissingCompanies.length,
        updates
      },
      suggestion: "Visit /dashboard/companies/list-all to see valid companies",
      fallbackCompany
    });
  } catch (error) {
    console.error("Error in link fixing:", error);
    return NextResponse.json(
      {
        error: "Failed to fix links",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 