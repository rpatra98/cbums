"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, ActivityAction } from "@/prisma/enums";
import {
  DataTable,
  Card,
  CardContent,
  Skeleton,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  DatePicker,
} from "@/components/ui";
import { ArrowLeft, Smartphone, Monitor, Filter, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDevice, formatDate } from "@/lib/utils";
import { Box, Typography, Paper, CircularProgress, Alert } from "@mui/material";

interface ActivityLog {
  id: string;
  action: string;
  targetResourceType: string;
  targetResourceId: string;
  userId: string;
  createdAt: string;
  userAgent?: string;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  details: {
    entityType?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
    sessionId?: string;
    source?: string;
    destination?: string;
    barcode?: string;
    cost?: string;
    resourceType?: string;
    device?: string;
    reasonText?: string;
    amount?: string;
    recipientName?: string;
    filters?: {
      search?: string;
      role?: string;
      page?: number;
      limit?: number;
    };
    resultCount?: number;
    totalCount?: number;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: number;
  recipientName?: string;
  [key: string]: unknown;
};

type ActivityLogRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityLogDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
};

type RowProps = {
  row: {
    original: ActivityLogRow;
  };
};

// Column definition for the activity logs table
const columns = [
  {
    accessorKey: "user",
    header: "User",
    cell: ({ row }: RowProps) => {
      try {
        const userData = row?.original?.user;
        if (!userData) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{userData.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{userData.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }: RowProps) => {
      try {
        const action = row?.original?.action;
        const details = row?.original?.details;
        const userAgent = row?.original?.userAgent;
        
        if (!action) return <span>-</span>;
        
        return (
          <div className="flex items-center gap-2">
            {/* Highlight login/logout actions with a colored badge */}
            {action === "LOGIN" || action === "LOGOUT" ? (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                action === "LOGIN" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
              }`}>
                {action.toLowerCase()}
              </span>
            ) : (
              <span className="capitalize">{action.toLowerCase().replace(/_/g, ' ')}</span>
            )}
            
            {/* Display device icon for login/logout events */}
            {(action === "LOGIN" || action === "LOGOUT") && userAgent && (
              <div className="ml-2" title={`${action} from ${detectDevice(userAgent).type} device`}>
                {detectDevice(userAgent).isMobile ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        );
      } catch (err) {
        console.error("Error rendering Action column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "details",
    header: "Details",
    cell: ({ row }: RowProps) => {
      try {
        const details = row?.original?.details;
        const action = row?.original?.action;
        if (!details) return <span>-</span>;
        
        // For login/logout events, show device info
        if (action === "LOGIN" || action === "LOGOUT") {
          const deviceType = details.device || "unknown";
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {action === "LOGIN" ? "Logged in from" : "Logged out from"} {deviceType} device
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For transfer events, show recipient and amount
        if (action === "TRANSFER") {
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                Transferred {details.amount} coins to {details.recipientName || "user"}
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  Reason: {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For other actions with structured details, convert to readable format
        if (typeof details === 'object') {
          // Convert object to readable string, excluding certain technical fields
          const excludeKeys = ['deviceDetails', 'userAgent'];
          const detailsText = Object.entries(details)
            .filter(([key]) => !excludeKeys.includes(key))
            .map(([key, value]) => {
              // Skip nested objects
              if (typeof value === 'object' && value !== null) {
                return `${key}: [object]`;
              }
              return `${key}: ${String(value)}`;
            })
            .join(', ');
          
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {detailsText}
              </span>
            </div>
          );
        }
        
        // Default fallback for string or primitive details
        return (
          <div className="flex flex-col">
            <span className="text-sm whitespace-normal break-words max-w-sm">
              {String(details)}
            </span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering Details column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "targetUser",
    header: "Target User",
    cell: ({ row }: RowProps) => {
      try {
        const targetUser = row?.original?.targetUser;
        if (!targetUser) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{targetUser.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{targetUser.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering Target User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }: RowProps) => {
      try {
        if (!row?.original) return <span>-</span>;
        
        const createdAt = row.original.createdAt;
        if (!createdAt) return <span>-</span>;
        
        return <span>{formatDate(createdAt)}</span>;
      } catch (err) {
        console.error("Error rendering Time column:", err);
        return <span>-</span>;
      }
    },
  },
];

export default function ActivityLogsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchActivityLogs = async (pageNum: number) => {
    try {
      const response = await fetch(`/api/activity-logs?page=${pageNum}`);
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      const data: ActivityLogsResponse = await response.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setError("Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchActivityLogs(page);
    }
  }, [page, session?.user, fetchActivityLogs]);

  useEffect(() => {
    if (!session?.user) {
      router.push("/auth/login");
    }
  }, [session?.user, router]);
  
  // Debug: Log activity data when it changes
  useEffect(() => {
    if (logs && logs.length > 0) {
      console.log("Activity types present:", 
        [...new Set(logs.map(log => log.action))]);
    }
  }, [logs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "success.main";
      case "UPDATE":
        return "info.main";
      case "DELETE":
        return "error.main";
      case "VIEW":
        return "primary.main";
      default:
        return "text.secondary";
    }
  };

  const renderLogDetails = (log: ActivityLog) => {
    const details = log.details;
    
    switch (log.targetResourceType) {
      case "USER":
        return (
          <>
            <Typography variant="body2">
              User: {details.userEmail} ({details.userRole})
            </Typography>
            {log.targetUser && (
              <Typography variant="body2">
                Target User: {log.targetUser.name} ({log.targetUser.role})
              </Typography>
            )}
          </>
        );
        
      case "SESSION":
        return (
          <>
            <Typography variant="body2">
              Session: {details.sessionId}
            </Typography>
            <Typography variant="body2">
              From: {details.source} to {details.destination}
            </Typography>
            {details.barcode && (
              <Typography variant="body2">
                Barcode: {details.barcode}
              </Typography>
            )}
            {details.cost && (
              <Typography variant="body2">
                Cost: {details.cost}
              </Typography>
            )}
            {details.reasonText && (
              <Typography variant="body2">
                Reason: {details.reasonText}
              </Typography>
            )}
          </>
        );
        
      case "USER_LIST":
        return (
          <>
            <Typography variant="body2">
              Filters: {Object.entries(details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2">
              Results: {details.resultCount} of {details.totalCount}
            </Typography>
          </>
        );
        
      default:
        return (
          <Typography variant="body2">
            {JSON.stringify(details, null, 2)}
          </Typography>
        );
    }
  };

  if (!session?.user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please sign in to view activity logs</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Activity Logs
      </Typography>

      {logs.length === 0 ? (
        <Alert severity="info">No activity logs found</Alert>
      ) : (
        logs.map((log) => (
          <Paper
            key={log.id}
            sx={{
              p: 2,
              mb: 2,
              borderLeft: 4,
              borderColor: getActionColor(log.action),
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle1" sx={{ color: getActionColor(log.action) }}>
                {log.action}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(log.createdAt)}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              By: {log.user.name} ({log.user.role})
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Resource: {log.targetResourceType}
            </Typography>

            {renderLogDetails(log)}
          </Paper>
        ))
      )}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </Box>
        </Box>
      )}
    </Box>
  );
} 