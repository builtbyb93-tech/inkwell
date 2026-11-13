import { randomUUID, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL is required; see .env.example.');
const source = new URL(raw);
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('Integration tests require a local, disposable PostgreSQL instance.');
}
if (!/^\/inkwell_[a-z0-9_]+$/i.test(source.pathname)) {
  throw new Error('Use a dedicated inkwell_ database. Tests never use an unrelated database.');
}
const name = `inkwell_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: raw, connectionTimeoutMillis: 3000 });
const target = new URL(raw);
target.pathname = `/${name}`;
const testEnv = {
  ...process.env,
  DATABASE_URL: target.toString(),
  NEXTAUTH_SECRET: randomBytes(32).toString('base64url'),
};
let created = false;
let exitCode = 1;
try {
  // name is generated locally from a UUID, never interpolated from user input.
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  for (const args of [
    ['node', 'scripts/database.mjs', 'migrate', 'deploy'],
    ['pnpm', 'exec', 'vitest', 'run', '--project', 'integration'],
  ]) {
    const [command, ...rest] = args;
    const result = spawnSync(command, rest, { env: testEnv, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Integration check failed.');
  }
  exitCode = 0;
} catch (error) {
  // Do not print database URLs or underlying driver errors containing credentials.
  console.error(
    error instanceof Error && error.message === 'Integration check failed.'
      ? error.message
      : 'Integration database setup failed; verify the local configuration.',
  );
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
process.exitCode = exitCode;
