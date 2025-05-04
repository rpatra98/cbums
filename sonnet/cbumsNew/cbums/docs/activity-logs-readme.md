# Activity Logs System

This document provides information on how to use the Activity Logs system in the CBUMS application.

## Overview

The Activity Logs system tracks user actions across the platform, providing an audit trail for:
- Authentication events (login/logout)
- Resource operations (create/update/delete)
- Financial transactions
- Data viewing

Each log includes information about:
- The user who performed the action
- The type of action performed
- When the action occurred
- Details specific to the action
- Device information (for login/logout events)

## How to Use Activity Logging

### Direct Logging

For one-off logging needs, you can use the `addActivityLog` function directly:

```typescript
import { addActivityLog } from "@/lib/activity-logger";
import { ActivityAction } from "@/prisma/enums";

// Log an activity
await addActivityLog({
  userId: "user-id",
  action: ActivityAction.CREATE,
  details: {
    resourceName: "Example Resource",
    // Any other relevant details
  },
  targetResourceId: "resource-id",
  targetResourceType: "RESOURCE_TYPE"
});
```

### API Route Logging

For API routes, you can use wrapper functions to automatically log activities:

```typescript
import { withCreateLogging } from "@/lib/api-logger";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";

async function handler(req, context) {
  // Your handler implementation
}

// Wrap your handler with authentication and logging
export const POST = withAuth(
  withCreateLogging(handler, {
    resourceType: "EXAMPLE_RESOURCE",
    getResourceId: (req, res) => {
      // Extract resource ID from response or request
    },
    getDetails: (req, res) => {
      // Return details to log
      return {
        method: "POST",
        resourceName: "Example"
      };
    }
  }),
  [UserRole.ADMIN] // Roles allowed to access this endpoint
);
```

Available logging wrappers:
- `withCreateLogging` - For resource creation
- `withUpdateLogging` - For resource updates
- `withDeleteLogging` - For resource deletion
- `withViewLogging` - For resource viewing
- `withActivityLogging` - Generic wrapper for custom action types

### Database Operations Logging

For database operations, you can use the `withActivityLog` helper:

```typescript
import { withActivityLog } from "@/lib/activity-logger";
import { ActivityAction } from "@/prisma/enums";

// Execute a database operation with logging
const result = await withActivityLog(
  // Database operation as a function
  () => prisma.resource.create({
    data: {
      // ...data
    }
  }),
  // Logging parameters
  {
    userId: "user-id",
    action: ActivityAction.CREATE,
    details: {
      // ...details
    }
  }
);
```

## Viewing Activity Logs

Activity logs can be viewed in the dashboard at `/dashboard/activity-logs`. The UI provides:

- Filtering by action type, date range, and device type
- Pagination for large result sets
- Role-based visibility of logs

## Access Control

Access to logs is controlled based on user roles:

| Role | Access Level |
|------|-------------|
| SUPERADMIN | All logs in the system |
| ADMIN | Logs of users they created |
| COMPANY | Logs of their employees |
| EMPLOYEE | Only their own logs |

## Device Information

The system automatically detects and logs device type (mobile/desktop) for login and logout events. This information is displayed with icons in the activity logs view.

## Best Practices

1. **Be Consistent**: Use the same approach for similar operations
2. **Log Meaningful Details**: Include relevant context in the details
3. **Don't Log Sensitive Data**: Avoid including passwords or sensitive personal information
4. **Use Resource Types**: Always specify a resource type for better filtering
5. **Keep Performance in Mind**: Logging should not significantly impact API performance 