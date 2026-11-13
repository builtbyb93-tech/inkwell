import 'server-only';
import {
  type AccountRecord,
  type RichDocument,
  type SceneStatus,
  type TargetRecord,
} from '@inkwell/contracts';
import { database } from './database';
import { HttpError, notFound } from './http';
import { id } from './records';
import { type Tx, readDocument, jsonDocument, prismaPosition, pageResult } from './ideas';
import { ListQuery } from '@inkwell/contracts';

export async function lockProject(tx: Tx, account: AccountRecord, projectId: string) {
  const result = await tx.project.updateMany({
    where: { id: id(projectId), workspaceId: account.workspaceId, archivedAt: null },
    data: { updatedAt: new Date() },
  });
  if (result.count !== 1) {
    if (
      await tx.project.findFirst({
        where: { id: projectId, workspaceId: account.workspaceId },
        select: { id: true },
      })
    )
      throw new HttpError(
        409,
        'REVISION_CONFLICT',
        'Restore the project before adding links or converted records.',
      );
    notFound();
  }
}
export async function requireActiveStory(
  tx: Tx,
  account: AccountRecord,
  projectId: string,
  storyId: string,
) {
  const story = await tx.story.findFirst({
    where: { id: id(storyId), projectId, workspaceId: account.workspaceId, archivedAt: null },
    select: { id: true },
  });
  if (!story) notFound();
  return story;
}
type Seed = { title: string; content: RichDocument; contentText: string };
export function seedStory(tx: Tx, account: AccountRecord, projectId: string, source: Seed) {
  return tx.story.create({
    data: {
      workspaceId: account.workspaceId,
      projectId,
      title: source.title,
      synopsis: source.contentText,
    },
  });
}
export function seedCharacter(tx: Tx, account: AccountRecord, projectId: string, source: Seed) {
  return tx.canonRecord.create({
    data: {
      workspaceId: account.workspaceId,
      projectId,
      name: source.title,
      content: jsonDocument(source.content),
      contentText: source.contentText,
    },
  });
}
export async function appendSceneSeed(
  tx: Tx,
  account: AccountRecord,
  projectId: string,
  storyId: string,
  source: Seed,
  options: { groupId?: string | null; status?: SceneStatus; duplicatedFromId?: string } = {},
) {
  const story = await tx.story.updateMany({
    where: { id: id(storyId), projectId, workspaceId: account.workspaceId, archivedAt: null },
    data: { sequenceVersion: { increment: 1 } },
  });
  if (story.count !== 1) notFound();
  const max = await tx.scene.aggregate({
    where: { storyId, workspaceId: account.workspaceId },
    _max: { position: true },
  });
  return tx.scene.create({
    data: {
      workspaceId: account.workspaceId,
      projectId,
      storyId,
      title: source.title,
      content: jsonDocument(source.content),
      contentText: source.contentText,
      position: (max._max.position ?? -1) + 1,
      ...options,
    },
  });
}
export async function listScenes(
  account: AccountRecord,
  projectId: string,
  storyId: string,
  search: URLSearchParams,
) {
  const query = ListQuery.safeParse(Object.fromEntries(search));
  if (!query.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid scene filters.');
  const p = query.data;
  const parent = await database().story.findFirst({
    where: { id: id(storyId), projectId: id(projectId), workspaceId: account.workspaceId },
    select: { id: true },
  });
  if (!parent) notFound();
  const rows = await database().scene.findMany({
    where: {
      workspaceId: account.workspaceId,
      projectId,
      storyId,
      archivedAt: p.archived === 'true' ? { not: null } : null,
      ...prismaPosition(p.cursor),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: p.limit + 1,
    select: { id: true, title: true, position: true, version: true, createdAt: true },
  });
  return pageResult(rows, p.limit, (row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
export async function getTarget(
  account: AccountRecord,
  kind: 'CHARACTER' | 'SCENE',
  projectId: string,
  targetId: string,
  storyId?: string,
): Promise<TargetRecord> {
  id(projectId);
  id(targetId);
  const db = database();
  if (kind === 'CHARACTER') {
    const row = await db.canonRecord.findFirst({
      where: {
        id: targetId,
        projectId,
        workspaceId: account.workspaceId,
        kind: 'CHARACTER',
        scope: 'SHARED',
      },
      include: {
        conversions: {
          where: { workspaceId: account.workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
          select: { idea: { select: { id: true, title: true, archivedAt: true } } },
        },
      },
    });
    if (!row) notFound();
    return {
      id: row.id,
      kind,
      projectId,
      title: row.name,
      content: readDocument(row.content, row.contentSchemaVersion),
      contentSchemaVersion: row.contentSchemaVersion,
      version: row.version,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      sources: row.conversions.map((c) => ({
        id: c.idea.id,
        title: c.idea.title,
        archived: Boolean(c.idea.archivedAt),
      })),
    };
  }
  if (!storyId) notFound();
  id(storyId);
  const row = await db.scene.findFirst({
    where: { id: targetId, projectId, storyId, workspaceId: account.workspaceId },
    include: {
      ideaLinks: {
        where: { workspaceId: account.workspaceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: { idea: { select: { id: true, title: true, archivedAt: true } } },
      },
    },
  });
  if (!row) notFound();
  return {
    id: row.id,
    kind,
    projectId,
    storyId,
    title: row.title,
    content: readDocument(row.content, row.contentSchemaVersion),
    contentSchemaVersion: row.contentSchemaVersion,
    version: row.version,
    position: row.position,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    sources: row.ideaLinks.map((c) => ({
      id: c.idea.id,
      title: c.idea.title,
      archived: Boolean(c.idea.archivedAt),
    })),
  };
}
