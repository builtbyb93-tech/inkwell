import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { database } from './database';
import { authConfig } from './config';
import { HttpError } from './http';

/** Each app replica has its own client; the atomic database window is shared. */
export function createRateLimiter(
  db: ReturnType<typeof database>,
  secret: string,
  clock = Date.now,
) {
  let lastCleanup = 0;
  return async function consume(operation: string, identifier: string, max: number, seconds = 60) {
    const now = clock();
    const windowStart = new Date(Math.floor(now / (seconds * 1000)) * seconds * 1000);
    const keyHash = createHmac('sha256', secret).update(`${operation}:${identifier}`).digest('hex');
    const rows = await db.$queryRaw<
      { count: number }[]
    >`INSERT INTO "RateLimitBucket" ("id","keyHash","windowStart","count") VALUES (${randomUUID()}::uuid,${keyHash},${windowStart},1) ON CONFLICT ("keyHash","windowStart") DO UPDATE SET "count"="RateLimitBucket"."count"+1 RETURNING "count"`;
    if (now - lastCleanup > 60000) {
      lastCleanup = now;
      await db.rateLimitBucket.deleteMany({
        where: { windowStart: { lt: new Date(now - 86400000) } },
      });
    }
    if (!rows[0] || rows[0].count > max)
      throw new HttpError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Please wait a minute and try again.',
      );
  };
}
let consume: ReturnType<typeof createRateLimiter> | undefined;
export async function limit(operation: string, identifier: string, max: number, seconds = 60) {
  consume ??= createRateLimiter(database(), authConfig().secret);
  return consume(operation, identifier, max, seconds);
}
export async function publicLimit(request: Request, operation: string, email?: string) {
  // Enable only behind an owner-configured proxy that strips incoming X-Forwarded-For.
  const ip =
    process.env.TRUST_PROXY === 'true'
      ? (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) ?? 'unknown')
      : 'untrusted';
  await limit('auth-global', 'all', 600);
  await limit(operation + ':ip', ip, 60);
  if (email) await limit(operation + ':email', email, 5);
}
