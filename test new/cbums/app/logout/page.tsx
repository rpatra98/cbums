"use client";

import { useEffect, useState, Suspense } from "react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, CircularProgress } from "@mui/material";

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Logging out...");
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  
  // Perform client-side logout and redirect
  useEffect(() => {
    async function performLogout() {
      try {
        // Step 1: Clear all cookies
        document.cookie.split(";").forEach(cookie => {
          const name = cookie.split("=")[0].trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        });
        
        // Step 2: Clear local storage
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error("Error clearing storage:", e);
        }
        
        // Step 3: Call NextAuth signOut
        setStatus("Clearing session...");
        await signOut({ redirect: false });
        
        // Step 4: Redirect to our logout handler which will clear server-side cookies
        setStatus("Redirecting...");
        window.location.href = `/api/auth/logout?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      } catch (error) {
        console.error("Logout error:", error);
        setStatus("Error during logout. Redirecting...");
        // Fallback to direct navigation
        setTimeout(() => {
          window.location.href = callbackUrl;
        }, 1000);
      }
    }
    
    performLogout();
  }, [callbackUrl]);
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default'
      }}
    >
      <CircularProgress size={48} sx={{ mb: 4 }} />
      <Typography variant="h5" gutterBottom>
        {status}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Please wait while we sign you out securely.
      </Typography>
    </Box>
  );
}

export default function LogoutPage() {
  return (
    <Suspense fallback={
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress size={48} sx={{ mb: 4 }} />
        <Typography variant="h5" gutterBottom>
          Loading...
        </Typography>
      </Box>
    }>
      <LogoutContent />
    </Suspense>
  );
} 