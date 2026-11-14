import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { it, expect } from 'vitest';
import { storageConfiguration, s3Storage, assertLocalTestStorage } from '@inkwell/storage';
import { plainDocument } from '@inkwell/contracts';
import { database } from '../../apps/web/src/server/database';
import { createProject, createStory } from '../../apps/web/src/server/records';
import { createScene } from '../../apps/web/src/server/plot';
import {
  createSnapshot,
  issueShareLink,
  revokeShareLink,
} from '../../apps/web/src/server/snapshots';
import { backupLocal, restoreLocal } from '../../scripts/backup-local.mjs';
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl || !/^\/inkwell_test_[a-f0-9]{32}$/.test(new URL(sourceUrl).pathname))
  throw new Error('Use isolated runner.');
assertLocalTestStorage();
it('restores a consistent encrypted database and all frozen objects in isolation without reviving old capabilities', async () => {
  const db = database(),
    config = storageConfiguration(),
    temp = await mkdtemp(join(tmpdir(), 'inkwell-backup-sql-'));
  const bucket = config.bucket + '-restore-' + randomUUID().slice(0, 8),
    targetName = 'inkwell_restore_' + randomUUID().replaceAll('-', '');
  const container = execFileSync(
    'docker',
    ['ps', '--filter', `publish=${new URL(config.endpoint).port}`, '--format', '{{.ID}}'],
    { encoding: 'utf8' },
  ).trim();
  if (!/^[a-f0-9]{12}$/.test(container)) throw new Error('Use isolated local storage.');
  const garage = (...args) =>
    execFileSync('docker', ['exec', container, '/garage', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const restoredStorage = { ...config, bucket },
    restoredObjects = s3Storage(restoredStorage);
  const admin = new pg.Pool({ connectionString: sourceUrl });
  const backupRole = 'inkwell_backup_test_' + randomUUID().replaceAll('-', '');
  let backupRoleCreated = false,
    backupKeyId;
  let restored,
    keys = [],
    sourceKeys = [],
    createdBucket = false;
  try {
    const u = await db.user.create({
      data: { email: randomUUID() + '@example.test', workspace: { create: {} } },
      include: { workspace: true },
    });
    const a = {
      id: u.id,
      email: u.email,
      displayName: '',
      version: 1,
      workspaceId: u.workspace.id,
      aiEnabled: false,
    };
    const project = await createProject(a, {
        title: 'Backup voyage',
        description: 'A synthetic universe',
      }),
      story = await createStory(a, project.id, {
        title: 'Backup story',
        synopsis: 'A synthetic synopsis',
        format: 'Film',
      });
    const marker = 'Preserved scene ' + randomUUID();
    const scene = await createScene(
      a,
      { projectId: project.id, storyId: story.id },
      { title: marker, content: plainDocument('Preserve this exact draft'), status: 'DRAFT' },
    );
    const snap = await createSnapshot(a, project.id, {
      title: 'Backup snapshot',
      selection: {
        project: false,
        storyIds: [story.id],
        ideaIds: [],
        canonIds: [],
        sceneIds: [scene.id],
        groupIds: [],
        relationships: false,
      },
    });
    const link = await issueShareLink(a, project.id, snap.snapshot.id, {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: true,
    });
    const session = await db.authSession.create({
      data: { userId: u.id, authVersion: u.authVersion, expiresAt: new Date(Date.now() + 3600000) },
    });
    const auth = await db.authToken.create({
      data: {
        userId: u.id,
        purpose: 'RESET_PASSWORD',
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const keyFile = join(temp, 'key');
    await writeFile(keyFile, randomBytes(32), { mode: 0o600 });
    const archive = join(temp, 'backup.iwb');
    const backupPassword = randomBytes(32).toString('hex');
    await admin.query(
      'CREATE ROLE "' +
        backupRole +
        '" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ' +
        "'" +
        backupPassword +
        "'",
    );
    backupRoleCreated = true;
    const grants = (
      await readFile(new URL('../../deploy/backup-grants.sql', import.meta.url), 'utf8')
    ).replaceAll(':"backup_role"', '"' + backupRole + '"');
    await admin.query(grants);
    const readerUrl = new URL(sourceUrl);
    readerUrl.username = backupRole;
    readerUrl.password = backupPassword;
    const reader = new pg.Pool({ connectionString: readerUrl.toString() });
    try {
      expect((await reader.query('SELECT count(*) FROM "User"')).rowCount).toBe(1);
      await expect(
        reader.query('UPDATE "User" SET "displayName"=$1', ['forbidden']),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await reader.end();
    }
    const keyResult = garage('key', 'create', 'inkwell-backup-proof-' + randomUUID()).toString();
    backupKeyId = keyResult.match(/Key ID:\s*(\S+)/)?.[1];
    const backupSecret = keyResult.match(/Secret key:\s*(\S+)/i)?.[1];
    if (!backupKeyId || !backupSecret)
      throw new Error('Isolated read-only backup key unavailable.');
    garage('bucket', 'allow', '--read', '--key', backupKeyId, config.bucket);
    const readConfig = { ...config, accessKeyId: backupKeyId, secretAccessKey: backupSecret };
    const snapshotKey = (await db.snapshot.findUniqueOrThrow({ where: { id: snap.snapshot.id } }))
      .objectKey;
    await expect(s3Storage(readConfig).remove(snapshotKey)).rejects.toThrow(
      'Private object storage is unavailable',
    );
    const manifest = await backupLocal({
      sourceUrl: readerUrl.toString(),
      storage: readConfig,
      keyFile,
      output: archive,
    });
    expect((await readFile(archive)).includes(Buffer.from(marker))).toBe(false);
    keys = manifest.entries.flatMap((e) => (e.objectKey ? [e.objectKey] : []));
    sourceKeys = (
      await db.snapshot.findMany({
        where: { workspaceId: a.workspaceId },
        select: { objectKey: true },
      })
    ).map((r) => r.objectKey);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    await db.scene.update({ where: { id: scene.id }, data: { title: 'Later source title' } });
    await revokeShareLink(a, project.id, snap.snapshot.id, link.link.id, 1);
    garage('bucket', 'create', bucket);
    createdBucket = true;
    garage('bucket', 'allow', '--read', '--write', '--key', config.accessKeyId, bucket);
    const result = await restoreLocal({
      sourceUrl,
      storage: restoredStorage,
      keyFile,
      archive,
      targetName,
    });
    expect(result).toEqual({
      database: targetName,
      verifiedObjects: keys.length,
      oldCapabilitiesRevoked: true,
    });
    const url = new URL(sourceUrl);
    url.pathname = '/' + targetName;
    restored = new pg.Pool({ connectionString: url.toString() });
    expect(
      (await restored.query('SELECT title,"storyId" FROM "Scene" WHERE id=$1', [scene.id])).rows[0],
    ).toEqual({ title: marker, storyId: story.id });
    expect(
      (await restored.query('SELECT "revokedAt" FROM "ShareLink" WHERE id=$1', [link.link.id]))
        .rows[0].revokedAt,
    ).not.toBeNull();
    expect(
      (await restored.query('SELECT "revokedAt" FROM "AuthSession" WHERE id=$1', [session.id]))
        .rows[0].revokedAt,
    ).not.toBeNull();
    expect(
      (await restored.query('SELECT "consumedAt" FROM "AuthToken" WHERE id=$1', [auth.id])).rows[0]
        .consumedAt,
    ).not.toBeNull();
    expect(
      (await restored.query('SELECT "authVersion" FROM "User" WHERE id=$1', [u.id])).rows[0]
        .authVersion,
    ).toBe(u.authVersion + 1);
    for (const row of (
      await restored.query(
        'SELECT "objectKey","contentHash" FROM "Snapshot" WHERE status=\'READY\'',
      )
    ).rows)
      expect(
        createHash('sha256')
          .update(await restoredObjects.get(row.objectKey))
          .digest('hex'),
      ).toBe(row.contentHash);
    expect((await db.scene.findUnique({ where: { id: scene.id } })).title).toBe(
      'Later source title',
    );
    await expect(
      restoreLocal({ sourceUrl, storage: restoredStorage, keyFile, archive, targetName }),
    ).rejects.toThrow('Backup operation failed');
    const wrong = join(temp, 'wrong');
    await writeFile(wrong, randomBytes(32), { mode: 0o600 });
    await expect(
      restoreLocal({ sourceUrl, storage: restoredStorage, keyFile: wrong, archive }),
    ).rejects.toThrow('Backup operation failed');
    // A nonempty source bucket is never a restore destination.
    await expect(restoreLocal({ sourceUrl, storage: config, keyFile, archive })).rejects.toThrow(
      'Backup operation failed',
    );
  } finally {
    if (restored) await restored.end();
    await admin.query(`DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`);
    if (backupRoleCreated) {
      await admin.query('DROP OWNED BY "' + backupRole + '"');
      await admin.query('DROP ROLE "' + backupRole + '"');
    }
    await admin.end();
    if (backupKeyId) garage('key', 'delete', '--yes', backupKeyId);
    if (createdBucket) {
      for (const key of keys) await restoredObjects.remove(key);
      garage('bucket', 'delete', '--yes', bucket);
    }
    for (const key of sourceKeys) await s3Storage(config).remove(key);
    await rm(temp, { recursive: true, force: true });
    await db.$disconnect();
  }
}, 60000);
