import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { it, expect, afterAll } from 'vitest';
import { Prisma } from '@inkwell/db';
import { plainDocument, type AccountRecord, type CanonKind } from '@inkwell/contracts';
import { database } from '../../apps/web/src/server/database';
import { searchWorkspace } from '../../apps/web/src/server/search';
if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use isolated runner.');
const db = database();
afterAll(() => db.$disconnect());
it('meets the approved warm p95 gate across 10,000 mixed records and uses the GIN index for selective search', async () => {
  const u = await db.user.create({
      data: {
        email: randomUUID() + '@example.test',
        emailVerifiedAt: new Date(),
        workspace: { create: {} },
      },
      include: { workspace: true },
    }),
    a: AccountRecord = {
      id: u.id,
      email: u.email,
      displayName: '',
      workspaceId: u.workspace!.id,
      version: 1,
      aiEnabled: false,
    },
    workspaceId = a.workspaceId,
    doc = plainDocument('Nebula common searchable notes'),
    base = { workspaceId, createdAt: new Date(), updatedAt: new Date() };
  const projects = Array.from({ length: 100 }, (_, i) => ({
    ...base,
    id: randomUUID(),
    title: 'Nebula project ' + i,
    description: 'Nebula notes',
  }));
  await db.project.createMany({ data: projects });
  const stories = Array.from({ length: 500 }, (_, i) => ({
    ...base,
    id: randomUUID(),
    projectId: projects[i % 100]!.id,
    title: 'Nebula story ' + i,
  }));
  await db.story.createMany({ data: stories });
  const ideas = Array.from({ length: 3000 }, (_, i) => ({
    ...base,
    id: randomUUID(),
    title: i === 0 ? 'quasarneedle' : 'Nebula idea ' + i,
    content: doc as Prisma.InputJsonValue,
    contentText: 'Nebula common notes',
  }));
  const kinds: CanonKind[] = ['CHARACTER', 'LOCATION', 'LORE', 'EVENT', 'ORGANIZATION'];
  const canon = Array.from({ length: 3000 }, (_, i) => ({
    ...base,
    id: randomUUID(),
    projectId: projects[i % 100]!.id,
    kind: kinds[i % 5]!,
    scope: 'SHARED' as const,
    name: 'Nebula canon ' + i,
    content: doc as Prisma.InputJsonValue,
    contentText: 'Nebula common notes',
  }));
  const scenes = Array.from({ length: 3000 }, (_, i) => ({
    ...base,
    id: randomUUID(),
    projectId: stories[i % 500]!.projectId,
    storyId: stories[i % 500]!.id,
    title: 'Nebula scene ' + i,
    position: Math.floor(i / 500),
    content: doc as Prisma.InputJsonValue,
    contentText: 'Nebula common notes',
  }));
  for (let i = 0; i < 3000; i += 200) {
    await db.idea.createMany({ data: ideas.slice(i, i + 200) });
    await db.canonRecord.createMany({ data: canon.slice(i, i + 200) });
    await db.scene.createMany({ data: scenes.slice(i, i + 200) });
  }
  await db.plotGroup.createMany({
    data: stories.slice(0, 300).map((s, i) => ({
      ...base,
      id: randomUUID(),
      projectId: s.projectId,
      storyId: s.id,
      title: 'Nebula group ' + i,
    })),
  });
  await db.canonOverride.createMany({
    data: canon.slice(0, 100).map((c, i) => ({
      ...base,
      id: randomUUID(),
      projectId: c.projectId,
      storyId: stories[i]!.id,
      canonId: c.id,
      hasName: true,
      name: 'Nebula override ' + i,
      baseVersion: 1,
      baseName: c.name,
      baseContent: doc as Prisma.InputJsonValue,
    })),
  });
  const counts = await Promise.all([
    db.project.count({ where: { workspaceId } }),
    db.story.count({ where: { workspaceId } }),
    db.idea.count({ where: { workspaceId } }),
    db.canonRecord.count({ where: { workspaceId } }),
    db.scene.count({ where: { workspaceId } }),
    db.plotGroup.count({ where: { workspaceId } }),
    db.canonOverride.count({ where: { workspaceId } }),
  ]);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(10000);
  for (const table of [
    'Project',
    'Story',
    'Idea',
    'Character',
    'Scene',
    'PlotGroup',
    'CanonOverride',
  ])
    await db.$executeRawUnsafe('ANALYZE "' + table + '"');
  const queries = [
    new URLSearchParams({ q: 'Nebula' }),
    new URLSearchParams({ q: 'quasarneedle' }),
    new URLSearchParams({ q: 'Nebula', projectId: projects[0]!.id }),
    new URLSearchParams({ q: 'Nebula', projectId: projects[0]!.id, storyId: stories[0]!.id }),
    new URLSearchParams({ q: 'Nebula', kinds: 'CANON,OVERRIDE', canonKind: 'LOCATION' }),
    new URLSearchParams({ q: 'absentterm', archive: 'all' }),
  ];
  for (const q of queries) await searchWorkspace(a, q);
  const measured: number[] = [];
  for (let i = 0; i < 36; i++) {
    const start = performance.now();
    await searchWorkspace(a, queries[i % queries.length]!);
    measured.push(performance.now() - start);
  }
  measured.sort((a, b) => a - b);
  const p95 = measured[Math.ceil(measured.length * 0.95) - 1]!;
  writeFileSync(
    '/tmp/inkwell-phase5-search-gate.json',
    JSON.stringify({
      searchGate: {
        records: 10000,
        warmQueries: 36,
        p95Ms: Number(p95.toFixed(2)),
        limitMs: 250,
        environment: 'isolated local PostgreSQL; VPS unverified',
      },
    }),
  );
  expect(p95).toBeLessThanOrEqual(250);
  const plan =
    await db.$queryRaw`EXPLAIN (FORMAT JSON) SELECT id FROM "Idea" WHERE "workspaceId"=${workspaceId}::uuid AND "searchVector" @@ websearch_to_tsquery('simple','quasarneedle')`;
  expect(JSON.stringify(plan)).toContain('Idea_searchVector_idx');
}, 60000);
