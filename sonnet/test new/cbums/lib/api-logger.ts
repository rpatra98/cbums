import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";

type ApiHandlerFunction = (
  req: NextRequest, 
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with activity logging
 * @param handler The API route handler
 * @param action The action type to log
 * @param options Additional options for logging
 * @returns Wrapped handler with logging
 */
export function withActivityLogging(
  handler: ApiHandlerFunction,
  action: ActivityAction,
  options?: {
    getResourceId?: (req: NextRequest, res: NextResponse) => string | undefined;
    getResourceType?: (req: NextRequest) => string | undefined;
    getDetails?: (req: NextRequest, res: NextResponse) => Record<string, any> | undefined;
    getTargetUserId?: (req: NextRequest) => string | undefined;
  }
): ApiHandlerFunction {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      // Execute the original handler
      const response = await handler(req, context);
      
      // Get user token
      const token = await getToken({ req: req as any });
      
      if (token?.id) {
        // Extract data for logging
        let responseData: any = {};
        try {
          // Clone the response to read its data
          const clonedResponse = response.clone();
          if (clonedResponse.headers.get("content-type")?.includes("application/json")) {
            responseData = await clonedResponse.json();
          }
        } catch (error) {
          console.error("Failed to extract response data for logging:", error);
        }
        
        // Prepare logging details
        const details = options?.getDetails 
          ? options.getDetails(req, response)
          : { method: req.method, path: req.nextUrl.pathname };
          
        const targetResourceId = options?.getResourceId 
          ? options.getResourceId(req, response)
          : undefined;
          
        const targetResourceType = options?.getResourceType 
          ? options.getResourceType(req)
          : undefined;
          
        const targetUserId = options?.getTargetUserId 
          ? options.getTargetUserId(req)
          : undefined;
          
        // Don't wait for logging to complete
        addActivityLog({
          userId: token.id as string,
          action,
          details,
          targetUserId,
          targetResourceId,
          targetResourceType,
          ipAddress: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined
        }).catch(error => {
          console.error("Failed to log activity:", error);
        });
      }
      
      return response;
    } catch (error) {
      // If the handler fails, re-throw the error without logging
      throw error;
    }
  };
}

/**
 * Wraps a handler to log resource creation
 */
export function withCreateLogging(
  handler: ApiHandlerFunction,
  options?: {
    resourceType: string;
    getResourceId?: (req: NextRequest, res: NextResponse) => string | undefined;
    getDetails?: (req: NextRequest, res: NextResponse) => Record<string, any> | undefined;
    getTargetUserId?: (req: NextRequest) => string | undefined;
  }
): ApiHandlerFunction {
  return withActivityLogging(handler, ActivityAction.CREATE, {
    getResourceType: () => options?.resourceType,
    getResourceId: options?.getResourceId,
    getDetails: options?.getDetails,
    getTargetUserId: options?.getTargetUserId
  });
}

/**
 * Wraps a handler to log resource updates
 */
export function withUpdateLogging(
  handler: ApiHandlerFunction,
  options?: {
    resourceType: string;
    getResourceId?: (req: NextRequest, res: NextResponse) => string | undefined;
    getDetails?: (req: NextRequest, res: NextResponse) => Record<string, any> | undefined;
    getTargetUserId?: (req: NextRequest) => string | undefined;
  }
): ApiHandlerFunction {
  return withActivityLogging(handler, ActivityAction.UPDATE, {
    getResourceType: () => options?.resourceType,
    getResourceId: options?.getResourceId,
    getDetails: options?.getDetails,
    getTargetUserId: options?.getTargetUserId
  });
}

/**
 * Wraps a handler to log resource deletions
 */
export function withDeleteLogging(
  handler: ApiHandlerFunction,
  options?: {
    resourceType: string;
    getResourceId?: (req: NextRequest, res: NextResponse) => string | undefined;
    getDetails?: (req: NextRequest, res: NextResponse) => Record<string, any> | undefined;
    getTargetUserId?: (req: NextRequest) => string | undefined;
  }
): ApiHandlerFunction {
  return withActivityLogging(handler, ActivityAction.DELETE, {
    getResourceType: () => options?.resourceType,
    getResourceId: options?.getResourceId,
    getDetails: options?.getDetails,
    getTargetUserId: options?.getTargetUserId
  });
}

/**
 * Wraps a handler to log resource views
 */
export function withViewLogging(
  handler: ApiHandlerFunction,
  options?: {
    resourceType: string;
    getResourceId?: (req: NextRequest, res: NextResponse) => string | undefined;
    getDetails?: (req: NextRequest, res: NextResponse) => Record<string, any> | undefined;
    getTargetUserId?: (req: NextRequest) => string | undefined;
  }
): ApiHandlerFunction {
  return withActivityLogging(handler, ActivityAction.VIEW, {
    getResourceType: () => options?.resourceType,
    getResourceId: options?.getResourceId,
    getDetails: options?.getDetails,
    getTargetUserId: options?.getTargetUserId
  });
} 