"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Alert
} from "@mui/material";
import { ArrowLeft, Coins, Trash2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/prisma/enums";

interface AdminDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  coins: number;
  createdAt: string;
  updatedAt: string;
  createdCompanies: CreatedEntity[];
  createdEmployees: CreatedEntity[];
  stats: {
    totalCompanies: number;
    totalEmployees: number;
    totalSessions?: number;
  };
  sessions: SessionEntity[];
}

interface CreatedEntity {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  coins?: number;
  role?: string;
  company?: {
    id: string;
    name: string;
  };
}

interface SessionEntity {
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
    subrole: string;
  };
  seal?: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: string | null;
  };
}

interface Session {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  seal: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: Date | null;
  } | null;
}

export default function AdminDetailsPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [sessions, setSessions] = useState<SessionEntity[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const fetchAdminDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/admins/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch admin details");
      }
      const data = await response.json();
      setAdmin(data);
    } catch (err) {
      console.error("Error fetching admin details:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch admin details"));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (session?.user) {
      fetchAdminDetails();
    }
  }, [session?.user, fetchAdminDetails]);

  useEffect(() => {
    if (!session?.user) {
      router.push("/auth/login");
      return;
    }

    // Only superadmins can view admin details
    if (session.user.role !== UserRole.SUPERADMIN) {
      router.push("/dashboard");
    }
  }, [session?.user, router]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      setSessionsError(null);
      
      const response = await fetch(`/api/admins/${params.id}/sessions`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${errorText}`);
        throw new Error("Failed to fetch sessions");
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
      
      // Update stats if needed
      if (admin && data.totalCount !== undefined) {
        setAdmin({
          ...admin,
          stats: {
            ...admin.stats,
            totalSessions: data.totalCount
          }
        });
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setSessionsError("Failed to load sessions. Please try again later.");
    } finally {
      setLoadingSessions(false);
    }
  }, [params.id, admin]);

  // Fetch sessions when tab changes to sessions
  useEffect(() => {
    if (tabValue === 2 && params.id) {
      fetchSessions();
    }
  }, [tabValue, params.id, fetchSessions]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Handle admin deletion
  const handleDeleteAdmin = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    
    try {
      const response = await fetch(`/api/admins/${params.id}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is a resource constraint error
        if (data.resourceCount && data.resourceCount > 0) {
          throw new Error(
            `This admin has created ${data.resourceCount} resources. ` +
            `Please reassign or delete their companies and employees first.`
          );
        }
        throw new Error(data.error || "Failed to delete admin");
      }
      
      // Success - redirect back to dashboard
      toast.success("Admin deleted successfully");
      router.push("/dashboard/admins");
    } catch (err: unknown) {
      console.error("Error deleting admin:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete admin";
      setDeleteError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Get color for session status chip
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "IN_PROGRESS":
        return "info";
      case "COMPLETED":
        return "success";
      default:
        return "default";
    }
  };

  // Calculate if admin can be deleted (no companies or employees created)
  const canDeleteAdmin = !admin?.stats?.totalCompanies && !admin?.stats?.totalEmployees;

  if (!session?.user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please sign in to view admin details</Alert>
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
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  if (!admin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Admin not found</Alert>
      </Box>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outlined"
            size="small"
            onClick={() => router.push("/dashboard/admins")}
            startIcon={<ArrowLeft size={16} />}
          >
            Back
          </Button>
          <Typography variant="h5" component="h1" fontWeight="bold">
            Admin Details
          </Typography>
        </div>
        
        <Button 
          variant="contained"
          color="error"
          size="small"
          disabled={!canDeleteAdmin || deleteLoading}
          startIcon={<Trash2 size={16} />}
          onClick={() => setShowDeleteConfirm(true)}
          title={!canDeleteAdmin ? "Cannot delete admin with created resources" : "Delete admin"}
        >
          Delete Admin
        </Button>
      </div>
      
      {!canDeleteAdmin && (
        <Paper 
          sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: "warning.light", 
            color: "warning.dark",
            border: 1,
            borderColor: "warning.main"
          }}
          elevation={0}
        >
          <Typography>
            This admin cannot be deleted because they have created companies or employees. 
            Please reassign or delete these resources first.
          </Typography>
        </Paper>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader 
            title="Coin Balance" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {admin.coins.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Companies Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="info.main">
              {admin.stats.totalCompanies}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Employees Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {admin.stats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Total Sessions" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="h4" fontWeight="bold" color="secondary.main">
              {admin.stats.totalSessions || 0}
              {tabValue !== 2 && loadingSessions && (
                <CircularProgress size={16} sx={{ ml: 1 }} />
              )}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader 
            title="Account Created" 
            titleTypographyProps={{ variant: "subtitle2" }}
            sx={{ pb: 1 }}
          />
          <CardContent>
            <Typography variant="body1" fontWeight="medium">
              {formatDate(admin.createdAt)}
            </Typography>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-4">
          <Card>
            <CardHeader title="Basic Information" />
            <CardContent>
              <Box component="dl" sx={{ display: "grid", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                  <Typography>{admin.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                  <Typography>{admin.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Role</Typography>
                  <Chip label={admin.role} variant="outlined" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-8">
          <Card>
            <CardHeader title="Account Information" />
            <CardContent>
              <Box component="dl" sx={{ display: "grid", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Created At</Typography>
                  <Typography>{formatDate(admin.createdAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Last Updated</Typography>
                  <Typography>{formatDate(admin.updatedAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                  <Typography sx={{ wordBreak: "break-all" }}>{admin.id}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Box sx={{ width: '100%', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={`Companies Created (${admin.stats.totalCompanies})`} />
            <Tab label={`Employees Created (${admin.stats.totalEmployees})`} />
            <Tab label={`Sessions (${admin.stats.totalSessions || 0})`} />
          </Tabs>
        </Box>
        
        <Box hidden={tabValue !== 0} sx={{ pt: 3 }}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Company Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Created On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admin.createdCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">No companies created by this admin</TableCell>
                  </TableRow>
                ) : (
                  admin.createdCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.email}</TableCell>
                      <TableCell>{formatDate(company.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        <Box hidden={tabValue !== 1} sx={{ pt: 3 }}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Coins</TableCell>
                  <TableCell>Created On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admin.createdEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No employees created by this admin</TableCell>
                  </TableRow>
                ) : (
                  admin.createdEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.company?.name || 'N/A'}</TableCell>
                      <TableCell>
                        {employee.role === 'GUARD' 
                          ? 'Not Applicable' 
                          : employee.coins?.toLocaleString() || '0'}
                      </TableCell>
                      <TableCell>{formatDate(employee.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        <Box hidden={tabValue !== 2} sx={{ pt: 3 }}>
          {sessionsError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {sessionsError}
            </Alert>
          )}
          
          {loadingSessions ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Destination</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created On</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">No sessions found for companies managed by this admin</TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.id.substring(0, 8)}...</TableCell>
                        <TableCell>{session.source}</TableCell>
                        <TableCell>{session.destination}</TableCell>
                        <TableCell>{session.company.name}</TableCell>
                        <TableCell>{session.createdBy.name}</TableCell>
                        <TableCell>
                          <Chip 
                            label={session.status} 
                            color={getStatusColor(session.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(session.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            component={Link}
                            href={`/dashboard/sessions/${session.id}`}
                            size="small"
                            variant="outlined"
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>Delete Admin User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {canDeleteAdmin 
              ? "Are you sure you want to delete this admin user? This action cannot be undone."
              : "This admin user cannot be deleted because they have created companies or employees. You must first reassign or delete these resources."
            }
          </DialogContentText>
          {deleteError && (
            <Box mt={2} p={2} bgcolor="error.light" color="error.dark" borderRadius={1}>
              {deleteError}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAdmin} 
            color="error" 
            disabled={!canDeleteAdmin || deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 