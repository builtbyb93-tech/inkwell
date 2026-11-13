import 'server-only';
import { createDatabase, type Database } from '@inkwell/db';

const globalDatabase = globalThis as typeof globalThis & { inkwellDatabase?: Database };
export function database(): Database {
  if (!globalDatabase.inkwellDatabase) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Database configuration unavailable.');
    globalDatabase.inkwellDatabase = createDatabase(url);
  }
  return globalDatabase.inkwellDatabase;
}
