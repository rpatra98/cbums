import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Path patterns that should be protected
const protectedPaths = ["/dashboard", "/api/users", "/api/coins"];

// Paths that are public
const publicPaths = ["/", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Always allow access to auth-related paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the path should be protected
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    const token = await getToken({ req: request });
    
    // If not authenticated, redirect to login page or return 401 for API routes
    if (!token) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Create new URL for redirection
      const url = new URL("/", request.url);
      url.searchParams.set("error", "NotAuthenticated");
      return NextResponse.redirect(url);
    }
    
    // Token age check
    if (token.iat && typeof token.iat === 'number') {
      const issuedAt = token.iat;
      const currentTime = Math.floor(Date.now() / 1000);
      const twelveHoursInSeconds = 12 * 60 * 60;
      
      // If token is older than 12 hours, force a re-login
      if (currentTime - issuedAt > twelveHoursInSeconds) {
        if (pathname.startsWith("/api")) {
          return NextResponse.json(
            { error: "Session expired" },
            { status: 401 }
          );
        }
        
        // Redirect to our custom logout page with error
        const url = new URL("/api/auth/logout", request.url);
        url.searchParams.set("callbackUrl", "/?error=SessionExpired");
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

// Paths that should trigger the middleware
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/auth/* (authentication API routes)
     * 2. /_next/* (Next.js built-in paths)
     * 3. /public files (public assets)
     */
    "/((?!_next/|static/|public/|assets/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}; 