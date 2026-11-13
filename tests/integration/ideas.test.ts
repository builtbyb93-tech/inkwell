import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, it, expect } from 'vitest';
import { database } from '../../apps/web/src/server/database';
import {
  createIdea,
  updateIdea,
  getIdea,
  listIdeas,
  createTaxonomy,
} from '../../apps/web/src/server/ideas';
import { addIdeaLink, listIdeaLinks, removeIdeaLink } from '../../apps/web/src/server/idea-links';
import { convertIdea, listConversions } from '../../apps/web/src/server/idea-conversions';
import { getTarget } from '../../apps/web/src/server/idea-targets';
import { createProject, createStory } from '../../apps/web/src/server/records';
import { plainDocument, type AccountRecord } from '@inkwell/contracts';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated integration runner.');
const db = database();
afterAll(() => db.$disconnect());
async function actor(): Promise<AccountRecord> {
  const u = await db.user.create({
    data: {
      email: randomUUID() + '@example.test',
      displayName: 'Vault author',
      emailVerifiedAt: new Date(),
      workspace: { create: {} },
    },
    include: { workspace: true },
  });
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    version: u.version,
    aiEnabled: false,
    workspaceId: u.workspace!.id,
  };
}
const input = (title: string, text = title) => ({
  title,
  content: plainDocument(text),
  categoryId: null,
  tagIds: [],
});

