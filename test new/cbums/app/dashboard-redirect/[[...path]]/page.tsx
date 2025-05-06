import { redirect } from 'next/navigation';

type PathParams = {
  path?: string[];
};

// Make this a client component to ensure redirects work
export const dynamic = 'force-dynamic';

export default function DashboardRedirectPage({
  params
}: {
  params: PathParams;
}) {
  const path = params.path || [];
  
  // Log the path for debugging
  console.log("Dashboard redirect path:", path);
  
  // If no path, redirect to main dashboard
  if (!path || path.length === 0) {
    redirect('/dashboard');
  }

  // Handle companies list
  if (path[0] === 'companies' && path.length === 1) {
    redirect('/dashboard');
  }
  
  // Handle company detail pages
  if (path[0] === 'companies' && path.length > 1) {
    const companyId = path[1];
    redirect(`/dashboard/companies/${companyId}`);
  }

  // Handle employees list
  if (path[0] === 'employees' && path.length === 1) {
    redirect('/dashboard/employees');
  }
  
  // Handle employee detail pages
  if (path[0] === 'employees' && path.length > 1) {
    const employeeId = path[1];
    redirect(`/dashboard/employee/${employeeId}`);
  }
  
  // Default fallback - redirect to dashboard with the full path
  redirect(`/dashboard/${path.join('/')}`);
} 