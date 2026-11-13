import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, it, expect } from 'vitest';
import { database } from '../../apps/web/src/server/database';
import {
  createProject,
  createStory,
  updateProject,
  updateStory,
} from '../../apps/web/src/server/records';
import {
  createCanon,
  getCanon,
  listCanon,
  updateCanon,
  saveOverride,
  reviewOverride,
} from '../../apps/web/src/server/canon';
import {
  createRelationship,
  listRelationships,
  updateRelationship,
} from '../../apps/web/src/server/canon-relationships';
import { createIdea } from '../../apps/web/src/server/ideas';
import { convertIdea } from '../../apps/web/src/server/idea-conversions';
import { getTarget } from '../../apps/web/src/server/idea-targets';
import { plainDocument, CanonKind, type AccountRecord } from '@inkwell/contracts';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated integration runner.');
const db = database();
afterAll(() => db.$disconnect());
async function fixture() {
  const u = await db.user.create({
    data: {
      email: randomUUID() + '@example.test',
      displayName: 'Canon author',
      emailVerifiedAt: new Date(),
      workspace: { create: {} },
    },
    include: { workspace: true },
  });
  const a: AccountRecord = {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    version: 1,
    aiEnabled: false,
    workspaceId: u.workspace!.id,
  };
  const p = await createProject(a, { title: 'Universe', description: '' });
  const s = await createStory(a, p.id, { title: 'One', synopsis: '', format: '' }),
    s2 = await createStory(a, p.id, { title: 'Two', synopsis: '', format: '' });
  return { a, p, s, s2, c: { projectId: p.id }, sc: { projectId: p.id, storyId: s.id } };
}
const input = (
  kind: 'CHARACTER' | 'LOCATION' | 'LORE' | 'EVENT' | 'ORGANIZATION' = 'CHARACTER',
  name = 'Ada',
) => ({ kind, name, content: plainDocument('Original notes') });
const inherit = { mode: 'INHERIT' as const },
  clear = { mode: 'CLEAR' as const };
