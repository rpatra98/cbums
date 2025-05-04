"use client";

import { useState, FormEvent, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  TextField, 
  Button, 
  Alert, 
  Typography, 
  CircularProgress,
  IconButton,
  Link
} from "@mui/material";
import { EmailOutlined, LockOutlined, Visibility, VisibilityOff } from "@mui/icons-material";

interface LoginFormProps {
  callbackUrl?: string;
  initialError?: string;
  forceLogout?: boolean;
  needsLogout?: boolean;
}

export default function LoginForm({ callbackUrl, initialError, forceLogout, needsLogout }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>(initialError || "");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Update error if initialError changes
  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  // Handle the need to log out the user
  useEffect(() => {
    if (needsLogout) {
      // Use direct navigation instead of NextAuth signOut
      window.location.href = '/api/auth/logout?callbackUrl=/';
    }
  }, [needsLogout]);

  // Show clear session button for session-related errors
  const showClearSessionButton = error.includes("session") || 
                                error.includes("User not found") || 
                                error.includes("UserNotFound") || 
                                error.includes("ServerError");

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogout = () => {
    // Avoid using NextAuth signOut directly - use our custom logout page
    window.location.href = '/api/auth/logout?callbackUrl=/';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Explicitly stringify and encode credentials to avoid JSON parsing issues
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || "/dashboard"
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.url) {
        // Use direct window location for more reliable navigation
        window.location.href = result.url;
      } else {
        // Fallback
        router.push(callbackUrl || "/dashboard");
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      {needsLogout && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {isLoading ? 
            "Signing you out for security reasons... Please wait." : 
            "Your session is invalid. You'll need to sign in again."}
        </Alert>
      )}
      
      {error && !isLoading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          {showClearSessionButton && (
            <Box mt={1}>
              <Typography variant="body2">
                If you keep seeing this error, try{" "}
                <Link 
                  component="button" 
                  variant="body2" 
                  onClick={handleLogout}
                  sx={{ fontWeight: 'bold' }}
                >
                  clearing your session
                </Link>
                {" "}and logging in again.
              </Typography>
            </Box>
          )}
        </Alert>
      )}
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label="Email Address"
        name="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        InputProps={{
          startAdornment: <EmailOutlined color="action" sx={{ mr: 1 }} />,
        }}
        sx={{ 
          mb: 2,
          '& .MuiInputBase-input': { color: 'text.primary' },
        }}
        disabled={isLoading}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        InputProps={{
          startAdornment: <LockOutlined color="action" sx={{ mr: 1 }} />,
          endAdornment: (
            <IconButton
              aria-label="toggle password visibility"
              onClick={handleTogglePasswordVisibility}
              edge="end"
              disabled={isLoading}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          ),
        }}
        sx={{ 
          mb: 2,
          '& .MuiInputBase-input': { color: 'text.primary' },
        }}
        disabled={isLoading}
      />
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        disabled={isLoading}
        sx={{ mt: 2, mb: 2, py: 1.5 }}
      >
        {isLoading ? <CircularProgress size={24} color="inherit" /> : "Login"}
      </Button>
      
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
        First time? Contact your administrator for an account.
      </Typography>
    </Box>
  );
} 