import { useParams } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export const dynamic = "force-dynamic";

export default async function CompanyBackupPage({ params }: { params: { id: string } }) {
  const companyId = params.id;
  
  try {
    // Get company details directly without any authorization checks
    const company = await prisma.user.findUnique({
      where: {
        id: companyId,
        role: UserRole.COMPANY,
      },
    });

    if (!company) {
      return (
        <div className="p-8 bg-red-50 rounded-lg">
          <h1 className="text-2xl font-bold text-red-700">Company Not Found</h1>
          <p className="mt-4">The company with ID <code className="bg-gray-100 px-2 py-1 rounded">{companyId}</code> could not be found.</p>
          <div className="mt-6">
            <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Return to Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Company Details (Backup View)</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-500 mb-6">This is a backup view with limited functionality.</p>
          
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Company Information</h2>
            <p><strong>ID:</strong> {company.id}</p>
            <p><strong>Name:</strong> {company.name}</p>
            <p><strong>Email:</strong> {company.email}</p>
            <p><strong>Created:</strong> {new Date(company.createdAt).toLocaleString()}</p>
          </div>
          
          <div className="mt-6">
            <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-8 bg-red-50 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Error</h1>
        <p className="mt-4">An error occurred while trying to display company information.</p>
        <p className="text-red-600 mt-2">{error instanceof Error ? error.message : String(error)}</p>
        <div className="mt-6">
          <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
} 