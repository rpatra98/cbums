"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { SuperAdminDashboardProps } from "./types";
import { CircularProgress, Card, CardContent, Typography, Box, Button } from "@mui/material";
import { format } from "date-fns";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  coins: number;
  hasCreatedResources: boolean;
}

export default function SuperAdminDashboard({ user: initialUser }: SuperAdminDashboardProps) {
  const { data: session, update: updateSession } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [activeTab, setActiveTab] = useState("admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalCompanies: 0,
    totalEmployees: 0,
    totalCoins: 0,
  });
  const [refreshTransactions, setRefreshTransactions] = useState(0);

  // Fetch admins if on admins tab
  useEffect(() => {
    if (activeTab === "admins") {
      fetchAdmins();
    } else if (activeTab === "stats") {
      fetchStats();
    }
  }, [activeTab]);

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      try {
        const response = await fetch(`/api/users/${session?.user?.id || initialUser.id}`);
        const data = await response.json();
        
        if (data.user) {
          setCurrentUser(data.user);
          // Update session to reflect the latest user data
          await refreshUserSession();
          return;
        }
      } catch (err) {
        console.error("Error fetching user details, trying fallback:", err);
      }
      
      // Fallback: try /api/users/me endpoint
      try {
        const meResponse = await fetch('/api/users/me');
        const meData = await meResponse.json();
        
        if (meData.id) {
          setCurrentUser(meData);
          // Update session to reflect the latest user data
          await refreshUserSession();
        }
      } catch (meErr) {
        console.error("Error in fallback user fetch:", meErr);
        // If all else fails, keep using initialUser from props
      }
    } catch (err) {
      console.error("Error fetching current user (all attempts failed):", err);
    }
  };

  // Fetch admins
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admins");
      const data = await response.json();
      
      if (data.admins) {
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch system stats
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Use dashboard/superadmin endpoint as a fallback if stats endpoint fails
      try {
        const response = await fetch("/api/stats");
        const data = await response.json();
        
        if (data.stats) {
          setStats(data.stats);
          setLoading(false);
          return;
        }
      } catch (statErr) {
        console.error("Error fetching from /api/stats, trying fallback:", statErr);
      }
      
      // Fallback to superadmin dashboard endpoint
      const fallbackResponse = await fetch("/api/dashboard/superadmin");
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.systemStats) {
        setStats({
          totalUsers: fallbackData.systemStats.admins + fallbackData.systemStats.companies + fallbackData.systemStats.employees + 1, // +1 for superadmin
          totalAdmins: fallbackData.systemStats.admins,
          totalCompanies: fallbackData.systemStats.companies,
          totalEmployees: fallbackData.systemStats.employees,
          totalCoins: fallbackData.coinFlow?.totalCoins || 0
        });
      }
    } catch (err) {
      console.error("Error fetching stats (all attempts failed):", err);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy");
  };

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Fetch updated user data to get the new coin balance
    await fetchCurrentUser();
  };

  // Always fetch user data when this component tab is set to coins
  useEffect(() => {
    if (activeTab === "coins") {
      fetchCurrentUser();
    }
  }, [activeTab]);

  // Initial load of stats if that's the active tab
  useEffect(() => {
    if (activeTab === "stats") {
      fetchStats();
    }
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">SuperAdmin Dashboard</h2>
        <p className="text-gray-600">
          Welcome, {currentUser.name}. You can manage admins, view system-wide stats, and transfer coins.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("admins")}
              className={`py-4 px-6 ${
                activeTab === "admins"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Admins
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`py-4 px-6 ${
                activeTab === "stats"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              System Stats
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
          {/* Coins Tab Content */}
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
          
          {/* Admins Tab Content */}
          {activeTab === "admins" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Manage Admins</h3>
              
              <div className="mb-4">
                <Link 
                  href="/dashboard/admins/create" 
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700"
                >
                  Create New Admin
                </Link>
              </div>
              
              {loading ? (
                <div className="flex justify-center p-6">
                  <CircularProgress />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {admins.map((admin) => (
                    <Card key={admin.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {admin.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {admin.email}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Typography variant="body2" color="text.secondary">
                            Created: {formatDate(admin.createdAt)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Coins: {admin.coins}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Link 
                            href={`/dashboard/admins/${admin.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Details
                          </Link>
                          {!admin.hasCreatedResources && (
                            <Link 
                              href={`/dashboard/admins/${admin.id}/delete`}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </Link>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Stats Tab Content */}
          {activeTab === "stats" && (
            <div>
              <h3 className="text-lg font-medium mb-4">System Statistics</h3>
              
              {loading ? (
                <div className="flex justify-center p-6">
                  <CircularProgress />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Users
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalUsers}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Companies
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalCompanies}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Employees
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalEmployees}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Coins in System
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalCoins}
                      </Typography>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 