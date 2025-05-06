"use client";

import { useState, useEffect, useMemo, useContext } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
  FormHelperText
} from "@mui/material";
import { 
  ArrowBack, 
  ArrowForward, 
  PhotoCamera, 
  QrCode 
} from "@mui/icons-material";
import Link from "next/link";
import { EmployeeSubrole } from "@/prisma/enums";
import { SessionUpdateContext } from "@/app/dashboard/layout";

type CompanyType = {
  id: string;
  name: string;
};

type LoadingDetailsForm = {
  transporterName: string;
  materialName: string;
  receiverPartyName: string;
  vehicleNumber: string;
  gpsImeiNumber: string;
  driverName: string;
  driverContactNumber: string;
  loadingSite: string;
  loaderName: string;
  challanRoyaltyNumber: string;
  doNumber: string;
  freight: number;
  qualityOfMaterials: string;
  tpNumber: string;
  grossWeight: number;
  tareWeight: number;
  netMaterialWeight: number;
  loaderMobileNumber: string;
  timestamps: Record<string, string>;
};

type ImagesForm = {
  gpsImeiPicture: File | null;
  vehicleNumberPlatePicture: File | null;
  driverPicture: File | null;
  sealingImages: File[];
  vehicleImages: File[];
  additionalImages: File[];
  qrCodeData: string;
  manualQrData: string;
  scannedCodes: string[];
  qrCodeImage: File | null;
  timestamps: Record<string, string>;
};

