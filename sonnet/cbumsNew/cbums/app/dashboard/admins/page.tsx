"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  IconButton,
  Chip
} from "@mui/material";
import { Plus, Eye } from "lucide-react";
import { format } from "date-fns";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  coins: number;
  createdAt: string;
  hasCreatedResources: boolean;
}

export default function AdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admins');
        
        if (!response.ok) {
          throw new Error('Failed to fetch admins');
        }
        
        const data = await response.json();
        setAdmins(data.admins || []);
      } catch (err) {
        console.error('Error fetching admins:', err);
        setError('Failed to load admins. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdmins();
  }, []);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const handleViewDetails = (adminId: string) => {
    router.push(`/dashboard/admins/${adminId}`);
  };

  const handleAddAdmin = () => {
    router.push('/dashboard/admins/create');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Box p={2} color="error.main">{error}</Box>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <Typography variant="h5" component="h1" fontWeight="bold">
          Admin Users
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={16} />}
          onClick={handleAddAdmin}
        >
          Add Admin
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Coins</TableCell>
              <TableCell>Created On</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No admin users found
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.coins.toLocaleString()}</TableCell>
                  <TableCell>{formatDate(admin.createdAt)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={admin.hasCreatedResources ? "Has Resources" : "No Resources"} 
                      color={admin.hasCreatedResources ? "warning" : "success"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small"
                      onClick={() => handleViewDetails(admin.id)}
                      title="View Details"
                    >
                      <Eye size={18} />
                    </IconButton>
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