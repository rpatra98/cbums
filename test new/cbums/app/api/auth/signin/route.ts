import { NextResponse } from "next/server";

// This route handles redirection from NextAuth to our custom signin page
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get all potential query parameters
    const callbackUrl = searchParams.get("callbackUrl");
    const error = searchParams.get("error");
    const csrfToken = searchParams.get("csrfToken");
    
    // Build the target URL (our homepage with the login form)
    const loginUrl = new URL("/", new URL(request.url).origin);
    
    // Add all relevant parameters
    if (callbackUrl) {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    
    if (error) {
      loginUrl.searchParams.set("error", error);
    }
    
    if (csrfToken) {
      loginUrl.searchParams.set("csrfToken", csrfToken);
    }
    
    // Add a timestamp to prevent caching issues
    loginUrl.searchParams.set("ts", Date.now().toString());
    
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error("Error in signin route:", error);
    // Fallback to simple redirect
    return NextResponse.redirect(new URL("/", request.url));
  }
} 