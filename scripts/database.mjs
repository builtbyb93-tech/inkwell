import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args[0] === 'migrate') {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required for migrations.');
  const url = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(
      'Phase 0 tooling only migrates local databases. Remote migrations need a separate approved plan.',
    );
  }
  if (!/^\/inkwell_[a-z0-9_]+$/i.test(url.pathname)) {
    throw new Error('Use a dedicated database whose name starts with inkwell_.');
  }
}
const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
  cwd: fileURLToPath(new URL('../packages/db', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
