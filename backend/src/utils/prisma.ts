let prismaClient: any = null;

try {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  } catch (_) {}

  const { PrismaClient } = require('@prisma/client');
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const connectionString = process.env.DATABASE_URL || '';
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool);

  prismaClient = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
  });
} catch (e) {
  // Mock proxy fallback for test/offline environments
  prismaClient = new Proxy({}, {
    get: (_target, prop) => {
      return new Proxy({}, {
        get: () => async () => null,
      });
    },
  });
}

export const prisma = prismaClient;
