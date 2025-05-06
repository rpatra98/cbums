"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Box,
  CircularProgress,
  Alert
} from "@mui/material";
import { Add, Person } from "@mui/icons-material";
import { UserRole } from "@/prisma/enums";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string;
  coins: number;
  createdAt: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Only fetch if we have a valid session
    if (session?.user) {
      fetchEmployees();
    }
  }, [session]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = '/api/employees';
      
      // If user is a company, get employees for this company
      if (session?.user?.role === UserRole.COMPANY) {
        url = `/api/companies/${session.user.id}/employees`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }
      
      const data = await response.json();
      setEmployees(data);
      setError("");
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to load employees. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = () => {
    router.push("/dashboard/employees/create");
  };

  const handleViewEmployee = (id: string) => {
    router.push(`/dashboard/employees/${id}`);
  };

  if (!session) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Employees
        </Typography>
        {(session.user?.role === UserRole.ADMIN || session.user?.role === UserRole.COMPANY) && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleCreateEmployee}
          >
            Add Employee
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : employees.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body1">
            No employees found.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Coins</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.subrole || employee.role}</TableCell>
                  <TableCell>{employee.coins}</TableCell>
                  <TableCell>
                    {new Date(employee.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Person />}
                      onClick={() => handleViewEmployee(employee.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
} 