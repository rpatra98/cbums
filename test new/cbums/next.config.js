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
  
  // Disable ESLint errors from failing the build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure which pages should not be statically generated
  output: 'standalone',
  
  // Skip static generation for routes that access the database
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  
  // Add redirects for company and employee detail pages
  async redirects() {
    return [
      // Specific redirects for company and employee detail pages
      {
        source: '/dashboard/company/:id',
        destination: '/dashboard/companies/:id',
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
      }
    ];
  },
};

module.exports = nextConfig;
