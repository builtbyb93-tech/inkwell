import 'server-only';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { Prisma } from '@inkwell/db';
import { objectKey, s3Storage, StorageAlreadyExists, type PrivateStorage } from '@inkwell/storage';
import {
  SnapshotOptionsQuery,
  ListQuery,
  snapshotMaxBytes,
  type SnapshotInput,
  type SnapshotDocument,
  type SnapshotRecord,
  type SnapshotPreview,
  type SnapshotSummary,
  type ShareLinkRecord,
  type AccountRecord,
  type SnapshotOption,
  type ShareLinkInput,
} from '@inkwell/contracts';
import { canonicalJson, validateSnapshotDocument, decodeCursor } from '@inkwell/domain';
import type { z } from 'zod';
import { database } from './database';
import { id, getProject, getStory } from './records';
import { canonDto } from './canon';
import { readDocument, pageResult, prismaPosition } from './ideas';
import { HttpError, notFound, conflict } from './http';
let storage: PrivateStorage | undefined;
export const snapshotStorage = () => (storage ??= s3Storage());
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const summary = (r: {
  id: string;
  title: string;
  recordCount: number;
  createdAt: Date;
}): SnapshotSummary => ({
  id: r.id,
  title: r.title,
  recordCount: r.recordCount,
  createdAt: r.createdAt.toISOString(),
  version: 1,
});
const linkDto = (r: {
  id: string;
  expiresAt: Date;
  allowDownload: boolean;
  revokedAt: Date | null;
  version: number;
  createdAt: Date;
}): ShareLinkRecord => ({
  id: r.id,
  expiresAt: r.expiresAt.toISOString(),
  allowDownload: r.allowDownload,
  revokedAt: r.revokedAt?.toISOString() ?? null,
  version: r.version,
  createdAt: r.createdAt.toISOString(),
});
function page(search: URLSearchParams) {
  const p = ListQuery.pick({ cursor: true, limit: true })
    .strict()
    .safeParse(Object.fromEntries(search));
  if (!p.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Check the list filters.');
  const cursor = p.data.cursor ? decodeCursor(p.data.cursor) : null;
  if (p.data.cursor && !cursor) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  return p.data;
}
async function owned(a: AccountRecord, projectId: string, snapshotId: string) {
  const row = await database().snapshot.findFirst({
    where: {
      id: id(snapshotId),
      projectId: id(projectId),
      workspaceId: a.workspaceId,
      status: 'READY',
    },
  });
  return row ?? notFound();
}
export async function listSnapshots(a: AccountRecord, projectId: string, search: URLSearchParams) {
  await getProject(a, projectId);
  const p = page(search),
    rows = await database().snapshot.findMany({
      where: {
        workspaceId: a.workspaceId,
        projectId,
        status: 'READY',
        ...prismaPosition(p.cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: p.limit + 1,
    });
  return pageResult(rows, p.limit, summary);
}
export async function snapshotOptions(
  a: AccountRecord,
  projectId: string,
  search: URLSearchParams,
) {
  await getProject(a, projectId);
  const parsed = SnapshotOptionsQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Check the selection filters.');
  const p = parsed.data;
  if (p.storyId) await getStory(a, projectId, p.storyId);
  const cursor = p.cursor ? decodeCursor(p.cursor) : null;
  if (p.cursor && !cursor) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid cursor.');
  const base = {
      workspaceId: a.workspaceId,
      projectId,
      ...(p.storyId ? { storyId: p.storyId } : {}),
      archivedAt: p.archive === 'archived' ? { not: null } : null,
      ...prismaPosition(p.cursor),
    },
    paging = {
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: p.limit + 1,
    };
  const map = (r: {
    id: string;
    title: string;
    archivedAt: Date | null;
    storyId?: string | null;
    createdAt: Date;
  }): SnapshotOption => ({
    id: r.id,
    kind: p.kind,
    title: r.title,
    archived: Boolean(r.archivedAt),
    storyId: r.storyId ?? null,
  });
  switch (p.kind) {
    case 'STORY': {
      const rows = await database().story.findMany({
        where: {
          workspaceId: a.workspaceId,
          projectId,
          ...(p.storyId ? { id: p.storyId } : {}),
          archivedAt: base.archivedAt,
          ...prismaPosition(p.cursor),
        },
        ...paging,
      });
      return pageResult(rows, p.limit, (r) => ({ ...map(r), storyId: r.id }));
    }
    case 'IDEA': {
      const rows = await database().idea.findMany({
        where: {
          workspaceId: a.workspaceId,
          archivedAt: base.archivedAt,
          AND: [prismaPosition(p.cursor)],
          OR: [
            { storyLinks: { some: { projectId, ...(p.storyId ? { storyId: p.storyId } : {}) } } },
            { sceneLinks: { some: { projectId, ...(p.storyId ? { storyId: p.storyId } : {}) } } },
            {
              conversions: {
                some: {
                  projectId,
                  ...(p.storyId
                    ? { OR: [{ parentStoryId: p.storyId }, { targetStoryId: p.storyId }] }
                    : {}),
                },
              },
            },
          ],
        },
        ...paging,
      });
      return pageResult(rows, p.limit, map);
    }
    case 'CANON': {
      const rows = await database().canonRecord.findMany({
        where: {
          workspaceId: a.workspaceId,
          projectId,
          archivedAt: base.archivedAt,
          AND: [prismaPosition(p.cursor)],
          OR: [
            { scope: 'SHARED' },
            ...(p.storyId ? [{ scope: 'STORY' as const, storyId: p.storyId }] : []),
          ],
        },
        include: {
          overrides: {
            where: {
              workspaceId: a.workspaceId,
              storyId: p.storyId ?? '00000000-0000-0000-0000-000000000000',
            },
          },
        },
        ...paging,
      });
      return pageResult(rows, p.limit, (r) => ({
        id: r.id,
        kind: 'CANON' as const,
        title: canonDto(r).effective.name,
        archived: Boolean(r.archivedAt),
        storyId: r.storyId,
        canonKind: r.kind,
      }));
    }
    case 'SCENE':
      return pageResult(await database().scene.findMany({ where: base, ...paging }), p.limit, map);
    case 'GROUP':
      return pageResult(
        await database().plotGroup.findMany({ where: base, ...paging }),
        p.limit,
        map,
      );
  }
}
export async function createSnapshot(
  a: AccountRecord,
  projectId: string,
  input: SnapshotInput,
  objects: PrivateStorage = snapshotStorage(),
): Promise<SnapshotPreview> {
  const snapshotId = randomUUID(),
    key = objectKey(a.workspaceId, snapshotId),
    createdAt = new Date();
  const result = await database().$transaction(
    async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: id(projectId), workspaceId: a.workspaceId },
      });
      if (!project) notFound();
      if (
        input.storyId &&
        !(await tx.story.findFirst({
          where: { id: input.storyId, projectId, workspaceId: a.workspaceId },
        }))
      )
        notFound();
      const s = input.selection,
        scope = { workspaceId: a.workspaceId, projectId },
        context = input.storyId ? { storyId: input.storyId } : {},
        sort = { orderBy: { id: 'asc' as const } };
      const stories = await tx.story.findMany({
        where: {
          ...scope,
          id: { in: s.storyIds },
          ...(input.storyId ? { id: { in: s.storyIds, equals: input.storyId } } : {}),
        },
        ...sort,
      });
      const ideas = await tx.idea.findMany({
        where: {
          workspaceId: a.workspaceId,
          id: { in: s.ideaIds },
          OR: [
            { storyLinks: { some: { projectId, ...context } } },
            { sceneLinks: { some: { projectId, ...context } } },
            {
              conversions: {
                some: {
                  projectId,
                  ...(input.storyId
                    ? { OR: [{ parentStoryId: input.storyId }, { targetStoryId: input.storyId }] }
                    : {}),
                },
              },
            },
          ],
        },
        ...sort,
      });
      const canon = await tx.canonRecord.findMany({
        where: {
          ...scope,
          id: { in: s.canonIds },
          OR: [
            { scope: 'SHARED' },
            ...(input.storyId ? [{ scope: 'STORY' as const, storyId: input.storyId }] : []),
          ],
        },
        include: {
          overrides: {
            where: {
              workspaceId: a.workspaceId,
              storyId: input.storyId ?? '00000000-0000-0000-0000-000000000000',
            },
          },
        },
        ...sort,
      });
      const scenes = await tx.scene.findMany({
          where: { ...scope, ...context, id: { in: s.sceneIds } },
          orderBy: [{ storyId: 'asc' }, { position: 'asc' }],
        }),
        groups = await tx.plotGroup.findMany({
          where: { ...scope, ...context, id: { in: s.groupIds } },
          ...sort,
        });
      if (
        stories.length !== s.storyIds.length ||
        ideas.length !== s.ideaIds.length ||
        canon.length !== s.canonIds.length ||
        scenes.length !== s.sceneIds.length ||
        groups.length !== s.groupIds.length
      )
        notFound();
      const ids = new Map<string, string>(),
        copyId = (kind: string, old: string) => {
          const name = kind + ':' + old;
          if (!ids.has(name)) ids.set(name, randomUUID());
          return ids.get(name)!;
        };
      const records: SnapshotRecord[] = [];
      if (s.project)
        records.push({
          id: copyId('PROJECT', project.id),
          kind: 'PROJECT',
          title: project.title,
          text: project.description,
        });
      for (const r of stories) copyId('STORY', r.id);
      for (const r of groups) copyId('GROUP', r.id);
      for (const r of stories)
        records.push({
          id: copyId('STORY', r.id),
          kind: 'STORY',
          title: r.title,
          text: r.synopsis,
          format: r.format,
        });
      for (const r of ideas)
        records.push({
          id: copyId('IDEA', r.id),
          kind: 'IDEA',
          title: r.title,
          content: readDocument(r.content, r.contentSchemaVersion),
        });
      for (const r of canon) {
        const effective = canonDto(r).effective;
        records.push({
          id: copyId('CANON', r.id),
          kind: 'CANON',
          title: effective.name,
          canonKind: r.kind,
          storyId: ids.get('STORY:' + (input.storyId ?? r.storyId)) ?? null,
          content: effective.content,
        });
      }
      for (const r of groups)
        records.push({
          id: copyId('GROUP', r.id),
          kind: 'GROUP',
          title: r.title,
          text: r.description,
          storyId: ids.get('STORY:' + r.storyId) ?? null,
          parentId: r.parentId ? (ids.get('GROUP:' + r.parentId) ?? null) : null,
        });
      for (const [position, r] of scenes.entries())
        records.push({
          id: copyId('SCENE', r.id),
          kind: 'SCENE',
          title: r.title,
          status: r.status,
          content: readDocument(r.content, r.contentSchemaVersion),
          storyId: ids.get('STORY:' + r.storyId) ?? null,
          groupId: r.groupId ? (ids.get('GROUP:' + r.groupId) ?? null) : null,
          position,
        });
      const relationships: SnapshotDocument['relationships'] = [];
      const add = (
        fromKind: string,
        from: string,
        toKind: string,
        to: string,
        kind: SnapshotDocument['relationships'][number]['kind'],
        label = '',
      ) => {
        const fromId = ids.get(fromKind + ':' + from),
          toId = ids.get(toKind + ':' + to);
        if (fromId && toId) relationships.push({ fromId, toId, kind, label });
      };
      if (s.relationships) {
        const relations = await tx.canonRelationship.findMany({
          where: {
            ...scope,
            archivedAt: null,
            fromId: { in: s.canonIds },
            toId: { in: s.canonIds },
            OR: [{ storyId: null }, ...(input.storyId ? [{ storyId: input.storyId }] : [])],
          },
          take: 10001,
        });
        for (const r of relations) add('CANON', r.fromId, 'CANON', r.toId, r.kind, r.label);
        const characters = await tx.sceneCharacterLink.findMany({
            where: { ...scope, sceneId: { in: s.sceneIds }, canonId: { in: s.canonIds } },
            take: 10001,
          }),
          locations = await tx.sceneLocationLink.findMany({
            where: { ...scope, sceneId: { in: s.sceneIds }, canonId: { in: s.canonIds } },
            take: 10001,
          });
        for (const r of characters) add('SCENE', r.sceneId, 'CANON', r.canonId, 'SCENE_CHARACTER');
        for (const r of locations) add('SCENE', r.sceneId, 'CANON', r.canonId, 'SCENE_LOCATION');
        const storyIdeas = await tx.ideaStoryLink.findMany({
            where: { ...scope, storyId: { in: s.storyIds }, ideaId: { in: s.ideaIds } },
            take: 10001,
          }),
          sceneIdeas = await tx.ideaSceneLink.findMany({
            where: { ...scope, sceneId: { in: s.sceneIds }, ideaId: { in: s.ideaIds } },
            take: 10001,
          });
        for (const r of storyIdeas) add('STORY', r.storyId, 'IDEA', r.ideaId, 'STORY_IDEA');
        for (const r of sceneIdeas) add('SCENE', r.sceneId, 'IDEA', r.ideaId, 'SCENE_IDEA');
      }
      if (relationships.length > 10000)
        throw new HttpError(
          413,
          'VALIDATION_ERROR',
          'Choose fewer relationships for this snapshot.',
        );
      const candidate = {
        format: 'inkwell.snapshot',
        version: 1,
        title: input.title,
        createdAt: createdAt.toISOString(),
        records,
        relationships,
        assets: [],
      };
      if (Buffer.byteLength(canonicalJson(candidate)) > snapshotMaxBytes)
        throw new HttpError(
          413,
          'VALIDATION_ERROR',
          'Choose less content for this snapshot (8 MiB limit).',
        );
      const doc = validateSnapshotDocument(candidate),
        bytes = Buffer.from(canonicalJson(doc));
      if (bytes.length > snapshotMaxBytes)
        throw new HttpError(
          413,
          'VALIDATION_ERROR',
          'Choose less content for this snapshot (8 MiB limit).',
        );
      const row = await tx.snapshot.create({
        data: {
          id: snapshotId,
          ...scope,
          storyId: input.storyId ?? null,
          title: input.title,
          objectKey: key,
          contentHash: hash(bytes),
          byteSize: bytes.length,
          recordCount: records.length,
          createdAt,
        },
      });
      return { row, doc, bytes };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 },
  );
  try {
    await objects.put(key, result.bytes);
    const saved = await objects.get(key);
    if (hash(saved) !== result.row.contentHash)
      throw new Error('Private copy verification failed.');
    const ready = await database().snapshot.updateMany({
      where: { id: snapshotId, workspaceId: a.workspaceId, status: 'PENDING' },
      data: { status: 'READY' },
    });
    if (ready.count !== 1) throw new Error('Snapshot state changed.');
    return { snapshot: summary(result.row), document: result.doc };
  } catch (error) {
    let failed = false;
    try {
      failed =
        (
          await database().snapshot.updateMany({
            where: { id: snapshotId, workspaceId: a.workspaceId, status: 'PENDING' },
            data: { status: 'FAILED' },
          })
        ).count === 1;
    } catch {
      /* Leave tracked private staging for later verification when the database is unavailable. */
    }
    if (failed && !(error instanceof StorageAlreadyExists))
      try {
        await objects.remove(key);
      } catch {
        /* FAILED metadata retains the private orphan key for an operator cleanup. */
      }
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'The private snapshot could not be confirmed. Check your snapshots before creating another copy.',
    );
  }
}
async function readFrozen(
  row: { objectKey: string; contentHash: string; byteSize: number },
  objects: PrivateStorage,
) {
  const bytes = await objects.get(row.objectKey);
  if (bytes.length !== row.byteSize || hash(bytes) !== row.contentHash)
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'This snapshot is temporarily unavailable.');
  try {
    return validateSnapshotDocument(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'This snapshot is temporarily unavailable.');
  }
}
export async function previewSnapshot(
  a: AccountRecord,
  projectId: string,
  snapshotId: string,
  objects: PrivateStorage = snapshotStorage(),
): Promise<SnapshotPreview> {
  const row = await owned(a, projectId, snapshotId);
  return { snapshot: summary(row), document: await readFrozen(row, objects) };
}
export async function issueShareLink(
  a: AccountRecord,
  projectId: string,
  snapshotId: string,
  input: z.infer<typeof ShareLinkInput>,
) {
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a future expiry time.');
  await owned(a, projectId, snapshotId);
  const token = randomBytes(32).toString('base64url'),
    row = await database().shareLink.create({
      data: {
        workspaceId: a.workspaceId,
        snapshotId,
        tokenHash: hash(token),
        expiresAt,
        allowDownload: input.allowDownload,
      },
    });
  return { link: linkDto(row), token };
}
export async function listShareLinks(
  a: AccountRecord,
  projectId: string,
  snapshotId: string,
  search: URLSearchParams,
) {
  await owned(a, projectId, snapshotId);
  const p = page(search),
    rows = await database().shareLink.findMany({
      where: { workspaceId: a.workspaceId, snapshotId, ...prismaPosition(p.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: p.limit + 1,
    });
  return pageResult(rows, p.limit, linkDto);
}
export async function revokeShareLink(
  a: AccountRecord,
  projectId: string,
  snapshotId: string,
  linkId: string,
  version: number,
) {
  await owned(a, projectId, snapshotId);
  const result = await database().shareLink.updateMany({
    where: { id: id(linkId), workspaceId: a.workspaceId, snapshotId, version, revokedAt: null },
    data: { revokedAt: new Date(), version: { increment: 1 } },
  });
  if (!result.count) {
    if (
      await database().shareLink.findFirst({
        where: { id: linkId, workspaceId: a.workspaceId, snapshotId },
      })
    )
      conflict();
    notFound();
  }
  return linkDto(await database().shareLink.findUniqueOrThrow({ where: { id: linkId } }));
}
export function unavailable(): never {
  throw new HttpError(404, 'NOT_FOUND', 'This share link is unavailable.');
}
export async function accessShared(
  token: string,
  download = false,
  objects: PrivateStorage = snapshotStorage(),
) {
  const tokenHash = hash(token),
    where = {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      snapshot: { status: 'READY' as const },
    },
    row = await database().shareLink.findFirst({ where, include: { snapshot: true } });
  if (!row) unavailable();
  if (download && !row.allowDownload)
    throw new HttpError(403, 'FORBIDDEN', 'Downloads are disabled for this link.');
  const document = await readFrozen(row.snapshot, objects);
  // Use a fresh read after object I/O: a repeatable-read transaction would hide revocation.
  if (
    !(await database().shareLink.findFirst({
      where: {
        id: row.id,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        snapshot: { status: 'READY' },
        ...(download ? { allowDownload: true } : {}),
      },
      select: { id: true },
    }))
  )
    unavailable();
  return { document, expiresAt: row.expiresAt.toISOString(), allowDownload: row.allowDownload };
}
