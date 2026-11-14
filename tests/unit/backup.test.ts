import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, stat, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { it, expect } from 'vitest';
import { sealBackup, openBackup, retentionPlan } from '@inkwell/operations';
it('authenticates encrypted database and private object bytes and publishes without overwrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inkwell-backup-proof-'));
  try {
    const key = join(dir, 'key'),
      dump = join(dir, 'dump'),
      object = join(dir, 'object'),
      output = join(dir, 'out.iwb');
    await writeFile(key, randomBytes(32), { mode: 0o600 });
    const privateText = 'Synthetic private draft ' + randomUUID();
    await writeFile(dump, Buffer.concat([randomBytes(128), Buffer.from(privateText)]));
    await writeFile(object, JSON.stringify({ text: privateText }));
    const objectKey = `workspaces/${randomUUID()}/snapshots/${randomUUID()}.json`;
    const manifest = await sealBackup(output, key, [{ file: dump }, { file: object, objectKey }]);
    expect((await stat(output)).mode & 0o077).toBe(0);
    expect((await readFile(output)).includes(Buffer.from(privateText))).toBe(false);
    const opened = await openBackup(output, key);
    try {
      expect(opened.manifest).toEqual(manifest);
      expect(await readFile(opened.files[0]!.path)).toEqual(await readFile(dump));
      expect(await readFile(opened.files[1]!.path)).toEqual(await readFile(object));
    } finally {
      await opened.dispose();
    }
    const before = await readFile(output);
    await expect(sealBackup(output, key, [{ file: dump }])).rejects.toThrow(
      'Backup operation failed',
    );
    expect(await readFile(output)).toEqual(before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it('rejects wrong keys, tampering, truncation, unsafe keys and public key permissions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'inkwell-backup-proof-'));
  try {
    const key = join(dir, 'key'),
      wrong = join(dir, 'wrong'),
      dump = join(dir, 'dump'),
      output = join(dir, 'out.iwb');
    await writeFile(key, randomBytes(32), { mode: 0o600 });
    await writeFile(wrong, randomBytes(32), { mode: 0o600 });
    await writeFile(dump, 'synthetic database bytes');
    await sealBackup(output, key, [{ file: dump }]);
    await expect(openBackup(output, wrong)).rejects.toThrow('Backup operation failed');
    const bytes = await readFile(output);
    bytes[bytes.length - 20]! ^= 1;
    await writeFile(output, bytes);
    await expect(openBackup(output, key)).rejects.toThrow('Backup operation failed');
    await writeFile(output, bytes.subarray(0, 20));
    await expect(openBackup(output, key)).rejects.toThrow('Backup operation failed');
    await expect(
      sealBackup(join(dir, 'unsafe.iwb'), key, [
        { file: dump },
        { file: dump, objectKey: '../private' },
      ]),
    ).rejects.toThrow('Backup operation failed');
    await chmod(key, 0o644);
    await expect(sealBackup(join(dir, 'public.iwb'), key, [{ file: dump }])).rejects.toThrow(
      'Backup operation failed',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it('plans thirty successful daily backups and preserves unknown files without deleting anything', () => {
  const names = Array.from(
    { length: 35 },
    (_, i) =>
      'inkwell-' +
      new Date(Date.UTC(2026, 9, i + 1, 12)).toISOString().replaceAll(/[-:.]/g, '') +
      '.iwb',
  );
  names.push(
    names[34]!.replace('T120000000Z', 'T110000000Z'),
    'unknown.keep',
    'inkwell-20269999T999999999Z.iwb',
  );
  const result = retentionPlan(names);
  expect(result.keep).toHaveLength(30);
  expect(result.candidates).toHaveLength(6);
  expect(result.unknown).toEqual(['unknown.keep', 'inkwell-20269999T999999999Z.iwb']);
  expect(result.deletionEnabled).toBe(false);
  expect(result.keep[0]).toBe(names[34]);
});
