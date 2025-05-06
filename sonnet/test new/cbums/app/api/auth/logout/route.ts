import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { detectDevice } from "@/lib/utils";

// Client-side approach to logout
// Just returns a simple HTML page with JavaScript to sign out
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/"; // Default to root page which has the login form
    
    // Get the user's JWT token to identify them for activity logging
    const token = await getToken({ req: request });
    
    // Log the logout activity if we have a user token
    if (token?.id) {
      const userAgent = request.headers.get("user-agent") || "unknown";
      const deviceInfo = detectDevice(userAgent);
      
      await addActivityLog({
        userId: token.id as string,
        action: ActivityAction.LOGOUT,
        details: {
          method: "client-side",
          device: deviceInfo.type,
          deviceDetails: deviceInfo
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: userAgent
      });
    }
    
    // First check if this is an API request expecting JSON (from NextAuth)
    const acceptHeader = request.headers.get("accept");
    if (acceptHeader && acceptHeader.includes("application/json")) {
      // Return JSON for NextAuth signOut() function
      return NextResponse.json({ url: callbackUrl }, { status: 200 });
    }
    
    // Create the HTML response with cookie-clearing script
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Signing out...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #f5f5f5;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            h1 {
              color: #333;
              font-size: 1.5rem;
              margin-bottom: 1rem;
            }
            p {
              color: #666;
              margin-bottom: 1.5rem;
            }
            .debug {
              font-size: 0.8rem;
              color: #999;
              margin-top: 1.5rem;
              text-align: left;
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Signing out...</h1>
            <p>Please wait while we securely sign you out.</p>
            <div class="debug" id="debug"></div>
          </div>
          
          <script>
            const debugLog = (message) => {
              const debugEl = document.getElementById('debug');
              const logItem = document.createElement('div');
              logItem.textContent = message;
              debugEl.appendChild(logItem);
            };
            
            // Clear all cookies
            const clearCookies = () => {
              debugLog('Clearing cookies...');
              const cookies = document.cookie.split(';');
              
              for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                
                if (name) {
                  // Set each cookie as expired in multiple paths to be thorough
                  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
                  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=localhost';
                  debugLog('Cleared: ' + name);
                }
              }
              
              // Specifically target NextAuth cookies
              const nextAuthCookies = [
                'next-auth.session-token',
                'next-auth.csrf-token',
                'next-auth.callback-url',
                'next-auth.pkce.code-verifier',
                '__Secure-next-auth.session-token',
                '__Secure-next-auth.callback-url',
                '__Secure-next-auth.csrf-token',
                '__Host-next-auth.csrf-token'
              ];
              
              nextAuthCookies.forEach(name => {
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=localhost';
                debugLog('Explicitly cleared: ' + name);
              });
              
              return cookies.length;
            };
            
            // Clear cookies
            const cookiesCleared = clearCookies();
            debugLog('Total cookies found: ' + cookiesCleared);
            
            // Try to clear local/session storage
            try {
              localStorage.clear();
              sessionStorage.clear();
              debugLog('Local/session storage cleared');
            } catch (e) {
              debugLog('Error clearing storage: ' + e.message);
            }
            
            function forceRedirect() {
              debugLog('Force redirecting to: ${callbackUrl}');
              window.location.replace("${callbackUrl}");
            }
            
            // Redirect after a short delay
            setTimeout(forceRedirect, 1500);
            
            // Set a backup redirect in case the first one fails
            setTimeout(function() {
              if (document.cookie.length > 0) {
                debugLog('Backup redirect needed');
                clearCookies(); // Try again
                window.location.href = "${callbackUrl}";
              }
            }, 3000);
          </script>
        </body>
      </html>
    `;
    
    // Create response with HTML
    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-store, max-age=0",
      }
    });
    
    // Clear cookies server-side as well
    const cookieNames = [
      'next-auth.session-token', 
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.callback-url',
      '__Host-next-auth.csrf-token'
    ];
    
    cookieNames.forEach(name => {
      response.cookies.set(name, '', { path: '/' });
    });
    
    return response;
  } catch (error: unknown) {
    console.error("Error in logout handler:", error);
    // If there's an error, redirect to home page
    return NextResponse.redirect(new URL("/", request.url));
  }
} 