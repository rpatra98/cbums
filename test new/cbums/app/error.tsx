'use client';

import { useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 4,
        textAlign: 'center',
      }}
    >
      <Typography variant="h2" gutterBottom color="error">
        Something went wrong!
      </Typography>
      <Typography variant="body1" paragraph sx={{ maxWidth: 600, mb: 4 }}>
        We apologize for the inconvenience. The application encountered an unexpected error.
        You can try resetting the application or go back to the homepage.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={reset}
        >
          Try again
        </Button>
        <Button
          variant="outlined"
          color="primary"
          href="/"
        >
          Go to Homepage
        </Button>
      </Box>
      {process.env.NODE_ENV !== 'production' && (
        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1, maxWidth: '100%', overflow: 'auto' }}>
          <Typography variant="subtitle2" color="error">
            Error details (development only):
          </Typography>
          <Typography variant="body2" component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {error.message}
          </Typography>
          {error.stack && (
            <Typography variant="body2" component="pre" sx={{ mt: 1, fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {error.stack}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
} 