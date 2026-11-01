import { PrismaClient } from '@prisma/client';

const ATTEMPTS = 6;
const DELAY_MS = 3000;

/**
 * Wakes the remote test database before any suite runs: a serverless Postgres (Neon) suspended
 * after inactivity can miss the first connection and fail an unrelated test.
 */
export default async function wakeTestDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return;

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        if (attempt === ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
