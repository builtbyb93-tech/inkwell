import 'server-only';
import { Id, ListQuery, ProjectRecord, StoryRecord, type AccountRecord } from '@inkwell/contracts';
import { decodeCursor, encodeCursor } from '@inkwell/domain';
import { database } from './database';
import { HttpError, notFound, conflict } from './http';

export function id(value: string) {
  if (!Id.safeParse(value).success) notFound();
  return value;
}
function paging(search: URLSearchParams) {
  const input = ListQuery.safeParse(Object.fromEntries(search));
  if (!input.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid list filters.');
  const cursor = input.data.cursor ? decodeCursor(input.data.cursor) : null;
  if (input.data.cursor && !cursor)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid page cursor.');
  return {
    ...input.data,
    position: cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {},
  };
}
type Dates = { createdAt: Date; updatedAt: Date; archivedAt: Date | null };
function dates(row: Dates) {
  return {
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}
export function projectDto(
  row: { id: string; title: string; description: string; version: number } & Dates,
): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    version: row.version,
    ...dates(row),
  };
}
export function storyDto(
  row: {
    id: string;
    projectId: string;
    title: string;
    synopsis: string;
    format: string;
    version: number;
  } & Dates,
): StoryRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    synopsis: row.synopsis,
    format: row.format,
    version: row.version,
    ...dates(row),
  };
}
export async function listProjects(account: AccountRecord, search: URLSearchParams) {
  const page = paging(search);
  const rows = await database().project.findMany({
    where: {
      workspaceId: account.workspaceId,
      archivedAt: page.archived === 'true' ? { not: null } : null,
      ...page.position,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  });
  const items = rows.slice(0, page.limit);
  const last = items.at(-1);
  return {
    items: items.map(projectDto),
    nextCursor: rows.length > page.limit && last ? encodeCursor(last) : null,
  };
}
export async function getProject(account: AccountRecord, projectId: string) {
  const row = await database().project.findFirst({
    where: { id: id(projectId), workspaceId: account.workspaceId },
  });
  return row ? projectDto(row) : notFound();
}
export async function createProject(
  account: AccountRecord,
  input: { title: string; description: string },
) {
  return projectDto(
    await database().project.create({ data: { ...input, workspaceId: account.workspaceId } }),
  );
}
export async function updateProject(
  account: AccountRecord,
  projectId: string,
  version: number,
  input: {
    title?: string | undefined;
    description?: string | undefined;
    archived?: boolean | undefined;
  },
) {
  const db = database();
  id(projectId);
  return db.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id: projectId, workspaceId: account.workspaceId, version },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      if (
        await tx.project.findFirst({
          where: { id: projectId, workspaceId: account.workspaceId },
          select: { id: true },
        })
      )
        conflict();
      notFound();
    }
    const row = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    return projectDto(row);
  });
}
export async function listStories(
  account: AccountRecord,
  projectId: string,
  search: URLSearchParams,
) {
  await getProject(account, projectId);
  const page = paging(search);
  const rows = await database().story.findMany({
    where: {
      workspaceId: account.workspaceId,
      projectId,
      archivedAt: page.archived === 'true' ? { not: null } : null,
      ...page.position,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
  });
  const items = rows.slice(0, page.limit);
  const last = items.at(-1);
  return {
    items: items.map(storyDto),
    nextCursor: rows.length > page.limit && last ? encodeCursor(last) : null,
  };
}
export async function getStory(account: AccountRecord, projectId: string, storyId: string) {
  const row = await database().story.findFirst({
    where: { id: id(storyId), projectId: id(projectId), workspaceId: account.workspaceId },
  });
  return row ? storyDto(row) : notFound();
}
export async function createStory(
  account: AccountRecord,
  projectId: string,
  input: { title: string; synopsis: string; format: string },
) {
  id(projectId);
  const db = database();
  return db.$transaction(async (tx) => {
    const parent = await tx.project.updateMany({
      where: { id: projectId, workspaceId: account.workspaceId, archivedAt: null },
      data: { updatedAt: new Date() },
    });
    if (parent.count !== 1) {
      const exists = await tx.project.findFirst({
        where: { id: projectId, workspaceId: account.workspaceId },
        select: { id: true },
      });
      if (exists) throw archivedParent();
      notFound();
    }
    return storyDto(
      await tx.story.create({ data: { ...input, projectId, workspaceId: account.workspaceId } }),
    );
  });
}
function archivedParent() {
  return new HttpError(
    409,
    'REVISION_CONFLICT',
    'Restore this project before changing its stories.',
  );
}
export async function updateStory(
  account: AccountRecord,
  projectId: string,
  storyId: string,
  version: number,
  input: {
    title?: string | undefined;
    synopsis?: string | undefined;
    format?: string | undefined;
    archived?: boolean | undefined;
  },
) {
  id(projectId);
  id(storyId);
  const db = database();
  return db.$transaction(async (tx) => {
    // Match the child first so foreign IDs cannot reveal parent archive state.
    const own = await tx.story.findFirst({
      where: { id: storyId, projectId, workspaceId: account.workspaceId },
      select: { id: true },
    });
    if (!own) notFound();
    const parent = await tx.project.updateMany({
      where: { id: projectId, workspaceId: account.workspaceId, archivedAt: null },
      data: { updatedAt: new Date() },
    });
    if (parent.count !== 1) throw archivedParent();
    const result = await tx.story.updateMany({
      where: { id: storyId, projectId, workspaceId: account.workspaceId, version },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.synopsis !== undefined ? { synopsis: input.synopsis } : {}),
        ...(input.format !== undefined ? { format: input.format } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) conflict();
    return storyDto(await tx.story.findUniqueOrThrow({ where: { id: storyId } }));
  });
}
export async function summary(account: AccountRecord) {
  const db = database();
  const [projects, stories, recent, ideas, recentIdeas] = await Promise.all([
    db.project.count({ where: { workspaceId: account.workspaceId, archivedAt: null } }),
    db.story.count({
      where: { workspaceId: account.workspaceId, archivedAt: null, project: { archivedAt: null } },
    }),
    db.project.findMany({
      where: { workspaceId: account.workspaceId, archivedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5,
    }),
    db.idea.count({ where: { workspaceId: account.workspaceId, archivedAt: null } }),
    db.idea.findMany({
      where: { workspaceId: account.workspaceId, archivedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: { id: true, title: true },
    }),
  ]);
  return {
    projects,
    stories,
    recent: recent.map(projectDto),
    ideas,
    recentIdeas: recentIdeas.map((idea) => ({ id: idea.id, title: idea.title })),
  };
}
