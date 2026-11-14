import 'server-only';
import { Prisma } from '@inkwell/db';
import type { z } from 'zod';
import {
  PlotQuery,
  ListQuery,
  documentText,
  type AccountRecord,
  type PlotGroupRecord,
  type PlotGroupInput,
  type PlotGroupPatch,
  type SceneInput,
  type ScenePatch,
  type SceneMove,
  type SceneRecord,
  type PlotPage,
} from '@inkwell/contracts';
import { decodePlotCursor, encodePlotCursor, moveSceneOrder } from '@inkwell/domain';
import { database } from './database';
import { id } from './records';
import { canonContext } from './canon';
import { appendSceneSeed } from './idea-targets';
import { type Tx, readDocument, jsonDocument, pageResult, prismaPosition } from './ideas';
import { HttpError, notFound, conflict } from './http';
export type PlotContext = { projectId: string; storyId: string };
export const plotWhere = (a: AccountRecord, c: PlotContext) => ({
  workspaceId: a.workspaceId,
  projectId: id(c.projectId),
  storyId: id(c.storyId),
});
export async function plotContext(tx: Tx, a: AccountRecord, c: PlotContext, write = false) {
  await canonContext(tx, a, c, write);
  return tx.story.findFirstOrThrow({
    where: { id: c.storyId, projectId: c.projectId, workspaceId: a.workspaceId },
    select: { id: true, title: true, sequenceVersion: true },
  });
}
export function groupDto(
  r: Pick<PlotGroupRecord, 'id' | 'title' | 'description' | 'parentId' | 'version'> & {
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
): PlotGroupRecord {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    parentId: r.parentId,
    version: r.version,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export async function requireGroup(
  tx: Tx,
  a: AccountRecord,
  c: PlotContext,
  groupId: string,
  active = false,
) {
  const row = await tx.plotGroup.findFirst({ where: { ...plotWhere(a, c), id: id(groupId) } });
  if (!row) notFound();
  if (active && row.archivedAt)
    throw new HttpError(409, 'REVISION_CONFLICT', 'Restore this plot group before using it.');
  return row;
}
export async function requireScene(
  tx: Tx,
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  active = false,
) {
  const row = await tx.scene.findFirst({
    where: { ...plotWhere(a, c), id: id(sceneId) },
    include: { group: true },
  });
  if (!row) notFound();
  if (active && row.archivedAt)
    throw new HttpError(
      409,
      'REVISION_CONFLICT',
      'Restore this scene before editing or moving it.',
    );
  return row;
}
type SceneRow = Prisma.SceneGetPayload<{ include: { group: true } }>;
export function sceneDto(r: SceneRow): SceneRecord {
  return {
    id: r.id,
    projectId: r.projectId,
    storyId: r.storyId,
    title: r.title,
    content: readDocument(r.content, r.contentSchemaVersion),
    contentSchemaVersion: r.contentSchemaVersion,
    status: r.status,
    position: r.position,
    groupId: r.groupId,
    group: r.group
      ? {
          id: r.group.id,
          title: r.group.title,
          archivedAt: r.group.archivedAt?.toISOString() ?? null,
        }
      : null,
    duplicatedFromId: r.duplicatedFromId,
    version: r.version,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
export async function bumpSequence(tx: Tx, a: AccountRecord, c: PlotContext) {
  return tx.story.update({
    where: { id: c.storyId, projectId: c.projectId, workspaceId: a.workspaceId },
    data: { sequenceVersion: { increment: 1 } },
    select: { sequenceVersion: true },
  });
}
export async function getGroup(a: AccountRecord, c: PlotContext, groupId: string) {
  return database().$transaction(async (tx) => {
    await plotContext(tx, a, c);
    return groupDto(await requireGroup(tx, a, c, groupId));
  });
}
export async function listGroups(a: AccountRecord, c: PlotContext, search: URLSearchParams) {
  const p = ListQuery.safeParse(Object.fromEntries(search));
  if (!p.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid group filters.');
  return database().$transaction(
    async (tx) => {
      const story = await plotContext(tx, a, c);
      const rows = await tx.plotGroup.findMany({
        where: {
          ...plotWhere(a, c),
          archivedAt: p.data.archived === 'true' ? { not: null } : null,
          ...prismaPosition(p.data.cursor),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: p.data.limit + 1,
      });
      return {
        ...pageResult(rows, p.data.limit, groupDto),
        sequenceVersion: story.sequenceVersion,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
async function validateParent(
  tx: Tx,
  a: AccountRecord,
  c: PlotContext,
  parentId: string | null,
  groupId?: string,
) {
  if (!parentId) return;
  const p = await requireGroup(tx, a, c, parentId, true);
  if (
    p.parentId ||
    p.id === groupId ||
    (groupId && (await tx.plotGroup.count({ where: { ...plotWhere(a, c), parentId: groupId } })))
  )
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Use a root group as parent. Groups allow two levels and no cycles.',
    );
}
export async function createGroup(
  a: AccountRecord,
  c: PlotContext,
  input: z.infer<typeof PlotGroupInput>,
) {
  return database().$transaction(async (tx) => {
    await plotContext(tx, a, c, true);
    await validateParent(tx, a, c, input.parentId);
    const row = await tx.plotGroup.create({ data: { ...input, ...plotWhere(a, c) } });
    await bumpSequence(tx, a, c);
    return groupDto(row);
  });
}
export async function updateGroup(
  a: AccountRecord,
  c: PlotContext,
  groupId: string,
  version: number,
  input: z.infer<typeof PlotGroupPatch>,
  transaction?: Tx,
) {
  const perform = async (tx: Tx) => {
    await plotContext(tx, a, c, true);
    const row = await requireGroup(tx, a, c, groupId);
    if (row.version !== version) conflict();
    if (
      row.archivedAt &&
      (input.title !== undefined || input.description !== undefined || input.parentId !== undefined)
    )
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore this group before editing it.');
    const parentId = input.parentId === undefined ? row.parentId : input.parentId;
    await validateParent(tx, a, c, parentId, groupId);
    if (
      input.archived === true &&
      ((await tx.plotGroup.count({
        where: { ...plotWhere(a, c), parentId: groupId, archivedAt: null },
      })) ||
        (await tx.scene.count({ where: { ...plotWhere(a, c), groupId, archivedAt: null } })))
    )
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Move or archive the active child groups and scenes first.',
      );
    const updated = await tx.plotGroup.updateMany({
      where: { ...plotWhere(a, c), id: groupId, version },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (!updated.count) conflict();
    await bumpSequence(tx, a, c);
    return groupDto(await requireGroup(tx, a, c, groupId));
  };
  return transaction ? perform(transaction) : database().$transaction(perform);
}
export async function getScene(a: AccountRecord, c: PlotContext, sceneId: string) {
  return database().$transaction(
    async (tx) => {
      const story = await plotContext(tx, a, c);
      return {
        ...sceneDto(await requireScene(tx, a, c, sceneId)),
        sequenceVersion: story.sequenceVersion,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function createScene(
  a: AccountRecord,
  c: PlotContext,
  input: z.infer<typeof SceneInput>,
) {
  return database().$transaction(async (tx) => {
    await plotContext(tx, a, c, true);
    if (input.groupId) await requireGroup(tx, a, c, input.groupId, true);
    const row = await appendSceneSeed(
      tx,
      a,
      c.projectId,
      c.storyId,
      { title: input.title, content: input.content, contentText: documentText(input.content) },
      { status: input.status, groupId: input.groupId },
    );
    return sceneDto(await requireScene(tx, a, c, row.id));
  });
}
export async function updateScene(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  version: number,
  input: z.infer<typeof ScenePatch>,
  transaction?: Tx,
) {
  const perform = async (tx: Tx) => {
    await plotContext(tx, a, c, true);
    const row = await requireScene(tx, a, c, sceneId);
    if (row.version !== version) conflict();
    if (
      row.archivedAt &&
      (input.title !== undefined || input.content !== undefined || input.status !== undefined)
    )
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore the scene before editing it.');
    if (input.archived === false && row.groupId) await requireGroup(tx, a, c, row.groupId, true);
    const updated = await tx.scene.updateMany({
      where: { ...plotWhere(a, c), id: sceneId, version },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined
          ? { content: jsonDocument(input.content), contentText: documentText(input.content) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (!updated.count) conflict();
    if (input.archived !== undefined && Boolean(row.archivedAt) !== input.archived)
      await bumpSequence(tx, a, c);
    return sceneDto(await requireScene(tx, a, c, sceneId));
  };
  return transaction ? perform(transaction) : database().$transaction(perform);
}
export async function moveScene(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  sequenceVersion: number,
  input: z.infer<typeof SceneMove>,
) {
  return database().$transaction(async (tx) => {
    const story = await plotContext(tx, a, c, true);
    if (story.sequenceVersion !== sequenceVersion) conflict();
    const source = await requireScene(tx, a, c, sceneId, true);
    if (input.groupId) await requireGroup(tx, a, c, input.groupId, true);
    const rows = await tx.scene.findMany({
      where: plotWhere(a, c),
      orderBy: { position: 'asc' },
      select: { id: true, archivedAt: true, position: true },
    });
    let ids: string[];
    try {
      ids = moveSceneOrder(
        rows.map((r) => ({ id: r.id, archived: Boolean(r.archivedAt) })),
        sceneId,
        input,
      );
    } catch {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose an active destination in this story.');
    }
    const positions = new Map(rows.map((r) => [r.id, r.position]));
    const changes = ids
      .map((id, position) => ({ id, position }))
      .filter((r) => positions.get(r.id) !== r.position);
    if (changes.length) {
      await tx.$executeRawUnsafe('SET CONSTRAINTS "Scene_storyId_position_key" DEFERRED');
      for (let start = 0; start < changes.length; start += 500) {
        const batch = changes.slice(start, start + 500);
        await tx.$executeRaw(
          Prisma.sql`UPDATE "Scene" s SET position=v.position FROM (VALUES ${Prisma.join(batch.map((r) => Prisma.sql`(${r.id}::uuid,${r.position}::integer)`))}) v(id,position) WHERE s.id=v.id AND s."workspaceId"=${a.workspaceId}::uuid AND s."projectId"=${c.projectId}::uuid AND s."storyId"=${c.storyId}::uuid`,
        );
      }
    }
    const groupId = input.groupId === undefined ? source.groupId : input.groupId;
    if (groupId !== source.groupId)
      await tx.scene.update({ where: { id: sceneId }, data: { groupId } });
    const version =
      changes.length || groupId !== source.groupId
        ? (await bumpSequence(tx, a, c)).sequenceVersion
        : story.sequenceVersion;
    return { scene: sceneDto(await requireScene(tx, a, c, sceneId)), sequenceVersion: version };
  });
}
export async function duplicateScene(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  version: number,
) {
  return database().$transaction(async (tx) => {
    await plotContext(tx, a, c, true);
    const source = await requireScene(tx, a, c, sceneId, true);
    if (source.version !== version) conflict();
    if (source.groupId) await requireGroup(tx, a, c, source.groupId, true);
    const doc = readDocument(source.content, source.contentSchemaVersion);
    const target = await appendSceneSeed(
      tx,
      a,
      c.projectId,
      c.storyId,
      {
        title: (source.title + ' (copy)').slice(0, 120),
        content: doc,
        contentText: documentText(doc),
      },
      { status: source.status, groupId: source.groupId, duplicatedFromId: source.id },
    );
    const [characters, locations, ideas] = await Promise.all([
      tx.sceneCharacterLink.findMany({ where: { ...plotWhere(a, c), sceneId } }),
      tx.sceneLocationLink.findMany({ where: { ...plotWhere(a, c), sceneId } }),
      tx.ideaSceneLink.findMany({ where: { ...plotWhere(a, c), sceneId } }),
    ]);
    for (const [kind, links] of [
      ['CHARACTER', characters],
      ['LOCATION', locations],
    ] as const) {
      if (links.length) {
        const data = links.map((r) => ({
          ...plotWhere(a, c),
          sceneId: target.id,
          canonId: r.canonId,
        }));
        if (kind === 'CHARACTER') await tx.sceneCharacterLink.createMany({ data });
        else await tx.sceneLocationLink.createMany({ data });
      }
    }
    if (ideas.length)
      await tx.ideaSceneLink.createMany({
        data: ideas.map((r) => ({ ...plotWhere(a, c), sceneId: target.id, ideaId: r.ideaId })),
      });
    return sceneDto(await requireScene(tx, a, c, target.id));
  });
}
export async function getPlot(
  a: AccountRecord,
  c: PlotContext,
  search: URLSearchParams,
): Promise<PlotPage> {
  const parsed = PlotQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid plot filters.');
  const p = parsed.data,
    cursor = p.cursor ? decodePlotCursor(p.cursor) : null;
  if (p.cursor && !cursor) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid plot cursor.');
  return database().$transaction(
    async (tx) => {
      const story = await plotContext(tx, a, c);
      if (cursor && cursor.sequenceVersion !== story.sequenceVersion) conflict();
      const filterGroup =
        p.groupId && p.groupId !== 'ungrouped' ? await requireGroup(tx, a, c, p.groupId) : null;
      const [rows, groups] = await Promise.all([
        tx.scene.findMany({
          where: {
            ...plotWhere(a, c),
            archivedAt: p.archived === 'true' ? { not: null } : null,
            ...(p.groupId === 'ungrouped'
              ? { groupId: null }
              : filterGroup
                ? filterGroup.parentId
                  ? { groupId: filterGroup.id }
                  : { OR: [{ groupId: filterGroup.id }, { group: { parentId: filterGroup.id } }] }
                : {}),
            ...(cursor ? { position: { gt: cursor.position } } : {}),
          },
          orderBy: { position: 'asc' },
          take: p.limit + 1,
          include: {
            group: { include: { parent: { select: { title: true } } } },
            _count: { select: { characters: true, locations: true, ideaLinks: true } },
          },
        }),
        tx.plotGroup.findMany({
          where: { ...plotWhere(a, c), archivedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 51,
        }),
      ]);
      const items = rows.slice(0, p.limit),
        last = items.at(-1),
        groupPage = pageResult(groups, 50, groupDto);
      return {
        storyTitle: story.title,
        sequenceVersion: story.sequenceVersion,
        groups: groupPage.items,
        groupCursor: groupPage.nextCursor,
        items: items.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          storyId: r.storyId,
          title: r.title,
          status: r.status,
          position: r.position,
          groupId: r.groupId,
          groupTitle: r.group
            ? (r.group.parent ? r.group.parent.title + ' / ' : '') + r.group.title
            : null,
          duplicatedFromId: r.duplicatedFromId,
          version: r.version,
          archivedAt: r.archivedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          excerpt: r.contentText.slice(0, 180),
          counts: {
            characters: r._count.characters,
            locations: r._count.locations,
            ideas: r._count.ideaLinks,
          },
        })),
        nextCursor:
          rows.length > p.limit && last
            ? encodePlotCursor(last.position, story.sequenceVersion)
            : null,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
