import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with proper configuration for MongoDB on Vercel
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    throw new Error('DATABASE_URL environment variable is not set')
  }

  return new PrismaClient({
    log: ['error'],
  })
}

// Use singleton pattern to prevent multiple PrismaClient instances
export const db = globalForPrisma.prisma ?? createPrismaClient()

// In development, cache the Prisma client
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
