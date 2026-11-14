import { randomUUID } from 'node:crypto';
import { it, expect, afterAll, vi } from 'vitest';
import { S3Client, GetObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import {
  assertLocalTestStorage,
  s3Storage,
  storageConfiguration,
  type PrivateStorage,
} from '@inkwell/storage';
import { plainDocument, SnapshotInput, type AccountRecord } from '@inkwell/contracts';
import { database } from '../../apps/web/src/server/database';
import { createProject, createStory } from '../../apps/web/src/server/records';
import { createIdea } from '../../apps/web/src/server/ideas';
import { createCanon, saveOverride, updateCanon } from '../../apps/web/src/server/canon';
import { createScene, createGroup, updateScene } from '../../apps/web/src/server/plot';
import { changeSceneCanon } from '../../apps/web/src/server/plot-links';
import { addIdeaLink } from '../../apps/web/src/server/idea-links';
import { createRelationship } from '../../apps/web/src/server/canon-relationships';
import {
  createSnapshot,
  previewSnapshot,
  issueShareLink,
  revokeShareLink,
  accessShared,
  listSnapshots,
  snapshotOptions,
  listShareLinks,
} from '../../apps/web/src/server/snapshots';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated runner.');
assertLocalTestStorage();
const db = database(),
  objects = s3Storage();
const keys: string[] = [];
afterAll(async () => {
  for (const key of keys) await objects.remove(key);
  await db.$disconnect();
});
async function actor(): Promise<AccountRecord> {
  const u = await db.user.create({
    data: {
      email: randomUUID() + '@example.test',
      emailVerifiedAt: new Date(),
      workspace: { create: {} },
    },
    include: { workspace: true },
  });
  return {
    id: u.id,
    email: u.email,
    displayName: '',
    version: 1,
    workspaceId: u.workspace!.id,
    aiEnabled: false,
  };
}
async function fixture() {
  const a = await actor(),
    p = await createProject(a, {
      title: 'Secret universe title',
      description: 'Secret project notes',
    }),
    s = await createStory(a, p.id, {
      title: 'Secret story title',
      synopsis: 'Secret story synopsis',
      format: 'Film',
    }),
    c = { projectId: p.id, storyId: s.id },
    shared = { projectId: p.id };
  const hero = await createCanon(a, shared, {
      kind: 'CHARACTER',
      name: 'Hidden shared name',
      content: plainDocument('Hidden shared notes'),
    }),
    place = await createCanon(a, c, {
      kind: 'LOCATION',
      name: 'Selected harbor',
      content: plainDocument('A public place'),
    }),
    root = await createGroup(a, c, {
      title: 'Hidden group',
      description: 'Secret group notes',
      parentId: null,
    }),
    scene = await createScene(a, c, {
      title: 'Selected arrival',
      content: plainDocument('The lantern arrives.'),
      status: 'DRAFT',
      groupId: root.id,
    }),
    idea = await createIdea(a, {
      title: 'Selected source',
      content: plainDocument('A public source thought'),
      categoryId: null,
      tagIds: [],
    });
  await changeSceneCanon(a, c, scene.id, 1, { kind: 'CHARACTER', canonId: hero.id });
  await changeSceneCanon(a, c, scene.id, 2, { kind: 'LOCATION', canonId: place.id });
  await addIdeaLink(a, idea.id, 1, { kind: 'SCENE', ...c, sceneId: scene.id });
  await saveOverride(a, c, hero.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Selected story name' },
    content: { mode: 'CLEAR' },
  });
  await createRelationship(a, c, hero.id, {
    toId: place.id,
    kind: 'LOCATED_IN',
    label: 'Lives here',
  });
  const input = SnapshotInput.parse({
    title: 'A lantern copy',
    storyId: s.id,
    selection: {
      project: false,
      storyIds: [],
      ideaIds: [idea.id],
      canonIds: [hero.id, place.id],
      sceneIds: [scene.id],
      groupIds: [],
      relationships: true,
    },
  });
  return { a, p, s, c, hero, place, root, scene, idea, input };
}
async function copy(f: Awaited<ReturnType<typeof fixture>>) {
  const r = await createSnapshot(f.a, f.p.id, f.input);
  keys.push((await db.snapshot.findUniqueOrThrow({ where: { id: r.snapshot.id } })).objectKey);
  return r;
}
it('copies only selected effective content and remapped connections, and never follows private source references', async () => {
  const f = await fixture(),
    r = await copy(f),
    text = JSON.stringify(r.document);
  expect(r.document.records).toHaveLength(4);
  expect(text).toContain('Selected story name');
  for (const privateValue of [
    f.p.id,
    f.s.id,
    f.hero.id,
    f.root.id,
    f.scene.id,
    f.idea.id,
    'Secret universe title',
    'Secret story title',
    'Hidden shared name',
    'Hidden shared notes',
    'Secret group notes',
  ])
    expect(text).not.toContain(privateValue);
  expect(
    r.document.records.find((v) => v.kind === 'CANON' && v.title === 'Selected story name'),
  ).toMatchObject({ content: plainDocument(''), storyId: null });
  expect(r.document.records.find((v) => v.kind === 'SCENE')).toMatchObject({
    position: 0,
    storyId: null,
    groupId: null,
  });
  expect(r.document.relationships).toHaveLength(4);
  expect(r.document.assets).toEqual([]);
  expect(await previewSnapshot(f.a, f.p.id, r.snapshot.id)).toEqual(r);
  await updateCanon(f.a, { projectId: f.p.id }, f.hero.id, 1, { name: 'Later shared edit' });
  await updateScene(f.a, f.c, f.scene.id, 3, { title: 'Later private scene' });
  expect((await previewSnapshot(f.a, f.p.id, r.snapshot.id)).document).toEqual(r.document);
});
it('uses private S3 and a scoped runtime key; direct anonymous object reads cannot bypass link policy', async () => {
  const f = await fixture(),
    r = await copy(f),
    row = await db.snapshot.findUniqueOrThrow({ where: { id: r.snapshot.id } }),
    config = storageConfiguration();
  const anon = await fetch(config.endpoint + '/' + config.bucket + '/' + row.objectKey);
  expect(anon.ok).toBe(false);
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: config,
    forcePathStyle: true,
    maxAttempts: 1,
  });
  await expect(
    client.send(new CreateBucketCommand({ Bucket: 'inkwell-unrelated-' + randomUUID() })),
  ).rejects.toBeDefined();
  const original = await objects.get(row.objectKey);
  await expect(objects.put(row.objectKey, Buffer.from('overwrite'))).rejects.toBeDefined();
  expect(await objects.get(row.objectKey)).toEqual(original);
  const got = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: row.objectKey }),
  );
  expect(got.ContentType).toBe('application/json');
  await got.Body?.transformToString();
});
it('stores only share hashes, enforces download permission and immediate terminal revocation', async () => {
  const f = await fixture(),
    r = await copy(f),
    link = await issueShareLink(f.a, f.p.id, r.snapshot.id, {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: false,
    });
  expect(link.token).toHaveLength(43);
  const stored = await db.shareLink.findUniqueOrThrow({ where: { id: link.link.id } });
  expect(JSON.stringify(stored)).not.toContain(link.token);
  expect(stored.tokenHash).toHaveLength(64);
  expect((await accessShared(link.token)).document).toEqual(r.document);
  await expect(accessShared(link.token, true)).rejects.toMatchObject({ status: 403 });
  await revokeShareLink(f.a, f.p.id, r.snapshot.id, link.link.id, 1);
  await expect(accessShared(link.token)).rejects.toMatchObject({ status: 404 });
  await expect(accessShared(link.token, true)).rejects.toMatchObject({ status: 404 });
  await expect(
    db.shareLink.update({ where: { id: link.link.id }, data: { revokedAt: null } }),
  ).rejects.toBeDefined();
  const list = await listShareLinks(f.a, f.p.id, r.snapshot.id, new URLSearchParams());
  expect(JSON.stringify(list)).not.toContain(stored.tokenHash);
  expect(JSON.stringify(list)).not.toContain(link.token);
});
it('rejects expired links and revocation or expiry during private object I/O', async () => {
  const f = await fixture(),
    r = await copy(f),
    link = await issueShareLink(f.a, f.p.id, r.snapshot.id, {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: true,
    });
  const delayed: PrivateStorage = {
    ...objects,
    get: async (key, max) => {
      const bytes = await objects.get(key, max);
      await revokeShareLink(f.a, f.p.id, r.snapshot.id, link.link.id, 1);
      return bytes;
    },
  };
  await expect(accessShared(link.token, true, delayed)).rejects.toMatchObject({ status: 404 });
  const expires = await issueShareLink(f.a, f.p.id, r.snapshot.id, {
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    allowDownload: true,
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 7200000);
  try {
    await expect(accessShared(expires.token)).rejects.toMatchObject({ status: 404 });
  } finally {
    vi.useRealTimers();
  }
  await expect(
    issueShareLink(f.a, f.p.id, r.snapshot.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      allowDownload: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it('rejects foreign owners/projects/stories and prevents cross-workspace link or payload mutation', async () => {
  const f = await fixture(),
    r = await copy(f),
    b = await actor(),
    foreign = await createProject(b, { title: 'Other owner', description: '' });
  await expect(previewSnapshot(b, f.p.id, r.snapshot.id)).rejects.toMatchObject({ status: 404 });
  await expect(
    issueShareLink(b, f.p.id, r.snapshot.id, {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: true,
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    createSnapshot(f.a, f.p.id, {
      ...f.input,
      selection: { ...f.input.selection, sceneIds: [randomUUID()] },
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(createSnapshot(f.a, foreign.id, f.input)).rejects.toMatchObject({ status: 404 });
  await expect(
    createSnapshot(f.a, f.p.id, { ...f.input, storyId: randomUUID() }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    db.snapshot.update({ where: { id: r.snapshot.id }, data: { contentHash: '0'.repeat(64) } }),
  ).rejects.toBeDefined();
  await expect(
    db.shareLink.create({
      data: {
        workspaceId: b.workspaceId,
        snapshotId: r.snapshot.id,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 3600000),
      },
    }),
  ).rejects.toBeDefined();
});
it('never publishes failed storage copies and preserves READY objects after a lost activation acknowledgement', async () => {
  const f = await fixture();
  const failing: PrivateStorage = {
    ...objects,
    put: async () => {
      throw new Error('test storage failure');
    },
  };
  await expect(createSnapshot(f.a, f.p.id, f.input, failing)).rejects.toMatchObject({
    status: 503,
  });
  const failed = await db.snapshot.findFirstOrThrow({
    where: { workspaceId: f.a.workspaceId, status: 'FAILED' },
  });
  await expect(
    issueShareLink(f.a, f.p.id, failed.id, {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: false,
    }),
  ).rejects.toMatchObject({ status: 404 });
  const native = db.snapshot.updateMany.bind(db.snapshot);
  // Simulate a transport acknowledgement loss after the actual database write.
  const intercept = async (...args: Parameters<typeof native>) => {
    const result = await native(...args);
    if (args[0]?.data?.status === 'READY') throw new Error('test lost acknowledgement');
    return result;
  };
  const spy = vi
    .spyOn(db.snapshot, 'updateMany')
    .mockImplementation(intercept as unknown as typeof native);
  try {
    await expect(createSnapshot(f.a, f.p.id, f.input)).rejects.toMatchObject({ status: 503 });
  } finally {
    spy.mockRestore();
  }
  const ready = await db.snapshot.findFirstOrThrow({
    where: { workspaceId: f.a.workspaceId, status: 'READY' },
  });
  keys.push(ready.objectKey);
  expect((await previewSnapshot(f.a, f.p.id, ready.id)).document.records).toHaveLength(4);
});
it('paginates selection authorization and lists without repeating the first page', async () => {
  const f = await fixture();
  const one = await snapshotOptions(
    f.a,
    f.p.id,
    new URLSearchParams({ kind: 'CANON', storyId: f.s.id, limit: '1' }),
  );
  expect(one.items).toHaveLength(1);
  expect(one.nextCursor).not.toBeNull();
  const two = await snapshotOptions(
    f.a,
    f.p.id,
    new URLSearchParams({ kind: 'CANON', storyId: f.s.id, limit: '1', cursor: one.nextCursor! }),
  );
  expect(two.items).toHaveLength(1);
  expect(two.items[0]?.id).not.toBe(one.items[0]?.id);
  const r = await copy(f),
    listed = await listSnapshots(f.a, f.p.id, new URLSearchParams());
  expect(listed.items.map((r) => r.id)).toContain(r.snapshot.id);
});
