import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createDatabase(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 2500,
    query_timeout: 2500,
    max: 5,
  });
  return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createDatabase>;

export { Prisma } from '../generated/prisma/client';
