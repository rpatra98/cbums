import { redirect } from "next/navigation";

// Redirect from the old route to the new one
export default function CompanyAddRedirect() {
  // Use a direct URL redirect for more reliability
  redirect("/dashboard/companies/create");
}

// Export config to suppress static render during build
export const dynamic = 'force-dynamic'; 