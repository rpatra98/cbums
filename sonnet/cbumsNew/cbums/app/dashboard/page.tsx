import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import dynamic from "next/dynamic";
import SessionErrorPage from "@/components/SessionErrorPage";

// Use dynamic imports to prevent chunk loading errors
const SuperAdminDashboard = dynamic(() => import("@/components/dashboard/SuperAdminDashboard"), {
  ssr: true,
  loading: () => <div className="text-center p-8">Loading dashboard...</div>
});

const AdminDashboard = dynamic(() => import("@/components/dashboard/AdminDashboard"), {
  ssr: true,
  loading: () => <div className="text-center p-8">Loading dashboard...</div>
});

const CompanyDashboard = dynamic(() => import("@/components/dashboard/CompanyDashboard"), {
  ssr: true,
  loading: () => <div className="text-center p-8">Loading dashboard...</div>
});

const EmployeeDashboard = dynamic(() => import("@/components/dashboard/EmployeeDashboard"), {
  ssr: true,
  loading: () => <div className="text-center p-8">Loading dashboard...</div>
});

export default async function DashboardPage() {
  // Get session data
  const session = await getServerSession(authOptions);

  // If no session or user ID, redirect to login
  if (!session || !session.user || !session.user.id) {
    console.log("No valid session found, redirecting to login");
    return redirect("/?error=NotAuthenticated");
  }

  try {
    console.log(`Fetching user with ID: ${session.user.id}`);
    
    // Get user with additional info
    const dbUser = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        company: true,
      },
    });

    // If user not found in database, show error page instead of redirecting
    // This breaks the redirect loop
    if (!dbUser) {
      console.log(`User with ID ${session.user.id} not found in database`);
      return <SessionErrorPage />;
    }

    console.log(`User found with role: ${dbUser.role}`);
    
    // Cast the user object to handle type compatibility issues
    // This is necessary because there might be differences between Prisma's enums and our local enums
    const user = dbUser as any;
    
    // Render appropriate dashboard based on user role
    switch (dbUser.role) {
      case 'SUPERADMIN':
        return <SuperAdminDashboard user={user} />;
      case 'ADMIN':
        return <AdminDashboard user={user} />;
      case 'COMPANY':
        return <CompanyDashboard user={user} />;
      case 'EMPLOYEE':
        return <EmployeeDashboard user={user} />;
      default:
        console.log(`Invalid role: ${dbUser.role}`);
        return redirect("/?error=InvalidRole");
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    return redirect("/?error=ServerError");
  }
} 