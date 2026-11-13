import { spawn } from 'node:child_process';
import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = path.join(root, 'apps/web');
const runtime = path.join(app, '.next/standalone/apps/web');
await cp(path.join(app, 'public'), path.join(runtime, 'public'), { recursive: true });
await cp(path.join(app, '.next/static'), path.join(runtime, '.next/static'), { recursive: true });
const args = process.argv.slice(2);
const port = args.includes('--port')
  ? args[args.indexOf('--port') + 1]
  : (process.env.APP_PORT ?? '3000');
if (!port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error('Invalid app port.');
const child = spawn(process.execPath, [path.join(runtime, 'server.js')], {
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: port },
  stdio: 'inherit',
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
