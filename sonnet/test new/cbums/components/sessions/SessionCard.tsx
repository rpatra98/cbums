"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  Button, 
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper
} from "@mui/material";
import { 
  DirectionsCar, 
  LocationOn, 
  AccessTime,
  Verified,
  VerifiedUser,
  Lock,
  CheckCircle
} from "@mui/icons-material";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";

type SealType = {
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
};

type SessionType = {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  seal?: SealType | null;
};

type SessionCardProps = {
  session: SessionType;
  userRole: string;
  userSubrole?: string;
  onAddSeal?: (sessionId: string, barcode: string) => Promise<void>;
  onVerifySeal?: (sealId: string) => Promise<void>;
};

export default function SessionCard({ 
  session, 
  userRole, 
  userSubrole, 
  onAddSeal, 
  onVerifySeal 
}: SessionCardProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Check if user is a guard
  const isGuard = userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.GUARD;
  
  // Check if this session needs verification (has seal but not verified)
  const needsVerification = session.status === SessionStatus.IN_PROGRESS && 
                           session.seal && 
                           !session.seal.verified;
  
  // Debug logging for the Add Seal button conditions
  console.log("SessionCard Debug:", {
    sessionId: session.id,
    hasSeal: !!session.seal,
    userRole,
    userSubrole,
    sessionStatus: session.status,
    sealVerified: session.seal ? session.seal.verified : null,
    isEmployeeOperator: userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.OPERATOR,
    isPending: session.status === SessionStatus.PENDING,
    shouldShowAddSealButton: userRole === "EMPLOYEE" && 
                            userSubrole === EmployeeSubrole.OPERATOR && 
                            session.status === SessionStatus.PENDING &&
                            (!session.seal || (session.seal && !session.seal.verified))
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setBarcode("");
  };

  const handleAddSeal = async () => {
    if (!barcode.trim() || !onAddSeal) return;
    
    setIsSubmitting(true);
    try {
      await onAddSeal(session.id, barcode);
      handleCloseDialog();
    } catch (error) {
      console.error("Error adding seal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySeal = async () => {
    if (!session.seal || !onVerifySeal) return;
    
    setIsSubmitting(true);
    try {
      await onVerifySeal(session.seal.id);
    } catch (error) {
      console.error("Error verifying seal:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2,
        border: needsVerification && isGuard ? '1px solid #4caf50' : undefined,
        boxShadow: needsVerification && isGuard ? '0 0 8px rgba(76, 175, 80, 0.2)' : undefined
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" component="div">
            {isGuard ? `Trip #${session.id.slice(0, 8)}` : `Session #${session.id.slice(0, 8)}`}
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
          <VerifiedUser color="action" sx={{ mr: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Company: {session.company.name}
          </Typography>
        </Box>

        {session.seal ? (
          <Box sx={{ mb: 2, p: 2, bgcolor: needsVerification && isGuard ? "rgba(76, 175, 80, 0.08)" : "background.paper", borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {isGuard ? "Trip Seal Information" : "Seal Information"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Lock color="action" sx={{ mr: 1 }} />
              <Typography variant="body2">
                Barcode: {session.seal.barcode}
              </Typography>
            </Box>
            {session.seal.verified ? (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Verified color="success" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  Verified by: {session.seal.verifiedBy?.name || "Unknown"}
                  {session.seal.scannedAt && ` (${formatDate(session.seal.scannedAt)})`}
                </Typography>
              </Box>
            ) : (
              isGuard && (
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  onClick={handleVerifySeal}
                  disabled={isSubmitting}
                  startIcon={<CheckCircle />}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  View & Verify Trip
                </Button>
              )
            )}
          </Box>
        ) : null}

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            component={Link}
            href={`/dashboard/sessions/${session.id}`}
          >
            View Details
          </Button>
          
          {userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.OPERATOR && session.status === SessionStatus.PENDING && (!session.seal || (session.seal && !session.seal.verified)) ? (
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleOpenDialog}
            >
              Add Seal
            </Button>
          ) : needsVerification && isGuard && (
            <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle fontSize="small" sx={{ mr: 0.5 }} />
              Ready for verification
            </Typography>
          )}
        </Box>
      </CardContent>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Add Seal to Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="barcode"
            label="Seal Barcode"
            type="text"
            fullWidth
            variant="outlined"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleAddSeal} 
            disabled={!barcode.trim() || isSubmitting}
          >
            Add Seal
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
} 