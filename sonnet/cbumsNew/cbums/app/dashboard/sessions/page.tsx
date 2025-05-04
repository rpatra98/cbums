"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert, 
  Button, 
  Tabs, 
  Tab 
} from "@mui/material";
import { AddCircleOutline, Refresh } from "@mui/icons-material";
import Link from "next/link";
import SessionCard from "@/components/sessions/SessionCard";
import { SessionStatus } from "@/prisma/enums";

type SessionType = any; // Using any for brevity, would use proper type in actual code

export default function SessionsPage() {
  const { data: session, status } = useSession();
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [userRole, setUserRole] = useState("");
  const [userSubrole, setUserSubrole] = useState("");

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUserRole(session.user.role as string);
      setUserSubrole(session.user.subrole as string);
      fetchSessions();
    }
  }, [status, session, activeTab]);

  const fetchSessions = async () => {
    setLoading(true);
    setError("");

    try {
      // Map the tab values to the SessionStatus enum values
      let statusParam = "";
      if (activeTab !== "all") {
        const statusMap: Record<string, string> = {
          "pending": "PENDING",
          "in_progress": "IN_PROGRESS",
          "completed": "COMPLETED"
        };
        statusParam = `status=${statusMap[activeTab]}`;
      }
      
      const response = await fetch(`/api/sessions?${statusParam}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      
      const data = await response.json();
      
      // Handle the response
      if (Array.isArray(data)) {
        setSessions(data);
      } else if (data.sessions && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        console.error("Unexpected API response format:", data);
        setSessions([]);
        setError("Received invalid data format from server");
      }
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError("Failed to load sessions. Please try again.");
      setSessions([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  const handleAddSeal = async (sessionId: string, barcode: string) => {
    try {
      const response = await fetch("/api/seals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, barcode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add seal");
      }
      
      // Refresh sessions to show the updated state
      fetchSessions();
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : "Failed to add seal"}`);
    }
  };

  const handleVerifySeal = async (sealId: string) => {
    try {
      // When called from the sessions list, redirect to the session details page
      // for full verification process instead of direct verification
      const session = sessions.find(s => s.seal?.id === sealId);
      if (session) {
        window.location.href = `/dashboard/sessions/${session.id}`;
        return;
      }
      
      // This code below won't run due to the redirect, but keeps the original behavior
      // in case it's needed for other scenarios
      const response = await fetch("/api/seals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          sealId,
          verificationData: {
            fieldVerifications: {},
            imageVerifications: {},
            allMatch: true
          } 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify seal");
      }
      
      // Refresh sessions to show the updated state
      fetchSessions();
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : "Failed to verify seal"}`);
    }
  };

  if (status === "loading") {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {userSubrole === "GUARD" ? "Trip Verification" : "Sessions"}
        </Typography>
        <Box>
          <Button 
            onClick={fetchSessions} 
            startIcon={<Refresh />} 
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          {userRole === "EMPLOYEE" && userSubrole === "OPERATOR" && (
            <Button
              component={Link}
              href="/dashboard/sessions/create"
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutline />}
            >
              New Trip
            </Button>
          )}
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab label="All" value="all" />
        <Tab label="Pending" value="pending" />
        <Tab label="In Progress" value="in_progress" />
        <Tab label="Completed" value="completed" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : sessions.length === 0 ? (
        <Alert severity="info">
          No sessions found. {userRole === "OPERATOR" && "Create a new session to get started."}
        </Alert>
      ) : (
        <Box>
          {activeTab === "in_progress" && userSubrole === "GUARD" && (
            <Alert severity="info" sx={{ mb: 3 }}>
              These trips are ready for verification. Click "View Details" to review all trip data, then click the "Verify Seal & Complete Trip" button to complete the verification process.
            </Alert>
          )}
          
          {Array.isArray(sessions) ? (
            sessions.map((session: any) => (
              <SessionCard
                key={session.id}
                session={session}
                userRole={userRole}
                userSubrole={userSubrole}
                onAddSeal={handleAddSeal}
                onVerifySeal={handleVerifySeal}
              />
            ))
          ) : (
            <Alert severity="error">
              Invalid session data format. Please contact support.
            </Alert>
          )}
        </Box>
      )}
    </Container>
  );
} 