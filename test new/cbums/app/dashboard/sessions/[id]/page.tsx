"use server";

import { Suspense } from "react";
// Import from components.tsx to avoid TypeScript module resolution issues
import { SessionDetailClient } from "./components";

export default async function SessionDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Resolve the ID parameter on the server
  const sessionId = params.id;
  
  // Pass the resolved ID to the client component
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SessionDetailClient sessionId={sessionId} />
    </Suspense>
  );
} 