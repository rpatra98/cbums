"use client";

import { useState, useContext, useEffect, useCallback } from "react";
import Link from "next/link";
import { EmployeeDashboardProps } from "./types";
import { Person, AccountCircle, Apartment, LocalAtm, DirectionsCar, CheckCircle } from "@mui/icons-material";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import { EmployeeSubrole } from "@/prisma/enums";

export default function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const { data: session } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [currentUser, setCurrentUser] = useState(user);
  const [verificationSessions, setVerificationSessions] = useState<any[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [operatorSessions, setOperatorSessions] = useState<any[]>([]);
  const [loadingOperatorSessions, setLoadingOperatorSessions] = useState(false);
  const [operatorSessionsError, setOperatorSessionsError] = useState("");
  
  // Format the subrole for display
  const formattedSubrole = user.subrole ? String(user.subrole).toLowerCase().replace('_', ' ') : '';
  
  // Check if user is a GUARD (they don't use coins)
  const isGuard = user.subrole === EmployeeSubrole.GUARD;
  
  // Check if user is an OPERATOR (they can manage trips and have coins)
  const isOperator = user.subrole === EmployeeSubrole.OPERATOR;

  // Fetch latest user data when tab changes to coins
  useEffect(() => {
    if (activeTab === "coins" && isOperator) {
      fetchCurrentUser();
    }
  }, [activeTab, isOperator]);

  // Fetch current user data
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

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Update the session to reflect the latest coin balance
    await fetchCurrentUser();
  };

  // Wrap fetchVerificationSessions in useCallback to prevent infinite loop
  const fetchVerificationSessions = useCallback(async () => {
    setLoadingVerifications(true);
    setVerificationError("");
    
    try {
      console.log("[GUARD DEBUG] Starting verification session fetch");
      console.log("[GUARD DEBUG] Guard user:", {
        id: user.id,
        name: user.name,
        companyId: user.companyId,
        subrole: user.subrole
      });
      
      // Use a specific query to get only sessions needing verification
      const response = await fetch(`/api/sessions?needsVerification=true&companyId=${user.companyId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GUARD DEBUG] API response not OK:", response.status, response.statusText);
        console.error("[GUARD DEBUG] API error details:", errorText);
        
        let errorMessage = "Failed to fetch sessions";
        try {
          // Try to parse error response as JSON
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseErr) {
          // If parsing fails, use the raw text
          if (errorText) {
            errorMessage = `Server error: ${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("[GUARD DEBUG] API response:", data);
      
      if (data.sessions && Array.isArray(data.sessions)) {
        console.log(`[GUARD DEBUG] Found ${data.sessions.length} sessions needing verification`);
        
        // Double-check on client side to ensure we only show valid sessions
        const sessionsNeedingVerification = data.sessions.filter((session: any) => {
          return (
            session.seal && 
            !session.seal.verified && 
            session.status === "IN_PROGRESS" &&
            String(session.companyId) === String(user.companyId)
          );
        });
        
        console.log(`[GUARD DEBUG] After client filtering: ${sessionsNeedingVerification.length} sessions`);
        
        setVerificationSessions(sessionsNeedingVerification);
      } else {
        console.error("[GUARD DEBUG] Unexpected API response format:", data);
        setVerificationSessions([]);
        setVerificationError("Received invalid data format from server");
      }
    } catch (err: any) {
      console.error("[GUARD DEBUG] Error fetching verification sessions:", err);
      setVerificationError(err?.message || "Failed to load sessions. Please try again.");
      setVerificationSessions([]);
    } finally {
      setLoadingVerifications(false);
    }
  }, [user.companyId, user.id, user.name, user.subrole]);

  // Fetch verification sessions when the tab changes to verifications
  useEffect(() => {
    if (activeTab === "verifications" && isGuard) {
      fetchVerificationSessions();
    }
  }, [activeTab, isGuard, fetchVerificationSessions]);

  // Fetch verification sessions when the component loads for GUARD users
  useEffect(() => {
    if (isGuard) {
      fetchVerificationSessions();
    }
  }, [isGuard, fetchVerificationSessions]);

  useEffect(() => {
    if (activeTab === "trips" && isOperator) {
      fetchOperatorSessions();
    }
  }, [activeTab, isOperator]);

  const fetchOperatorSessions = async () => {
    setLoadingOperatorSessions(true);
    setOperatorSessionsError("");
    
    try {
      const response = await fetch("/api/sessions");
      
      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }
      
      const data = await response.json();
      
      if (data.sessions && Array.isArray(data.sessions)) {
        // Sort sessions by creation date (newest first)
        const sortedSessions = [...data.sessions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        // Take only the 5 most recent sessions
        const recentSessions = sortedSessions.slice(0, 5);
        setOperatorSessions(recentSessions);
      } else {
        console.error("Unexpected API response format:", data);
        setOperatorSessions([]);
        setOperatorSessionsError("Received invalid data format from server");
      }
    } catch (err) {
      console.error("Error fetching operator sessions:", err);
      setOperatorSessionsError("Failed to load trips. Please try again.");
      setOperatorSessions([]);
    } finally {
      setLoadingOperatorSessions(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:space-x-6">
        {/* Sidebar */}
        <div className="w-full md:w-1/4 mb-6 md:mb-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mb-4">
                <AccountCircle fontSize="large" />
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-gray-600">{user.email}</p>
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <Person fontSize="small" className="mr-1" />
                <span className="capitalize">{user.role?.toLowerCase()} {user.subrole && `(${user.subrole})`}</span>
              </div>
              {user.company && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <Apartment fontSize="small" className="mr-1" />
                  <span>{user.company.name}</span>
                </div>
              )}
              {isOperator && (
                <div className="mt-4 flex items-center text-yellow-600 font-bold">
                  <LocalAtm fontSize="small" className="mr-1" />
                  <span>{session?.user?.coins || currentUser.coins} Coins</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <ul>
                <li className="mb-2">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeTab === "profile"
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Profile
                  </button>
                </li>
                {isOperator && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("coins")}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        activeTab === "coins"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Coin Management
                    </button>
                  </li>
                )}
                {isOperator && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("trips")}
                      className={`w-full text-left px-4 py-2 rounded-md ${
                        activeTab === "trips"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Trip Management
                    </button>
                  </li>
                )}
                {isGuard && (
                  <li className="mb-2">
                    <button
                      onClick={() => setActiveTab("verifications")}
                      className={`w-full text-left flex justify-between items-center px-4 py-2 rounded-md ${
                        activeTab === "verifications"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span>Trip Verification</span>
                      {verificationSessions.length > 0 && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {verificationSessions.length}
                        </span>
                      )}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full md:w-3/4">
          <div className="bg-white shadow rounded-lg p-6">
            {/* Profile content */}
            {activeTab === "profile" && (
              <div>
                <h3 className="text-lg font-medium mb-4">Profile Information</h3>
                
                {/* Notification for GUARD users when there are trips to verify */}
                {isGuard && (
                  <div className={verificationSessions.length > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"} 
                       style={{padding: "1rem", borderRadius: "0.375rem", marginBottom: "1rem", display: "flex", alignItems: "center"}}>
                    {verificationSessions.length > 0 ? (
                      <>
                        <CheckCircle color="success" sx={{ fontSize: 20, mr: 1 }} />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">
                            {verificationSessions.length} trip{verificationSessions.length !== 1 ? 's' : ''} awaiting verification
                          </p>
                          <p className="text-sm text-green-700">
                            There are trips ready for your verification. 
                            <button
                              onClick={() => setActiveTab("verifications")}
                              className="ml-2 underline font-medium"
                            >
                              View now
                            </button>
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle color="action" sx={{ fontSize: 20, mr: 1, opacity: 0.5 }} />
                        <div className="flex-1">
                          <p className="font-medium text-gray-700">
                            No trips awaiting verification
                          </p>
                          <p className="text-sm text-gray-600">
                            There are currently no trips that need verification.
                          </p>
                        </div>
                      </>
                    )}
                    <button 
                      onClick={fetchVerificationSessions}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-100 ml-3"
                    >
                      Refresh
                    </button>
                  </div>
                )}
                
                <div className="bg-gray-100 p-6 rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Name</h4>
                      <p className="text-gray-900">{user.name}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                      <p className="text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Role</h4>
                      <p className="text-gray-900 capitalize">{user.role?.toLowerCase()}</p>
                    </div>
                    {user.subrole && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Sub-Role</h4>
                        <p className="text-gray-900 capitalize">{formattedSubrole}</p>
                      </div>
                    )}
                    {user.company && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Company</h4>
                        <p className="text-gray-900">{user.company.name}</p>
                      </div>
                    )}
                    {isOperator && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Coins</h4>
                        <p className="text-gray-900">{session?.user?.coins || currentUser.coins}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Coins management content */}
            {activeTab === "coins" && isOperator && (
              <div>
                <h3 className="text-lg font-medium mb-4">Coin Management</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Your Coin Balance</h4>
                      <p className="text-3xl font-bold text-yellow-600">
                        {session?.user?.coins || currentUser.coins} Coins
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Each session creation costs 1 coin.
                      </p>
                    </div>
                    <button
                      onClick={fetchCurrentUser}
                      className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50"
                    >
                      Refresh Balance
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {/* Transaction History */}
                  <div>
                    <h4 className="font-medium mb-2">Transaction History</h4>
                    <TransactionHistory refreshTrigger={refreshTransactions} />
                  </div>
                </div>
              </div>
            )}

            {/* Trip Management content */}
            {activeTab === "trips" && isOperator && (
              <div>
                <h3 className="text-lg font-medium mb-4">Trip Management</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Your Trips</h4>
                      <p className="text-sm text-gray-600">Manage your company's transport trips</p>
                    </div>
                    <div className="flex">
                      <button
                        onClick={fetchOperatorSessions}
                        className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50 mr-2"
                      >
                        Refresh
                      </button>
                    <Link href="/dashboard/sessions/create">
                      <button className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                        Create New Trip
                      </button>
                    </Link>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {/* Trip List */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Recent Trips</h4>
                      <Link href="/dashboard/sessions">
                        <button className="px-3 py-1.5 border border-blue-500 text-blue-500 rounded-md text-xs hover:bg-blue-50">
                          View All Trips
                        </button>
                      </Link>
                    </div>
                    
                    {operatorSessionsError && (
                      <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                        {operatorSessionsError}
                      </div>
                    )}
                    
                    {loadingOperatorSessions ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : operatorSessions.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <DirectionsCar sx={{ fontSize: 48 }} className="mx-auto mb-4 text-gray-400" />
                        <p className="mb-2">No trips found</p>
                        <p className="text-sm">
                          Create a new trip to get started with trip management
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {operatorSessions.map((operatorSession) => (
                          <div key={operatorSession.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between mb-2">
                              <span className="font-medium">Trip #{operatorSession.id.slice(0, 8)}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                operatorSession.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                operatorSession.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
                                "bg-green-100 text-green-800"
                              }`}>
                                {operatorSession.status}
                              </span>
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">From:</span> {operatorSession.source}
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">To:</span> {operatorSession.destination}
                            </div>
                            
                            <div className="text-sm mb-1">
                              <span className="text-gray-600 mr-1">Created:</span> 
                              {new Date(operatorSession.createdAt).toLocaleDateString()}
                            </div>
                            
                            <div className="flex justify-between items-center mt-3">
                              <Link href={`/dashboard/sessions/${operatorSession.id}`}>
                                <button className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                                  View Details
                                </button>
                              </Link>
                              
                              {operatorSession.status === "PENDING" && !operatorSession.seal && (
                                <Link href={`/dashboard/sessions/${operatorSession.id}`}>
                                  <button className="px-3 py-1.5 border border-green-500 text-green-600 rounded-md text-sm hover:bg-green-50">
                                    Add Seal
                                  </button>
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex justify-center mt-6">
                      <Link href="/dashboard/sessions">
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200">
                          View All Trips
                        </button>
                      </Link>
                    </div>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-6">
                    <h4 className="font-medium mb-4">Trip Management Process</h4>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">1</div>
                        <div>
                          <h5 className="font-medium">Create Trip</h5>
                          <p className="text-sm text-gray-600">
                            Enter all required details including vehicle information, materials, and weights.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">2</div>
                        <div>
                          <h5 className="font-medium">Add Seal</h5>
                          <p className="text-sm text-gray-600">
                            Add a security seal with barcode to the trip once it's ready for transport.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">3</div>
                        <div>
                          <h5 className="font-medium">Guard Verification</h5>
                          <p className="text-sm text-gray-600">
                            A Guard will verify the seal and complete the trip at the destination.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trip Verification content for guards */}
            {activeTab === "verifications" && isGuard && (
              <div>
                <h3 className="text-lg font-medium mb-4">Trip Verification</h3>
                
                <div className="bg-gray-100 p-6 rounded-md mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium mb-2">Trips Awaiting Verification</h4>
                      <p className="text-sm text-gray-600">
                        Verify trip details and seals to complete transport trips
                      </p>
                    </div>
                    <button 
                      onClick={fetchVerificationSessions}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {verificationError && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                      {verificationError}
                    </div>
                  )}
                  
                  {loadingVerifications ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : verificationSessions.length === 0 ? (
                    <div className="bg-white border rounded-lg p-6 text-center py-10 text-gray-500">
                      <DirectionsCar sx={{ fontSize: 48 }} className="mx-auto mb-4 text-gray-400" />
                      <p className="mb-2">No trips awaiting verification</p>
                      <p className="text-sm">
                        All trips have been verified or there are no trips in progress.
                      </p>
                      
                      <div className="flex justify-center mt-4">
                        <Link href="/dashboard/sessions?status=IN_PROGRESS">
                          <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-blue-50">
                            View All In-Progress Trips
                          </button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Session Cards */}
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-medium mb-4">Trips Ready for Verification ({verificationSessions.length})</h4>
                        
                        <div className="space-y-4">
                          {verificationSessions.map((verificationSession) => (
                            <div key={verificationSession.id} className="border rounded-lg p-4 bg-green-50 border-green-100">
                              <div className="flex justify-between mb-2">
                                <span className="font-medium">Trip #{verificationSession.id.slice(0, 8)}</span>
                                <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full text-xs">
                                  {verificationSession.status}
                                </span>
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">From:</span> {verificationSession.source}
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">To:</span> {verificationSession.destination}
                              </div>
                              
                              <div className="text-sm mb-1">
                                <span className="text-gray-600 mr-1">Company:</span> {verificationSession.company.name}
                              </div>
                              
                              {verificationSession.seal && (
                                <div className="text-sm mb-2">
                                  <span className="text-gray-600 mr-1">Seal:</span> {verificationSession.seal.barcode}
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center mt-3">
                                <Link href={`/dashboard/sessions/${verificationSession.id}`}>
                                  <button className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600">
                                    View Details
                                  </button>
                                </Link>
                                
                                <div className="text-green-700 flex items-center text-sm">
                                  <CheckCircle fontSize="small" className="mr-1" />
                                  Ready to verify
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-medium mb-4">Verification Process</h4>
                        
                        <div className="space-y-4 mb-6">
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">1</div>
                            <div>
                              <h5 className="font-medium">View Trip Details</h5>
                              <p className="text-sm text-gray-600">
                                Check all trip details entered by the operator, including vehicle information, materials, and weights.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">2</div>
                            <div>
                              <h5 className="font-medium">Verify Physical Seal</h5>
                              <p className="text-sm text-gray-600">
                                Confirm the physical seal matches the barcode in the system and is properly applied.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="bg-blue-100 text-blue-800 rounded-full h-6 w-6 flex items-center justify-center mr-2 mt-0.5">3</div>
                            <div>
                              <h5 className="font-medium">Complete Verification</h5>
                              <p className="text-sm text-gray-600">
                                Click "Verify Seal" to mark the trip as verified and complete the transport process.
                              </p>
                            </div>
                          </div>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 