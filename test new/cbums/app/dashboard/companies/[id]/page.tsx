import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import Link from "next/link";

// Add dynamic export to ensure Next.js treats this as a dynamic route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const companyId = params.id;
  
  // Debug output
  console.log("Company ID from params:", companyId);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      redirect("/");
    }

    // Get user with detailed information
    const dbUser = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    });

    if (!dbUser) {
      redirect("/");
    }

    // Check authorization - only ADMIN and SUPERADMIN can view
    if (dbUser.role !== UserRole.ADMIN && dbUser.role !== UserRole.SUPERADMIN) {
      redirect("/dashboard");
    }

    // Get company details
    const company = await prisma.user.findUnique({
      where: {
        id: companyId,
        role: UserRole.COMPANY,
      },
    });

    // Debug output
    console.log("Company found:", company ? "Yes" : "No");

    if (!company) {
      // Return debugging info instead of 404
      return (
        <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
          <h1 className="text-2xl font-bold text-red-700">Company Not Found</h1>
          <p className="mt-2">The company with ID: {companyId} was not found in the database.</p>
          <div className="mt-4">
            <Link href="/dashboard" className="text-blue-600 hover:underline">
              &larr; Go back to Dashboard
            </Link>
          </div>
        </div>
      );
    }

    // Get employees for this company
    const employees = await prisma.user.findMany({
      where: {
        companyId: companyId,
        role: UserRole.EMPLOYEE,
      },
      orderBy: {
        name: "asc",
      },
    });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-gray-600">{company.email}</p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Company Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">ID</p>
              <p>{company.id}</p>
            </div>
            <div>
              <p className="text-gray-600">Coins</p>
              <p>{company.coins}</p>
            </div>
            <div>
              <p className="text-gray-600">Created</p>
              <p>{new Date(company.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Employees</h2>
            <Link 
              href={`/dashboard/employees/create?companyId=${company.id}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Employee
            </Link>
          </div>

          {employees.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No employees found for this company.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.subrole ? String(employee.subrole).toLowerCase().replace("_", " ") : "Employee"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.coins}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Link 
                          href={`/dashboard/employees/${employee.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error in company details page:", error);
    return (
      <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Error</h1>
        <p className="mt-2">An error occurred while trying to fetch company details.</p>
        <p className="mt-2 text-red-500">{error instanceof Error ? error.message : String(error)}</p>
        <div className="mt-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            &larr; Go back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
}