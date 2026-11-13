import 'server-only';
import { Prisma } from '@inkwell/db';
import {
  CanonQuery,
  documentText,
  plainDocument,
  type AccountRecord,
  type CanonRecord,
  type CanonSummary,
  type CanonInput,
  type CanonPatch,
  type OverrideInput,
  type OverrideReview,
} from '@inkwell/contracts';
import { canonConflicts, decodeCursor } from '@inkwell/domain';
import type { z } from 'zod';
import { database } from './database';
import { id } from './records';
import { lockProject } from './idea-targets';
import { type Tx, readDocument, jsonDocument, pageResult } from './ideas';
import { HttpError, notFound, conflict } from './http';
export type CanonContext = { projectId: string; storyId?: string };
type Row = Prisma.CanonRecordGetPayload<{ include: { overrides: true } }>;
export async function canonContext(tx: Tx, a: AccountRecord, c: CanonContext, write = false) {
  id(c.projectId);
  if (
    !(await tx.project.findFirst({
      where: { id: c.projectId, workspaceId: a.workspaceId },
      select: { id: true },
    }))
  )
    notFound();
  if (c.storyId) {
    id(c.storyId);
    if (
      !(await tx.story.findFirst({
        where: { id: c.storyId, projectId: c.projectId, workspaceId: a.workspaceId },
        select: { id: true },
      }))
    )
      notFound();
  }
  if (write) {
    await lockProject(tx, a, c.projectId);
    if (c.storyId) {
      const r = await tx.story.updateMany({
        where: {
          id: c.storyId,
          projectId: c.projectId,
          workspaceId: a.workspaceId,
          archivedAt: null,
        },
        data: { updatedAt: new Date() },
      });
      if (!r.count)
        throw new HttpError(
          409,
          'REVISION_CONFLICT',
          'Restore this story before changing its canon.',
        );
    }
  }
}
export async function canonRow(
  tx: Tx,
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
): Promise<Row> {
  const row = await tx.canonRecord.findFirst({
    where: {
      id: id(recordId),
      projectId: c.projectId,
      workspaceId: a.workspaceId,
      OR: [
        { scope: 'SHARED' },
        ...(c.storyId ? [{ scope: 'STORY' as const, storyId: c.storyId }] : []),
      ],
    },
    include: {
      overrides: {
        where: {
          storyId: c.storyId ?? '00000000-0000-0000-0000-000000000000',
          workspaceId: a.workspaceId,
        },
      },
    },
  });
  return row ?? notFound();
}
export function canonDto(row: Row): CanonRecord {
  const content = readDocument(row.content, row.contentSchemaVersion),
    o = row.overrides[0];
  const override = o
    ? {
        version: o.version,
        baseVersion: o.baseVersion,
        baseName: o.baseName,
        baseContent: readDocument(o.baseContent, o.baseContentSchemaVersion),
        hasName: o.hasName,
        name: o.name,
        hasContent: o.hasContent,
        content: o.content === null ? null : readDocument(o.content, o.contentSchemaVersion),
      }
    : null;
  return {
    id: row.id,
    projectId: row.projectId,
    storyId: row.storyId,
    kind: row.kind,
    scope: row.scope,
    name: row.name,
    content,
    contentSchemaVersion: row.contentSchemaVersion,
    version: row.version,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    override,
    conflicts: canonConflicts({ name: row.name, content }, override),
    effective: {
      name: override?.hasName ? (override.name ?? '') : row.name,
      content: override?.hasContent ? (override.content ?? plainDocument('')) : content,
    },
  };
}
export async function getCanon(a: AccountRecord, c: CanonContext, recordId: string) {
  return database().$transaction(
    async (tx) => {
      await canonContext(tx, a, c);
      return canonDto(await canonRow(tx, a, c, recordId));
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function createCanon(
  a: AccountRecord,
  c: CanonContext,
  input: z.infer<typeof CanonInput>,
) {
  return database().$transaction(async (tx) => {
    await canonContext(tx, a, c, true);
    const row = await tx.canonRecord.create({
      data: {
        workspaceId: a.workspaceId,
        projectId: c.projectId,
        storyId: c.storyId ?? null,
        scope: c.storyId ? 'STORY' : 'SHARED',
        kind: input.kind,
        name: input.name,
        content: jsonDocument(input.content),
        contentText: documentText(input.content),
      },
    });
    return canonDto({ ...row, overrides: [] });
  });
}
export async function updateCanon(
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
  version: number,
  input: z.infer<typeof CanonPatch>,
) {
  return database().$transaction(async (tx) => {
    const row = await canonRow(tx, a, c, recordId);
    await canonContext(tx, a, c, true);
    if (c.storyId && row.scope === 'SHARED')
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Use a story override here, or explicitly open project canon to edit the shared record.',
      );
    if (row.version !== version) conflict();
    if (row.archivedAt && (input.name !== undefined || input.content !== undefined))
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore this record before editing it.');
    const changed = await tx.canonRecord.updateMany({
      where: { id: recordId, workspaceId: a.workspaceId, projectId: c.projectId, version },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.content !== undefined
          ? { content: jsonDocument(input.content), contentText: documentText(input.content) }
          : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (!changed.count) conflict();
    return canonDto(await canonRow(tx, a, c, recordId));
  });
}
export async function saveOverride(
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
  version: number,
  input: z.infer<typeof OverrideInput>,
) {
  return database().$transaction(async (tx) => {
    if (!c.storyId) notFound();
    await canonContext(tx, a, c, true);
    const row = await canonRow(tx, a, c, recordId),
      old = row.overrides[0];
    if (row.scope !== 'SHARED') notFound();
    if (row.archivedAt)
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Restore shared canon before changing its story override. Existing story content is preserved.',
      );
    if (row.version !== input.baseVersion || (old?.version ?? 0) !== version) conflict();
    if (canonDto(row).conflicts.length)
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Review the changed shared fields before editing this override.',
      );
    const data = {
      hasName: input.name.mode !== 'INHERIT',
      name: input.name.mode === 'CUSTOM' ? input.name.value : null,
      hasContent: input.content.mode !== 'INHERIT',
      content: input.content.mode === 'CUSTOM' ? jsonDocument(input.content.value) : Prisma.DbNull,
      contentText: input.content.mode === 'CUSTOM' ? documentText(input.content.value) : null,
      contentSchemaVersion: 1,
      baseVersion: row.version,
      baseName: row.name,
      baseContent: jsonDocument(readDocument(row.content, row.contentSchemaVersion)),
      baseContentSchemaVersion: row.contentSchemaVersion,
    };
    if (old)
      await tx.canonOverride.update({
        where: { id: old.id },
        data: { ...data, version: { increment: 1 } },
      });
    else
      await tx.canonOverride.create({
        data: {
          ...data,
          workspaceId: a.workspaceId,
          projectId: c.projectId,
          storyId: c.storyId,
          canonId: recordId,
        },
      });
    return canonDto(await canonRow(tx, a, c, recordId));
  });
}
export async function reviewOverride(
  a: AccountRecord,
  c: CanonContext,
  recordId: string,
  version: number,
  input: z.infer<typeof OverrideReview>,
) {
  return database().$transaction(async (tx) => {
    if (!c.storyId) notFound();
    await canonContext(tx, a, c, true);
    const row = await canonRow(tx, a, c, recordId),
      old = row.overrides[0];
    if (row.scope !== 'SHARED' || !old) notFound();
    if (row.version !== input.baseVersion || old.version !== version) conflict();
    const fields = canonDto(row).conflicts;
    if (
      fields.length === 0 ||
      fields.some((f) => !input[f]) ||
      (['name', 'content'] as const).some((f) => input[f] && !fields.includes(f))
    )
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Choose keep or inherit for every changed field.',
      );
    await tx.canonOverride.update({
      where: { id: old.id },
      data: {
        ...(input.name === 'INHERIT' ? { hasName: false, name: null } : {}),
        ...(input.content === 'INHERIT'
          ? { hasContent: false, content: Prisma.DbNull, contentText: null }
          : {}),
        baseVersion: row.version,
        baseName: row.name,
        baseContent: jsonDocument(readDocument(row.content, row.contentSchemaVersion)),
        baseContentSchemaVersion: row.contentSchemaVersion,
        version: { increment: 1 },
      },
    });
    return canonDto(await canonRow(tx, a, c, recordId));
  });
}
export async function listCanon(a: AccountRecord, c: CanonContext, search: URLSearchParams) {
  const result = CanonQuery.safeParse(Object.fromEntries(search));
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid canon filters.');
  const p = result.data;
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid page cursor.');
  return database().$transaction(
    async (tx) => {
      await canonContext(tx, a, c);
      const story = c.storyId ?? null;
      const name = Prisma.sql`CASE WHEN o."hasName" THEN COALESCE(o.name,'') ELSE r.name END`;
      const body = Prisma.sql`CASE WHEN o."hasContent" THEN COALESCE(o."contentText",'') ELSE r."contentText" END`;
      const pattern = '%' + p.q.replace(/[\\%_]/g, '\\$&') + '%';
      const rows = await tx.$queryRaw<
        (Omit<CanonSummary, 'createdAt' | 'archivedAt' | 'conflicts'> & {
          createdAt: Date;
          archivedAt: Date | null;
          nameConflict: boolean;
          contentConflict: boolean;
        })[]
      >(Prisma.sql`
   SELECT r.id,r."projectId",r."storyId",r.kind,r.scope,${name} AS name,r.version,r."archivedAt",r."createdAt",COALESCE(o."hasName" OR o."hasContent",false) AS overridden,
   COALESCE(o."hasName" AND o."baseName" IS DISTINCT FROM r.name,false) AS "nameConflict",
   COALESCE(o."hasContent" AND o."baseContent" IS DISTINCT FROM r.content,false) AS "contentConflict"
   FROM "Character" r LEFT JOIN "CanonOverride" o ON o."canonId"=r.id AND o."storyId"=${story}::uuid AND o."workspaceId"=${a.workspaceId}::uuid
   WHERE r."workspaceId"=${a.workspaceId}::uuid AND r."projectId"=${c.projectId}::uuid
   AND (r.scope='SHARED' OR (r.scope='STORY' AND r."storyId"=${story}::uuid))
   AND ${p.archived === 'true' ? Prisma.sql`r."archivedAt" IS NOT NULL` : Prisma.sql`(r."archivedAt" IS NULL OR o."hasName" OR o."hasContent")`}
   ${p.kind ? Prisma.sql`AND r.kind=${p.kind}::"CanonKind"` : Prisma.empty}
   ${p.q ? Prisma.sql`AND (${name} ILIKE ${pattern} OR ${body} ILIKE ${pattern})` : Prisma.empty}
   ${cursor ? Prisma.sql`AND (r."createdAt",r.id)<(${cursor.createdAt},${cursor.id}::uuid)` : Prisma.empty}
   ORDER BY r."createdAt" DESC,r.id DESC LIMIT ${p.limit + 1}`);
      return pageResult(rows, p.limit, (row) => ({
        id: row.id,
        projectId: row.projectId,
        storyId: row.storyId,
        kind: row.kind,
        scope: row.scope,
        name: row.name,
        version: row.version,
        archivedAt: row.archivedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        overridden: row.overridden,
        conflicts: [
          ...(row.nameConflict ? ['name' as const] : []),
          ...(row.contentConflict ? ['content' as const] : []),
        ],
      }));
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
