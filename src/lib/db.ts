import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with proper configuration for MongoDB on Vercel
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set')
    throw new Error('DATABASE_URL environment variable is not set')
  }

  console.log('Creating Prisma client with DATABASE_URL:', databaseUrl.substring(0, 30) + '...')

  return new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'colorless',
  })
}

// Use singleton pattern to prevent multiple PrismaClient instances
// This is crucial for serverless environments like Vercel
let prismaClient: PrismaClient

try {
  prismaClient = globalForPrisma.prisma ?? createPrismaClient()
} catch (error) {
  console.error('Failed to create Prisma client:', error)
  throw error
}

export const db = prismaClient

// In development, cache the Prisma client
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
