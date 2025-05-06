import { redirect } from "next/navigation";

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  // Redirect to the proper companies (plural) route
  redirect(`/dashboard/companies/${params.id}`);
} 