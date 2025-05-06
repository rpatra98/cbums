/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  
  // Temporarily disable TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Add redirects for company and employee detail pages
  async redirects() {
    return [
      // Specific redirects for company and employee detail pages
      {
        source: '/dashboard/companies/:id',
        destination: '/dashboard/company/:id',
        permanent: false,
      },
      {
        source: '/dashboard/employees/:id',
        destination: '/dashboard/employee/:id',
        permanent: false,
      },
      // Add redirect for the new admin page
      {
        source: '/dashboard/admins/new',
        destination: '/dashboard/admins/create',
        permanent: false,
      },
      // Use our catch-all handler only for specific paths, not conflicting with /dashboard
      {
        source: '/dashboard/companies',
        destination: '/dashboard-redirect/companies',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
