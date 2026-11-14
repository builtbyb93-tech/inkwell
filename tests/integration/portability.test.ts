import { randomUUID } from 'node:crypto';
import { it, expect, afterAll } from 'vitest';
import { database } from '../../apps/web/src/server/database';
import { createProject, createStory } from '../../apps/web/src/server/records';
import { createIdea, createTaxonomy } from '../../apps/web/src/server/ideas';
import { createCanon, saveOverride, updateCanon } from '../../apps/web/src/server/canon';
import {
  createGroup,
  createScene,
  duplicateScene,
  updateScene,
} from '../../apps/web/src/server/plot';
import { createRelationship } from '../../apps/web/src/server/canon-relationships';
import { changeSceneCanon } from '../../apps/web/src/server/plot-links';
import { addIdeaLink } from '../../apps/web/src/server/idea-links';
import { convertIdea } from '../../apps/web/src/server/idea-conversions';
import { exportProject, importProject, readArchive } from '../../apps/web/src/server/portability';
import { plainDocument, type AccountRecord } from '@inkwell/contracts';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated runner.');
const db = database();
afterAll(() => db.$disconnect());
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
    p = await createProject(a, { title: 'Lantern project', description: 'A complete world' }),
    s = await createStory(a, p.id, {
      title: 'Lantern story',
      synopsis: 'Opening',
      format: 'Comic',
    }),
    c = { projectId: p.id, storyId: s.id },
    shared = { projectId: p.id };
  const category = await createTaxonomy(a, 'categories', 'Worlds'),
    tag = await createTaxonomy(a, 'tags', 'Lanterns'),
    idea = await createIdea(a, {
      title: 'Lantern source',
      content: plainDocument('Provenance notes'),
      categoryId: category.id,
      tagIds: [tag.id],
    });
  const hero = await createCanon(a, shared, {
      kind: 'CHARACTER',
      name: 'Mira',
      content: plainDocument('Shared notes'),
    }),
    place = await createCanon(a, c, {
      kind: 'LOCATION',
      name: 'Observatory',
      content: plainDocument('A story place'),
    });
  await saveOverride(a, c, hero.id, 0, {
    baseVersion: hero.version,
    name: { mode: 'CUSTOM', value: 'Story Mira' },
    content: { mode: 'CLEAR' },
  });
  await updateCanon(a, shared, hero.id, 1, { name: 'Shared Mira now' });
  const root = await createGroup(a, c, { title: 'Act', description: 'Root', parentId: null }),
    child = await createGroup(a, c, { title: 'Sequence', description: 'Child', parentId: root.id }),
    scene = await createScene(a, c, {
      title: 'Arrival',
      content: plainDocument('A rich scene'),
      status: 'DRAFT',
      groupId: child.id,
    });
  await changeSceneCanon(a, c, scene.id, 1, { kind: 'CHARACTER', canonId: hero.id });
  await changeSceneCanon(a, c, scene.id, 2, { kind: 'LOCATION', canonId: place.id });
  await addIdeaLink(a, idea.id, 1, { kind: 'STORY', projectId: p.id, storyId: s.id });
  let current = await db.idea.findUniqueOrThrow({ where: { id: idea.id } });
  await addIdeaLink(a, idea.id, current.version, {
    kind: 'SCENE',
    projectId: p.id,
    storyId: s.id,
    sceneId: scene.id,
  });
  current = await db.idea.findUniqueOrThrow({ where: { id: idea.id } });
  await convertIdea(a, idea.id, current.version, randomUUID(), {
    kind: 'CHARACTER',
    projectId: p.id,
  });
  const copy = await duplicateScene(a, c, scene.id, 3);
  await updateScene(a, c, copy.id, copy.version, { archived: true });
  await createRelationship(a, c, hero.id, {
    toId: place.id,
    kind: 'LOCATED_IN',
    label: 'Lives here',
  });
  const other = await createProject(a, { title: 'Unrelated secret project', description: '' }),
    otherStory = await createStory(a, other.id, {
      title: 'Other secret story',
      synopsis: '',
      format: '',
    });
  current = await db.idea.findUniqueOrThrow({ where: { id: idea.id } });
  await addIdeaLink(a, idea.id, current.version, {
    kind: 'STORY',
    projectId: other.id,
    storyId: otherStory.id,
  });
  return { a, p, s, idea, other, otherStory };
}
it('exports only the selected project and round-trips archived content, overrides, graph and provenance with fresh IDs', async () => {
  const { a, p, other, otherStory } = await fixture(),
    archive = await exportProject(a, p.id);
  const raw = JSON.stringify(archive);
  expect(raw).not.toContain(other.id);
  expect(raw).not.toContain(otherStory.id);
  expect(raw).not.toMatch(/workspaceId|requestKey|requestHash|password|saveReceipt/);
  expect(archive.overrides[0]).toMatchObject({
    baseVersion: 1,
    hasName: true,
    hasContent: true,
    content: null,
  });
  expect(archive.scenes.some((s) => s.archivedAt)).toBe(true);
  const b = await actor(),
    result = await importProject(b, archive),
    again = await exportProject(b, result.projectId);
  expect(result.projectId).not.toBe(p.id);
  expect(again.project.title).toBe(archive.project.title);
  expect(again.stories.map((s) => s.title)).toEqual(archive.stories.map((s) => s.title));
  expect(again.scenes.map((s) => s.title).sort()).toEqual(
    archive.scenes.map((s) => s.title).sort(),
  );
  expect(again.scenes.map((s) => s.position).sort()).toEqual(
    archive.scenes.map((s) => s.position).sort(),
  );
  expect(again.overrides[0]).toMatchObject({
    baseVersion: 1,
    baseName: 'Mira',
    name: 'Story Mira',
    hasContent: true,
    content: null,
  });
  expect(again.conversions[0]?.contentSnapshot).toEqual(archive.conversions[0]?.contentSnapshot);
  expect(again.sceneCharacters).toHaveLength(2);
  expect(again.sceneLocations).toHaveLength(2);
  expect(again.ideaStoryLinks).toHaveLength(1);
  expect(again.ideaSceneLinks).toHaveLength(2);
  expect(again.relationships).toHaveLength(1);
  for (const key of [
    'stories',
    'canon',
    'overrides',
    'groups',
    'scenes',
    'ideas',
    'relationships',
    'conversions',
  ] as const) {
    expect(again[key]).toHaveLength(archive[key].length);
    const old = new Set(archive[key].map((r) => r.id));
    expect(again[key].some((r) => old.has(r.id))).toBe(false);
  }
  const copy = again.scenes.find((s) => s.duplicatedFromId)!;
  expect(again.scenes.some((s) => s.id === copy.duplicatedFromId)).toBe(true);
  expect(again.groups.find((g) => g.parentId)?.parentId).toBe(
    again.groups.find((g) => !g.parentId)?.id,
  );
  await expect(exportProject(a, result.projectId)).rejects.toMatchObject({ status: 404 });
});
it('reuses workspace taxonomy names without changing existing labels or merging content', async () => {
  const { a, p } = await fixture(),
    archive = await exportProject(a, p.id),
    b = await actor(),
    existing = await createTaxonomy(b, 'categories', 'WORLDS');
  await importProject(b, archive);
  await importProject(b, archive);
  expect(await db.ideaCategory.count({ where: { workspaceId: b.workspaceId } })).toBe(1);
  expect((await db.ideaCategory.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe(
    'WORLDS',
  );
  expect(await db.project.count({ where: { workspaceId: b.workspaceId } })).toBe(2);
  expect(await db.idea.count({ where: { workspaceId: b.workspaceId } })).toBe(2);
});
it('rejects unknown versions, unsafe rich text, missing references, duplicate ordering and third-level groups before writes', async () => {
  const { a, p } = await fixture(),
    archive = await exportProject(a, p.id),
    b = await actor();
  for (const corrupt of [
    (x: typeof archive) => {
      x.version = 2 as 1;
    },
    (x: typeof archive) => {
      x.scenes[0]!.content = { type: 'doc', content: [{ type: 'image' }] };
    },
    (x: typeof archive) => {
      x.ideaStoryLinks[0]!.storyId = randomUUID();
    },
    (x: typeof archive) => {
      x.scenes[1]!.position = x.scenes[0]!.position;
    },
    (x: typeof archive) => {
      const child = x.groups.find((g) => g.parentId)!;
      x.groups.push({ ...child, id: randomUUID(), parentId: child.id });
    },
    (x: typeof archive) => {
      x.sceneCharacters[0]!.canonId = x.canon.find((c) => c.kind === 'LOCATION')!.id;
    },
    (x: typeof archive) => {
      x.scenes[0]!.duplicatedFromId = x.scenes[1]!.id;
      x.scenes[1]!.duplicatedFromId = x.scenes[0]!.id;
    },
  ]) {
    const changed = structuredClone(archive);
    corrupt(changed);
    await expect(importProject(b, changed)).rejects.toMatchObject({ status: 400 });
  }
  expect(await db.project.count({ where: { workspaceId: b.workspaceId } })).toBe(0);
  expect(() => readArchive('{"version":99}')).toThrow('Unsupported archive version');
  expect(() => readArchive('['.repeat(65) + ']'.repeat(65))).toThrow();
});
it('rolls back project, taxonomy and every child when a late database write fails', async () => {
  const { a, p } = await fixture(),
    archive = await exportProject(a, p.id),
    b = await actor();
  await db.$executeRawUnsafe(
    `CREATE FUNCTION inkwell_test_import_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."workspaceId"='${b.workspaceId}'::uuid THEN RAISE EXCEPTION 'test failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    'CREATE TRIGGER inkwell_test_import_failure BEFORE INSERT ON "IdeaConversion" FOR EACH ROW EXECUTE FUNCTION inkwell_test_import_failure()',
  );
  try {
    await expect(importProject(b, archive)).rejects.toBeDefined();
    for (const count of await Promise.all([
      db.project.count({ where: { workspaceId: b.workspaceId } }),
      db.story.count({ where: { workspaceId: b.workspaceId } }),
      db.canonRecord.count({ where: { workspaceId: b.workspaceId } }),
      db.scene.count({ where: { workspaceId: b.workspaceId } }),
      db.idea.count({ where: { workspaceId: b.workspaceId } }),
      db.ideaCategory.count({ where: { workspaceId: b.workspaceId } }),
      db.ideaTag.count({ where: { workspaceId: b.workspaceId } }),
    ]))
      expect(count).toBe(0);
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER inkwell_test_import_failure ON "IdeaConversion"');
    await db.$executeRawUnsafe('DROP FUNCTION inkwell_test_import_failure()');
  }
});