export default function CreateSessionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Loading Details
  const [loadingDetails, setLoadingDetails] = useState<LoadingDetailsForm>({
    transporterName: "",
    materialName: "",
    receiverPartyName: "",
    vehicleNumber: "",
    gpsImeiNumber: "",
    driverName: "",
    driverContactNumber: "",
    loadingSite: "",
    loaderName: "",
    challanRoyaltyNumber: "",
    doNumber: "",
    freight: 0,
    qualityOfMaterials: "",
    tpNumber: "",
    grossWeight: 0,
    tareWeight: 0,
    netMaterialWeight: 0,
    loaderMobileNumber: "",
    timestamps: {}
  });

  // Step 2: Images & Verification
  const [imagesForm, setImagesForm] = useState<ImagesForm>({
    gpsImeiPicture: null,
    vehicleNumberPlatePicture: null,
    driverPicture: null,
    sealingImages: [],
    vehicleImages: [],
    additionalImages: [],
    qrCodeData: "",
    manualQrData: "",
    scannedCodes: [],
    qrCodeImage: null,
    timestamps: {}
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate net weight automatically
  useEffect(() => {
    if (loadingDetails.grossWeight && loadingDetails.tareWeight) {
      const netWeight = loadingDetails.grossWeight - loadingDetails.tareWeight;
      setLoadingDetails(prev => ({
        ...prev,
        netMaterialWeight: netWeight > 0 ? netWeight : 0,
        timestamps: {
          ...prev.timestamps,
          netMaterialWeight: new Date().toISOString()
        }
      }));
    }
  }, [loadingDetails.grossWeight, loadingDetails.tareWeight]);

  useEffect(() => {
    // Check if user is an operator
    if (status === "authenticated" && session?.user) {
      if (
        session.user.role !== "EMPLOYEE" || 
        session.user.subrole !== EmployeeSubrole.OPERATOR
      ) {
        router.push("/dashboard");
      }
    }
  }, [status, session, router]);

  const handleLoadingDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoadingDetails(prev => ({
      ...prev,
      [name]: value,
      timestamps: {
        ...prev.timestamps,
        [name]: new Date().toISOString()
      }
    }));
    
    // Clear validation error when field is modified
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof ImagesForm) => {
    if (!e.target.files?.length) return;
    
    if (fieldName === 'sealingImages' || fieldName === 'vehicleImages' || fieldName === 'additionalImages') {
      const filesArray = Array.from(e.target.files);
      setImagesForm(prev => ({
        ...prev,
        [fieldName]: [...prev[fieldName] as File[], ...filesArray],
        timestamps: {
          ...prev.timestamps,
          [fieldName]: new Date().toISOString()
        }
      }));
    } else {
      setImagesForm(prev => ({
        ...prev,
        [fieldName]: e.target.files?.[0] || null,
        timestamps: {
          ...prev.timestamps,
          [fieldName]: new Date().toISOString()
        }
      }));
    }
    
    // Clear validation error when file is uploaded
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fieldName];
        return newErrors;
      });
      }
  };

  const handleAddQrCode = () => {
    if (imagesForm.manualQrData) {
      setImagesForm(prev => ({
        ...prev,
        scannedCodes: [...prev.scannedCodes, prev.manualQrData],
        manualQrData: "",
        timestamps: {
          ...prev.timestamps,
          scannedCodes: new Date().toISOString()
        }
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 0) {
      // Validate Loading Details
      if (!loadingDetails.transporterName) newErrors.transporterName = "Transporter name is required";
      if (!loadingDetails.materialName) newErrors.materialName = "Material name is required";
      if (!loadingDetails.receiverPartyName) newErrors.receiverPartyName = "Receiver party name is required";
      
      if (!loadingDetails.vehicleNumber) {
        newErrors.vehicleNumber = "Vehicle number is required";
      } else if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(loadingDetails.vehicleNumber)) {
        newErrors.vehicleNumber = "Invalid vehicle number format (e.g., MH02AB1234)";
      }
      
      if (!loadingDetails.gpsImeiNumber) {
        newErrors.gpsImeiNumber = "GPS IMEI number is required";
      } else if (!/^\d+$/.test(loadingDetails.gpsImeiNumber)) {
        newErrors.gpsImeiNumber = "IMEI must contain only numbers";
      }
      
      if (!loadingDetails.driverName) newErrors.driverName = "Driver name is required";
      
      if (!loadingDetails.driverContactNumber) {
        newErrors.driverContactNumber = "Driver contact number is required";
      } else if (!/^\d{10}$/.test(loadingDetails.driverContactNumber)) {
        newErrors.driverContactNumber = "Contact number must be 10 digits";
      }
      
      if (!loadingDetails.loadingSite) newErrors.loadingSite = "Loading site is required";
      if (!loadingDetails.loaderName) newErrors.loaderName = "Loader name is required";
      if (!loadingDetails.challanRoyaltyNumber) newErrors.challanRoyaltyNumber = "Challan royalty number is required";
      if (!loadingDetails.doNumber) newErrors.doNumber = "DO number is required";
      if (!loadingDetails.freight) newErrors.freight = "Freight amount is required";
      if (!loadingDetails.tpNumber) newErrors.tpNumber = "TP number is required";
      if (!loadingDetails.grossWeight) newErrors.grossWeight = "Gross weight is required";
      if (!loadingDetails.tareWeight) newErrors.tareWeight = "Tare weight is required";
      
      if (!loadingDetails.loaderMobileNumber) {
        newErrors.loaderMobileNumber = "Loader mobile number is required";
      } else if (!/^\d{10}$/.test(loadingDetails.loaderMobileNumber)) {
        newErrors.loaderMobileNumber = "Mobile number must be 10 digits";
      }
    } else if (step === 1) {
      // Validate Images & Verification
      if (!imagesForm.gpsImeiPicture) newErrors.gpsImeiPicture = "GPS IMEI picture is required";
      if (!imagesForm.vehicleNumberPlatePicture) newErrors.vehicleNumberPlatePicture = "Vehicle number plate picture is required";
      if (!imagesForm.driverPicture) newErrors.driverPicture = "Driver's picture is required";
      if (imagesForm.sealingImages.length === 0) newErrors.sealingImages = "At least one sealing image is required";
      if (imagesForm.vehicleImages.length === 0) newErrors.vehicleImages = "At least one vehicle image is required";
    }
    
    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(activeStep)) {
      return;
    }
    
    setError("");
    setIsSubmitting(true);

    try {
      // Create form data to handle file uploads
      const formData = new FormData();
      
      // Add loading details
      Object.entries(loadingDetails).forEach(([key, value]) => {
        if (key !== 'timestamps') {
          formData.append(key, String(value));
        }
      });
      
      // Add timestamps for loading details
      formData.append('loadingDetailsTimestamps', JSON.stringify(loadingDetails.timestamps));
      
      // Add image files
      if (imagesForm.gpsImeiPicture) formData.append('gpsImeiPicture', imagesForm.gpsImeiPicture);
      if (imagesForm.vehicleNumberPlatePicture) formData.append('vehicleNumberPlatePicture', imagesForm.vehicleNumberPlatePicture);
      if (imagesForm.driverPicture) formData.append('driverPicture', imagesForm.driverPicture);
      
      // Add multiple files
      imagesForm.sealingImages.forEach((file, index) => {
        formData.append(`sealingImages[${index}]`, file);
      });
      
      imagesForm.vehicleImages.forEach((file, index) => {
        formData.append(`vehicleImages[${index}]`, file);
      });
      
      imagesForm.additionalImages.forEach((file, index) => {
        formData.append(`additionalImages[${index}]`, file);
      });
      
      // Add QR code data
      formData.append('scannedCodes', JSON.stringify(imagesForm.scannedCodes));
      
      // Add timestamps for images form
      formData.append('imagesFormTimestamps', JSON.stringify(imagesForm.timestamps));

      // Send the request without Content-Type header to allow browser to set correct boundary for FormData
      const response = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
        // Do not set Content-Type header as browser will set it automatically for FormData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      // Refresh the user session to update coin balance
      await refreshUserSession();

      // Redirect to the sessions page on success
      router.push("/dashboard/sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      console.error("Error submitting form:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ['Loading Details', 'Images & Verification'];

  if (status === "loading") {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Trip
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit}>
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Loading Details
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Transporter Name"
                  name="transporterName"
                  value={loadingDetails.transporterName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.transporterName}
                  helperText={validationErrors.transporterName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Material Name"
                  name="materialName"
                  value={loadingDetails.materialName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.materialName}
                  helperText={validationErrors.materialName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Receiver Party Name"
                  name="receiverPartyName"
                  value={loadingDetails.receiverPartyName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.receiverPartyName}
                  helperText={validationErrors.receiverPartyName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Vehicle Number"
                  name="vehicleNumber"
                  value={loadingDetails.vehicleNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  placeholder="MH02AB1234"
                  error={!!validationErrors.vehicleNumber}
                  helperText={validationErrors.vehicleNumber || "Format: MH02AB1234"}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="GPS IMEI Number"
                  name="gpsImeiNumber"
                  value={loadingDetails.gpsImeiNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.gpsImeiNumber}
                  helperText={validationErrors.gpsImeiNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Name"
                  name="driverName"
                  value={loadingDetails.driverName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.driverName}
                  helperText={validationErrors.driverName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Contact Number"
                  name="driverContactNumber"
                  value={loadingDetails.driverContactNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.driverContactNumber}
                  helperText={validationErrors.driverContactNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loading Site"
                  name="loadingSite"
                  value={loadingDetails.loadingSite}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loadingSite}
                  helperText={validationErrors.loadingSite}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Name"
                  name="loaderName"
                  value={loadingDetails.loaderName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loaderName}
                  helperText={validationErrors.loaderName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Mobile Number"
                  name="loaderMobileNumber"
                  value={loadingDetails.loaderMobileNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.loaderMobileNumber}
                  helperText={validationErrors.loaderMobileNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Challan Royalty Number"
                  name="challanRoyaltyNumber"
                  value={loadingDetails.challanRoyaltyNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.challanRoyaltyNumber}
                  helperText={validationErrors.challanRoyaltyNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="DO Number"
                  name="doNumber"
                  value={loadingDetails.doNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.doNumber}
                  helperText={validationErrors.doNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Freight"
                  name="freight"
                  value={loadingDetails.freight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  error={!!validationErrors.freight}
                  helperText={validationErrors.freight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Quality of Materials"
                  name="qualityOfMaterials"
                  value={loadingDetails.qualityOfMaterials}
                  onChange={handleLoadingDetailsChange}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="TP Number"
                  name="tpNumber"
                  value={loadingDetails.tpNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.tpNumber}
                  helperText={validationErrors.tpNumber}
                />
              </Box>

              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Gross Weight (kg)"
                  name="grossWeight"
                  value={loadingDetails.grossWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.grossWeight}
                  helperText={validationErrors.grossWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Tare Weight (kg)"
                  name="tareWeight"
                  value={loadingDetails.tareWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.tareWeight}
                  helperText={validationErrors.tareWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Net Material Weight (kg)"
                  value={loadingDetails.netMaterialWeight}
                  InputProps={{
                    readOnly: true,
                  }}
                  disabled
                />
              </Box>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Images & Verification
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload GPS IMEI Picture
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.gpsImeiPicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'gpsImeiPicture')}
                  />
                </Button>
                {imagesForm.gpsImeiPicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.gpsImeiPicture.name}
                  </Typography>
                )}
                {validationErrors.gpsImeiPicture && (
                  <FormHelperText error>{validationErrors.gpsImeiPicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Number Plate
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.vehicleNumberPlatePicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'vehicleNumberPlatePicture')}
                  />
                </Button>
                {imagesForm.vehicleNumberPlatePicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleNumberPlatePicture.name}
                  </Typography>
                )}
                {validationErrors.vehicleNumberPlatePicture && (
                  <FormHelperText error>{validationErrors.vehicleNumberPlatePicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Driver's Picture
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.driverPicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'driverPicture')}
                  />
                </Button>
                {imagesForm.driverPicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.driverPicture.name}
                  </Typography>
                )}
                {validationErrors.driverPicture && (
                  <FormHelperText error>{validationErrors.driverPicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Sealing Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'sealingImages')}
                  />
                </Button>
                {imagesForm.sealingImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.sealingImages.length} image(s) selected
                  </Typography>
                )}
                {validationErrors.sealingImages && (
                  <FormHelperText error>{validationErrors.sealingImages}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'vehicleImages')}
                  />
                </Button>
                {imagesForm.vehicleImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleImages.length} image(s) selected
                  </Typography>
                )}
                {validationErrors.vehicleImages && (
                  <FormHelperText error>{validationErrors.vehicleImages}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Capture Additional Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'additionalImages')}
                  />
                </Button>
                {imagesForm.additionalImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.additionalImages.length} image(s) selected
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <Typography variant="h6">
                  QR & Barcode Scanner
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<QrCode />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload QR Code Image
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'qrCodeImage')}
                  />
                </Button>
                {imagesForm.qrCodeImage && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.qrCodeImage.name}
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Manual QR/Barcode Entry"
                  value={imagesForm.manualQrData}
                  onChange={(e) => setImagesForm(prev => ({
                    ...prev,
                    manualQrData: e.target.value
                  }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button 
                          onClick={handleAddQrCode} 
                          disabled={!imagesForm.manualQrData}
                        >
                          Add
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Scanned Codes: {imagesForm.scannedCodes.length}
                </Typography>
                {imagesForm.scannedCodes.length > 0 && (
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    {imagesForm.scannedCodes.map((code, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        {index + 1}. {code}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <Box mt={4} display="flex" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            
            <Box>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Create Trip"
                  )}
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 