it('persists all five types, shares across stories and isolates story-local records', async () => {
  const { a, c, sc, p, s2 } = await fixture();
  for (const kind of CanonKind.options) {
    const row = await createCanon(a, c, input(kind));
    expect((await getCanon(a, { projectId: p.id, storyId: s2.id }, row.id)).kind).toBe(kind);
  }
  const local = await createCanon(a, sc, input('LOCATION', 'Secret place'));
  expect(local.scope).toBe('STORY');
  expect((await listCanon(a, sc, new URLSearchParams())).items).toHaveLength(6);
  expect((await listCanon(a, c, new URLSearchParams())).items).toHaveLength(5);
  await expect(getCanon(a, c, local.id)).rejects.toMatchObject({ status: 404 });
  await expect(getCanon(a, { projectId: p.id, storyId: s2.id }, local.id)).rejects.toMatchObject({
    status: 404,
  });
  await updateCanon(a, sc, local.id, 1, { name: 'Local revision' });
  await expect(
    updateCanon(a, sc, (await listCanon(a, c, new URLSearchParams())).items[0]!.id, 1, {
      name: 'Wrong route',
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it('distinguishes inherit, clear and custom, including inherited disjoint updates', async () => {
  const { a, c, sc } = await fixture(),
    r = await createCanon(a, c, input());
  let o = await saveOverride(a, sc, r.id, 0, { baseVersion: 1, name: clear, content: inherit });
  expect(o.effective.name).toBe('');
  expect(o.override?.hasName).toBe(true);
  expect((await getCanon(a, c, r.id)).name).toBe('Ada');
  await updateCanon(a, c, r.id, 1, { content: plainDocument('New shared body') });
  o = await getCanon(a, sc, r.id);
  expect(o.conflicts).toEqual([]);
  expect(o.effective.content).toEqual(plainDocument('New shared body'));
  o = await saveOverride(a, sc, r.id, 1, { baseVersion: 2, name: inherit, content: clear });
  expect(o.effective.name).toBe('Ada');
  expect(o.effective.content).toEqual(plainDocument(''));
  expect(o.override?.hasName).toBe(false);
});
it('requires explicit field decisions for relevant shared revisions and preserves private values', async () => {
  const { a, c, sc } = await fixture(),
    r = await createCanon(a, c, input());
  await saveOverride(a, sc, r.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Story Ada' },
    content: { mode: 'CUSTOM', value: plainDocument('Story body') },
  });
  await updateCanon(a, c, r.id, 1, { name: 'Shared Ada', content: plainDocument('Shared body') });
  const current = await getCanon(a, sc, r.id);
  expect(current.conflicts).toEqual(['name', 'content']);
  expect(current.effective.name).toBe('Story Ada');
  await expect(
    saveOverride(a, sc, r.id, 1, { baseVersion: 2, name: inherit, content: inherit }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    reviewOverride(a, sc, r.id, 1, { baseVersion: 2, name: 'KEEP' }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    reviewOverride(a, sc, r.id, 1, { baseVersion: 1, name: 'KEEP', content: 'INHERIT' }),
  ).rejects.toMatchObject({ status: 409 });
  const resolved = await reviewOverride(a, sc, r.id, 1, {
    baseVersion: 2,
    name: 'KEEP',
    content: 'INHERIT',
  });
  expect(resolved.conflicts).toEqual([]);
  expect(resolved.effective.name).toBe('Story Ada');
  expect(resolved.effective.content).toEqual(plainDocument('Shared body'));
  expect(resolved.override?.version).toBe(2);
  await expect(
    reviewOverride(a, sc, r.id, 1, { baseVersion: 2, name: 'KEEP', content: 'KEEP' }),
  ).rejects.toMatchObject({ status: 409 });
});
it('serializes concurrent canon and override writes without silent replacement', async () => {
  const { a, c, sc } = await fixture(),
    r = await createCanon(a, c, input());
  const edits = await Promise.allSettled([
    updateCanon(a, c, r.id, 1, { name: 'One' }),
    updateCanon(a, c, r.id, 1, { name: 'Two' }),
  ]);
  expect(edits.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const overrides = await Promise.allSettled([
    saveOverride(a, sc, r.id, 0, { baseVersion: 2, name: clear, content: inherit }),
    saveOverride(a, sc, r.id, 0, { baseVersion: 2, name: inherit, content: clear }),
  ]);
  expect(overrides.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const latest = await getCanon(a, sc, r.id);
  expect(latest.override?.version).toBe(1);
  expect(latest.version).toBe(2);
});
it('authorizes every source, endpoint, story and project, including same-account mismatches', async () => {
  const { a, c, sc, p } = await fixture(),
    b = await fixture(),
    r = await createCanon(a, c, input());
  await expect(getCanon(b.a, c, r.id)).rejects.toMatchObject({ status: 404 });
  await expect(createCanon(a, { projectId: p.id, storyId: b.s.id }, input())).rejects.toMatchObject(
    { status: 404 },
  );
  const other = await createProject(a, { title: 'Other', description: '' }),
    foreign = await createCanon(a, { projectId: other.id }, input());
  await expect(
    createRelationship(a, c, r.id, { toId: foreign.id, kind: 'KNOWS', label: '' }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    saveOverride(a, { projectId: other.id, storyId: sc.storyId }, r.id, 0, {
      baseVersion: 1,
      name: clear,
      content: clear,
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(updateCanon(b.a, c, r.id, 1, { name: 'Foreign' })).rejects.toMatchObject({
    status: 404,
  });
});
it('validates typed links, reuses shared graphs, exposes backlinks and keeps story edits separate', async () => {
  const { a, c, sc, p, s2 } = await fixture(),
    ch = await createCanon(a, c, input()),
    loc = await createCanon(a, c, input('LOCATION', 'Harbor')),
    org = await createCanon(a, c, input('ORGANIZATION', 'Guild'));
  await expect(
    createRelationship(a, c, ch.id, { toId: loc.id, kind: 'KNOWS', label: '' }),
  ).rejects.toMatchObject({ status: 400 });
  const link = await createRelationship(a, c, ch.id, {
    toId: loc.id,
    kind: 'LOCATED_IN',
    label: 'Lives here',
  });
  let back = (await listRelationships(a, c, loc.id, new URLSearchParams())).items[0]!;
  expect(back).toMatchObject({ direction: 'INCOMING', other: { id: ch.id }, editable: true });
  back = (await listRelationships(a, sc, loc.id, new URLSearchParams())).items[0]!;
  expect(back.editable).toBe(false);
  await expect(
    updateRelationship(a, sc, loc.id, link.id, 1, { archived: true }),
  ).rejects.toMatchObject({ status: 404 });
  const local = await createCanon(a, sc, input('CHARACTER', 'Local Ada'));
  const storyLink = await createRelationship(a, sc, local.id, {
    toId: org.id,
    kind: 'MEMBER_OF',
    label: '',
  });
  expect(
    (await listRelationships(a, { projectId: p.id, storyId: s2.id }, org.id, new URLSearchParams()))
      .items,
  ).toHaveLength(0);
  await updateRelationship(a, sc, org.id, storyLink.id, 1, { archived: true });
  expect((await listRelationships(a, sc, org.id, new URLSearchParams())).items).toHaveLength(0);
  await expect(
    createRelationship(a, sc, local.id, { toId: org.id, kind: 'MEMBER_OF', label: '' }),
  ).rejects.toMatchObject({ status: 409 });
  await updateRelationship(a, sc, org.id, storyLink.id, 2, { archived: false });
  expect((await listRelationships(a, sc, org.id, new URLSearchParams())).items).toHaveLength(1);
  await expect(
    updateRelationship(a, sc, org.id, storyLink.id, 2, { label: 'Stale' }),
  ).rejects.toMatchObject({ status: 409 });
});
it('retains overrides and references on shared archive and restores without losing canon', async () => {
  const { a, c, sc } = await fixture(),
    r = await createCanon(a, c, input()),
    other = await createCanon(a, c, input('CHARACTER', 'Other'));
  await saveOverride(a, sc, r.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Story survivor' },
    content: clear,
  });
  await createRelationship(a, c, r.id, { toId: other.id, kind: 'KNOWS', label: '' });
  await updateCanon(a, c, r.id, 1, { archived: true });
  expect((await listCanon(a, sc, new URLSearchParams())).items.some((x) => x.id === r.id)).toBe(
    true,
  );
  expect((await listCanon(a, c, new URLSearchParams())).items.some((x) => x.id === r.id)).toBe(
    false,
  );
  expect((await getCanon(a, sc, r.id)).effective.name).toBe('Story survivor');
  await expect(
    saveOverride(a, sc, r.id, 1, { baseVersion: 2, name: inherit, content: inherit }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await listRelationships(a, c, other.id, new URLSearchParams())).items[0]?.other.archived,
  ).toBe(true);
  await updateCanon(a, c, r.id, 2, { archived: false });
  expect((await getCanon(a, sc, r.id)).effective.name).toBe('Story survivor');
});
it('searches effective story fields and pages deterministically without leaking local canon', async () => {
  const { a, c, sc } = await fixture(),
    r = await createCanon(a, c, input());
  await saveOverride(a, sc, r.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Silver sky' },
    content: clear,
  });
  expect((await listCanon(a, sc, new URLSearchParams({ q: 'Silver' }))).items[0]?.name).toBe(
    'Silver sky',
  );
  expect((await listCanon(a, c, new URLSearchParams({ q: 'Silver' }))).items).toHaveLength(0);
  expect((await listCanon(a, sc, new URLSearchParams({ q: 'Original notes' }))).items).toHaveLength(
    0,
  );
  await createCanon(a, c, input('EVENT', 'Another'));
  const page = await listCanon(a, c, new URLSearchParams({ limit: '1' }));
  const next = await listCanon(a, c, new URLSearchParams({ limit: '1', cursor: page.nextCursor! }));
  expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
  await expect(listCanon(a, c, new URLSearchParams({ cursor: 'garbage' }))).rejects.toMatchObject({
    status: 400,
  });
});
it('preserves converted Character identity, structured content and source provenance', async () => {
  const { a, c, p } = await fixture(),
    idea = await createIdea(a, {
      title: 'From idea',
      content: plainDocument('Source body'),
      categoryId: null,
      tagIds: [],
    });
  const conversion = await convertIdea(a, idea.id, 1, randomUUID(), {
    kind: 'CHARACTER',
    projectId: p.id,
  });
  const target = conversion.conversion.targetCharacterId!;
  expect((await getCanon(a, c, target)).kind).toBe('CHARACTER');
  await updateCanon(a, c, target, 1, { name: 'Developed character' });
  expect((await getTarget(a, 'CHARACTER', p.id, target)).sources[0]?.id).toBe(idea.id);
  expect(
    (await db.ideaConversion.findFirstOrThrow({ where: { targetCharacterId: target } }))
      .titleSnapshot,
  ).toBe('From idea');
});
it('rejects archived parent writes and unsupported document versions safely', async () => {
  const { a, c, sc, p, s } = await fixture(),
    r = await createCanon(a, c, input());
  await updateStory(a, p.id, s.id, 1, { archived: true });
  await expect(createCanon(a, sc, input())).rejects.toMatchObject({ status: 409 });
  await updateProject(a, p.id, 1, { archived: true });
  await expect(updateCanon(a, c, r.id, 1, { name: 'No' })).rejects.toMatchObject({ status: 409 });
  await db.canonRecord.update({ where: { id: r.id }, data: { contentSchemaVersion: 2 } });
  await expect(getCanon(a, c, r.id)).rejects.toMatchObject({ status: 503 });
});
it('enforces type, story scope, override base and conversion invariants at SQL boundary', async () => {
  const { a, c, sc, p, s2 } = await fixture(),
    ch = await createCanon(a, c, input()),
    loc = await createCanon(a, c, input('LOCATION')),
    local = await createCanon(a, sc, input());
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await expect(
      pool.query('UPDATE "Character" SET kind=$1 WHERE id=$2', ['LOCATION', ch.id]),
    ).rejects.toMatchObject({ code: '23514' });
    const linkSql =
      'INSERT INTO "CanonRelationship"(id,"workspaceId","projectId","storyId","fromId","toId",kind,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,now())';
    await expect(
      pool.query(linkSql, [randomUUID(), a.workspaceId, p.id, null, ch.id, loc.id, 'KNOWS']),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(linkSql, [randomUUID(), a.workspaceId, p.id, s2.id, local.id, ch.id, 'RELATED']),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        'INSERT INTO "CanonOverride"(id,"workspaceId","projectId","storyId","canonId","baseVersion","baseName","baseContent","updatedAt") VALUES($1,$2,$3,$4,$5,1,$6,$7,now())',
        [
          randomUUID(),
          a.workspaceId,
          p.id,
          sc.storyId,
          local.id,
          'Local',
          JSON.stringify(plainDocument('')),
        ],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const idea = await createIdea(a, {
      title: 'Guard',
      content: plainDocument(''),
      categoryId: null,
      tagIds: [],
    });
    await expect(
      pool.query(
        'INSERT INTO "IdeaConversion"(id,"workspaceId","requestKey","requestHash","ideaId","projectId",kind,"sourceVersion","titleSnapshot","contentSnapshot","targetCharacterId") VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10)',
        [
          randomUUID(),
          a.workspaceId,
          randomUUID(),
          'test',
          idea.id,
          p.id,
          'CHARACTER',
          'Guard',
          JSON.stringify(plainDocument('')),
          loc.id,
        ],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  } finally {
    await pool.end();
  }
});
