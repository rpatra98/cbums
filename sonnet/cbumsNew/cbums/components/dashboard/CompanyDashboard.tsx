"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CompanyDashboardProps } from "./types";
import { CircularProgress, Chip, Card, CardContent, Typography, Box, List, ListItem, ListItemText, Divider, Alert, Button, Tabs, Tab } from "@mui/material";
import { Person, Work, LocalAtm, People, ErrorOutline, LocationOn, DirectionsCar, AccessTime, Lock, CheckCircle, Refresh } from "@mui/icons-material";
import { format } from "date-fns";
import { SessionStatus } from "@/prisma/enums";

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string | null;
  coins: number;
  createdAt: string | Date;
}

interface SessionData {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  seal?: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: string | null;
    verifiedById: string | null;
    verifiedBy?: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
}

export default function CompanyDashboard({ user }: CompanyDashboardProps) {
  const [activeTab, setActiveTab] = useState("sessions");
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isErrorEmployees, setIsErrorEmployees] = useState(false);
  const [isErrorSessions, setIsErrorSessions] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");

  // Create a fetchSessions function reference at component level with useCallback
  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setIsErrorSessions(false);
    try {
      // Map the filter values to the SessionStatus enum values
      let statusParam = "";
      if (sessionStatusFilter !== "all") {
        const statusMap: Record<string, string> = {
          "pending": SessionStatus.PENDING,
          "in_progress": SessionStatus.IN_PROGRESS,
          "completed": SessionStatus.COMPLETED
        };
        statusParam = `status=${statusMap[sessionStatusFilter]}`;
      }
      
      // Debug user object to see the structure
      console.log("User object for session fetch:", {
        userId: user.id,
        companyId: user.company?.id,
        userRole: user.role,
        companyName: user.company?.name,
      });
      
      // Try multiple API approaches to get the sessions
      console.log("User role is:", user.role);
      
      // First try without any companyId parameter
      let apiUrl = `/api/sessions?${statusParam}`;
      console.log("Fetching sessions from:", apiUrl);
      
      let response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error("Sessions API error on first attempt:", response.status, response.statusText);
        throw new Error("Failed to fetch sessions");
      }
      
      let data = await response.json();
      console.log("Sessions API response (first attempt):", data);
      
      // If no sessions were returned, try with companyId
      if ((!data.sessions || data.sessions.length === 0) && user.role === 'COMPANY') {
        console.log("No sessions found on first attempt, trying with companyId parameter");
        
        apiUrl = `/api/sessions?${statusParam}${statusParam ? '&' : ''}companyId=${user.id}`;
        console.log("Fetching sessions (second attempt) from:", apiUrl);
        
        response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.error("Sessions API error on second attempt:", response.status, response.statusText);
          throw new Error("Failed to fetch sessions on second attempt");
        }
        
        data = await response.json();
        console.log("Sessions API response (second attempt):", data);
        
        // If still no sessions, try with the user's company.id if available
        if ((!data.sessions || data.sessions.length === 0) && user.company?.id) {
          console.log("No sessions found on second attempt, trying with user.company.id");
          
          apiUrl = `/api/sessions?${statusParam}${statusParam ? '&' : ''}companyId=${user.company.id}`;
          console.log("Fetching sessions (third attempt) from:", apiUrl);
          
          response = await fetch(apiUrl);
          
          if (!response.ok) {
            console.error("Sessions API error on third attempt:", response.status, response.statusText);
            throw new Error("Failed to fetch sessions on third attempt");
          }
          
          data = await response.json();
          console.log("Sessions API response (third attempt):", data);
        }
      }
      
      // Handle the response
      if (Array.isArray(data)) {
        setSessions(data);
      } else if (data.sessions && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        console.error("Unexpected API response format:", data);
        setSessions([]);
        setIsErrorSessions(true);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setIsErrorSessions(true);
      setSessions([]); // Reset to empty array on error
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user.id, user.role, user.company?.id, sessionStatusFilter]);

  // Fetch employees when component mounts
  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      setIsErrorEmployees(false);
      try {
        // Use the correct API endpoint for fetching employees
        const response = await fetch(`/api/employees?companyId=${user.company?.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }
        const data = await response.json();
        setEmployees(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
        setIsErrorEmployees(true);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [user.company?.id]);
  
  // Fetch sessions when component mounts or filter changes
  useEffect(() => {
    if (activeTab === "sessions") {
      console.log("Fetching sessions for tab:", activeTab);
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

  // Format date for display
  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  // Transform subrole for display
  const getSubroleLabel = (subrole: string | null) => {
    if (!subrole) return "No subrole";
    
    // Convert SNAKE_CASE to Title Case
    return subrole
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get chip color based on subrole
  const getSubroleColor = (subrole: string | null) => {
    if (!subrole) return "default";
    
    switch (subrole.toUpperCase()) {
      case "OPERATOR":
        return "primary";
      case "DRIVER":
        return "success";
      case "TRANSPORTER":
        return "info";
      case "GUARD":
        return "warning";
      default:
        return "default";
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case SessionStatus.PENDING:
        return "warning";
      case SessionStatus.IN_PROGRESS:
        return "info";
      case SessionStatus.COMPLETED:
        return "success";
      default:
        return "default";
    }
  };
  
  const handleSessionStatusFilterChange = (_event: React.SyntheticEvent, newValue: string) => {
    setSessionStatusFilter(newValue);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Company Dashboard</h2>
        <p className="text-gray-600">
          Welcome, {user.name}. You are managing {user.company?.name || "your company"}.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`py-4 px-6 ${
                activeTab === "sessions"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setActiveTab("employees")}
              className={`py-4 px-6 ${
                activeTab === "employees"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Employees
            </button>
            <Link 
              href="/dashboard/activity-logs"
              className="py-4 px-6 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Activity Logs
            </Link>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "sessions" && (
            <div>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Box display="flex" alignItems="center">
                  <DirectionsCar sx={{ mr: 1 }} />
                  <Typography variant="h6">Your Sessions</Typography>
                </Box>
                
                <Box>
                  <Button 
                    onClick={() => {
                      setSessionStatusFilter("all");
                      // Force a refresh of sessions
                      setIsLoadingSessions(true);
                      setTimeout(() => fetchSessions(), 100);
                    }}
                    startIcon={<Refresh />} 
                    size="small"
                    sx={{ mr: 1 }}
                  >
                    Refresh
                  </Button>
                  
                  <Button
                    component={Link}
                    href="/dashboard/sessions"
                    variant="outlined"
                    size="small"
                  >
                    Go to Sessions Page
                  </Button>
                </Box>
              </Box>
              
              <Box mb={3}>
                <Tabs
                  value={sessionStatusFilter}
                  onChange={handleSessionStatusFilterChange}
                  indicatorColor="primary"
                  textColor="primary"
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="All" value="all" />
                  <Tab label="Pending" value="pending" />
                  <Tab label="In Progress" value="in_progress" />
                  <Tab label="Completed" value="completed" />
                </Tabs>
              </Box>

              {isLoadingSessions ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  p={4}
                >
                  <CircularProgress />
                </Box>
              ) : isErrorSessions ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  p={4}
                  bgcolor="error.light"
                  borderRadius={1}
                >
                  <ErrorOutline sx={{ mr: 1, color: "error.main" }} />
                  <Typography color="error">
                    Failed to load sessions. Please try again.
                  </Typography>
                </Box>
              ) : sessions.length === 0 ? (
                <Box
                  p={4}
                  bgcolor="grey.100"
                  borderRadius={1}
                  textAlign="center"
                >
                  <Typography variant="body1" mb={2}>
                    No sessions found for the selected filter.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try selecting a different status filter or check back later.
                  </Typography>
                </Box>
              ) : (
                <div>
                  {sessions.map((session) => (
                    <Card key={session.id} variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                          <Typography variant="h6" component="div">
                            Session #{session.id.slice(0, 8)}
                          </Typography>
                          <Chip 
                            label={session.status} 
                            color={getStatusColor(session.status)}
                            size="small"
                          />
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                          <LocationOn color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            From: {session.source}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                          <DirectionsCar color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            To: {session.destination}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                          <AccessTime color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Created: {formatDate(session.createdAt)}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                          <Person color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Created by: {session.createdBy.name}
                          </Typography>
                        </Box>

                        {session.seal && (
                          <Box sx={{ mb: 2, p: 2, bgcolor: "background.paper", borderRadius: 1, border: '1px solid rgba(0, 0, 0, 0.12)' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Seal Information
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                              <Lock color="action" sx={{ mr: 1 }} />
                              <Typography variant="body2">
                                Barcode: {session.seal.barcode}
                              </Typography>
                            </Box>
                            {session.seal.verified ? (
                              <Box sx={{ display: "flex", alignItems: "center" }}>
                                <CheckCircle color="success" sx={{ mr: 1 }} />
                                <Typography variant="body2">
                                  Verified by: {session.seal.verifiedBy?.name || "Unknown"}
                                  {session.seal.scannedAt && ` (${formatDate(session.seal.scannedAt)})`}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="warning.main">
                                Not verified yet
                              </Typography>
                            )}
                          </Box>
                        )}

                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                          <Button
                            variant="outlined"
                            size="small"
                            component={Link}
                            href={`/dashboard/sessions/${session.id}`}
                          >
                            View Details
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "employees" && (
            <div>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Box display="flex" alignItems="center">
                  <People sx={{ mr: 1 }} />
                  <Typography variant="h6">Your Employees</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Employees are assigned to your company by administrators
                </Typography>
              </Box>

              {isLoadingEmployees ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  p={4}
                >
                  <CircularProgress />
                </Box>
              ) : isErrorEmployees ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  p={4}
                  bgcolor="error.light"
                  borderRadius={1}
                >
                  <ErrorOutline sx={{ mr: 1, color: "error.main" }} />
                  <Typography color="error">
                    Failed to load employees. Please try again.
                  </Typography>
                </Box>
              ) : employees.length === 0 ? (
                <Box
                  p={4}
                  bgcolor="grey.100"
                  borderRadius={1}
                  textAlign="center"
                >
                  <Typography variant="body1" mb={2}>
                    You don't have any employees yet.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please contact an administrator to assign employees to your company.
                  </Typography>
                </Box>
              ) : (
                <List>
                  {employees.map((employee) => (
                    <Card key={employee.id} variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between">
                          <Box>
                            <Typography variant="h6">{employee.name}</Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              gutterBottom
                            >
                              {employee.email}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                bgcolor: "primary.light",
                                color: "primary.contrastText",
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                display: "inline-block",
                                textTransform: "capitalize",
                                fontSize: "0.75rem",
                              }}
                            >
                              {String(employee.subrole || employee.role).toLowerCase().replace("_", " ")}
                            </Typography>
                          </Box>
                          
                          <Box display="flex" flexDirection="column" alignItems="flex-end">
                            <Chip
                              label={getSubroleLabel(employee.subrole || null)}
                              color={getSubroleColor(employee.subrole || null)}
                              variant="outlined"
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontSize="0.75rem"
                            >
                              Since {formatDate(employee.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </List>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 