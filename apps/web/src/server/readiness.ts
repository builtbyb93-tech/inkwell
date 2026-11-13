import 'server-only';
import { ServerEnvironment } from '@inkwell/contracts';
import { createDatabase, type Database } from '@inkwell/db';
import { assessReadiness } from '@inkwell/domain';

let database: Database | undefined;

export async function isReady() {
  return assessReadiness(async () => {
    const result = ServerEnvironment.safeParse(process.env);
    if (!result.success || !result.data.DATABASE_URL) throw new Error('Configuration unavailable');
    database ??= createDatabase(result.data.DATABASE_URL);
    await database.$queryRaw`SELECT 1`;
  });
}
