import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ActivityAction, UserRole } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handleGet(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;

    // Get admin user details
    const admin = await prisma.user.findUnique({
      where: { 
        id: adminId,
        role: UserRole.ADMIN 
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        coins: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Find companies created by this admin by querying users with createdById field
    const companies = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Find employees created by this admin by querying users with createdById field
    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        coins: true,
        role: true,
        company: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ...admin,
      createdCompanies: companies,
      createdEmployees: employees,
      stats: {
        totalCompanies: companies.length,
        totalEmployees: employees.length,
      }
    });
  } catch (error) {
    console.error("Error fetching admin details:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin details" },
      { status: 500 }
    );
  }
}

async function handleDelete(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;

    // Check if the admin exists and is actually an ADMIN
    const admin = await prisma.user.findUnique({
      where: {
        id: adminId,
        role: UserRole.ADMIN
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            createdUsers: true
          }
        }
      }
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Check if admin has created any resources (companies, employees)
    if (admin._count.createdUsers > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete admin user with created resources. Reassign or delete their resources first.",
          resourceCount: admin._count.createdUsers
        },
        { status: 400 }
      );
    }

    // Delete the admin user
    await prisma.user.delete({
      where: {
        id: adminId
      }
    });

    // Log the activity
    await addActivityLog({
      userId: session.user.id,
      action: ActivityAction.DELETE,
      details: {
        entityType: "USER",
        entityRole: "ADMIN",
        entityName: admin.name,
        entityEmail: admin.email
      },
      targetResourceId: adminId,
      targetResourceType: "USER"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Failed to delete admin user" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access admin details
export const GET = withAuth(handleGet, [UserRole.SUPERADMIN]);

// Only SuperAdmin can delete admin
export const DELETE = withAuth(handleDelete, [UserRole.SUPERADMIN]); 