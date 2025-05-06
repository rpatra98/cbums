"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { AdminDashboardProps } from "./types";
import { 
  CircularProgress, 
  Chip, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Alert,
  Button
} from "@mui/material";
import { Person, Work, Business } from "@mui/icons-material";
import { format } from "date-fns";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";

interface CompanyData {
  id: string;
  name: string;
  email: string;
  createdAt: string | Date;
  companyId?: string;
  _count?: {
    employees: number;
  };
  companyUserId?: string;
}

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string | null;
  coins: number;
  createdAt: string | Date;
  company?: CompanyData;
}

// Add a helper function before the component to ensure we're using the right company ID
function getCompanyLinkId(company: CompanyData) {
  // If company has a companyUserId, use that, otherwise use the company.id
  // This ensures we link to the right ID
  return company.companyUserId || company.id;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("companies");
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const { data: session, update: updateSession } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [currentUser, setCurrentUser] = useState(user);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [viewingCompanyEmployees, setViewingCompanyEmployees] = useState(false);

  useEffect(() => {
    if (activeTab === "companies") {
      fetchCompanies();
      // Reset the employee viewing state when switching to companies tab
      setViewingCompanyEmployees(false);
      setSelectedCompanyId(null);
    } else if (activeTab === "employees") {
      if (!viewingCompanyEmployees) {
        fetchEmployees();
      }
    } else if (activeTab === "coins") {
      fetchCurrentUser();
    }
  }, [activeTab]);

  const fetchCompanies = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      
      const data = await response.json();
      console.log("Fetched company data:", data);
      setCompanies(data);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");
    setViewingCompanyEmployees(false);
    setSelectedCompanyId(null);
    
    try {
      console.log("Fetching all employees for admin...");
      // Use the improved API endpoint that allows admins to fetch all employees
      const response = await fetch("/api/employees?limit=100");
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch employees: ${response.status} ${errorText}`);
      }
      
      const employeeData = await response.json();
      console.log("Received employee data:", employeeData);
      console.log("Number of employees:", Array.isArray(employeeData) ? employeeData.length : "Not an array");
      
      setEmployees(employeeData);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`/api/users/${session?.user?.id || user.id}`);
      const data = await response.json();
      
      if (data.user) {
        setCurrentUser(data.user);
        // Update session to reflect the latest user data
        await refreshUserSession();
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
    }
  };

  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy");
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

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Update the session to reflect the new coin balance
    await fetchCurrentUser();
  };

  const viewCompanyEmployees = async (companyId: string) => {
    setLoading(true);
    setError("");
    
    // Find the selected company
    const selectedCompany = companies.find(c => c.id === companyId);
    if (!selectedCompany) {
      setError("Company not found");
      setLoading(false);
      return;
    }
    
    // Use the actual company ID, not the user ID
    const actualCompanyId = selectedCompany.companyId || companyId;
    setSelectedCompanyId(companyId);
    
    try {
      console.log(`Fetching employees for company ${companyId} (actual company ID: ${actualCompanyId})`);
      // The companyId in the database is stored on employees, we need to pass it correctly
      const response = await fetch(`/api/employees?companyId=${actualCompanyId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch company employees: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} employees for company ${actualCompanyId}`);
      setEmployees(data);
      setViewingCompanyEmployees(true);
      setActiveTab("employees");
    } catch (err) {
      console.error("Error fetching company employees:", err);
      setError(err instanceof Error ? err.message : "Failed to load company employees");
      setViewingCompanyEmployees(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
        <p className="text-gray-600">
          Welcome, {user.name}. Manage companies, employees, and system coins.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("companies")}
              className={`py-4 px-6 ${
                activeTab === "companies"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Companies
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
              href="/dashboard/sessions"
              className={`py-4 px-6 text-gray-500 hover:text-gray-700 hover:border-gray-300`}
            >
              Session Management
            </Link>
            <button
              onClick={() => setActiveTab("coins")}
              className={`py-4 px-6 ${
                activeTab === "coins"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Coin Management
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
          {activeTab === "companies" && (
            <div>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center" 
                mb={3}
              >
                <h3 className="text-lg font-medium">Companies</h3>
                <Link href="/dashboard/companies/add">
                  <Button variant="contained" color="primary">
                    Add Company
                  </Button>
                </Link>
              </Box>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : companies.length === 0 ? (
                <div className="bg-gray-100 p-6 rounded-md text-center">
                  <p>No companies found. Start by adding a company.</p>
                  <Link href="/dashboard/companies/add">
                    <Button variant="contained" color="primary" sx={{ mt: 2 }}>
                      Add Your First Company
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company) => (
                    <Card key={company.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {company.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {company.email}
                        </Typography>
                        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                          <Chip 
                            label={`${company._count?.employees || 0} employees`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                          <Box>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => viewCompanyEmployees(company.id)}
                              sx={{ mr: 1 }}
                            >
                              View Employees
                            </Button>
                            <Link href={`/dashboard/companies/${getCompanyLinkId(company)}`}>
                              <Button size="small" variant="outlined">
                                Details
                              </Button>
                            </Link>
                          </Box>
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
                  {viewingCompanyEmployees && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => {
                        setActiveTab("companies");
                      }}
                      sx={{ mr: 2 }}
                    >
                      ← Back to Companies
                    </Button>
                  )}
                  <h3 className="text-lg font-medium">
                    {viewingCompanyEmployees 
                      ? `Employees for ${companies.find(c => c.id === selectedCompanyId)?.name || 'Company'}`
                      : 'All Employees'
                    }
                  </h3>
                </Box>
                <Link href="/dashboard/employees/add">
                  <Button variant="contained" color="primary">
                    Add Employee
                  </Button>
                </Link>
              </Box>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : employees.length === 0 ? (
                <div className="bg-gray-100 p-6 rounded-md text-center">
                  <p>
                    {viewingCompanyEmployees 
                      ? 'No employees found for this company.' 
                      : 'No employees found in the system.'
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((employee) => (
                    <Card key={employee.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {employee.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {employee.email}
                        </Typography>
                        
                        <Box display="flex" mt={1} mb={2}>
                          <Chip 
                            label={employee.role.toLowerCase()}
                            size="small" 
                            color="primary" 
                            sx={{ mr: 1, textTransform: 'capitalize' }}
                          />
                          {employee.subrole && (
                            <Chip 
                              label={String(employee.subrole).toLowerCase().replace('_', ' ')} 
                              size="small" 
                              color="secondary" 
                              sx={{ textTransform: 'capitalize' }}
                            />
                          )}
                        </Box>

                        {employee.company && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Company: {employee.company.name}
                          </Typography>
                        )}
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Coins: {employee.coins}
                          </Typography>
                          <Link href={`/dashboard/employees/${employee.id}`}>
                            <Button size="small" variant="outlined">
                              View Details
                            </Button>
                          </Link>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Box display="flex" alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              Joined: {formatDate(employee.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "coins" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Coin Management</h3>
              <div className="bg-gray-100 p-6 rounded-md mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium mb-2">Your Coin Balance</h4>
                    <p className="text-3xl font-bold text-yellow-600">
                      {session?.user?.coins || currentUser.coins} Coins
                    </p>
                  </div>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small"
                    onClick={fetchCurrentUser}
                  >
                    Refresh Balance
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transfer Coins Form */}
                <div>
                  <h4 className="font-medium mb-2">Transfer Coins</h4>
                  <TransferCoinsForm 
                    currentBalance={session?.user?.coins || currentUser.coins} 
                    onSuccess={handleTransferSuccess} 
                  />
                </div>
                
                {/* Transaction History */}
                <div>
                  <h4 className="font-medium mb-2">Transaction History</h4>
                  <TransactionHistory refreshTrigger={refreshTransactions} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 