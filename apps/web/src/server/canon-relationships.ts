import 'server-only';
import {
  CanonQuery,
  type AccountRecord,
  type RelationshipInput,
  type RelationshipPatch,
  type RelationshipRecord,
} from '@inkwell/contracts';
import { validCanonRelationship } from '@inkwell/domain';
import type { z } from 'zod';
import { database } from './database';
import { canonContext, canonRow, type CanonContext } from './canon';
import { id } from './records';
import { prismaPosition, pageResult } from './ideas';
import { HttpError, notFound, conflict } from './http';
const Query = CanonQuery.pick({ storyId: true, cursor: true, limit: true, archived: true });
export async function createRelationship(
  a: AccountRecord,
  c: CanonContext,
  fromId: string,
  input: z.infer<typeof RelationshipInput>,
) {
  return database().$transaction(async (tx) => {
    await canonContext(tx, a, c, true);
    const from = await canonRow(tx, a, c, fromId),
      to = await canonRow(tx, a, c, input.toId);
    if (from.archivedAt || to.archivedAt)
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore both records before linking them.');
    if (from.id === to.id || !validCanonRelationship(input.kind, from.kind, to.kind))
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Choose a compatible relationship and another record.',
      );
    const existing = await tx.canonRelationship.findFirst({
      where: {
        workspaceId: a.workspaceId,
        projectId: c.projectId,
        storyId: c.storyId ?? null,
        fromId,
        toId: to.id,
        kind: input.kind,
      },
      select: { id: true },
    });
    if (existing)
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'This relationship already exists. Restore it from archived relationships if needed.',
      );
    const row = await tx.canonRelationship.create({
      data: {
        workspaceId: a.workspaceId,
        projectId: c.projectId,
        storyId: c.storyId ?? null,
        fromId,
        toId: to.id,
        kind: input.kind,
        label: input.label,
      },
    });
    return { id: row.id, version: row.version };
  });
}
export async function updateRelationship(
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
  relationshipId: string,
  version: number,
  input: z.infer<typeof RelationshipPatch>,
) {
  return database().$transaction(async (tx) => {
    await canonRow(tx, a, c, recordId);
    const row = await tx.canonRelationship.findFirst({
      where: {
        id: id(relationshipId),
        workspaceId: a.workspaceId,
        projectId: c.projectId,
        storyId: c.storyId ?? null,
        OR: [{ fromId: recordId }, { toId: recordId }],
      },
    });
    if (!row) notFound();
    await canonContext(tx, a, c, true);
    if (row.version !== version) conflict();
    const from = await canonRow(tx, a, c, row.fromId),
      to = await canonRow(tx, a, c, row.toId);
    if (
      input.archived !== true &&
      (from.archivedAt || to.archivedAt || (row.archivedAt && input.label !== undefined))
    )
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Restore the records and relationship before editing.',
      );
    const changed = await tx.canonRelationship.updateMany({
      where: {
        id: row.id,
        workspaceId: a.workspaceId,
        projectId: c.projectId,
        storyId: c.storyId ?? null,
        version,
      },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (!changed.count) conflict();
    return { id: row.id, version: version + 1 };
  });
}
export async function listRelationships(
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
  search: URLSearchParams,
) {
  const result = Query.safeParse(Object.fromEntries(search));
  if (!result.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid relationship filters.');
  const p = result.data;
  return database().$transaction(
    async (tx) => {
      await canonContext(tx, a, c);
      await canonRow(tx, a, c, recordId);
      const endpoint = {
        select: {
          id: true,
          name: true,
          kind: true,
          archivedAt: true,
          overrides: {
            where: {
              storyId: c.storyId ?? '00000000-0000-0000-0000-000000000000',
              workspaceId: a.workspaceId,
            },
            select: { hasName: true, name: true },
          },
        },
      } as const;
      const rows = await tx.canonRelationship.findMany({
        where: {
          workspaceId: a.workspaceId,
          projectId: c.projectId,
          AND: [
            { OR: [{ storyId: null }, ...(c.storyId ? [{ storyId: c.storyId }] : [])] },
            { OR: [{ fromId: recordId }, { toId: recordId }] },
          ],
          archivedAt: p.archived === 'true' ? { not: null } : null,
          ...prismaPosition(p.cursor),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: p.limit + 1,
        include: { from: endpoint, to: endpoint },
      });
      const output: RelationshipRecord[] = [];
      for (const row of rows.slice(0, p.limit)) {
        const other = row.fromId === recordId ? row.to : row.from;
        const override = other.overrides[0];
        output.push({
          id: row.id,
          fromId: row.fromId,
          toId: row.toId,
          kind: row.kind,
          label: row.label,
          version: row.version,
          storyId: row.storyId,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          other: {
            id: other.id,
            name: override?.hasName ? (override.name ?? '') : other.name,
            kind: other.kind,
            archived: Boolean(other.archivedAt),
          },
          direction: row.fromId === recordId ? 'OUTGOING' : 'INCOMING',
          editable: row.storyId === (c.storyId ?? null),
        });
      }
      return { ...pageResult(rows, p.limit, (row) => row.id), items: output };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
