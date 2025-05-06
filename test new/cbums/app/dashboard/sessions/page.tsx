"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Box,
  CircularProgress,
  Alert
} from "@mui/material";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/prisma/enums";

interface Session {
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

interface SessionError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SessionError | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError({
        message: 'Failed to load sessions. Please try again later.',
        details: err instanceof Error ? { originalError: err.message } : undefined
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const handleViewDetails = (sessionId: string) => {
    router.push(`/dashboard/sessions/${sessionId}`);
  };

  const handleAddSession = () => {
    router.push('/dashboard/sessions/create');
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Session deleted successfully');
        setSessions(sessions.filter((session) => session.id !== sessionId));
      } else {
        throw new Error(data.error || 'Failed to delete session');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError({
        message: 'Failed to delete session. Please try again later.',
        details: err instanceof Error ? { originalError: err.message } : undefined
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">
          {error.message}
          {error.details && (
            <Typography variant="caption" display="block">
              {JSON.stringify(error.details)}
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <Typography variant="h5" component="h1" fontWeight="bold">
          Sessions
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={16} />}
          onClick={handleAddSession}
        >
          Add Session
        </Button>
      </div>

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
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No sessions found
                </TableCell>
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
                      color={session.status === "COMPLETED" ? "success" : "warning"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatDate(session.createdAt)}</TableCell>
                  <TableCell align="right">
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
    </div>
  );
} 