"use client";

import { useState, useEffect } from "react";
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

// Column definition for the activity logs table
const columns = [
  {
    accessorKey: "user",
    header: "User",
    cell: ({ row }: any) => {
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
    cell: ({ row }: any) => {
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
    cell: ({ row }: any) => {
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
              return `${key}: ${value}`;
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
    cell: ({ row }: any) => {
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
    cell: ({ row }: any) => {
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
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [meta, setMeta] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    action: "",
    fromDate: null as Date | null,
    toDate: null as Date | null,
    userId: "",
    deviceType: ""
  });
  
  const fetchActivityLogs = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize),
      });
      
      // Add filters if they are set
      if (filters.action) params.append("action", filters.action);
      if (filters.userId) params.append("userId", filters.userId);
      if (filters.fromDate) params.append("fromDate", filters.fromDate.toISOString());
      if (filters.toDate) params.append("toDate", filters.toDate.toISOString());
      if (filters.deviceType) params.append("deviceType", filters.deviceType);
      
      const response = await fetch(`/api/activity-logs?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs");
      }
      
      const data = await response.json();
      setActivityLogs(data.logs || []);
      setMeta(data.meta || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10,
      });
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      setActivityLogs([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (session?.user) {
      // Initially show all activities including login/logout
      fetchActivityLogs();
      
      // Debug: Directly check for login/logout activities
      fetch('/api/debug-logs')
        .then(res => res.json())
        .then(data => {
          console.log('Debug logs data:', data);
          
          // Test login and logout activities
          if (data.loginActivities?.length === 0 && data.logoutActivities?.length === 0) {
            console.log('No login/logout activities found. Try creating test events with /api/debug-logs/test-login-event');
          } else {
            console.log(`Found ${data.loginActivities?.length || 0} login and ${data.logoutActivities?.length || 0} logout activities`);
          }
        })
        .catch(err => {
          console.error('Error fetching debug logs:', err);
        });
    }
  }, [session]);
  
  // Debug: Log activity data when it changes
  useEffect(() => {
    if (activityLogs && activityLogs.length > 0) {
      console.log("Activity types present:", 
        [...new Set(activityLogs.map(log => log.action))]);
    }
  }, [activityLogs]);
  
  // Handle pagination changes
  useEffect(() => {
    if (session?.user) {
      fetchActivityLogs();
    }
  }, [pagination.pageIndex, pagination.pageSize]);
  
  const handleApplyFilters = () => {
    // Reset pagination to first page when applying filters
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
    fetchActivityLogs();
    setFiltersVisible(false);
  };
  
  const handleResetFilters = () => {
    setFilters({
      action: "",
      fromDate: null,
      toDate: null,
      userId: "",
      deviceType: ""
    });
    
    // Reset pagination to first page
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
    
    // Fetch with reset filters
    fetchActivityLogs();
  };
  
  const toggleFilters = () => {
    setFiltersVisible(!filtersVisible);
  };
  
  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header with navigation and title */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Activity Logs</h1>
            <div className="h-1 w-20 bg-blue-500 mt-1 rounded-full"></div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter toggle button */}
          <Button 
            variant="outline"
            size="sm"
            onClick={toggleFilters}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          
          {/* Refresh button */}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => fetchActivityLogs()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Filters section - collapsible */}
      {filtersVisible && (
        <Card className="mb-6 shadow-md rounded-lg border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Action Type</label>
                <Select
                  value={filters.action}
                  onValueChange={(value) => setFilters({ ...filters, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue value={filters.action} placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    <SelectItem value="LOGIN">Login</SelectItem>
                    <SelectItem value="LOGOUT">Logout</SelectItem>
                    <SelectItem value="CREATE">Create</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                    <SelectItem value="ALLOCATE">Allocate</SelectItem>
                    <SelectItem value="VIEW">View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Device Type</label>
                <Select
                  value={filters.deviceType}
                  onValueChange={(value) => setFilters({ ...filters, deviceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue value={filters.deviceType} placeholder="All devices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Devices</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">From Date</label>
                <DatePicker
                  value={filters.fromDate}
                  onChange={(date) => setFilters({ ...filters, fromDate: date })}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">To Date</label>
                <DatePicker
                  value={filters.toDate}
                  onChange={(date) => setFilters({ ...filters, toDate: date })}
                />
              </div>
              
              {session?.user?.role === UserRole.SUPERADMIN || 
               session?.user?.role === UserRole.ADMIN ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">User ID</label>
                  <Input
                    placeholder="Filter by user ID"
                    value={filters.userId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setFilters({ ...filters, userId: e.target.value })
                    }
                    className="bg-white text-gray-900 border-gray-300 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              ) : null}
              
              <div className="flex space-x-2 items-end col-span-full">
                <Button 
                  onClick={handleApplyFilters}
                  size="sm"
                  className="h-9"
                >
                  Apply Filters
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleResetFilters}
                  size="sm"
                  className="h-9"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Activity logs table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-3 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        ) : activityLogs && Array.isArray(activityLogs) && activityLogs.length > 0 ? (
          <DataTable
            columns={columns}
            data={activityLogs}
            pagination={{
              pageCount: meta.totalPages,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              onPageChange: (pageIndex: number) => 
                setPagination({ ...pagination, pageIndex }),
              onPageSizeChange: (pageSize: number) => 
                setPagination({ pageIndex: 0, pageSize }),
            }}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No activity logs found</p>
          </div>
        )}
      </div>
      
      {/* Summary stats */}
      {!loading && activityLogs && activityLogs.length > 0 && (
        <div className="text-xs text-gray-500 text-right mt-2 px-2">
          Showing {pagination.pageIndex * pagination.pageSize + 1} to {Math.min((pagination.pageIndex + 1) * pagination.pageSize, meta.totalItems)} of {meta.totalItems} entries
        </div>
      )}
    </div>
  );
} 