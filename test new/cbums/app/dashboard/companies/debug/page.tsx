export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export default async function CompanyDebugPage() {
  const companyId = "36615a10-15f3-48ab-b3b4-eecea1c39f66";

  // Check if the company exists
  const company = await prisma.user.findUnique({
    where: {
      id: companyId,
      role: UserRole.COMPANY,
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Company Debug</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl mb-2">ID: {companyId}</h2>
        <div className="mt-4">
          <h3 className="font-semibold">Company exists in database?</h3>
          {company ? (
            <div className="bg-green-100 p-4 rounded mt-2">
              <p className="text-green-700">YES - Company found!</p>
              <p className="mt-2">Name: {company.name}</p>
              <p>Email: {company.email}</p>
              <p>Created at: {new Date(company.createdAt).toLocaleString()}</p>
            </div>
          ) : (
            <div className="bg-red-100 p-4 rounded mt-2">
              <p className="text-red-700">NO - Company not found in database</p>
              <p className="mt-2">The company with this ID doesn't exist in the database.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 