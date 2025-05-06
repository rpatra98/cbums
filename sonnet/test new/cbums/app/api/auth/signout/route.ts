import { NextResponse } from "next/server";

// This handles NextAuth signOut() function calls
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const callbackUrl = body?.callbackUrl || '/';
    
    // Return JSON with the URL to redirect to
    return NextResponse.json({ url: callbackUrl });
  } catch (error) {
    console.error('Error in signout handler:', error);
    return NextResponse.json({ url: '/' });
  }
}

// This manually clears auth cookies and redirects for browser navigation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    // Check if this is an API request expecting JSON (from NextAuth)
    const acceptHeader = request.headers.get("accept");
    if (acceptHeader && acceptHeader.includes("application/json")) {
      // Return JSON for NextAuth signOut() function
      return NextResponse.json({ url: callbackUrl });
    }
    
    // For browser requests, just redirect to the logout page with the callback
    return NextResponse.redirect(new URL(`/api/auth/logout?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url));
  } catch (error) {
    console.error('Error in signout GET handler:', error);
    // If there's an error, redirect to home page
    return NextResponse.redirect(new URL('/', request.url));
  }
} 