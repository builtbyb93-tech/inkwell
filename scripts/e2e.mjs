import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('Configure a dedicated local database before browser tests.');
const source = new URL(raw);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) ||
  !/^\/inkwell_[a-z0-9_]+$/i.test(source.pathname)
)
  throw new Error('Browser tests require a dedicated local inkwell_ database.');
const name = `inkwell_e2e_${randomUUID().replaceAll('-', '')}`;
const target = new URL(raw);
target.pathname = `/${name}`;
const port = process.env.E2E_PORT ?? '3100';
const env = {
  ...process.env,
  DATABASE_URL: target.toString(),
  NEXTAUTH_SECRET: randomBytes(32).toString('base64url'),
  NEXTAUTH_URL: `http://127.0.0.1:${port}/api/v1/auth`,
};
const admin = new pg.Pool({ connectionString: raw, connectionTimeoutMillis: 3000 });
let created = false;
let code = 1;
try {
  const mail = new URL(process.env.MAILPIT_URL ?? 'http://127.0.0.1:18025');
  if (!['127.0.0.1', 'localhost'].includes(mail.hostname)) throw new Error('Local mail required.');
  const health = await fetch(new URL('/api/v1/messages', mail), {
    signal: globalThis.AbortSignal.timeout(3000),
  });
  if (!health.ok) throw new Error('Local mail unavailable.');
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  for (const args of [
    ['node', 'scripts/database.mjs', 'migrate', 'deploy'],
    ['pnpm', 'exec', 'playwright', 'test', ...process.argv.slice(2)],
  ]) {
    const [command, ...rest] = args;
    const result = spawnSync(command, rest, { env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Browser check failed.');
  }
  code = 0;
} catch {
  console.error(
    'Browser check failed; verify isolated PostgreSQL/Mailpit configuration and test output.',
  );
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
process.exitCode = code;
