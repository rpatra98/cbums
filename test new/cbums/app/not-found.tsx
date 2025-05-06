import { Box, Typography, Button } from '@mui/material';

export default function NotFound() {
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
      <Typography variant="h1" gutterBottom sx={{ fontSize: '6rem', fontWeight: 'bold', color: 'primary.main' }}>
        404
      </Typography>
      <Typography variant="h2" gutterBottom>
        Page Not Found
      </Typography>
      <Typography variant="body1" paragraph sx={{ maxWidth: 600, mb: 4 }}>
        The page you are looking for doesn't exist or has been moved.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        href="/"
      >
        Back to Homepage
      </Button>
    </Box>
  );
} 