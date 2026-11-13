import { spawn } from 'node:child_process';

const child = spawn(
  'pnpm',
  ['--filter', '@inkwell/web', 'dev', '--port', process.env.APP_PORT ?? '3000'],
  {
    env: process.env,
    stdio: 'inherit',
  },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
