import { PrismaClient } from '@prisma/client';

// This is important - it prevents Prisma from trying to connect during build time
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Check if we're running in production and if this is a build or serverless function
const isBuilding = process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Create a mock Prisma client for build time
const createMockPrismaClient = () => {
  return {
    $extends: () => createMockPrismaClient(),
    // Add other methods that might be used during build
  } as unknown as PrismaClient;
};

// Use a real Prisma client for runtime, mock during build
export const prisma = 
  // If it's already been created and we're not in the build phase, reuse it
  globalForPrisma.prisma || 
  // During build phase on Vercel, use a mock client
  (isBuilding ? createMockPrismaClient() :
  // Otherwise create a real client
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          console.error(`Prisma Error [${model}.${operation}]:`, error);
          throw error;
        }
      },
    },
  }));

// Only save the instance if we're not building and not in production
if (process.env.NODE_ENV !== 'production' && !isBuilding) {
  globalForPrisma.prisma = prisma;
}

// Export Prisma-generated types and enums
export * from '@prisma/client';

export default prisma; 