describe('vault persistence, search and scoped integrity', () => {
  it('searches indexed title/body with scoped category/tag AND filters and stable pages', async () => {
    const a = await actor(),
      b = await actor();
    const category = await createTaxonomy(a, 'categories', 'World building'),
      tag = await createTaxonomy(a, 'tags', 'Cosmos');
    const one = await createIdea(a, {
      ...input('Comet lantern one', 'A bright comet lantern crosses the sky.'),
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await createIdea(a, {
      ...input('Comet lantern two'),
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await createIdea(b, input('Comet lantern private'));
    const filter = new URLSearchParams({
      q: '"comet lantern"',
      categoryId: category.id,
      tagIds: tag.id,
      limit: '1',
    });
    const page = await listIdeas(a, filter);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    filter.set('cursor', page.nextCursor!);
    const next = await listIdeas(a, filter);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.id).not.toBe(page.items[0]?.id);
    expect((await listIdeas(b, new URLSearchParams({ q: 'comet', tagIds: tag.id }))).items).toEqual(
      [],
    );
    const edited = await updateIdea(a, one.id, one.version, {
      title: 'Different light',
      content: plainDocument('Nebula archive'),
    });
    expect((await listIdeas(a, new URLSearchParams('q=nebula'))).items[0]?.id).toBe(one.id);
    const archived = await updateIdea(a, one.id, edited.version, { archived: true });
    expect((await listIdeas(a, new URLSearchParams('q=nebula'))).items).toHaveLength(0);
    expect((await listIdeas(a, new URLSearchParams('q=nebula&archived=true'))).items).toHaveLength(
      1,
    );
    const restored = await updateIdea(a, one.id, archived.version, { archived: false });
    expect(restored.tags[0]?.id).toBe(tag.id);
    expect(restored.category?.id).toBe(category.id);
    const index = await db.$queryRaw<
      { indexdef: string }[]
    >`SELECT indexdef FROM pg_indexes WHERE tablename='Idea' AND indexdef LIKE '%USING gin%'`;
    expect(index).toHaveLength(1);
  });
  it('rejects foreign labels and records at both service and database boundaries', async () => {
    const a = await actor(),
      b = await actor();
    const idea = await createIdea(a, input('Owned'));
    const foreignCategory = await createTaxonomy(b, 'categories', 'Foreign'),
      foreignTag = await createTaxonomy(b, 'tags', 'Foreign');
    await expect(getIdea(b, idea.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateIdea(b, idea.id, 1, { title: 'Intrusion' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      updateIdea(a, idea.id, 1, { categoryId: foreignCategory.id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(updateIdea(a, idea.id, 1, { tagIds: [foreignTag.id] })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      db.ideaTagAssignment.create({
        data: { ideaId: idea.id, tagId: foreignTag.id, workspaceId: a.workspaceId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect((await getIdea(a, idea.id)).version).toBe(1);
  });
  it('keeps multiple qualified story/scene links through archive/restore and rejects mismatched projects', async () => {
    const a = await actor(),
      b = await actor();
    const p1 = await createProject(a, { title: 'One', description: '' }),
      p2 = await createProject(a, { title: 'Two', description: '' }),
      foreign = await createProject(b, { title: 'Foreign', description: '' });
    const s1 = await createStory(a, p1.id, { title: 'First', synopsis: '', format: '' }),
      s2 = await createStory(a, p2.id, { title: 'Second', synopsis: '', format: '' }),
      foreignStory = await createStory(b, foreign.id, {
        title: 'Private',
        synopsis: '',
        format: '',
      });
    const source = await createIdea(a, input('Scene source'));
    const scene = await convertIdea(a, source.id, 1, randomUUID(), {
      kind: 'SCENE',
      projectId: p2.id,
      storyId: s2.id,
    });
    const idea = await createIdea(a, input('Many references'));
    await addIdeaLink(a, idea.id, 1, { kind: 'STORY', projectId: p1.id, storyId: s1.id });
    await addIdeaLink(a, idea.id, 2, { kind: 'STORY', projectId: p2.id, storyId: s2.id });
    await addIdeaLink(a, idea.id, 3, {
      kind: 'SCENE',
      projectId: p2.id,
      storyId: s2.id,
      sceneId: scene.conversion.targetSceneId!,
    });
    await expect(
      addIdeaLink(a, idea.id, 4, { kind: 'STORY', projectId: p2.id, storyId: s1.id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      addIdeaLink(a, idea.id, 4, {
        kind: 'STORY',
        projectId: foreign.id,
        storyId: foreignStory.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    const invalidLinkSource = await createIdea(a, input('Invalid link fixture'));
    await expect(
      db.ideaSceneLink.create({
        data: {
          workspaceId: a.workspaceId,
          ideaId: invalidLinkSource.id,
          projectId: p1.id,
          storyId: s1.id,
          sceneId: scene.conversion.targetSceneId!,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const archived = await updateIdea(a, idea.id, 4, { archived: true });
    expect((await listIdeaLinks(a, idea.id, 'STORY', new URLSearchParams())).items).toHaveLength(2);
    const restored = await updateIdea(a, idea.id, archived.version, { archived: false });
    expect(restored.counts).toMatchObject({ stories: 2, scenes: 1 });
  });
  it('rejects stale creative edits without clearing rich content or classification', async () => {
    const a = await actor(),
      idea = await createIdea(a, input('Draft', 'Keep this body'));
    const changes = await Promise.allSettled([
      updateIdea(a, idea.id, 1, { title: 'A' }),
      updateIdea(a, idea.id, 1, { title: 'B' }),
    ]);
    expect(changes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(changes.find((r) => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect((await getIdea(a, idea.id)).content).toEqual(plainDocument('Keep this body'));
  });
});
describe('atomic typed conversions and durable source provenance', () => {
  it('creates all three target types and independent snapshots; archive cannot destroy provenance', async () => {
    const a = await actor(),
      p = await createProject(a, { title: 'Universe', description: '' }),
      parent = await createStory(a, p.id, { title: 'Parent', synopsis: '', format: '' }),
      idea = await createIdea(a, input('Seed', 'Original seed content'));
    const story = await convertIdea(a, idea.id, 1, randomUUID(), {
      kind: 'STORY',
      projectId: p.id,
    });
    const character = await convertIdea(a, idea.id, story.ideaVersion, randomUUID(), {
      kind: 'CHARACTER',
      projectId: p.id,
    });
    const scene = await convertIdea(a, idea.id, character.ideaVersion, randomUUID(), {
      kind: 'SCENE',
      projectId: p.id,
      storyId: parent.id,
    });
    expect(
      (await db.story.findUniqueOrThrow({ where: { id: story.conversion.targetStoryId! } }))
        .synopsis,
    ).toBe('Original seed content');
    const edited = await updateIdea(a, idea.id, scene.ideaVersion, {
      content: plainDocument('A different source now'),
    });
    expect(
      (await getTarget(a, 'CHARACTER', p.id, character.conversion.targetCharacterId!)).content,
    ).toEqual(plainDocument('Original seed content'));
    expect(
      (await db.ideaConversion.findUniqueOrThrow({ where: { id: scene.conversion.id } }))
        .contentSnapshot,
    ).toEqual(plainDocument('Original seed content'));
    const link = (await listIdeaLinks(a, idea.id, 'STORY', new URLSearchParams())).items[0]!;
    await expect(
      removeIdeaLink(a, idea.id, 'STORY', link.id, edited.version),
    ).rejects.toMatchObject({ status: 409 });
    await updateIdea(a, idea.id, edited.version, { archived: true });
    expect(
      (await getTarget(a, 'SCENE', p.id, scene.conversion.targetSceneId!, parent.id)).sources[0],
    ).toMatchObject({ id: idea.id, archived: true });
    expect((await listConversions(a, idea.id, new URLSearchParams())).items).toHaveLength(3);
  });
  it('replays simultaneous retries without duplicate targets and rejects reusing a key for another request', async () => {
    const a = await actor(),
      p = await createProject(a, { title: 'Project', description: '' }),
      idea = await createIdea(a, input('Retry')),
      key = randomUUID();
    const results = await Promise.all([
      convertIdea(a, idea.id, 1, key, { kind: 'STORY', projectId: p.id }),
      convertIdea(a, idea.id, 1, key, { kind: 'STORY', projectId: p.id }),
    ]);
    expect(results.map((r) => r.conversion.id)[0]).toBe(results[1]?.conversion.id);
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
    expect(await db.story.count({ where: { projectId: p.id } })).toBe(1);
    const newer = await updateIdea(a, idea.id, 2, {
      content: plainDocument('Another tab changed the body'),
    });
    const replay = await convertIdea(a, idea.id, 1, key, { kind: 'STORY', projectId: p.id });
    expect(replay.ideaVersion).toBe(2);
    expect(newer.version).toBe(3);
    await expect(
      updateIdea(a, idea.id, replay.ideaVersion, { title: 'Stale title' }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getIdea(a, idea.id)).content).toEqual(
      plainDocument('Another tab changed the body'),
    );
    await expect(
      convertIdea(a, idea.id, 1, key, { kind: 'CHARACTER', projectId: p.id }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('serializes scene appends and source revisions and rolls back invalid target chains', async () => {
    const a = await actor(),
      p = await createProject(a, { title: 'Project', description: '' }),
      other = await createProject(a, { title: 'Other', description: '' }),
      story = await createStory(a, p.id, { title: 'Story', synopsis: '', format: '' }),
      one = await createIdea(a, input('One')),
      two = await createIdea(a, input('Two'));
    await Promise.all([
      convertIdea(a, one.id, 1, randomUUID(), {
        kind: 'SCENE',
        projectId: p.id,
        storyId: story.id,
      }),
      convertIdea(a, two.id, 1, randomUUID(), {
        kind: 'SCENE',
        projectId: p.id,
        storyId: story.id,
      }),
    ]);
    expect(
      (await db.scene.findMany({ where: { storyId: story.id }, orderBy: { position: 'asc' } })).map(
        (s) => s.position,
      ),
    ).toEqual([0, 1]);
    expect((await db.story.findUniqueOrThrow({ where: { id: story.id } })).sequenceVersion).toBe(2);
    const bad = await createIdea(a, input('Bad chain'));
    await expect(
      convertIdea(a, bad.id, 1, randomUUID(), {
        kind: 'SCENE',
        projectId: other.id,
        storyId: story.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await getIdea(a, bad.id)).version).toBe(1);
    expect(await db.ideaConversion.count({ where: { ideaId: bad.id } })).toBe(0);
    const competing = await Promise.allSettled([
      convertIdea(a, bad.id, 1, randomUUID(), { kind: 'STORY', projectId: p.id }),
      convertIdea(a, bad.id, 1, randomUUID(), { kind: 'CHARACTER', projectId: p.id }),
    ]);
    expect(competing.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.ideaConversion.count({ where: { ideaId: bad.id } })).toBe(1);
  });
  it('fails safely on an unsupported persisted rich-text version without converting it', async () => {
    const a = await actor(),
      p = await createProject(a, { title: 'Project', description: '' }),
      idea = await createIdea(a, input('Future document'));
    await db.idea.update({ where: { id: idea.id }, data: { contentSchemaVersion: 2 } });
    await expect(getIdea(a, idea.id)).rejects.toMatchObject({ status: 503 });
    await expect(
      convertIdea(a, idea.id, 1, randomUUID(), { kind: 'STORY', projectId: p.id }),
    ).rejects.toMatchObject({ status: 503 });
    expect((await db.idea.findUniqueOrThrow({ where: { id: idea.id } })).version).toBe(1);
    expect(await db.ideaConversion.count({ where: { ideaId: idea.id } })).toBe(0);
  });
  it('enforces exactly one typed conversion target with a database check', async () => {
    const a = await actor(),
      p = await createProject(a, { title: 'Project', description: '' }),
      idea = await createIdea(a, input('Seed'));
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await expect(
        pool.query(
          'INSERT INTO "IdeaConversion" (id,"workspaceId","requestKey","requestHash","ideaId","projectId",kind,"sourceVersion","titleSnapshot","contentSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            randomUUID(),
            a.workspaceId,
            randomUUID(),
            'test-hash',
            idea.id,
            p.id,
            'STORY',
            1,
            'Seed',
            JSON.stringify(plainDocument('Seed')),
          ],
        ),
      ).rejects.toMatchObject({ code: '23514', constraint: 'IdeaConversion_target_check' });
    } finally {
      await pool.end();
    }
  });
});
