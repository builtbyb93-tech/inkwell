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
  createGroup,
  updateGroup,
  getGroup,
  listGroups,
  createScene,
  updateScene,
  getScene,
  getPlot,
  moveScene,
  duplicateScene,
} from '../../apps/web/src/server/plot';
import {
  changeSceneCanon,
  sceneCanonReferences,
  canonSceneReferences,
  sceneIdeaReferences,
} from '../../apps/web/src/server/plot-links';
import { createCanon, saveOverride, updateCanon } from '../../apps/web/src/server/canon';
import { createIdea } from '../../apps/web/src/server/ideas';
import { addIdeaLink, removeIdeaLink } from '../../apps/web/src/server/idea-links';
import { convertIdea } from '../../apps/web/src/server/idea-conversions';
import { plainDocument, type AccountRecord } from '@inkwell/contracts';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated integration runner.');
const db = database();
afterAll(() => db.$disconnect());
async function fixture() {
  const u = await db.user.create({
    data: {
      email: randomUUID() + '@example.test',
      displayName: 'Plot author',
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
  const p = await createProject(a, { title: 'Plot universe', description: '' }),
    s = await createStory(a, p.id, { title: 'Voyage', synopsis: '', format: '' }),
    other = await createStory(a, p.id, { title: 'Other story', synopsis: '', format: '' });
  return { a, p, s, other, c: { projectId: p.id, storyId: s.id } };
}
const scene = (title: string, groupId: string | null = null) => ({
  title,
  content: plainDocument(title + ' notes'),
  status: 'PLANNED' as const,
  groupId,
});
const group = (title: string, parentId: string | null = null) => ({
  title,
  description: '',
  parentId,
});
const order = async (storyId: string) =>
  await db.scene.findMany({
    where: { storyId },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });
it('persists status, structured notes and conditional scene edits without lost updates', async () => {
  const { a, c } = await fixture(),
    r = await createScene(a, c, scene('Opening'));
  const edited = await updateScene(a, c, r.id, 1, {
    status: 'DRAFT',
    content: plainDocument('A developed opening'),
  });
  expect(edited.version).toBe(2);
  expect((await getScene(a, c, r.id)).content).toEqual(plainDocument('A developed opening'));
  const writes = await Promise.allSettled([
    updateScene(a, c, r.id, 2, { title: 'One' }),
    updateScene(a, c, r.id, 2, { title: 'Two' }),
  ]);
  expect(writes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect((await getScene(a, c, r.id)).version).toBe(3);
});
it('enforces root/child nesting, forbids cycles and serializes opposing reparents', async () => {
  const { a, c, other } = await fixture(),
    root = await createGroup(a, c, group('Act one')),
    child = await createGroup(a, c, group('Sequence', root.id));
  await expect(createGroup(a, c, group('Third level', child.id))).rejects.toMatchObject({
    status: 400,
  });
  await expect(updateGroup(a, c, root.id, 1, { parentId: child.id })).rejects.toMatchObject({
    status: 400,
  });
  await expect(updateGroup(a, c, child.id, 1, { parentId: child.id })).rejects.toMatchObject({
    status: 400,
  });
  const foreign = await createGroup(a, { ...c, storyId: other.id }, group('Other'));
  await expect(createGroup(a, c, group('Wrong story', foreign.id))).rejects.toMatchObject({
    status: 404,
  });
  const one = await createGroup(a, c, group('One')),
    two = await createGroup(a, c, group('Two'));
  const edits = await Promise.allSettled([
    updateGroup(a, c, one.id, 1, { parentId: two.id }),
    updateGroup(a, c, two.id, 1, { parentId: one.id }),
  ]);
  expect(edits.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
});
it('archives groups only after active children/scenes and restores parents first', async () => {
  const { a, c } = await fixture(),
    root = await createGroup(a, c, group('Root')),
    child = await createGroup(a, c, group('Child', root.id)),
    r = await createScene(a, c, scene('Opening', child.id));
  await expect(updateGroup(a, c, root.id, 1, { archived: true })).rejects.toMatchObject({
    status: 409,
  });
  await expect(updateGroup(a, c, child.id, 1, { archived: true })).rejects.toMatchObject({
    status: 409,
  });
  await updateScene(a, c, r.id, 1, { archived: true });
  await updateGroup(a, c, child.id, 1, { archived: true });
  await updateGroup(a, c, root.id, 1, { archived: true });
  await expect(updateGroup(a, c, child.id, 2, { archived: false })).rejects.toMatchObject({
    status: 409,
  });
  await expect(updateScene(a, c, r.id, 2, { archived: false })).rejects.toMatchObject({
    status: 409,
  });
  await updateGroup(a, c, root.id, 2, { archived: false });
  await updateGroup(a, c, child.id, 2, { archived: false });
  await updateScene(a, c, r.id, 2, { archived: false });
  expect((await getGroup(a, c, child.id)).parentId).toBe(root.id);
});
it('uses one atomic sequence independent of groups and retains archived scenes in that sequence', async () => {
  const { a, c, s } = await fixture(),
    g = await createGroup(a, c, group('Act')),
    one = await createScene(a, c, scene('One')),
    two = await createScene(a, c, scene('Two', g.id)),
    three = await createScene(a, c, scene('Three'));
  let plot = await getPlot(a, c, new URLSearchParams());
  expect(plot.items.map((r) => r.id)).toEqual([one.id, two.id, three.id]);
  const moved = await moveScene(a, c, three.id, plot.sequenceVersion, {
    beforeId: one.id,
    groupId: g.id,
  });
  expect(moved.scene.position).toBe(0);
  expect(moved.scene.version).toBe(1);
  expect(moved.scene.groupId).toBe(g.id);
  await expect(
    moveScene(a, c, two.id, plot.sequenceVersion, { direction: 'EARLIER' }),
  ).rejects.toMatchObject({ status: 409 });
  await updateScene(a, c, two.id, 1, { archived: true });
  plot = await getPlot(a, c, new URLSearchParams());
  expect(plot.items.map((r) => r.id)).toEqual([three.id, one.id]);
  await moveScene(a, c, one.id, plot.sequenceVersion, { direction: 'LATER' });
  expect((await order(s.id)).map((r) => r.id)).toEqual([three.id, one.id, two.id]);
  await updateScene(a, c, two.id, 2, { archived: false });
  expect((await getPlot(a, c, new URLSearchParams())).items.map((r) => r.id)).toEqual([
    three.id,
    one.id,
    two.id,
  ]);
  expect((await order(s.id)).map((r) => r.position)).toEqual([0, 1, 2]);
});
it('detects competing moves, rejects wrong-story destinations and rolls back deferred uniqueness failures', async () => {
  const { a, c, s, other } = await fixture(),
    one = await createScene(a, c, scene('One')),
    two = await createScene(a, c, scene('Two')),
    three = await createScene(a, c, scene('Three')),
    foreign = await createScene(a, { ...c, storyId: other.id }, scene('Foreign'));
  const before = await getPlot(a, c, new URLSearchParams());
  await expect(
    moveScene(a, c, one.id, before.sequenceVersion, { beforeId: foreign.id }),
  ).rejects.toMatchObject({ status: 400 });
  expect((await order(s.id)).map((r) => r.id)).toEqual([one.id, two.id, three.id]);
  const moves = await Promise.allSettled([
    moveScene(a, c, three.id, before.sequenceVersion, { beforeId: one.id }),
    moveScene(a, c, two.id, before.sequenceVersion, { beforeId: one.id }),
  ]);
  expect(moves.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const state = await order(s.id),
    version = (await getPlot(a, c, new URLSearchParams())).sequenceVersion;
  await expect(
    db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET CONSTRAINTS "Scene_storyId_position_key" DEFERRED');
      await tx.scene.updateMany({ where: { storyId: s.id }, data: { position: 0 } });
      await tx.story.update({ where: { id: s.id }, data: { sequenceVersion: { increment: 1 } } });
    }),
  ).rejects.toBeDefined();
  expect(await order(s.id)).toEqual(state);
  expect((await getPlot(a, c, new URLSearchParams())).sequenceVersion).toBe(version);
});
it('paginates canonical order and rejects stale structural cursors rather than mixing revisions', async () => {
  const { a, c } = await fixture();
  for (let i = 0; i < 5; i++) await createScene(a, c, scene('Scene ' + i));
  const first = await getPlot(a, c, new URLSearchParams({ limit: '2' })),
    next = await getPlot(a, c, new URLSearchParams({ limit: '2', cursor: first.nextCursor! }));
  expect(first.items.map((r) => r.position)).toEqual([0, 1]);
  expect(next.items.map((r) => r.position)).toEqual([2, 3]);
  await createGroup(a, c, group('New grouping'));
  await expect(
    getPlot(a, c, new URLSearchParams({ cursor: first.nextCursor! })),
  ).rejects.toMatchObject({ status: 409 });
  await expect(getPlot(a, c, new URLSearchParams({ cursor: 'garbage' }))).rejects.toMatchObject({
    status: 400,
  });
  const groups = await listGroups(a, c, new URLSearchParams({ limit: '1' }));
  expect(groups.items).toHaveLength(1);
});
it('links only applicable same-project characters/locations with effective names and authorized backlinks', async () => {
  const { a, c, p, other } = await fixture(),
    r = await createScene(a, c, scene('Opening')),
    ch = await createCanon(
      a,
      { projectId: p.id },
      { kind: 'CHARACTER', name: 'Shared Ada', content: plainDocument('') },
    ),
    loc = await createCanon(a, c, {
      kind: 'LOCATION',
      name: 'Story port',
      content: plainDocument(''),
    }),
    wrong = await createCanon(
      a,
      { ...c, storyId: other.id },
      { kind: 'CHARACTER', name: 'Other cast', content: plainDocument('') },
    );
  await saveOverride(a, c, ch.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Voyage Ada' },
    content: { mode: 'INHERIT' },
  });
  await changeSceneCanon(a, c, r.id, 1, { kind: 'CHARACTER', canonId: ch.id });
  await changeSceneCanon(a, c, r.id, 2, { kind: 'LOCATION', canonId: loc.id });
  expect(
    (await sceneCanonReferences(a, c, r.id, 'CHARACTER', new URLSearchParams())).items[0]?.name,
  ).toBe('Voyage Ada');
  expect(
    (await canonSceneReferences(a, { projectId: p.id }, ch.id, new URLSearchParams())).items[0]
      ?.sceneId,
  ).toBe(r.id);
  await expect(
    changeSceneCanon(a, c, r.id, 3, { kind: 'CHARACTER', canonId: loc.id }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    changeSceneCanon(a, c, r.id, 3, { kind: 'CHARACTER', canonId: wrong.id }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    changeSceneCanon(a, c, r.id, 1, { kind: 'CHARACTER', canonId: ch.id }, true),
  ).rejects.toMatchObject({ status: 409 });
  await updateCanon(a, { projectId: p.id }, ch.id, 1, { archived: true });
  expect(
    (await sceneCanonReferences(a, c, r.id, 'CHARACTER', new URLSearchParams())).items[0]?.archived,
  ).toBe(true);
  await changeSceneCanon(a, c, r.id, 3, { kind: 'CHARACTER', canonId: ch.id }, true);
  expect(
    (await canonSceneReferences(a, { projectId: p.id }, ch.id, new URLSearchParams())).items,
  ).toHaveLength(0);
});
it('duplicates content, typed references and Idea links with fresh IDs without cloning conversion history', async () => {
  const { a, c, p, s } = await fixture(),
    idea = await createIdea(a, {
      title: 'Origin',
      content: plainDocument('Original notes'),
      categoryId: null,
      tagIds: [],
    }),
    conversion = await convertIdea(a, idea.id, 1, randomUUID(), {
      kind: 'SCENE',
      projectId: p.id,
      storyId: s.id,
    }),
    sourceId = conversion.conversion.targetSceneId!,
    ch = await createCanon(
      a,
      { projectId: p.id },
      { kind: 'CHARACTER', name: 'Ada', content: plainDocument('') },
    ),
    loc = await createCanon(a, c, { kind: 'LOCATION', name: 'Port', content: plainDocument('') });
  await changeSceneCanon(a, c, sourceId, 1, { kind: 'CHARACTER', canonId: ch.id });
  await changeSceneCanon(a, c, sourceId, 2, { kind: 'LOCATION', canonId: loc.id });
  await updateCanon(a, { projectId: p.id }, ch.id, 1, { archived: true });
  const copy = await duplicateScene(a, c, sourceId, 3);
  expect(copy.id).not.toBe(sourceId);
  expect(copy.duplicatedFromId).toBe(sourceId);
  expect(copy.content).toEqual(plainDocument('Original notes'));
  expect(copy.position).toBe(1);
  const originalLinks = await sceneCanonReferences(
      a,
      c,
      sourceId,
      'CHARACTER',
      new URLSearchParams(),
    ),
    copyLinks = await sceneCanonReferences(a, c, copy.id, 'CHARACTER', new URLSearchParams());
  expect(copyLinks.items[0]?.id).not.toBe(originalLinks.items[0]?.id);
  expect(copyLinks.items[0]).toMatchObject({ canonId: ch.id, archived: true });
  expect(
    (await sceneIdeaReferences(a, c, sourceId, new URLSearchParams())).items[0]?.converted,
  ).toBe(true);
  expect(
    (await sceneIdeaReferences(a, c, copy.id, new URLSearchParams())).items[0]?.converted,
  ).toBe(false);
  expect(await db.ideaConversion.count({ where: { ideaId: idea.id } })).toBe(1);
  await updateScene(a, c, copy.id, 1, { title: 'Independent copy' });
  await updateScene(a, c, sourceId, 3, { archived: true });
  expect((await getScene(a, c, copy.id)).title).toBe('Independent copy');
  await expect(duplicateScene(a, c, sourceId, 4)).rejects.toMatchObject({ status: 409 });
});
it('retains source Idea provenance and keeps incremental Idea references separately versioned', async () => {
  const { a, c, p, s } = await fixture(),
    r = await createScene(a, c, scene('Opening')),
    idea = await createIdea(a, {
      title: 'Reference',
      content: plainDocument(''),
      categoryId: null,
      tagIds: [],
    });
  await addIdeaLink(a, idea.id, 1, {
    kind: 'SCENE',
    projectId: p.id,
    storyId: s.id,
    sceneId: r.id,
  });
  const refs = await sceneIdeaReferences(a, c, r.id, new URLSearchParams());
  expect(refs.items[0]).toMatchObject({ ideaId: idea.id, ideaVersion: 2, converted: false });
  expect((await getScene(a, c, r.id)).version).toBe(1);
  await removeIdeaLink(a, idea.id, 'SCENE', refs.items[0]!.id, 2);
  expect((await sceneIdeaReferences(a, c, r.id, new URLSearchParams())).items).toHaveLength(0);
  const converted = await convertIdea(a, idea.id, 3, randomUUID(), {
    kind: 'SCENE',
    projectId: p.id,
    storyId: s.id,
  });
  const source = await sceneIdeaReferences(
    a,
    c,
    converted.conversion.targetSceneId!,
    new URLSearchParams(),
  );
  await expect(removeIdeaLink(a, idea.id, 'SCENE', source.items[0]!.id, 4)).rejects.toMatchObject({
    status: 409,
  });
});
it('rejects foreign resources/parents and rolls back unsupported-format duplication', async () => {
  const { a, c, p, s } = await fixture(),
    other = await fixture(),
    r = await createScene(a, c, scene('Private')),
    g = await createGroup(a, c, group('Private group'));
  await expect(getScene(other.a, c, r.id)).rejects.toMatchObject({ status: 404 });
  await expect(getGroup(other.a, c, g.id)).rejects.toMatchObject({ status: 404 });
  await expect(createScene(a, { ...c, storyId: other.s.id }, scene('Wrong'))).rejects.toMatchObject(
    { status: 404 },
  );
  const foreignCanon = await createCanon(other.a, other.c, {
    kind: 'LOCATION',
    name: 'Private',
    content: plainDocument(''),
  });
  await expect(
    changeSceneCanon(a, c, r.id, 1, { kind: 'LOCATION', canonId: foreignCanon.id }),
  ).rejects.toMatchObject({ status: 404 });
  await db.scene.update({ where: { id: r.id }, data: { contentSchemaVersion: 2 } });
  const before = await getPlot(a, c, new URLSearchParams());
  await expect(getScene(a, c, r.id)).rejects.toMatchObject({ status: 503 });
  await expect(duplicateScene(a, c, r.id, 1)).rejects.toMatchObject({ status: 503 });
  expect((await getPlot(a, c, new URLSearchParams())).sequenceVersion).toBe(before.sequenceVersion);
  await updateStory(a, p.id, s.id, 1, { archived: true });
  await expect(createGroup(a, c, group('Blocked'))).rejects.toMatchObject({ status: 409 });
  await updateProject(a, p.id, 1, { archived: true });
  await expect(createScene(a, c, scene('Blocked'))).rejects.toMatchObject({ status: 409 });
});
it('enforces group/scene/link scope and immutable copy identity at the SQL boundary', async () => {
  const { a, c, p, s, other } = await fixture(),
    root = await createGroup(a, c, group('Root')),
    child = await createGroup(a, c, group('Child', root.id)),
    r = await createScene(a, c, scene('Opening')),
    ch = await createCanon(a, c, { kind: 'CHARACTER', name: 'Ada', content: plainDocument('') });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await expect(
      pool.query(
        'INSERT INTO "PlotGroup"(id,"workspaceId","projectId","storyId","parentId",title,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,now())',
        [randomUUID(), a.workspaceId, p.id, s.id, child.id, 'Too deep'],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE "Scene" SET "storyId"=$1 WHERE id=$2', [other.id, r.id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE "Scene" SET "duplicatedFromId"=$1 WHERE id=$2', [randomUUID(), r.id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        'INSERT INTO "SceneLocationLink"(id,"workspaceId","projectId","storyId","sceneId","canonId") VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(), a.workspaceId, p.id, s.id, r.id, ch.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  } finally {
    await pool.end();
  }
});
it('serializes opposing raw SQL reparents before inspecting the two-level tree', async () => {
  const { a, c } = await fixture(),
    one = await createGroup(a, c, group('SQL one')),
    two = await createGroup(a, c, group('SQL two'));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const changes = await Promise.allSettled([
      pool.query('UPDATE "PlotGroup" SET "parentId"=$1 WHERE id=$2', [two.id, one.id]),
      pool.query('UPDATE "PlotGroup" SET "parentId"=$1 WHERE id=$2', [one.id, two.id]),
    ]);
    expect(changes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = changes.find((r) => r.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason.code : undefined).toBe('23514');
  } finally {
    await pool.end();
  }
});
it('moves across multiple SQL batches atomically without changing scene edit versions', async () => {
  const { a, c, s } = await fixture();
  const ids = Array.from({ length: 605 }, () => randomUUID());
  await db.$transaction(async (tx) => {
    await tx.scene.createMany({
      data: ids.map((id, position) => ({
        id,
        workspaceId: a.workspaceId,
        ...c,
        title: 'Scene ' + position,
        content: plainDocument(''),
        contentText: '',
        position,
      })),
    });
    await tx.story.update({ where: { id: s.id }, data: { sequenceVersion: 1 } });
  });
  const moved = await moveScene(a, c, ids.at(-1)!, 1, { beforeId: ids[0]! });
  expect(moved.sequenceVersion).toBe(2);
  const rows = await order(s.id);
  expect(rows.map((r) => r.id)).toEqual([ids.at(-1)!, ...ids.slice(0, -1)]);
  expect(rows.map((r) => r.position)).toEqual(Array.from({ length: 605 }, (_, i) => i));
  expect(await db.scene.count({ where: { storyId: s.id, version: 1 } })).toBe(605);
});

it('filters root groups with their child scenes while child/ungrouped views stay exact', async () => {
  const { a, c } = await fixture(),
    root = await createGroup(a, c, group('Root')),
    child = await createGroup(a, c, group('Child', root.id));
  const direct = await createScene(a, c, scene('Root scene', root.id)),
    nested = await createScene(a, c, scene('Child scene', child.id)),
    ungrouped = await createScene(a, c, scene('Free scene'));
  expect(
    (await getPlot(a, c, new URLSearchParams({ groupId: root.id }))).items.map((r) => r.id),
  ).toEqual([direct.id, nested.id]);
  expect(
    (await getPlot(a, c, new URLSearchParams({ groupId: child.id }))).items.map((r) => r.id),
  ).toEqual([nested.id]);
  expect(
    (await getPlot(a, c, new URLSearchParams({ groupId: 'ungrouped' }))).items.map((r) => r.id),
  ).toEqual([ungrouped.id]);
});
