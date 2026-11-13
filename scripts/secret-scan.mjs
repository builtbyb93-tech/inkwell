import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error(
    'This pinned scanner bootstrap supports Linux x64. Use gitleaks 8.30.1 with equivalent verification on other hosts.',
  );
}
const version = '8.30.1';
const expected = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';
const directory = path.resolve('.tools/gitleaks');
const archive = path.join(directory, 'gitleaks.tar.gz');
const binary = path.join(directory, 'gitleaks');
await mkdir(directory, { recursive: true });
// curl honors standard proxy configuration in restricted build environments.
const bytes = execFileSync(
  'curl',
  [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--max-time',
    '60',
    `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz`,
  ],
  { maxBuffer: 32 * 1024 * 1024 },
);
if (createHash('sha256').update(bytes).digest('hex') !== expected)
  throw new Error('Scanner checksum mismatch.');
await writeFile(archive, bytes);
execFileSync('tar', ['-xzf', archive, '-C', directory, 'gitleaks']);
await chmod(binary, 0o755);
const snapshot = await mkdtemp(path.join(tmpdir(), 'inkwell-secret-scan-'));
try {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
  for (const file of files) {
    const source = path.resolve(file);
    if (!(await lstat(source)).isFile()) continue;
    const target = path.join(snapshot, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  const config = path.resolve('.gitleaks.toml');
  for (const args of [
    ['dir', snapshot, '--config', config, '--redact', '--no-banner'],
    ['git', '.', '--config', config, '--redact', '--no-banner'],
  ]) {
    const result = spawnSync(binary, args, { stdio: 'inherit' });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  }
} finally {
  await rm(snapshot, { recursive: true, force: true });
  await rm(archive);
}
