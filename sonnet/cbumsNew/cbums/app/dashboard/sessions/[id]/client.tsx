"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Divider, 
  Chip, 
  CircularProgress, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText
} from "@mui/material";
import { 
  LocationOn, 
  DirectionsCar, 
  AccessTime, 
  VerifiedUser, 
  ArrowBack, 
  Lock,
  CheckCircle,
  Warning,
  PictureAsPdf,
  TableChart,
  Description
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';

// Types
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
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  seal?: SealType | null;
  // Additional trip details from the session creation form
  tripDetails?: {
    transporterName?: string;
    materialName?: string;
    vehicleNumber?: string;
    gpsImeiNumber?: string;
    driverName?: string;
    driverContactNumber?: string;
    loaderName?: string;
    challanRoyaltyNumber?: string;
    doNumber?: string;
    freight?: number;
    qualityOfMaterials?: string;
    tpNumber?: string;
    grossWeight?: number;
    tareWeight?: number;
    netMaterialWeight?: number;
    loaderMobileNumber?: string;
    loadingSite?: string;
    receiverPartyName?: string;
  };
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  };
  timestamps?: {
    loadingDetails?: Record<string, string>;
    imagesForm?: Record<string, string>;
  };
  qrCodes?: {
    primaryBarcode?: string;
    additionalBarcodes?: string[];
  };
  activityLogs?: {
    id: string;
    action: string;
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
      };
    };
  }[];
};

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userSubrole, setUserSubrole] = useState("");
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  
  // New state for guard verification
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [verificationFields, setVerificationFields] = useState<{[key: string]: {
    operatorValue: any;
    guardValue: any;
    comment: string;
    isVerified: boolean;
  }}>({});
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [sealInput, setSealInput] = useState("");
  const [sealError, setSealError] = useState("");
  const [imageVerificationStatus, setImageVerificationStatus] = useState<{[key: string]: boolean}>({});
  
  // Check if user is a guard
  const isGuard = useMemo(() => 
    userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.GUARD, 
    [userRole, userSubrole]
  );
  
  // Check if user can access reports (non-GUARD users)
  const canAccessReports = useMemo(() => 
    userRole === "SUPERADMIN" || 
    userRole === "ADMIN" || 
    userRole === "COMPANY", 
    [userRole]
  );
  
  // Check if the session can be verified
  const canVerify = useMemo(() => 
    isGuard && 
    session?.status === SessionStatus.IN_PROGRESS && 
    session?.seal && 
    !session.seal.verified,
    [isGuard, session]
  );

  // Define fetchSessionDetails function
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) {
      console.log("No session ID available yet, skipping fetch");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      console.log("Fetching session details for ID:", sessionId);
      const response = await fetch(`/api/session/${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          throw new Error("Session not found");
        } else {
          throw new Error(`Failed to fetch session details: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log("Session data received:", !!data);
      setSession(data);
    } catch (err) {
      console.error("Error fetching session details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user && sessionId) {
      setUserRole(authSession.user.role as string);
      setUserSubrole(authSession.user.subrole as string);
      fetchSessionDetails();
    }
  }, [authStatus, authSession, sessionId, fetchSessionDetails]);

  useEffect(() => {
    // Initialize verification fields when session data is loaded
    if (session && isGuard) {
      const fields: {[key: string]: any} = {};
      
      // Add trip details fields for verification
      if (session.tripDetails) {
        Object.entries(session.tripDetails).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            fields[key] = {
              operatorValue: value,
              guardValue: '',
              comment: '',
              isVerified: false
            };
          }
        });
      }
      
      setVerificationFields(fields);
      
      // Initialize image verification status
      const imageStatus: {[key: string]: boolean} = {};
      if (session.images) {
        if (session.images.driverPicture) imageStatus['driverPicture'] = false;
        if (session.images.vehicleNumberPlatePicture) imageStatus['vehicleNumberPlatePicture'] = false;
        if (session.images.gpsImeiPicture) imageStatus['gpsImeiPicture'] = false;
        if (session.images.sealingImages?.length) imageStatus['sealingImages'] = false;
        if (session.images.vehicleImages?.length) imageStatus['vehicleImages'] = false;
        if (session.images.additionalImages?.length) imageStatus['additionalImages'] = false;
      }
      
      setImageVerificationStatus(imageStatus);
    }
  }, [session, isGuard]);

  // Calculate verification progress
  useEffect(() => {
    if (Object.keys(verificationFields).length === 0) return;
    
    const verified = Object.values(verificationFields).filter(f => f.isVerified).length;
    const total = Object.keys(verificationFields).length;
    
    const imagesVerified = Object.values(imageVerificationStatus).filter(status => status).length;
    const totalImages = Object.keys(imageVerificationStatus).length;
    
    // Add 1 for seal verification at the end
    const progress = Math.round(
      ((verified + imagesVerified) / (total + totalImages + 1)) * 100
    );
    
    setVerificationProgress(progress);
  }, [verificationFields, imageVerificationStatus]);

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

  const startVerification = () => {
    setVerificationFormOpen(true);
    setVerificationStep(0);
  };
  
  const handleInputChange = (field: string, value: any) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        guardValue: value
      }
    }));
  };
  
  const handleCommentChange = (field: string, comment: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        comment
      }
    }));
  };
  
  const verifyField = (field: string) => {
    const fieldData = verificationFields[field];
    const match = fieldData.operatorValue === fieldData.guardValue;
    
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        isVerified: true
      }
    }));
    
    return match;
  };
  
  const verifyImage = (imageKey: string) => {
    setImageVerificationStatus(prev => ({
      ...prev,
      [imageKey]: true
    }));
  };
  
  const verifyAllFields = () => {
    // Mark all fields as verified
    const updatedFields = {...verificationFields};
    Object.keys(updatedFields).forEach(field => {
      updatedFields[field].isVerified = true;
    });
    setVerificationFields(updatedFields);
    
    // Move to image verification
    setVerificationStep(1);
  };
  
  const getFieldLabel = (key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  const getVerificationStats = () => {
    const fieldStats = Object.entries(verificationFields).reduce(
      (acc, [field, data]) => {
        if (data.isVerified) {
          acc.verified++;
          if (data.operatorValue === data.guardValue) {
            acc.matched++;
          } else {
            acc.mismatched++;
          }
        }
        return acc;
      },
      { verified: 0, matched: 0, mismatched: 0, total: Object.keys(verificationFields).length }
    );
    
    const imageStats = {
      verified: Object.values(imageVerificationStatus).filter(v => v).length,
      total: Object.keys(imageVerificationStatus).length
    };
    
    return { fieldStats, imageStats };
  };
  
  // Modified version of handleVerifySeal to include validation of GUARD entered seal
  const handleVerifySeal = async () => {
    if (!session?.seal) return;
    
    // Validate seal input
    if (!sealInput) {
      setSealError("Please enter the seal barcode");
      return;
    }
    
    // Check if seal matches
    if (sealInput !== session.seal.barcode) {
      setSealError("The seal barcode you entered does not match the expected seal. Please verify and try again.");
      return;
    }
    
    // Verify all fields have been filled out
    const unverifiedFields = Object.keys(verificationFields).filter(field => 
      !verificationFields[field].isVerified
    );
    
    if (unverifiedFields.length > 0) {
      setError("Please verify all fields before completing the verification process");
      return;
    }
    
    // Check if all images have been verified
    const unverifiedImages = Object.keys(imageVerificationStatus).filter(key => 
      !imageVerificationStatus[key]
    );
    
    if (unverifiedImages.length > 0) {
      setError("Please verify all images before completing the verification process");
      return;
    }
    
    setVerifying(true);
    setError("");
    setSealError("");
    
    try {
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
          results[field] = {
            operatorValue: data.operatorValue,
            guardValue: data.guardValue,
            matches: data.operatorValue === data.guardValue,
            comment: data.comment
          };
          return results;
        },
        {} as Record<string, any>
      );
      
      const response = await fetch("/api/seals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          sealId: session.seal.id,
          verificationData: {
            fieldVerifications: fieldVerificationResults,
            imageVerifications: imageVerificationStatus,
            allMatch: Object.values(fieldVerificationResults).every(v => v.matches)
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify seal");
      }
      
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      // Refresh session details after verification
      fetchSessionDetails();
    } catch (err) {
      console.error("Error verifying seal:", err);
      setError(err instanceof Error ? err.message : "Failed to verify seal");
    } finally {
      setVerifying(false);
      setConfirmDialogOpen(false);
    }
  };
  
  const openConfirmDialog = () => {
    setConfirmDialogOpen(true);
  };
  
  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // Verification Form Step 1: Trip Details Verification
  const renderTripDetailsVerification = () => {
    const fieldEntries = Object.entries(verificationFields);
    
    if (fieldEntries.length === 0) {
      return (
        <Alert severity="info">
          No trip details to verify. Please proceed to the next step.
        </Alert>
      );
    }
    
    return (
      <>
        <Typography variant="h6" gutterBottom>
          Step 1: Verify Trip Details
        </Typography>
        
        <Typography variant="body2" paragraph>
          Enter the information as you see it physically. Do not refer to any previously entered values.
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          {fieldEntries.map(([field, data], index) => (
            <Paper key={field} elevation={1} sx={{ p: 2, mb: 2, bgcolor: data.isVerified ? (data.operatorValue === data.guardValue ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)') : 'inherit' }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {getFieldLabel(field)}
                </Typography>
                
                {data.isVerified && (
                  <Chip 
                    label={data.operatorValue === data.guardValue ? "Match" : "Mismatch"} 
                    color={data.operatorValue === data.guardValue ? "success" : "warning"}
                    size="small"
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: data.isVerified ? '1fr 1fr' : '1fr' }, gap: 2 }}>
                {/* Only show Operator's value after field is verified */}
                {data.isVerified && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Operator's Value:
                    </Typography>
                    <Typography variant="body2">
                      {data.operatorValue}
                    </Typography>
                  </Box>
                )}
                
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Your Verification:
                  </Typography>
                  <input
                    type={typeof data.operatorValue === 'number' ? 'number' : 'text'}
                    value={data.guardValue}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    placeholder="Enter verified value"
                    disabled={data.isVerified}
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ccc', 
                      borderRadius: '4px',
                      marginTop: '4px'
                    }}
                  />
                </Box>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Comments (optional):
                </Typography>
                <textarea
                  value={data.comment}
                  onChange={(e) => handleCommentChange(field, e.target.value)}
                  placeholder="Add comments about this field if needed"
                  disabled={data.isVerified}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    marginTop: '4px',
                    minHeight: '60px'
                  }}
                />
              </Box>
              
              {!data.isVerified && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => verifyField(field)}
                  >
                    Verify This Field
                  </Button>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button onClick={() => setVerificationFormOpen(false)} color="inherit">
            Cancel
          </Button>
          
          {Object.values(verificationFields).every(f => f.isVerified) ? (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => setVerificationStep(1)}
            >
              Next: Image Verification
            </Button>
          ) : (
            <Button 
              variant="contained" 
              color="primary"
              onClick={verifyAllFields}
            >
              Verify All Fields and Continue
            </Button>
          )}
        </Box>
      </>
    );
  };

  // Verification Form Step 2: Image Verification
  const renderImageVerification = () => {
    if (!session?.images || Object.keys(imageVerificationStatus).length === 0) {
      return (
        <Alert severity="info">
          No images to verify. Please proceed to the next step.
        </Alert>
      );
    }
    
    return (
      <>
        <Typography variant="h6" gutterBottom>
          Step 2: Verify Images
        </Typography>
        
        <Typography variant="body2" paragraph>
          Physically verify that these images match the actual vehicle, driver, and materials.
        </Typography>
        
        {session.images.driverPicture && (
          <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: imageVerificationStatus['driverPicture'] ? 'rgba(76, 175, 80, 0.1)' : 'inherit' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Driver Photo
              </Typography>
              
              {imageVerificationStatus['driverPicture'] ? (
                <Chip label="Verified" color="success" size="small" />
              ) : (
                <Button 
                  variant="outlined" 
                  color="primary"
                  size="small"
                  onClick={() => verifyImage('driverPicture')}
                >
                  Mark as Verified
                </Button>
              )}
            </Box>
            
            <Box 
              component="img" 
              src={session.images.driverPicture}
              alt="Driver Photo"
              sx={{ 
                width: '100%', 
                maxHeight: 300,
                objectFit: 'contain', 
                borderRadius: 1 
              }}
            />
          </Paper>
        )}
        
        {session.images.vehicleNumberPlatePicture && (
          <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: imageVerificationStatus['vehicleNumberPlatePicture'] ? 'rgba(76, 175, 80, 0.1)' : 'inherit' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Vehicle Number Plate
              </Typography>
              
              {imageVerificationStatus['vehicleNumberPlatePicture'] ? (
                <Chip label="Verified" color="success" size="small" />
              ) : (
                <Button 
                  variant="outlined" 
                  color="primary"
                  size="small"
                  onClick={() => verifyImage('vehicleNumberPlatePicture')}
                >
                  Mark as Verified
                </Button>
              )}
            </Box>
            
            <Box 
              component="img" 
              src={session.images.vehicleNumberPlatePicture}
              alt="Vehicle Number Plate"
              sx={{ 
                width: '100%', 
                maxHeight: 300,
                objectFit: 'contain', 
                borderRadius: 1 
              }}
            />
          </Paper>
        )}
        
        {/* Similar blocks for other image types... */}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button onClick={() => setVerificationStep(0)} color="inherit">
            Back
          </Button>
          
          {Object.values(imageVerificationStatus).every(status => status) ? (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => setVerificationStep(2)}
            >
              Next: Seal Verification
            </Button>
          ) : (
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => {
                // Mark all images as verified
                const updatedStatus = {...imageVerificationStatus};
                Object.keys(updatedStatus).forEach(key => {
                  updatedStatus[key] = true;
                });
                setImageVerificationStatus(updatedStatus);
                
                // Move to next step
                setVerificationStep(2);
              }}
            >
              Verify All Images and Continue
            </Button>
          )}
        </Box>
      </>
    );
  };

  // Verification Form Step 3: Seal Verification
  const renderSealVerification = () => {
    const stats = getVerificationStats();
    
    return (
      <>
        <Typography variant="h6" gutterBottom>
          Step 3: Final Verification & Seal Entry
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Verification Complete</AlertTitle>
          <Typography variant="body2" gutterBottom>
            You've completed the verification process. Below is a summary of your verification:
          </Typography>
          <ul>
            <li>
              <Typography variant="body2">
                Data Fields Verified: {stats.fieldStats.verified} of {stats.fieldStats.total}
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Matching Fields: {stats.fieldStats.matched} of {stats.fieldStats.verified} 
                {stats.fieldStats.mismatched > 0 && 
                  ` (${stats.fieldStats.mismatched} ${stats.fieldStats.mismatched === 1 ? 'mismatch' : 'mismatches'} found)`
                }
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                Images Verified: {stats.imageStats.verified} of {stats.imageStats.total}
              </Typography>
            </li>
          </ul>
        </Alert>
        
        {stats.fieldStats.mismatched > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="warning.main" gutterBottom>
              Mismatched Fields:
            </Typography>
            <List sx={{ bgcolor: 'background.paper', border: '1px solid rgba(255, 152, 0, 0.3)', borderRadius: 1 }}>
              {Object.entries(verificationFields)
                .filter(([_, data]) => data.isVerified && data.operatorValue !== data.guardValue)
                .map(([field, data]) => (
                  <ListItem key={field} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <ListItemText
                      primary={getFieldLabel(field)}
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.primary' }}>
                            Operator entered: <b>{data.operatorValue}</b>
                          </Typography>
                          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.primary' }}>
                            You verified: <b>{data.guardValue}</b>
                          </Typography>
                          {data.comment && (
                            <Typography component="span" variant="body2" sx={{ display: 'block', fontStyle: 'italic', mt: 1 }}>
                              Your comment: {data.comment}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
            </List>
          </Box>
        )}
        
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Enter Seal Barcode for Verification
          </Typography>
          
          <Typography variant="body2" paragraph>
            Please physically check the seal and enter its barcode below. This must match the seal assigned by the operator.
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <input
              type="text"
              value={sealInput}
              onChange={(e) => {
                setSealInput(e.target.value);
                setSealError(""); // Clear error when input changes
              }}
              placeholder="Enter seal barcode"
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: '1px solid #ccc', 
                borderRadius: '4px'
              }}
            />
            {sealError && (
              <Typography variant="caption" color="error">
                {sealError}
              </Typography>
            )}
          </Box>
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button onClick={() => setVerificationStep(1)} color="inherit">
            Back
          </Button>
          
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleVerifySeal}
            disabled={verifying}
          >
            {verifying ? "Verifying..." : "Complete Verification"}
          </Button>
        </Box>
      </>
    );
  };

  // Add a new function to display verification results
  const renderVerificationResults = () => {
    // Don't show verification results to GUARD users for IN_PROGRESS sessions
    if (isGuard && session?.status === SessionStatus.IN_PROGRESS) {
      return null;
    }
    
    if (!session?.status || session.status !== SessionStatus.COMPLETED) {
      return null;
    }
    
    // Try to find verification data in activity logs
    const verificationActivity = session.activityLogs?.find(log => 
      log.action === "UPDATE" && 
      log.details?.verification?.fieldVerifications
    );
    
    if (!verificationActivity) {
      return null;
    }
    
    const verificationDetails = verificationActivity.details?.verification;
    const allMatch = verificationDetails?.allMatch;
    const fieldVerifications = verificationDetails?.fieldVerifications || {};
    
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: allMatch ? 'rgba(76, 175, 80, 0.05)' : 'rgba(255, 152, 0, 0.05)', borderLeft: `4px solid ${allMatch ? '#4caf50' : '#ff9800'}` }}>
        <Typography variant="h6" gutterBottom color={allMatch ? "success.main" : "warning.main"} sx={{ display: 'flex', alignItems: 'center' }}>
          {allMatch ? <CheckCircle sx={{ mr: 1 }} /> : <Warning sx={{ mr: 1 }} />}
          Verification Results
        </Typography>
        
        {allMatch ? (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success">
              <AlertTitle>All Okay</AlertTitle>
              All fields verified by the guard match the operator's entries. Trip verification completed successfully.
            </Alert>
          </Box>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Guard verification found mismatches in the following fields:
            </Typography>
            
            <List sx={{ bgcolor: 'background.paper' }}>
              {Object.entries(fieldVerifications).filter(([, data]: [string, any]) => !data.matches).map(([field, data]: [string, any]) => (
                <ListItem key={field} sx={{ border: '1px solid rgba(0,0,0,0.12)', mb: 1, borderRadius: 1 }}>
                  <ListItemText
                    primary={getFieldLabel(field)}
                    secondary={
                      <Box>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.primary' }}>
                          Operator entered: <b>{data.operatorValue}</b>
                        </Typography>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.primary' }}>
                          Guard verified: <b>{data.guardValue}</b>
                        </Typography>
                        {data.comment && (
                          <Typography component="span" variant="body2" sx={{ display: 'block', fontStyle: 'italic', mt: 1 }}>
                            Comment: {data.comment}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Paper>
    );
  };

  // Function to generate and download PDF report using server API
  const handleTextReportDownload = async () => {
    if (!session) return;
    
    setReportLoading('text');
    try {
      // Use the simplified text report
      console.log("Attempting simplified report download...");
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/reports/sessions/${session.id}/pdf/simple?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate simplified report: ${response.status} ${response.statusText}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error("Received empty file");
      }
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link and click it to download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `session-${session.id}-report.txt`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Unable to generate text report. Please try again later.");
    } finally {
      setReportLoading(null);
    }
  };
  
  // Function to generate PDF on the client side using jsPDF
  const handlePdfDownload = async () => {
    if (!session) return;
    
    setReportLoading('pdf');
    try {
      // Create a new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Add content to PDF
      // Title
      doc.setFontSize(18);
      doc.text('Session Report', 105, 15, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(20, 20, 190, 20);
      
      let y = 30; // Starting y position
      
      // Session Information
      doc.setFontSize(14);
      doc.text('Session Information', 20, y);
      y += 10;
      
      doc.setFontSize(10);
      doc.text(`Session ID: ${session.id}`, 20, y); y += 5;
      doc.text(`Status: ${session.status}`, 20, y); y += 5;
      doc.text(`Created At: ${new Date(session.createdAt).toLocaleString()}`, 20, y); y += 5;
      doc.text(`Source: ${session.source || 'N/A'}`, 20, y); y += 5;
      doc.text(`Destination: ${session.destination || 'N/A'}`, 20, y); y += 5;
      doc.text(`Company: ${session.company.name}`, 20, y); y += 5;
      doc.text(`Created By: ${session.createdBy.name} (${session.createdBy.email})`, 20, y); y += 10;
      
      // Check for page break
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Seal Information
      doc.setFontSize(14);
      doc.text('Seal Information', 20, y);
      y += 10;
      
      doc.setFontSize(10);
      if (session.seal) {
        doc.text(`Barcode: ${session.seal.barcode || 'N/A'}`, 20, y); y += 5;
        doc.text(`Status: ${session.seal.verified ? 'Verified' : 'Not Verified'}`, 20, y); y += 5;
        
        if (session.seal.verified && session.seal.verifiedBy) {
          doc.text(`Verified By: ${session.seal.verifiedBy.name || 'N/A'}`, 20, y); y += 5;
          if (session.seal.scannedAt) {
            doc.text(`Verified At: ${new Date(session.seal.scannedAt).toLocaleString()}`, 20, y); y += 5;
          }
        }
      } else {
        doc.text('No seal information available', 20, y); y += 5;
      }
      
      y += 5; // Add some spacing
      
      // Check for page break
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Trip Details with all fields
      if (session.tripDetails && Object.keys(session.tripDetails).length > 0) {
        doc.setFontSize(14);
        doc.text('Trip Details', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        
        const tripDetailsFields = [
          { key: 'transporterName', label: 'Transporter Name' },
          { key: 'materialName', label: 'Material Name' },
          { key: 'vehicleNumber', label: 'Vehicle Number' },
          { key: 'gpsImeiNumber', label: 'GPS IMEI Number' },
          { key: 'driverName', label: 'Driver Name' },
          { key: 'driverContactNumber', label: 'Driver Contact Number' },
          { key: 'loaderName', label: 'Loader Name' },
          { key: 'loaderMobileNumber', label: 'Loader Mobile Number' },
          { key: 'challanRoyaltyNumber', label: 'Challan/Royalty Number' },
          { key: 'doNumber', label: 'DO Number' },
          { key: 'tpNumber', label: 'TP Number' },
          { key: 'qualityOfMaterials', label: 'Quality of Materials' },
          { key: 'freight', label: 'Freight' },
          { key: 'grossWeight', label: 'Gross Weight (kg)' },
          { key: 'tareWeight', label: 'Tare Weight (kg)' },
          { key: 'netMaterialWeight', label: 'Net Material Weight (kg)' },
          { key: 'loadingSite', label: 'Loading Site' },
          { key: 'receiverPartyName', label: 'Receiver Party Name' }
        ];
        
        // Add all trip details, even if they don't exist in this specific session
        for (const field of tripDetailsFields) {
          const value = session.tripDetails[field.key as keyof typeof session.tripDetails]; // Type-safe property access
          if (value !== undefined && value !== null) {
            doc.text(`${field.label}: ${value}`, 20, y);
            y += 5;
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          }
        }
        
        // Also add any custom fields that might exist but weren't in our predefined list
        for (const [key, value] of Object.entries(session.tripDetails)) {
          if (value !== undefined && value !== null && !tripDetailsFields.some(field => field.key === key)) {
            // Format key from camelCase to Title Case with spaces
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            doc.text(`${formattedKey}: ${value}`, 20, y);
            y += 5;
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          }
        }
      } else {
        doc.text('No trip details available', 20, y);
        y += 10;
      }
      
      // Check for page break
      if (y > 240) { // Leave more space for verification results
        doc.addPage();
        y = 20;
      }
      
      // Add verification results if completed
      if (session.status === SessionStatus.COMPLETED && session.activityLogs && session.activityLogs.length > 0) {
        doc.setFontSize(14);
        doc.text('Verification Results', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        
        // Try to find verification data in activity logs
        const verificationActivity = session.activityLogs.find(log => 
          log.action === "UPDATE" && 
          log.details?.verification?.fieldVerifications
        );
        
        if (verificationActivity) {
          const verificationDetails = verificationActivity.details?.verification;
          const allMatch = verificationDetails?.allMatch;
          const fieldVerifications = verificationDetails?.fieldVerifications || {};
          
          doc.text(`Verification Status: ${allMatch ? 'All Details Match' : 'Mismatches Found'}`, 20, y);
          y += 10;
          
          // List all fields (both matches and mismatches)
          for (const [field, data] of Object.entries(fieldVerifications)) {
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            doc.text(`Field: ${formattedField}`, 25, y); y += 5;
            doc.text(`Operator Value: ${(data as any).operatorValue}`, 30, y); y += 5;
            doc.text(`Guard Value: ${(data as any).guardValue}`, 30, y); y += 5;
            doc.text(`Match: ${(data as any).operatorValue === (data as any).guardValue ? 'Yes' : 'No'}`, 30, y); y += 5;
            
            if ((data as any).comment) {
              doc.text(`Comment: ${(data as any).comment}`, 30, y); y += 5;
            }
            
            y += 5; // Add some spacing between fields
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          }
        } else {
          doc.text('No verification details available', 20, y);
          y += 10;
        }
      }
      
      // Check for page break
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      
      // Add image information if available
      if (session.images) {
        doc.setFontSize(14);
        doc.text('Images Information', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        
        if (session.images.driverPicture) {
          doc.text('Driver Picture: Available', 20, y); y += 5;
        }
        
        if (session.images.vehicleNumberPlatePicture) {
          doc.text('Vehicle Number Plate Picture: Available', 20, y); y += 5;
        }
        
        if (session.images.gpsImeiPicture) {
          doc.text('GPS IMEI Picture: Available', 20, y); y += 5;
        }
        
        if (session.images.sealingImages && session.images.sealingImages.length > 0) {
          doc.text(`Sealing Images: ${session.images.sealingImages.length} available`, 20, y); y += 5;
        }
        
        if (session.images.vehicleImages && session.images.vehicleImages.length > 0) {
          doc.text(`Vehicle Images: ${session.images.vehicleImages.length} available`, 20, y); y += 5;
        }
        
        if (session.images.additionalImages && session.images.additionalImages.length > 0) {
          doc.text(`Additional Images: ${session.images.additionalImages.length} available`, 20, y); y += 5;
        }
        
        y += 5; // Add some spacing
      }
      
      // Check for page break
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      
      // Add QR code information if available
      if (session.qrCodes) {
        doc.setFontSize(14);
        doc.text('QR Codes', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        
        if (session.qrCodes.primaryBarcode) {
          doc.text(`Primary Barcode: ${session.qrCodes.primaryBarcode}`, 20, y); y += 5;
        }
        
        if (session.qrCodes.additionalBarcodes && session.qrCodes.additionalBarcodes.length > 0) {
          doc.text(`Additional Barcodes: ${session.qrCodes.additionalBarcodes.length} available`, 20, y); y += 5;
          session.qrCodes.additionalBarcodes.forEach((barcode, index) => {
            doc.text(`  ${index + 1}. ${barcode}`, 20, y); y += 5;
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          });
        }
        
        y += 5; // Add some spacing
      }
      
      // Add timestamp information if available
      if (session.timestamps) {
        doc.setFontSize(14);
        doc.text('Timestamps', 20, y);
        y += 10;
        
        doc.setFontSize(10);
        
        // Loading details timestamps
        if (session.timestamps.loadingDetails && Object.keys(session.timestamps.loadingDetails).length > 0) {
          doc.text('Loading Details Timestamps:', 20, y); y += 5;
          
          Object.entries(session.timestamps.loadingDetails).forEach(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            doc.text(`  ${formattedKey}: ${new Date(value).toLocaleString()}`, 20, y); y += 5;
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          });
        }
        
        // Images form timestamps
        if (session.timestamps.imagesForm && Object.keys(session.timestamps.imagesForm).length > 0) {
          doc.text('Images Form Timestamps:', 20, y); y += 5;
          
          Object.entries(session.timestamps.imagesForm).forEach(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            doc.text(`  ${formattedKey}: ${new Date(value).toLocaleString()}`, 20, y); y += 5;
            
            // Check if we need a new page
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
          });
        }
        
        y += 5; // Add some spacing
      }
      
      // Page footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleString()}`, 105, 290, { align: 'center' });
      }
      
      // Save the PDF file
      doc.save(`session-${session.id}.pdf`);
      
    } catch (err) {
      console.error("Error generating PDF:", err);
      setError("Unable to generate PDF report. Please try again later.");
    } finally {
      setReportLoading(null);
    }
  };
  
  // Function to generate and download Excel report
  const handleExcelDownload = async () => {
    if (!session) return;
    
    setReportLoading('excel');
    try {
      const response = await fetch(`/api/reports/sessions/${session.id}/excel`);
      
      if (!response.ok) {
        // Get more info from the API response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || `Failed to generate Excel: ${response.status} ${response.statusText}`);
        } else {
          throw new Error(`Failed to generate Excel: ${response.status} ${response.statusText}`);
        }
      }
      
      // Check content type to ensure we got an Excel file
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        console.warn("Unexpected content type:", contentType);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error("Received empty Excel file");
      }
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link and click it to download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `session-${session.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error("Error downloading Excel:", err);
      setError("Failed to download Excel report. Please try the PDF report instead.");
      
      // Fallback to client-side Excel generation could be added here
    } finally {
      setReportLoading(null);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="error" sx={{ mb: 3, width: "100%" }}>
            {error}
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="info" sx={{ mb: 3, width: "100%" }}>
            Session not found
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  // Modified Verification Box for Guards
  if (canVerify) {
    return (
      <Container maxWidth="md">
        <Box mb={3}>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>

        {/* Session Details View */}
        {!verificationFormOpen && (
          <>
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                  {isGuard ? "Trip Details" : "Session Details"}
                </Typography>
                <Chip 
                  label={session.status} 
                  color={getStatusColor(session.status)}
                  size="medium"
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {isGuard ? "Trip ID" : "Session ID"}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {session.id}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <LocationOn color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Source Location
                  </Typography>
                  <Typography variant="body1">
                    {session.source}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <DirectionsCar color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Destination
                  </Typography>
                  <Typography variant="body1">
                    {session.destination}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <AccessTime color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(session.createdAt)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <VerifiedUser color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {session.createdBy.name} ({session.createdBy.email})
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <VerifiedUser color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Company
                  </Typography>
                  <Typography variant="body1">
                    {session.company.name}
                  </Typography>
                </Box>
              </Box>

              {/* Trip Details Section - Hide from GUARD users for IN_PROGRESS sessions */}
              {session.tripDetails && Object.keys(session.tripDetails).length > 0 && 
                !(isGuard && session.status === SessionStatus.IN_PROGRESS) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="h6" gutterBottom>
                    Trip Details
                  </Typography>
                  
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    {session.tripDetails.transporterName && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Transporter Name</Typography>
                        <Typography variant="body1">{session.tripDetails.transporterName}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.materialName && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Material Name</Typography>
                        <Typography variant="body1">{session.tripDetails.materialName}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.vehicleNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Vehicle Number</Typography>
                        <Typography variant="body1">{session.tripDetails.vehicleNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.gpsImeiNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">GPS IMEI Number</Typography>
                        <Typography variant="body1">{session.tripDetails.gpsImeiNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.driverName && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Driver Name</Typography>
                        <Typography variant="body1">{session.tripDetails.driverName}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.driverContactNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Driver Contact</Typography>
                        <Typography variant="body1">{session.tripDetails.driverContactNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.loaderName && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Loader Name</Typography>
                        <Typography variant="body1">{session.tripDetails.loaderName}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.challanRoyaltyNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Challan/Royalty Number</Typography>
                        <Typography variant="body1">{session.tripDetails.challanRoyaltyNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.doNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">DO Number</Typography>
                        <Typography variant="body1">{session.tripDetails.doNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.freight !== undefined && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Freight</Typography>
                        <Typography variant="body1">{session.tripDetails.freight}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.qualityOfMaterials && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Quality of Materials</Typography>
                        <Typography variant="body1">{session.tripDetails.qualityOfMaterials}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.tpNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">TP Number</Typography>
                        <Typography variant="body1">{session.tripDetails.tpNumber}</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.grossWeight !== undefined && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Gross Weight</Typography>
                        <Typography variant="body1">{session.tripDetails.grossWeight} kg</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.tareWeight !== undefined && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Tare Weight</Typography>
                        <Typography variant="body1">{session.tripDetails.tareWeight} kg</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.netMaterialWeight !== undefined && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Net Material Weight</Typography>
                        <Typography variant="body1">{session.tripDetails.netMaterialWeight} kg</Typography>
                      </Box>
                    )}
                    
                    {session.tripDetails.loaderMobileNumber && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">Loader Mobile</Typography>
                        <Typography variant="body1">{session.tripDetails.loaderMobileNumber}</Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Paper>
            
            {/* The rest of the session detail components... */}
          </>
        )}

        {/* Verification Form */}
        {verificationFormOpen && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                Trip Verification Process
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Verification Progress:
                </Typography>
                <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 1, overflow: 'hidden' }}>
                  <Box 
                    sx={{ 
                      height: 10, 
                      width: `${verificationProgress}%`, 
                      bgcolor: 'primary.main',
                      transition: 'width 0.3s ease-in-out'
                    }} 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {verificationProgress}% Complete
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Step {verificationStep + 1} of 3
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            {verificationStep === 0 && renderTripDetailsVerification()}
            {verificationStep === 1 && renderImageVerification()}
            {verificationStep === 2 && renderSealVerification()}
          </Paper>
        )}

        {/* Dialogs and other UI components */}
        <Dialog open={confirmDialogOpen} onClose={closeConfirmDialog}>
          <DialogTitle>Confirm Trip Verification</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to verify this trip? This action will mark the trip as completed and cannot be undone.
            </DialogContentText>
            <DialogContentText sx={{ mt: 2, fontWeight: 'bold' }}>
              Please confirm that:
            </DialogContentText>
            <Box component="ul" sx={{ mt: 1 }}>
              <Box component="li">You have physically inspected the seal with barcode: {session?.seal?.barcode}</Box>
              <Box component="li">You have verified all trip details are accurate</Box>
              <Box component="li">The vehicle and materials match the description</Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirmDialog} color="inherit">Cancel</Button>
            <Button 
              onClick={handleVerifySeal} 
              color="success" 
              variant="contained"
              disabled={verifying}
            >
              {verifying ? "Verifying..." : "Confirm Trip Verification"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Verification Form Dialog */}
        <Dialog 
          open={verificationFormOpen} 
          onClose={() => setVerificationFormOpen(false)}
          maxWidth="md"
          fullWidth
          sx={{ '& .MuiDialogContent-root': { px: 3, pb: 3 } }}
        >
          <DialogTitle>
            Trip Verification Process
            <LinearProgress 
              variant="determinate" 
              value={verificationProgress} 
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Step {verificationStep + 1} of 3: {
                verificationStep === 0 ? "Trip Details Verification (Independent)" :
                verificationStep === 1 ? "Image Verification" :
                "Seal Verification"
              }
            </Typography>
            {verificationStep === 0 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Enter values exactly as you observe them, without seeing what the Operator entered
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {verificationStep === 0 && renderTripDetailsVerification()}
            {verificationStep === 1 && renderImageVerification()}
            {verificationStep === 2 && renderSealVerification()}
          </DialogContent>
        </Dialog>

        {/* Add Reports Section for SUPERADMIN, ADMIN, and COMPANY users */}
        {canAccessReports && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Session Reports
            </Typography>
            
            <Typography variant="body2" paragraph color="text.secondary">
              Generate and download reports for this session in your preferred format.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={reportLoading === 'pdf' ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdf />}
                onClick={handlePdfDownload}
                disabled={reportLoading !== null}
              >
                {reportLoading === 'pdf' ? 'Generating...' : 'Download PDF Report'}
              </Button>
              
              <Button
                variant="outlined"
                color="primary"
                startIcon={reportLoading === 'text' ? <CircularProgress size={20} color="inherit" /> : <Description />}
                onClick={handleTextReportDownload}
                disabled={reportLoading !== null}
              >
                {reportLoading === 'text' ? 'Generating...' : 'Download Text Report'}
              </Button>
              
              <Button
                variant="outlined"
                color="primary"
                startIcon={reportLoading === 'excel' ? <CircularProgress size={20} color="inherit" /> : <TableChart />}
                onClick={handleExcelDownload}
                disabled={reportLoading !== null}
              >
                {reportLoading === 'excel' ? 'Generating...' : 'Download Excel Report'}
              </Button>
            </Box>
          </Paper>
        )}

        {/* Comment section */}
        {!verificationFormOpen && <CommentSection sessionId={sessionId} />}

        {/* Verification Results */}
        {renderVerificationResults()}

        {/* Verification Box for Guards */}
        {canVerify && (
          <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'rgba(76, 175, 80, 0.05)', borderLeft: '4px solid #4caf50' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" gutterBottom color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ mr: 1 }} />
                  Trip Ready for Verification
                </Typography>
                <Typography variant="body2">
                  As a Guard, you need to independently verify each detail of this trip against physical inspection. You will not see the Operator's entries until after you submit your verification.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={startVerification}
              >
                Start Verification
              </Button>
            </Box>
            
            {verificationSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Seal verified successfully! The trip is now marked as completed.
              </Alert>
            )}
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      {/* Regular session view */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        {/* Session details */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            {isGuard ? "Trip Details" : "Session Details"}
          </Typography>
          <Chip 
            label={session.status} 
            color={getStatusColor(session.status)}
            size="medium"
          />
        </Box>

        {/* Basic session info */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {isGuard ? "Trip ID" : "Session ID"}
          </Typography>
          <Typography variant="body1" gutterBottom>
            {session.id}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <LocationOn color="action" sx={{ mr: 1 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Source Location
            </Typography>
            <Typography variant="body1">
              {session.source}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <DirectionsCar color="action" sx={{ mr: 1 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Destination
            </Typography>
            <Typography variant="body1">
              {session.destination}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <AccessTime color="action" sx={{ mr: 1 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="body1">
              {formatDate(session.createdAt)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <VerifiedUser color="action" sx={{ mr: 1 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Created By
            </Typography>
            <Typography variant="body1">
              {session.createdBy.name} ({session.createdBy.email})
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <VerifiedUser color="action" sx={{ mr: 1 }} />
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Company
            </Typography>
            <Typography variant="body1">
              {session.company.name}
            </Typography>
          </Box>
        </Box>

        {/* Trip Details Section - Hide from GUARD users for IN_PROGRESS sessions */}
        {session.tripDetails && Object.keys(session.tripDetails).length > 0 && 
          !(isGuard && session.status === SessionStatus.IN_PROGRESS) && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Trip Details
            </Typography>
            
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {session.tripDetails.transporterName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Transporter Name</Typography>
                  <Typography variant="body1">{session.tripDetails.transporterName}</Typography>
                </Box>
              )}
              
              {session.tripDetails.materialName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Material Name</Typography>
                  <Typography variant="body1">{session.tripDetails.materialName}</Typography>
                </Box>
              )}
              
              {session.tripDetails.vehicleNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Vehicle Number</Typography>
                  <Typography variant="body1">{session.tripDetails.vehicleNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.gpsImeiNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">GPS IMEI Number</Typography>
                  <Typography variant="body1">{session.tripDetails.gpsImeiNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.driverName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Driver Name</Typography>
                  <Typography variant="body1">{session.tripDetails.driverName}</Typography>
                </Box>
              )}
              
              {session.tripDetails.driverContactNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Driver Contact</Typography>
                  <Typography variant="body1">{session.tripDetails.driverContactNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.loaderName && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Loader Name</Typography>
                  <Typography variant="body1">{session.tripDetails.loaderName}</Typography>
                </Box>
              )}
              
              {session.tripDetails.challanRoyaltyNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Challan/Royalty Number</Typography>
                  <Typography variant="body1">{session.tripDetails.challanRoyaltyNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.doNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">DO Number</Typography>
                  <Typography variant="body1">{session.tripDetails.doNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.freight !== undefined && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Freight</Typography>
                  <Typography variant="body1">{session.tripDetails.freight}</Typography>
                </Box>
              )}
              
              {session.tripDetails.qualityOfMaterials && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Quality of Materials</Typography>
                  <Typography variant="body1">{session.tripDetails.qualityOfMaterials}</Typography>
                </Box>
              )}
              
              {session.tripDetails.tpNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">TP Number</Typography>
                  <Typography variant="body1">{session.tripDetails.tpNumber}</Typography>
                </Box>
              )}
              
              {session.tripDetails.grossWeight !== undefined && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Gross Weight</Typography>
                  <Typography variant="body1">{session.tripDetails.grossWeight} kg</Typography>
                </Box>
              )}
              
              {session.tripDetails.tareWeight !== undefined && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Tare Weight</Typography>
                  <Typography variant="body1">{session.tripDetails.tareWeight} kg</Typography>
                </Box>
              )}
              
              {session.tripDetails.netMaterialWeight !== undefined && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Net Material Weight</Typography>
                  <Typography variant="body1">{session.tripDetails.netMaterialWeight} kg</Typography>
                </Box>
              )}
              
              {session.tripDetails.loaderMobileNumber && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Loader Mobile</Typography>
                  <Typography variant="body1">{session.tripDetails.loaderMobileNumber}</Typography>
                </Box>
              )}
            </Box>
          </>
        )}
        
        {/* Show Seal Information - Hide barcode from GUARD users for IN_PROGRESS sessions */}
        {session.seal && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Seal Information
            </Typography>
            
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {/* Only show seal barcode if not a GUARD or session is not IN_PROGRESS */}
              {!(isGuard && session.status === SessionStatus.IN_PROGRESS) && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Seal Barcode</Typography>
                  <Typography variant="body1">{session.seal.barcode}</Typography>
                </Box>
              )}
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Seal Status</Typography>
                <Typography variant="body1">{session.seal.verified ? "Verified" : "Not Verified"}</Typography>
              </Box>
              
              {session.seal.verifiedBy && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Verified By</Typography>
                  <Typography variant="body1">{session.seal.verifiedBy.name}</Typography>
                </Box>
              )}
              
              {session.seal.scannedAt && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Verified At</Typography>
                  <Typography variant="body1">{formatDate(session.seal.scannedAt)}</Typography>
                </Box>
              )}
            </Box>
          </>
        )}
        
        {/* Show Images if available - Hide from GUARD users for IN_PROGRESS sessions */}
        {session.images && Object.values(session.images).some(img => img) && 
          !(isGuard && session.status === SessionStatus.IN_PROGRESS) && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Trip Images
            </Typography>
            
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
              {session.images.driverPicture && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Driver Picture</Typography>
                  <Box component="img" src={session.images.driverPicture} alt="Driver" 
                    sx={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'cover', borderRadius: 1 }} 
                  />
                </Box>
              )}
              
              {session.images.vehicleNumberPlatePicture && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Vehicle Number Plate</Typography>
                  <Box component="img" src={session.images.vehicleNumberPlatePicture} alt="Vehicle Number" 
                    sx={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'cover', borderRadius: 1 }} 
                  />
                </Box>
              )}
              
              {session.images.gpsImeiPicture && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>GPS IMEI</Typography>
                  <Box component="img" src={session.images.gpsImeiPicture} alt="GPS IMEI" 
                    sx={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'cover', borderRadius: 1 }} 
                  />
                </Box>
              )}
            </Box>
            
            {/* Sealing Images */}
            {session.images.sealingImages && session.images.sealingImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Sealing Images</Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {session.images.sealingImages.map((img, i) => (
                    <Box key={`sealing-${i}`} component="img" src={img} alt={`Sealing ${i+1}`} 
                      sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }} 
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Vehicle Images */}
            {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Vehicle Images</Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {session.images.vehicleImages.map((img, i) => (
                    <Box key={`vehicle-${i}`} component="img" src={img} alt={`Vehicle ${i+1}`} 
                      sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }} 
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Additional Images */}
            {session.images.additionalImages && session.images.additionalImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Additional Images</Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {session.images.additionalImages.map((img, i) => (
                    <Box key={`additional-${i}`} component="img" src={img} alt={`Additional ${i+1}`} 
                      sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }} 
                    />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
        
        {/* Show Guard Verification Data if verified */}
        {session.status === "COMPLETED" && session.activityLogs && session.activityLogs.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Verification Details
            </Typography>
            
            {session.activityLogs.map((log, index) => {
              if (log.details?.verification) {
                return (
                  <Box key={log.id || index} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Verification Result: {log.details.verification.allMatch ? "All Fields Match" : "Some Fields Don't Match"}
                    </Typography>
                    
                    {log.details.verification.fieldVerifications && (
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                        {Object.entries(log.details.verification.fieldVerifications).map(([field, data]) => (
                          <Box key={field}>
                            <Typography variant="subtitle2" color="text.secondary">{getFieldLabel(field)}</Typography>
                            <Box>
                              <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                                Operator: 
                              </Typography>{' '}
                              <Typography component="span" variant="body2" sx={{ fontWeight: 'bold' }}>
                                {(data as any).operatorValue}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                                Guard: 
                              </Typography>{' '}
                              <Typography component="span" variant="body2" sx={{ fontWeight: 'bold' }}>
                                {(data as any).guardValue}
                              </Typography>
                            </Box>
                            {(data as any).comment && (
                              <Typography component="span" variant="body2" sx={{ display: 'block', fontStyle: 'italic', mt: 1 }}>
                                Comment: {(data as any).comment}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              }
              return null;
            })}
          </>
        )}
      </Paper>

      {/* Add Reports Section for SUPERADMIN, ADMIN, and COMPANY users */}
      {canAccessReports && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Session Reports
          </Typography>
          
          <Typography variant="body2" paragraph color="text.secondary">
            Generate and download reports for this session in your preferred format.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={reportLoading === 'pdf' ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdf />}
              onClick={handlePdfDownload}
              disabled={reportLoading !== null}
            >
              {reportLoading === 'pdf' ? 'Generating...' : 'Download PDF Report'}
            </Button>
            
            <Button
              variant="outlined"
              color="primary"
              startIcon={reportLoading === 'text' ? <CircularProgress size={20} color="inherit" /> : <Description />}
              onClick={handleTextReportDownload}
              disabled={reportLoading !== null}
            >
              {reportLoading === 'text' ? 'Generating...' : 'Download Text Report'}
            </Button>
            
            <Button
              variant="outlined"
              color="primary"
              startIcon={reportLoading === 'excel' ? <CircularProgress size={20} color="inherit" /> : <TableChart />}
              onClick={handleExcelDownload}
              disabled={reportLoading !== null}
            >
              {reportLoading === 'excel' ? 'Generating...' : 'Download Excel Report'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Comment section */}
      <CommentSection sessionId={sessionId} />

      {/* Verification Results */}
      {renderVerificationResults()}
    </Container>
  );
} 