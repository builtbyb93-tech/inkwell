import { randomUUID } from 'node:crypto';
import { it, expect, afterAll } from 'vitest';
import { database } from '../../apps/web/src/server/database';
import {
  createProject,
  createStory,
  updateProject,
  updateStory,
} from '../../apps/web/src/server/records';
import { createIdea, updateIdea } from '../../apps/web/src/server/ideas';
import { createCanon, saveOverride, updateCanon } from '../../apps/web/src/server/canon';
import { createScene, createGroup } from '../../apps/web/src/server/plot';
import { saveDraft } from '../../apps/web/src/server/draft-saves';
import { searchWorkspace } from '../../apps/web/src/server/search';
import { plainDocument, DraftSaveInput, type AccountRecord } from '@inkwell/contracts';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated runner.');
const db = database();
afterAll(() => db.$disconnect());
export async function actor(): Promise<AccountRecord> {
  const u = await db.user.create({
    data: {
      email: randomUUID() + '@example.test',
      displayName: 'Reliability author',
      emailVerifiedAt: new Date(),
      workspace: { create: {} },
    },
    include: { workspace: true },
  });
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    version: 1,
    workspaceId: u.workspace!.id,
    aiEnabled: false,
  };
}
const idea = (title: string) => ({
  title,
  content: plainDocument(title + ' notes'),
  categoryId: null,
  tagIds: [],
});
it('replays acknowledged saves without advancing past unseen edits and stores no content in receipts', async () => {
  const a = await actor(),
    r = await createIdea(a, idea('Comet')),
    input = DraftSaveInput.parse({
      kind: 'IDEA',
      recordId: r.id,
      version: 1,
      requestKey: randomUUID(),
      fields: { title: 'Saved comet' },
    });
  const one = await saveDraft(a, input);
  expect(one).toMatchObject({ version: 2, replayed: false });
  await updateIdea(a, r.id, 2, { title: 'Other tab comet' });
  expect(await saveDraft(a, input)).toMatchObject({ version: 2, replayed: true });
  await expect(
    saveDraft(
      a,
      DraftSaveInput.parse({
        ...input,
        requestKey: randomUUID(),
        fields: { title: 'Unseen overwrite' },
      }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  const receipt = await db.saveReceipt.findFirstOrThrow({ where: { workspaceId: a.workspaceId } });
  expect(Object.keys(receipt)).not.toContain('fields');
  expect(Object.keys(receipt)).not.toContain('content');
  expect((await db.idea.findUniqueOrThrow({ where: { id: r.id } })).title).toBe('Other tab comet');
});
it('serializes duplicate save requests and rejects reused keys or foreign writers atomically', async () => {
  const a = await actor(),
    b = await actor(),
    r = await createIdea(a, idea('Comet'));
  const input = DraftSaveInput.parse({
    kind: 'IDEA',
    recordId: r.id,
    version: 1,
    requestKey: randomUUID(),
    fields: { title: 'Saved comet' },
  });
  const result = await Promise.all([saveDraft(a, input), saveDraft(a, input)]);
  expect(result.map((r) => r.replayed).sort()).toEqual([false, true]);
  expect(await db.saveReceipt.count({ where: { workspaceId: a.workspaceId } })).toBe(1);
  await expect(
    saveDraft(a, DraftSaveInput.parse({ ...input, fields: { title: 'Different' } })),
  ).rejects.toMatchObject({
    status: 409,
  });
  await expect(saveDraft(b, input)).rejects.toMatchObject({ status: 404 });
  expect(await db.saveReceipt.count({ where: { workspaceId: b.workspaceId } })).toBe(0);
});
it('shares authorized transaction writers across every autosave target and bounds receipts per target', async () => {
  const a = await actor(),
    p = await createProject(a, { title: 'Comet project', description: '' }),
    s = await createStory(a, p.id, { title: 'Comet story', synopsis: '', format: '' }),
    c = { projectId: p.id, storyId: s.id },
    canon = await createCanon(
      a,
      { projectId: p.id },
      { kind: 'CHARACTER', name: 'Comet Ada', content: plainDocument('') },
    ),
    scene = await createScene(a, c, {
      title: 'Comet scene',
      content: plainDocument(''),
      status: 'PLANNED',
      groupId: null,
    }),
    g = await createGroup(a, c, { title: 'Comet group', description: '', parentId: null });
  const inputs = [
    {
      kind: 'PROJECT',
      recordId: p.id,
      fields: { title: 'Comet project updated', description: 'Notes' },
    },
    {
      kind: 'STORY',
      recordId: s.id,
      projectId: p.id,
      fields: { title: 'Comet story updated', synopsis: 'Notes', format: '' },
    },
    { kind: 'CANON', recordId: canon.id, projectId: p.id, fields: { name: 'Comet Ada updated' } },
    { kind: 'SCENE', recordId: scene.id, ...c, fields: { status: 'DRAFT' } },
    { kind: 'GROUP', recordId: g.id, ...c, fields: { description: 'Notes' } },
  ];
  for (const input of inputs)
    expect(
      (await saveDraft(a, DraftSaveInput.parse({ ...input, requestKey: randomUUID(), version: 1 })))
        .version,
    ).toBe(2);
  const o = await saveDraft(
    a,
    DraftSaveInput.parse({
      kind: 'OVERRIDE',
      recordId: canon.id,
      ...c,
      requestKey: randomUUID(),
      version: 0,
      fields: { baseVersion: 2, name: { mode: 'CLEAR' }, content: { mode: 'INHERIT' } },
    }),
  );
  expect(o.version).toBe(1);
  await saveDraft(a, DraftSaveInput.parse({ ...inputs[0], requestKey: randomUUID(), version: 2 }));
  expect(await db.saveReceipt.count({ where: { workspaceId: a.workspaceId } })).toBe(6);
});
it('searches all approved types with scoped filters, archive policy and stable cursors', async () => {
  const a = await actor(),
    b = await actor(),
    p = await createProject(a, { title: 'Comet project', description: '' }),
    s = await createStory(a, p.id, { title: 'Comet story', synopsis: '', format: '' }),
    c = { projectId: p.id, storyId: s.id };
  await createIdea(a, idea('Comet idea'));
  await createIdea(b, idea('Comet foreign'));
  await createCanon(
    a,
    { projectId: p.id },
    { kind: 'CHARACTER', name: 'Comet Ada', content: plainDocument('') },
  );
  await createScene(a, c, {
    title: 'Comet scene',
    content: plainDocument(''),
    status: 'PLANNED',
    groupId: null,
  });
  await createGroup(a, c, { title: 'Comet group', description: '', parentId: null });
  const result = await searchWorkspace(a, new URLSearchParams({ q: 'comet' }));
  expect(new Set(result.items.map((r) => r.kind))).toEqual(
    new Set(['PROJECT', 'STORY', 'IDEA', 'CANON', 'SCENE', 'GROUP']),
  );
  expect(result.items.some((r) => r.title === 'Comet foreign')).toBe(false);
  const first = await searchWorkspace(a, new URLSearchParams({ q: 'comet', limit: '2' })),
    next = await searchWorkspace(
      a,
      new URLSearchParams({ q: 'comet', limit: '2', cursor: first.nextCursor! }),
    );
  expect(next.items.some((r) => first.items.some((old) => old.resultId === r.resultId))).toBe(
    false,
  );
  await expect(
    searchWorkspace(
      a,
      new URLSearchParams({ q: 'different', limit: '2', cursor: first.nextCursor! }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    searchWorkspace(b, new URLSearchParams({ q: 'comet', projectId: p.id })),
  ).rejects.toMatchObject({ status: 404 });
  await updateProject(a, p.id, 1, { archived: true });
  expect(
    (await searchWorkspace(a, new URLSearchParams({ q: 'comet' }))).items.map((r) => r.kind),
  ).toEqual(['IDEA']);
  expect(
    (await searchWorkspace(a, new URLSearchParams({ q: 'comet', archive: 'archived' }))).items,
  ).toHaveLength(5);
});
it('indexes effective overrides without searching cleared/overridden-away shared fields and refreshes inheritance', async () => {
  const a = await actor(),
    p = await createProject(a, { title: 'World', description: '' }),
    s = await createStory(a, p.id, { title: 'Story', synopsis: '', format: '' }),
    c = { projectId: p.id, storyId: s.id },
    r = await createCanon(
      a,
      { projectId: p.id },
      { kind: 'CHARACTER', name: 'Secret comet', content: plainDocument('Ancient harbor') },
    );
  await saveOverride(a, c, r.id, 0, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Private lantern' },
    content: { mode: 'CLEAR' },
  });
  const search = (q: string) =>
    searchWorkspace(a, new URLSearchParams({ q, ...c, kinds: 'CANON' }));
  expect((await search('comet')).items).toEqual([]);
  expect((await search('harbor')).items).toEqual([]);
  expect((await search('lantern')).items[0]).toMatchObject({
    kind: 'OVERRIDE',
    title: 'Private lantern',
    storyId: s.id,
  });
  await saveOverride(a, c, r.id, 1, {
    baseVersion: 1,
    name: { mode: 'CUSTOM', value: 'Private lantern' },
    content: { mode: 'INHERIT' },
  });
  await updateCanon(a, { projectId: p.id }, r.id, 1, { content: plainDocument('Silver forest') });
  expect((await search('forest')).items[0]?.kind).toBe('OVERRIDE');
  expect((await search('harbor')).items).toEqual([]);
  expect((await db.canonOverride.findFirstOrThrow({ where: { canonId: r.id } })).version).toBe(2);
});

it('does not return inherited shared canon as active within an archived story context', async () => {
  const a = await actor(),
    p = await createProject(a, { title: 'Hidden nebula project', description: '' }),
    s = await createStory(a, p.id, { title: 'Hidden nebula story', synopsis: '', format: '' });
  await createCanon(
    a,
    { projectId: p.id },
    { kind: 'LORE', name: 'Inherited nebula', content: plainDocument('Shared notes') },
  );
  await updateStory(a, p.id, s.id, 1, { archived: true });
  expect(
    (
      await searchWorkspace(
        a,
        new URLSearchParams({ q: 'nebula', kinds: 'CANON', projectId: p.id, storyId: s.id }),
      )
    ).items,
  ).toHaveLength(0);
  expect(
    (
      await searchWorkspace(
        a,
        new URLSearchParams({
          q: 'nebula',
          kinds: 'CANON',
          projectId: p.id,
          storyId: s.id,
          archive: 'archived',
        }),
      )
    ).items,
  ).toHaveLength(1);
});
