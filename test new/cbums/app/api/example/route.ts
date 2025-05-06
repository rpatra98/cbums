import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";
import { withCreateLogging, withViewLogging, withUpdateLogging, withDeleteLogging } from "@/lib/api-logger";

/**
 * Sample API handler for a resource
 */
async function resourceHandler(req: NextRequest) {
  try {
    if (req.method === "GET") {
      // This would typically fetch a resource
      return NextResponse.json({
        id: "example-id",
        name: "Sample Resource",
        status: "active"
      });
    } else if (req.method === "POST") {
      // This would typically create a resource
      const body = await req.json();
      
      return NextResponse.json({
        id: "new-resource-id",
        ...body,
        createdAt: new Date()
      }, { status: 201 });
    } else if (req.method === "PATCH" || req.method === "PUT") {
      // This would typically update a resource
      const body = await req.json();
      
      return NextResponse.json({
        id: "existing-resource-id",
        ...body,
        updatedAt: new Date()
      });
    } else if (req.method === "DELETE") {
      // This would typically delete a resource
      return NextResponse.json({
        success: true,
        id: "deleted-resource-id"
      });
    }
    
    return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  } catch (error) {
    console.error("Error handling resource:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * Routes for different HTTP methods, each wrapped with appropriate activity logging
 */
export const GET = withAuth(
  withViewLogging(resourceHandler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: () => {
      // Extract resource ID from the response
      return "example-id";
    },
    getDetails: () => {
      return {
        method: "GET",
        action: "View example resource"
      };
    }
  }),
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
);

export const POST = withAuth(
  withCreateLogging(resourceHandler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: () => {
      // Extract new resource ID from the response
      return "new-resource-id";
    },
    getDetails: async (req) => {
      try {
        // Get the request body to include in the activity log
        const reqClone = req.clone();
        const body = await reqClone.json();
        
        return {
          method: "POST",
          action: "Create example resource",
          resourceName: body.name
        };
      } catch {
        return {
          method: "POST",
          action: "Create example resource"
        };
      }
    }
  }),
  [UserRole.SUPERADMIN, UserRole.ADMIN]
);

export const PUT = withAuth(
  withUpdateLogging(resourceHandler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: () => "existing-resource-id",
    getDetails: async (req) => {
      try {
        // Get the request body to include in the activity log
        const reqClone = req.clone();
        const body = await reqClone.json();
        
        return {
          method: "PUT",
          action: "Update example resource",
          updatedFields: Object.keys(body)
        };
      } catch {
        return {
          method: "PUT",
          action: "Update example resource"
        };
      }
    }
  }),
  [UserRole.SUPERADMIN, UserRole.ADMIN]
);

export const PATCH = withAuth(
  withUpdateLogging(resourceHandler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: () => "existing-resource-id",
    getDetails: async (req) => {
      try {
        // Get the request body to include in the activity log
        const reqClone = req.clone();
        const body = await reqClone.json();
        
        return {
          method: "PATCH",
          action: "Partial update example resource",
          updatedFields: Object.keys(body)
        };
      } catch {
        return {
          method: "PATCH",
          action: "Partial update example resource"
        };
      }
    }
  }),
  [UserRole.SUPERADMIN, UserRole.ADMIN]
);

export const DELETE = withAuth(
  withDeleteLogging(resourceHandler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: () => "deleted-resource-id",
    getDetails: () => {
      return {
        method: "DELETE",
        action: "Delete example resource"
      };
    }
  }),
  [UserRole.SUPERADMIN, UserRole.ADMIN]
); 