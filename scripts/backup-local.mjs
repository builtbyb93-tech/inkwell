import { randomUUID, createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Storage, assertLocalTestStorage } from '@inkwell/storage';
import { sealBackup, openBackup, BackupError, retentionPlan } from '@inkwell/operations';

function local(raw, storage) {
  const url = new URL(raw);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^\/inkwell_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new BackupError();
  assertLocalTestStorage({
    S3_ENDPOINT: storage.endpoint,
    S3_REGION: storage.region,
    S3_BUCKET: storage.bucket,
    S3_ACCESS_KEY_ID: storage.accessKeyId,
    S3_SECRET_ACCESS_KEY: storage.secretAccessKey,
  });
  const ids = execFileSync(
    'docker',
    ['ps', '--filter', `publish=${url.port || 5432}`, '--format', '{{.ID}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n');
  if (ids.length !== 1 || !ids[0]) throw new BackupError();
  const info = JSON.parse(execFileSync('docker', ['inspect', ids[0]], { encoding: 'utf8' }))[0];
  const bindings = info.NetworkSettings.Ports['5432/tcp'] ?? [];
  const compose = info.Config.Labels['com.docker.compose.project'];
  const localCompose =
    /^inkwell_[a-z0-9_]+$/.test(process.env.COMPOSE_PROJECT_NAME ?? '') &&
    compose === process.env.COMPOSE_PROJECT_NAME;
  const isolatedCI =
    process.env.CI === 'true' && /^\/inkwell_test_[a-f0-9]{32}$/.test(url.pathname);
  if (
    !(localCompose || isolatedCI) ||
    !info.Config.Image.startsWith('postgres:17.') ||
    !bindings.some(
      (b) => b.HostPort === (url.port || '5432') && (b.HostIp === '127.0.0.1' || isolatedCI),
    )
  )
    throw new BackupError();
  return {
    container: ids[0],
    user: decodeURIComponent(url.username),
    database: url.pathname.slice(1),
  };
}
async function dockerFile(args, file, input = false) {
  const child = spawn('docker', ['exec', '-i', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume(); // Driver/tool output may contain connection or content details.
  const closed = new Promise((res, rej) => {
    child.on('error', rej);
    child.on('close', (code) => (code === 0 ? res() : rej(new BackupError())));
  });
  if (input) {
    child.stdout.resume();
    await Promise.all([pipeline(createReadStream(file), child.stdin), closed]);
  } else {
    child.stdin.end();
    await Promise.all([
      pipeline(child.stdout, createWriteStream(file, { flags: 'wx', mode: 0o600 })),
      closed,
    ]);
  }
}
function pool(url) {
  const result = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  result.on('error', () => {});
  return result;
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Local rehearsal only. Hosted backup activation is a separate reviewed operation. */
export async function backupLocal({ sourceUrl, storage, keyFile, output }) {
  let admin, connection, temporary;
  let stage = 'configuration';
  try {
    const config = local(sourceUrl, storage);
    stage = 'database';
    admin = pool(sourceUrl);
    connection = await admin.connect();
    if (
      Number((await connection.query('SHOW server_version_num')).rows[0].server_version_num) <
        170000 ||
      Number((await connection.query('SHOW server_version_num')).rows[0].server_version_num) >=
        180000
    )
      throw new BackupError();
    temporary = await mkdtemp(join(tmpdir(), 'inkwell-backup-'));
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await connection.query('SELECT pg_export_snapshot() AS snapshot')).rows[0]
      .snapshot;
    const rows = (
      await connection.query(
        'SELECT "objectKey","contentHash","byteSize" FROM "Snapshot" WHERE status=\'READY\' ORDER BY id LIMIT 10001',
      )
    ).rows;
    if (rows.length > 10000) throw new BackupError();
    const dump = join(temporary, 'database.dump');
    stage = 'dump';
    await dockerFile(
      [
        config.container,
        'pg_dump',
        '-U',
        config.user,
        '-d',
        config.database,
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--snapshot',
        snapshot,
      ],
      dump,
    );
    await connection.query('COMMIT');
    connection.release();
    connection = undefined;
    stage = 'objects';
    const sources = [{ file: dump }],
      objects = s3Storage(storage);
    for (const [index, row] of rows.entries()) {
      const bytes = await objects.get(row.objectKey, row.byteSize);
      if (bytes.length !== row.byteSize || hash(bytes) !== row.contentHash) throw new BackupError();
      const file = join(temporary, `object-${index}.json`);
      await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
      sources.push({ file, objectKey: row.objectKey });
    }
    stage = 'encryption';
    return await sealBackup(output, keyFile, sources);
  } catch {
    const safe = new BackupError();
    safe.message += ' Stage: ' + stage;
    throw safe;
  } finally {
    if (connection) {
      await connection.query('ROLLBACK').catch(() => {});
      connection.release();
    }
    if (admin) await admin.end();
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}

/** Restores only into a new local database and empty dedicated private bucket. */
export async function restoreLocal({
  sourceUrl,
  storage,
  keyFile,
  archive,
  targetName = 'inkwell_restore_' + randomUUID().replaceAll('-', ''),
}) {
  let opened, admin, restored;
  try {
    // Full authentication and file/hash validation precede any target provisioning.
    opened = await openBackup(archive, keyFile);
    const config = local(sourceUrl, storage);
    if (!/^inkwell_restore_[a-f0-9]{32}$/.test(targetName)) throw new BackupError();
    admin = pool(sourceUrl);
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [targetName])).rowCount)
      throw new BackupError();
    const client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      credentials: storage,
      forcePathStyle: true,
      maxAttempts: 1,
    });
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: storage.bucket, MaxKeys: 1 }),
    );
    if (list.Contents?.length) throw new BackupError();
    // Names are generated/strictly validated, never user SQL.
    await admin.query(`CREATE DATABASE "${targetName}"`);
    await dockerFile(
      [
        config.container,
        'pg_restore',
        '-U',
        config.user,
        '-d',
        targetName,
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
      ],
      opened.files[0].path,
      true,
    );
    const target = new URL(sourceUrl);
    target.pathname = '/' + targetName;
    restored = pool(target.toString());
    const rows = (
      await restored.query(
        'SELECT "objectKey","contentHash","byteSize" FROM "Snapshot" WHERE status=\'READY\' ORDER BY id',
      )
    ).rows;
    if (rows.length !== opened.files.length - 1) throw new BackupError();
    const expected = new Map(rows.map((row) => [row.objectKey, row]));
    const objects = s3Storage(storage);
    for (const file of opened.files.slice(1)) {
      const row = expected.get(file.entry.objectKey);
      const bytes = await readFile(file.path);
      if (!row || bytes.length !== row.byteSize || hash(bytes) !== row.contentHash)
        throw new BackupError();
      await objects.put(row.objectKey, bytes);
      if (hash(await objects.get(row.objectKey, row.byteSize)) !== row.contentHash)
        throw new BackupError();
      expected.delete(row.objectKey);
    }
    if (expected.size) throw new BackupError();
    await restored.query(`BEGIN;
      UPDATE "AuthSession" SET "revokedAt"=COALESCE("revokedAt",now());
      UPDATE "AuthToken" SET "consumedAt"=COALESCE("consumedAt",now());
      UPDATE "User" SET "authVersion"="authVersion"+1;
      UPDATE "ShareLink" SET "revokedAt"=now(),version=version+1,"updatedAt"=now() WHERE "revokedAt" IS NULL;
      UPDATE "Snapshot" SET status='FAILED',"updatedAt"=now() WHERE status='PENDING';
      COMMIT;`);
    return { database: targetName, verifiedObjects: rows.length, oldCapabilitiesRevoked: true };
  } catch {
    throw new BackupError();
  } finally {
    if (restored) await restored.end();
    if (admin) await admin.end();
    if (opened) await opened.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const action = process.argv[2];
    if (action === 'retention-plan') {
      const { readdir } = await import('node:fs/promises');
      console.log(JSON.stringify(retentionPlan(await readdir(resolve('.local/backups')))));
    } else {
      const { storageConfiguration } = await import('@inkwell/storage');
      const sourceUrl = process.env.DATABASE_URL,
        storage = storageConfiguration();
      const keyFile = process.env.INKWELL_BACKUP_KEY_FILE;
      if (!sourceUrl || !keyFile) throw new BackupError();
      if (action === 'create') {
        await mkdir('.local/backups', { recursive: true, mode: 0o700 });
        const output = resolve(
          '.local/backups',
          'inkwell-' + new Date().toISOString().replaceAll(/[-:.]/g, '') + '.iwb',
        );
        const result = await backupLocal({ sourceUrl, storage, keyFile, output });
        console.log(
          JSON.stringify({
            backup: output,
            entries: result.entries.length,
            encrypted: true,
            hosted: false,
          }),
        );
      } else if (action === 'restore' && process.argv[3]) {
        console.log(
          JSON.stringify(
            await restoreLocal({ sourceUrl, storage, keyFile, archive: resolve(process.argv[3]) }),
          ),
        );
      } else throw new BackupError();
    }
  } catch {
    console.error(
      'Local backup operation failed. No hosted operation or retention deletion was activated. Inspect the isolated configuration without printing credentials.',
    );
    process.exitCode = 1;
  }
}
