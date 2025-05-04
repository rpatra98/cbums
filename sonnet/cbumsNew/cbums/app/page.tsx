import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import LoginForm from "@/components/auth/LoginForm";
import { Container, Paper, Box, Typography } from "@mui/material";

export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get authentication session
  const session = await getServerSession(authOptions);
  
  // Extract searchParams using correct async method
  const callbackUrl = typeof searchParams?.callbackUrl === 'string' 
    ? searchParams.callbackUrl 
    : undefined;
    
  const errorCode = typeof searchParams?.error === 'string'
    ? searchParams.error
    : undefined;
    
  const needsLogout = searchParams?.needsLogout === 'true';
  
  // Only redirect to dashboard if authenticated AND there's no callbackUrl AND we don't need to logout
  if (session && !callbackUrl && !needsLogout) {
    redirect("/dashboard");
  }

  // Get user-friendly error message
  const errorMessage = errorCode ? getErrorMessage(errorCode) : undefined;

  return (
    <Box 
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'grey.900',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <Paper 
          elevation={8}
          sx={{
            p: 4, 
            borderRadius: 2,
            borderTop: 4,
            borderColor: 'primary.main',
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            align="center" 
            fontWeight="bold" 
            color="primary"
            sx={{ 
              mb: 4,
              background: 'linear-gradient(45deg, #1976d2 30%, #3f51b5 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            CBUMS - Login
          </Typography>
          {/* @ts-ignore - Pass props to client component */}
          <LoginForm 
            callbackUrl={callbackUrl} 
            initialError={errorMessage}
            needsLogout={needsLogout}
          />
        </Paper>
      </Container>
    </Box>
  );
}

// Helper function to convert error codes to user-friendly messages
function getErrorMessage(errorCode: string): string {
  switch(errorCode) {
    case 'NotAuthenticated':
      return 'You must be logged in to access this page';
    case 'UserNotFound':
      return 'User account not found';
    case 'InvalidSession':
      return 'Your session is invalid. Please log in again.';
    case 'SessionExpired':
      return 'Your session has expired. Please log in again.';
    case 'InvalidRole':
      return 'Invalid user role';
    case 'ServerError':
      return 'A server error occurred';
    case 'AuthError':
      return 'Authentication error';
    default:
      return 'An error occurred';
  }
}
