"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Stack,
  Alert, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  OutlinedInput,
  CircularProgress
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useSession } from "next-auth/react";

interface Company {
  id: string;
  name: string;
}

export default function CreateEmployeePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyId: "",
    subrole: EmployeeSubrole.OPERATOR,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // Check user authorization
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    // Only ADMIN and COMPANY can create employees
    if (
      session?.user?.role !== UserRole.ADMIN && 
      session?.user?.role !== UserRole.SUPERADMIN &&
      session?.user?.role !== UserRole.COMPANY
    ) {
      setUnauthorized(true);
      return;
    }

    // Fetch companies if authorized and an admin (companies can only add to their own company)
    if (session?.user?.role === UserRole.ADMIN || session?.user?.role === UserRole.SUPERADMIN) {
      fetchCompanies();
    } else if (session?.user?.role === UserRole.COMPANY) {
      // For company users, set their companyId directly - they can only create for their company
      if (session.user.companyId) {
        console.log("Setting company ID from session:", session.user.companyId);
        setFormData(prev => ({
          ...prev,
          companyId: session.user.companyId as string
        }));
        
        // Also fetch the companies to get the company name
        fetchCompanies();
        setIsLoadingCompanies(false);
      } else {
        // Handle case where company user doesn't have a company ID
        console.error("Company user has no company ID");
        setError("Your account is not properly associated with a company. Please contact an administrator.");
        setIsLoadingCompanies(false);
      }
    }
  }, [status, session, router]);

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      setIsLoadingCompanies(true);
      const response = await fetch("/api/companies");
      
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      
      const data = await response.json();
      console.log("Available companies:", data);
      
      if (data.length === 0) {
        setError("No companies found. Please create a company first.");
      }
      
      // Sort companies alphabetically by name for easier selection
      const sortedCompanies = [...data].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      setCompanies(sortedCompanies);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError("Failed to load companies. Please try again later.");
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Add a validator that uses the existing companies list
  const isValidCompanyId = (companyId: string): boolean => {
    return companies.some(company => company.id === companyId);
  };

  // Add a function to get company information
  const getCompanyName = (companyId: string): string => {
    const company = companies.find(c => c.id === companyId);
    return company ? company.name : "Unknown Company";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!formData.companyId) {
      setError("Please select a company or check your company association");
      setIsLoading(false);
      return;
    }

    // Validate company ID against our existing companies list
    if (!isValidCompanyId(formData.companyId) && session?.user?.role !== UserRole.COMPANY) {
      setError("The selected company does not exist in our database. Please select a valid company.");
      console.error("Invalid company ID:", formData.companyId);
      console.error("Available company IDs:", companies.map(c => c.id));
      setIsLoading(false);
      return;
    }

    console.log("Form data at submission:", formData);
    
    try {
      console.log("Submitting with company ID:", formData.companyId);
      
      // Find the company name for the selected ID to verify
      const selectedCompany = companies.find(c => c.id === formData.companyId);
      console.log("Selected company:", selectedCompany);
      
      const requestBody = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: UserRole.EMPLOYEE,
        subrole: formData.subrole,
        companyId: formData.companyId.trim() // Ensure no extra whitespace
      };
      
      console.log("Request payload:", JSON.stringify(requestBody));
      
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        const errorMessage = data.error || "Failed to create employee";
        console.error("API error:", errorMessage);
        
        // Handle specific error cases with more helpful messages
        if (errorMessage.includes("Company not found")) {
          throw new Error(`The company ID is invalid: "${formData.companyId}". This may happen if the company was recently deleted.`);
        } else if (errorMessage.includes("email")) {
          throw new Error("This email is already in use. Please try another email address.");
        } else {
          throw new Error(errorMessage);
        }
      }

      // Redirect to employees list on success
      router.push("/dashboard/employees");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      console.error("Error creating employee:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // If unauthorized, show unauthorized message
  if (unauthorized) {
    return (
      <Box sx={{ maxWidth: "md", mx: "auto", p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Unauthorized Access</Typography>
          <Typography>
            You do not have permission to create employees. Only administrators and company managers can add employees.
          </Typography>
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => router.push("/dashboard")}
          fullWidth
        >
          Return to Dashboard
        </Button>
      </Box>
    );
  }

  // If still loading session status, show loading
  if (status === "loading" || isLoadingCompanies) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Create Employee
      </Typography>
      
      <Paper elevation={3} sx={{ p: 4, mt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={3}>
            <TextField
              required
              fullWidth
              id="name"
              name="name"
              label="Employee Name"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <TextField
              required
              fullWidth
              id="email"
              name="email"
              type="email"
              label="Email Address"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl variant="outlined" fullWidth required>
                <InputLabel htmlFor="password">Password</InputLabel>
                <OutlinedInput
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label="Password"
                />
              </FormControl>
              
              <FormControl variant="outlined" fullWidth required>
                <InputLabel htmlFor="confirmPassword">Confirm Password</InputLabel>
                <OutlinedInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={toggleConfirmPasswordVisibility}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label="Confirm Password"
                />
              </FormControl>
            </Stack>
            
            {session?.user?.role === UserRole.ADMIN || session?.user?.role === UserRole.SUPERADMIN ? (
              <FormControl fullWidth required>
                <InputLabel id="company-label">Company</InputLabel>
                <Select
                  labelId="company-label"
                  id="companyId"
                  name="companyId"
                  value={formData.companyId}
                  onChange={handleChange}
                  label="Company"
                  disabled={isLoading}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
                {/* Show the selected company ID for debugging */}
                {formData.companyId && (
                  <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                    Selected Company ID: {formData.companyId}
                  </Typography>
                )}
              </FormControl>
            ) : (
              // For COMPANY role users, just show their company name if available
              session?.user?.companyId && (
                <>
                  <TextField
                    fullWidth
                    label="Company"
                    value={companies.length > 0 ? getCompanyName(session.user.companyId) : "Your Company"}
                    disabled
                  />
                  {/* Show the company ID for debugging */}
                  <Typography variant="caption" sx={{ mt: -2, mb: 2, color: 'text.secondary' }}>
                    Your Company ID: {session.user.companyId}
                  </Typography>
                </>
              )
            )}
            
            <FormControl fullWidth required>
              <InputLabel id="subrole-label">Employee Role</InputLabel>
              <Select
                labelId="subrole-label"
                id="subrole"
                name="subrole"
                value={formData.subrole}
                onChange={handleChange}
                label="Employee Role"
                disabled={isLoading}
              >
                <MenuItem value={EmployeeSubrole.OPERATOR}>Operator</MenuItem>
                <MenuItem value={EmployeeSubrole.DRIVER}>Driver</MenuItem>
                <MenuItem value={EmployeeSubrole.TRANSPORTER}>Transporter</MenuItem>
                <MenuItem value={EmployeeSubrole.GUARD}>Guard</MenuItem>
              </Select>
            </FormControl>
            
            {/* Debugging section - will help identify company ID issues */}
            {companies.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Available Companies (Debug Info)
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Make sure you're selecting a company ID that matches exactly what's shown below.
                  </Typography>
                </Alert>
                <Stack spacing={1}>
                  {companies.map((company) => (
                    <Box key={company.id} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: formData.companyId === company.id ? 'primary.light' : 'white' }}>
                      <Typography variant="body2" sx={{ fontWeight: formData.companyId === company.id ? 'bold' : 'normal' }}>
                        {company.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {company.id}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={isLoading}
              sx={{ mt: 2, py: 1.5 }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                  Creating...
                </>
              ) : (
                "Create Employee"
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
} 