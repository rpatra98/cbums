import Link from "next/link";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export default async function ListAllCompaniesPage() {
  try {
    // Get all companies from the database
    const companies = await prisma.user.findMany({
      where: {
        role: "COMPANY",
      },
      orderBy: {
        name: 'asc'
      }
    });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">All Companies in Database</h1>
          <p className="text-gray-600 mt-2">Found {companies.length} companies</p>
        </div>

        {companies.length === 0 ? (
          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-yellow-700">No companies found in the database.</p>
            <p className="mt-2">You'll need to create some companies first.</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {companies.map(company => (
                  <tr key={company.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                      {company.id}
                      {company.companyUserId && (
                        <div className="text-xs text-gray-400 mt-1">
                          User ID: {company.companyUserId}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{company.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{company.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(company.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link 
                        href={`/dashboard/companies/${company.companyUserId || company.id}`}
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
    );
  } catch (error) {
    console.error("Error fetching companies:", error);
    return (
      <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Error</h1>
        <p className="mt-2">An error occurred while fetching companies.</p>
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