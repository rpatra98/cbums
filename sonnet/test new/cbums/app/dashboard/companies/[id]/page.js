import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import Link from "next/link";

// Force dynamic rendering to bypass caching issues
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function CompanyDetailPage({ params }) {
  const companyId = params.id;
  console.log("CompanyDetailPage - Looking up company ID:", companyId);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      redirect("/");
    }

    // Load the company data via our improved API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/companies/${companyId}`, {
      headers: {
        Cookie: `next-auth.session-token=${session.user.token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error("Failed to fetch company:", response.status, response.statusText);
      
      // If we can't find the company via the API, try to look it up directly
      let company = null;
      
      // Try as a direct company ID first
      company = await prisma.company.findUnique({
        where: { id: companyId },
      });
      
      // If not found, try as a company user
      if (!company) {
        const companyUser = await prisma.user.findFirst({
          where: {
            id: companyId,
            role: "COMPANY",
          },
          select: {
            id: true,
            name: true,
            email: true,
            companyId: true,
            coins: true,
            createdAt: true,
          },
        });
        
        // If we found a company user, check if it has an associated company
        if (companyUser?.companyId) {
          company = await prisma.company.findUnique({
            where: { id: companyUser.companyId },
          });
        }
        
        // If no company record but we have a company user, use that data
        if (!company && companyUser) {
          company = {
            id: companyUser.id,
            name: companyUser.name,
            email: companyUser.email,
            createdAt: companyUser.createdAt,
            coins: companyUser.coins,
            companyId: companyUser.companyId,
            _synthetic: true,
          };
        }
      }
      
      // If we still couldn't find the company, show available companies
      if (!company) {
        // Find up to 5 valid companies to suggest
        const availableCompanies = await prisma.user.findMany({
          where: {
            role: "COMPANY",
          },
          take: 5,
          orderBy: {
            name: 'asc'
          }
        });

        return (
          <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
            <h1 className="text-2xl font-bold text-red-700">Company Not Found</h1>
            <p className="mt-2">The company with ID: {companyId} was not found in the database.</p>
            
            {availableCompanies.length > 0 ? (
              <div className="mt-4 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Available Companies:</h2>
                <ul className="mt-2 list-disc pl-5">
                  {availableCompanies.map(company => (
                    <li key={company.id} className="mt-1">
                      <Link href={`/dashboard/companies/${company.id}`} className="text-blue-600 hover:underline">
                        {company.name} ({company.email})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded">
                <p>There are no companies in the database yet.</p>
                <p className="mt-2">You can create one by visiting the dashboard.</p>
              </div>
            )}
            
            <div className="mt-4 flex space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:underline">
                &larr; Go back to Dashboard
              </Link>
              <Link href="/dashboard/companies/list-all" className="text-blue-600 hover:underline">
                View All Companies
              </Link>
            </div>
          </div>
        );
      }
      
      // If we found the company directly, get its employees
      const employees = await prisma.user.findMany({
        where: {
          companyId: company._synthetic ? company.id : company.id,
          role: "EMPLOYEE",
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
            {company._synthetic && (
              <p className="text-amber-600 text-sm mt-1">
                Note: Using company user data, actual company record may be missing
              </p>
            )}
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
                <p>{company.coins || 0}</p>
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
    }

    // If the API request was successful, parse the company data
    const company = await response.json();
    
    // Get employees for this company
    const employees = company.employees || [];

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-gray-600">{company.email}</p>
          {company._synthetic && (
            <p className="text-amber-600 text-sm mt-1">
              Note: Using company user data, actual company record may be missing
            </p>
          )}
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
              <p>{company.coins || 0}</p>
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