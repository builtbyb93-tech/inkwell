import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, constants } from 'node:fs';
import { open, mkdtemp, rm, stat, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';

const MAGIC = Buffer.from('INKWELL_BACKUP_1\n');
const HEADER_BYTES = MAGIC.length + 16 + 12;
const MAX_BYTES = 2 * 1024 ** 3;
const KEY =
  /^workspaces\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/snapshots\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/;
const Manifest = z
  .object({
    format: z.literal('inkwell.backup'),
    version: z.literal(1),
    createdAt: z.iso.datetime(),
    postgresMajor: z.literal(17),
    entries: z
      .array(
        z
          .object({
            file: z.string().regex(/^(?:database\.dump|object-[0-9]{6}\.json)$/),
            size: z.number().int().positive().max(MAX_BYTES),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            objectKey: z.string().regex(KEY).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10001),
  })
  .strict();
export type BackupManifest = z.infer<typeof Manifest>;
export class BackupError extends Error {
  constructor() {
    super('Backup operation failed. Verify the protected key, archive and isolated configuration.');
  }
}
async function protectedKey(file: string) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      info.size !== 32 ||
      (info.mode & 0o077) !== 0 ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new BackupError();
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
async function digest(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function validateManifest(value: unknown) {
  const manifest = Manifest.parse(value);
  const keys = new Set<string>();
  let total = 0;
  manifest.entries.forEach((e, i) => {
    total += e.size;
    if (
      e.file !== (i === 0 ? 'database.dump' : `object-${String(i).padStart(6, '0')}.json`) ||
      (i === 0 ? e.objectKey !== undefined : !e.objectKey || e.size > 8 * 1024 ** 2)
    )
      throw new BackupError();
    if (e.objectKey) {
      if (keys.has(e.objectKey)) throw new BackupError();
      keys.add(e.objectKey);
    }
  });
  if (total > MAX_BYTES) throw new BackupError();
  return manifest;
}
/** Sources must be a trusted pg_dump and verified frozen objects, not public imports. */
export async function sealBackup(
  output: string,
  keyFile: string,
  sources: { file: string; objectKey?: string }[],
) {
  const temporary = await mkdtemp(join(dirname(output), '.inkwell-seal-'));
  try {
    const master = await protectedKey(keyFile);
    const entries: BackupManifest['entries'] = [];
    for (const [i, source] of sources.entries()) {
      const info = await stat(source.file);
      if (!info.isFile()) throw new BackupError();
      entries.push({
        file: i === 0 ? 'database.dump' : `object-${String(i).padStart(6, '0')}.json`,
        size: info.size,
        sha256: await digest(source.file),
        ...(source.objectKey ? { objectKey: source.objectKey } : {}),
      });
    }
    const manifest = validateManifest({
      format: 'inkwell.backup',
      version: 1,
      createdAt: new Date().toISOString(),
      postgresMajor: 17,
      entries,
    });
    const metadata = Buffer.from(JSON.stringify(manifest)),
      length = Buffer.alloc(4);
    length.writeUInt32BE(metadata.length);
    if (metadata.length > 4 * 1024 ** 2) throw new BackupError();
    const header = Buffer.concat([MAGIC, randomBytes(16), randomBytes(12)]);
    const key = Buffer.from(
      hkdfSync(
        'sha256',
        master,
        header.subarray(MAGIC.length, MAGIC.length + 16),
        Buffer.from('inkwell-backup-v1'),
        32,
      ),
    );
    master.fill(0);
    const cipher = createCipheriv('aes-256-gcm', key, header.subarray(-12));
    cipher.setAAD(header);
    async function* plaintext() {
      yield length;
      yield metadata;
      for (const source of sources)
        for await (const chunk of createReadStream(source.file)) yield chunk;
    }
    let first = true;
    const frame = new Transform({
      transform(chunk, _encoding, callback) {
        if (first) {
          this.push(header);
          first = false;
        }
        callback(null, chunk);
      },
      flush(callback) {
        this.push(cipher.getAuthTag());
        callback();
      },
    });
    const file = join(temporary, 'complete.iwb');
    await pipeline(
      Readable.from(plaintext()),
      cipher,
      frame,
      createWriteStream(file, { flags: 'wx', mode: 0o600 }),
    );
    const synced = await open(file, 'r');
    try {
      await synced.sync();
    } finally {
      await synced.close();
    }
    await link(file, output); // Atomic publication; never replace an existing backup.
    return manifest;
  } catch {
    throw new BackupError();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
/** Authenticates all ciphertext before parsing or exposing any extracted file. */
export async function openBackup(archive: string, keyFile: string) {
  const directory = await mkdtemp(join(tmpdir(), 'inkwell-restore-'));
  try {
    const master = await protectedKey(keyFile),
      source = await open(archive, 'r');
    let size: number;
    const header = Buffer.alloc(HEADER_BYTES),
      tag = Buffer.alloc(16);
    try {
      size = (await source.stat()).size;
      if (size < HEADER_BYTES + 20 || size > MAX_BYTES + 5 * 1024 ** 2) throw new BackupError();
      await source.read(header, 0, header.length, 0);
      await source.read(tag, 0, 16, size - 16);
    } finally {
      await source.close();
    }
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError();
    const key = Buffer.from(
      hkdfSync(
        'sha256',
        master,
        header.subarray(MAGIC.length, MAGIC.length + 16),
        Buffer.from('inkwell-backup-v1'),
        32,
      ),
    );
    master.fill(0);
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(-12));
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const plaintext = join(directory, 'authenticated.bin');
    await pipeline(
      createReadStream(archive, { start: HEADER_BYTES, end: size! - 17 }),
      decipher,
      createWriteStream(plaintext, { flags: 'wx', mode: 0o600 }),
    );
    const handle = await open(plaintext, 'r');
    let manifest: BackupManifest, offset: number;
    try {
      const length = Buffer.alloc(4);
      if ((await handle.read(length, 0, 4, 0)).bytesRead !== 4) throw new BackupError();
      const count = length.readUInt32BE();
      if (count < 1 || count > 4 * 1024 ** 2) throw new BackupError();
      const metadata = Buffer.alloc(count);
      if ((await handle.read(metadata, 0, count, 4)).bytesRead !== count) throw new BackupError();
      manifest = validateManifest(JSON.parse(metadata.toString('utf8')));
      offset = 4 + count;
      if (manifest.entries.reduce((n, e) => n + e.size, offset) !== (await handle.stat()).size)
        throw new BackupError();
    } finally {
      await handle.close();
    }
    const files: { path: string; entry: BackupManifest['entries'][number] }[] = [];
    for (const entry of manifest!.entries) {
      const path = join(directory, entry.file);
      await pipeline(
        createReadStream(plaintext, { start: offset!, end: offset! + entry.size - 1 }),
        createWriteStream(path, { flags: 'wx', mode: 0o600 }),
      );
      if ((await digest(path)) !== entry.sha256) throw new BackupError();
      files.push({ path, entry });
      offset! += entry.size;
    }
    await rm(plaintext);
    return {
      manifest: manifest!,
      files,
      dispose: () => rm(directory, { recursive: true, force: true }),
    };
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw new BackupError();
  }
}
/** Latest backup on each of the latest 30 successful UTC backup dates. Plan only. */
export function retentionPlan(names: string[], days = 30) {
  if (days !== 30) throw new BackupError();
  const valid = names
    .filter((n) => {
      if (!/^inkwell-\d{8}T\d{9}Z\.iwb$/.test(n)) return false;
      const stamp = n.slice(8, -4);
      const iso =
        stamp.slice(0, 4) +
        '-' +
        stamp.slice(4, 6) +
        '-' +
        stamp.slice(6, 8) +
        'T' +
        stamp.slice(9, 11) +
        ':' +
        stamp.slice(11, 13) +
        ':' +
        stamp.slice(13, 15) +
        '.' +
        stamp.slice(15, 18) +
        'Z';
      const date = new Date(iso);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().replaceAll(/[-:.]/g, '') === stamp &&
        date.getTime() <= Date.now() + 300000
      );
    })
    .sort()
    .reverse();
  const dates = new Set<string>(),
    keep: string[] = [],
    candidates: string[] = [];
  for (const name of valid) {
    const date = name.slice(8, 16);
    if (!dates.has(date) && dates.size < days) {
      dates.add(date);
      keep.push(name);
    } else candidates.push(name);
  }
  return {
    keep,
    candidates,
    unknown: names.filter((n) => !valid.includes(n)),
    deletionEnabled: false as const,
  };
}

/** Read-only configuration gate; it does not prove hosted connectivity or deploy. */
export function releaseConfiguration(env: Readonly<Record<string, string | undefined>>) {
  try {
    const environment = z.enum(['staging', 'production']).parse(env.INKWELL_ENV);
    const origin = new URL(env.NEXTAUTH_URL ?? ''),
      database = new URL(env.DATABASE_URL ?? '');
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
    if (environment === 'production' && loopback) throw new BackupError();
    if (
      origin.pathname !== '/api/v1/auth' ||
      origin.search ||
      origin.hash ||
      origin.username ||
      origin.password ||
      (origin.protocol !== 'https:' &&
        !(environment === 'staging' && loopback && origin.protocol === 'http:'))
    )
      throw new BackupError();
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !database.username ||
      !database.password ||
      !new RegExp('^inkwell_' + environment + '_runtime_login$').test(
        decodeURIComponent(database.username),
      ) ||
      !new RegExp('^/inkwell_' + environment + '(?:_[a-z0-9_]+)?$').test(database.pathname)
    )
      throw new BackupError();
    if (
      !env.NEXTAUTH_SECRET ||
      env.NEXTAUTH_SECRET.length < 43 ||
      !env.S3_ACCESS_KEY_ID ||
      !env.S3_SECRET_ACCESS_KEY ||
      !env.S3_REGION ||
      !new RegExp('^inkwell-' + environment + '(?:-[a-z0-9-]+)?$').test(env.S3_BUCKET ?? '')
    )
      throw new BackupError();
    const storage = new URL(env.S3_ENDPOINT ?? '');
    if (
      storage.username ||
      storage.password ||
      storage.search ||
      storage.hash ||
      storage.pathname !== '/' ||
      (storage.protocol !== 'https:' &&
        !(
          storage.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(storage.hostname)
        ))
    )
      throw new BackupError();
    if (
      !env.SMTP_HOST ||
      !env.SMTP_FROM ||
      !env.SMTP_USER ||
      !env.SMTP_PASSWORD ||
      !/^(?:465|587)$/.test(env.SMTP_PORT ?? '') ||
      !['true', 'false'].includes(env.SMTP_SECURE ?? '') ||
      (env.SMTP_PORT === '465' && env.SMTP_SECURE !== 'true') ||
      (env.SMTP_PORT === '587' && env.SMTP_SECURE !== 'false')
    )
      throw new BackupError();
    if (!/^[-a-z0-9./:]+@sha256:[a-f0-9]{64}$/.test(env.INKWELL_IMAGE ?? ''))
      throw new BackupError();
    return {
      environment,
      configurationValid: true,
      deploymentActivated: false,
      dailyBackupRetention: 30,
    };
  } catch {
    throw new BackupError();
  }
}
