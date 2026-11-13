import 'server-only';
import {
  ListQuery,
  type AccountRecord,
  type SceneCanonInput,
  type SceneCanonReference,
  type SceneIdeaReference,
  type CanonSceneReference,
} from '@inkwell/contracts';
import type { z } from 'zod';
import { database } from './database';
import { canonContext, canonRow, type CanonContext } from './canon';
import { plotContext, plotWhere, requireScene, type PlotContext } from './plot';
import { pageResult, prismaPosition } from './ideas';
import { id } from './records';
import { HttpError, notFound, conflict } from './http';
function query(search: URLSearchParams) {
  const p = ListQuery.safeParse(Object.fromEntries(search));
  if (!p.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid reference filters.');
  return p.data;
}
export async function changeSceneCanon(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  version: number,
  input: z.infer<typeof SceneCanonInput>,
  remove = false,
) {
  return database().$transaction(async (tx) => {
    await plotContext(tx, a, c, true);
    const scene = await requireScene(tx, a, c, sceneId, true);
    if (scene.version !== version) conflict();
    const canon = await canonRow(tx, a, c, input.canonId);
    if (canon.kind !== input.kind)
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Choose the matching character or location type.',
      );
    if (!remove && canon.archivedAt)
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore canon before adding a new reference.');
    const scope = { ...plotWhere(a, c), sceneId, canonId: canon.id };
    const where = { sceneId_canonId: { sceneId, canonId: canon.id } };
    const exists =
      input.kind === 'CHARACTER'
        ? await tx.sceneCharacterLink.findUnique({ where })
        : await tx.sceneLocationLink.findUnique({ where });
    if (remove && !exists) notFound();
    if (!remove && exists)
      throw new HttpError(409, 'REVISION_CONFLICT', 'This canon record is already linked.');
    if (input.kind === 'CHARACTER') {
      if (remove) await tx.sceneCharacterLink.delete({ where });
      else await tx.sceneCharacterLink.create({ data: scope });
    } else {
      if (remove) await tx.sceneLocationLink.delete({ where });
      else await tx.sceneLocationLink.create({ data: scope });
    }
    const changed = await tx.scene.updateMany({
      where: { ...plotWhere(a, c), id: sceneId, version },
      data: { version: { increment: 1 } },
    });
    if (!changed.count) conflict();
    return { sceneVersion: version + 1 };
  });
}
export async function sceneCanonReferences(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  kind: 'CHARACTER' | 'LOCATION',
  search: URLSearchParams,
) {
  const p = query(search);
  return database().$transaction(
    async (tx) => {
      await plotContext(tx, a, c);
      await requireScene(tx, a, c, sceneId);
      const args = {
        where: { ...plotWhere(a, c), sceneId, ...prismaPosition(p.cursor) },
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        take: p.limit + 1,
        include: {
          canon: {
            select: {
              id: true as const,
              name: true as const,
              archivedAt: true as const,
              overrides: {
                where: { storyId: c.storyId, workspaceId: a.workspaceId },
                select: { hasName: true as const, name: true as const },
              },
            },
          },
        },
      };
      const rows =
        kind === 'CHARACTER'
          ? await tx.sceneCharacterLink.findMany(args)
          : await tx.sceneLocationLink.findMany(args);
      return pageResult(
        rows,
        p.limit,
        (row) =>
          ({
            id: row.id,
            kind,
            canonId: row.canonId,
            name: row.canon.overrides[0]?.hasName
              ? (row.canon.overrides[0].name ?? '')
              : row.canon.name,
            archived: Boolean(row.canon.archivedAt),
            createdAt: row.createdAt.toISOString(),
          }) satisfies SceneCanonReference,
      );
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function sceneIdeaReferences(
  a: AccountRecord,
  c: PlotContext,
  sceneId: string,
  search: URLSearchParams,
) {
  const p = query(search);
  return database().$transaction(
    async (tx) => {
      await plotContext(tx, a, c);
      await requireScene(tx, a, c, sceneId);
      const rows = await tx.ideaSceneLink.findMany({
        where: { ...plotWhere(a, c), sceneId, ...prismaPosition(p.cursor) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: p.limit + 1,
        include: { idea: { select: { id: true, title: true, version: true, archivedAt: true } } },
      });
      const conversions = await tx.ideaConversion.findMany({
        where: {
          workspaceId: a.workspaceId,
          projectId: c.projectId,
          parentStoryId: c.storyId,
          targetSceneId: sceneId,
          ideaId: { in: rows.map((r) => r.ideaId) },
        },
        select: { ideaId: true },
      });
      const converted = new Set(conversions.map((r) => r.ideaId));
      return pageResult(
        rows,
        p.limit,
        (row) =>
          ({
            id: row.id,
            ideaId: row.ideaId,
            title: row.idea.title,
            ideaVersion: row.idea.version,
            archived: Boolean(row.idea.archivedAt),
            converted: converted.has(row.ideaId),
            createdAt: row.createdAt.toISOString(),
          }) satisfies SceneIdeaReference,
      );
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function canonSceneReferences(
  a: AccountRecord,
  c: CanonContext,
  canonId: string,
  search: URLSearchParams,
) {
  const p = query(search);
  return database().$transaction(
    async (tx) => {
      await canonContext(tx, a, c);
      const canon = await canonRow(tx, a, c, canonId);
      if (canon.kind !== 'CHARACTER' && canon.kind !== 'LOCATION')
        return { items: [], nextCursor: null };
      const args = {
        where: {
          workspaceId: a.workspaceId,
          projectId: c.projectId,
          canonId: id(canonId),
          ...(c.storyId ? { storyId: c.storyId } : {}),
          ...prismaPosition(p.cursor),
        },
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        take: p.limit + 1,
        include: {
          scene: {
            select: {
              title: true as const,
              archivedAt: true as const,
              story: { select: { title: true as const, archivedAt: true as const } },
              project: { select: { archivedAt: true as const } },
            },
          },
        },
      };
      const rows =
        canon.kind === 'CHARACTER'
          ? await tx.sceneCharacterLink.findMany(args)
          : await tx.sceneLocationLink.findMany(args);
      return pageResult(
        rows,
        p.limit,
        (row) =>
          ({
            id: row.id,
            sceneId: row.sceneId,
            title: row.scene.title,
            storyId: row.storyId,
            storyTitle: row.scene.story.title,
            archived: Boolean(
              row.scene.archivedAt || row.scene.story.archivedAt || row.scene.project.archivedAt,
            ),
            createdAt: row.createdAt.toISOString(),
          }) satisfies CanonSceneReference,
      );
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
