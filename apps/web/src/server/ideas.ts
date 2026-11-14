import 'server-only';
import { Prisma } from '@inkwell/db';
import {
  IdeaListQuery,
  TaxonomyQuery,
  documentText,
  validateRichDocument,
  Id,
  type AccountRecord,
  type IdeaRecord,
  type IdeaSummary,
  type TaxonomyRecord,
  type RichDocument,
} from '@inkwell/contracts';
import { decodeCursor, encodeCursor, taxonomyNameKey } from '@inkwell/domain';
import { database } from './database';
import { HttpError, notFound, conflict } from './http';
import { id } from './records';

export type Tx = Prisma.TransactionClient;
export const ideaInclude = {
  category: true,
  tags: { include: { tag: true } },
  _count: { select: { storyLinks: true, sceneLinks: true, conversions: true } },
} as const;
type Row = Prisma.IdeaGetPayload<{ include: typeof ideaInclude }>;
export function taxonomyDto(row: {
  id: string;
  name: string;
  version: number;
  createdAt: Date;
}): TaxonomyRecord {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}
function baseDto(row: Omit<Row, 'content'>) {
  return {
    id: row.id,
    title: row.title,
    contentSchemaVersion: row.contentSchemaVersion,
    version: row.version,
    category: row.category ? taxonomyDto(row.category) : null,
    tags: row.tags.map((x) => taxonomyDto(x.tag)),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    counts: {
      stories: row._count.storyLinks,
      scenes: row._count.sceneLinks,
      conversions: row._count.conversions,
    },
  };
}
export function ideaDto(row: Row): IdeaRecord {
  return { ...baseDto(row), content: readDocument(row.content, row.contentSchemaVersion) };
}
export function readDocument(value: unknown, version: number): RichDocument {
  if (version !== 1)
    throw new HttpError(
      503,
      'SERVICE_UNAVAILABLE',
      'This content format requires a newer application release.',
    );
  return validateRichDocument(value);
}
export const jsonDocument = (doc: RichDocument) => doc as unknown as Prisma.InputJsonValue;
export function cursorPosition(cursor?: string) {
  const position = cursor ? decodeCursor(cursor) : null;
  if (cursor && !position) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid page cursor.');
  return position;
}
export function pageResult<T extends { id: string; createdAt: Date }, D>(
  rows: T[],
  limit: number,
  dto: (row: T) => D,
) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(dto),
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}
export function prismaPosition(cursor?: string) {
  const p = cursorPosition(cursor);
  return p
    ? { OR: [{ createdAt: { lt: p.createdAt } }, { createdAt: p.createdAt, id: { lt: p.id } }] }
    : {};
}
export async function requireIdea(account: AccountRecord, ideaId: string, tx: Tx = database()) {
  const row = await tx.idea.findFirst({
    where: { id: id(ideaId), workspaceId: account.workspaceId },
    include: ideaInclude,
  });
  if (!row) notFound();
  return row;
}
export async function getIdea(account: AccountRecord, ideaId: string) {
  return ideaDto(await requireIdea(account, ideaId));
}
export async function claimIdea(
  tx: Tx,
  account: AccountRecord,
  ideaId: string,
  version: number,
  active = true,
) {
  const changed = await tx.idea.updateMany({
    where: {
      id: id(ideaId),
      workspaceId: account.workspaceId,
      version,
      ...(active ? { archivedAt: null } : {}),
    },
    data: { version: { increment: 1 } },
  });
  if (changed.count !== 1) {
    const exists = await tx.idea.findFirst({
      where: { id: ideaId, workspaceId: account.workspaceId },
      select: { archivedAt: true },
    });
    if (!exists) notFound();
    if (active && exists.archivedAt)
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore this idea before changing it.');
    conflict();
  }
}
async function validateLabels(
  tx: Tx,
  account: AccountRecord,
  categoryId?: string | null,
  tagIds?: string[],
) {
  if (
    categoryId &&
    !(await tx.ideaCategory.findFirst({
      where: { id: categoryId, workspaceId: account.workspaceId },
      select: { id: true },
    }))
  )
    notFound();
  if (
    tagIds?.length &&
    (await tx.ideaTag.count({
      where: { id: { in: tagIds }, workspaceId: account.workspaceId },
    })) !== tagIds.length
  )
    notFound();
}
export async function createIdea(
  account: AccountRecord,
  input: { title: string; content: RichDocument; categoryId: string | null; tagIds: string[] },
) {
  return database().$transaction(async (tx) => {
    await validateLabels(tx, account, input.categoryId, input.tagIds);
    const created = await tx.idea.create({
      data: {
        workspaceId: account.workspaceId,
        title: input.title,
        content: jsonDocument(input.content),
        contentText: documentText(input.content),
        categoryId: input.categoryId,
      },
    });
    if (input.tagIds.length)
      await tx.ideaTagAssignment.createMany({
        data: input.tagIds.map((tagId) => ({
          ideaId: created.id,
          tagId,
          workspaceId: account.workspaceId,
        })),
      });
    return ideaDto(await requireIdea(account, created.id, tx));
  });
}
export async function updateIdea(
  account: AccountRecord,
  ideaId: string,
  version: number,
  input: {
    title?: string | undefined;
    content?: RichDocument | undefined;
    categoryId?: string | null | undefined;
    tagIds?: string[] | undefined;
    archived?: boolean | undefined;
  },
  transaction?: Tx,
) {
  const perform = async (tx: Tx) => {
    await claimIdea(tx, account, ideaId, version, false);
    const current = await requireIdea(account, ideaId, tx);
    if (current.archivedAt && Object.keys(input).some((k) => k !== 'archived'))
      throw new HttpError(409, 'REVISION_CONFLICT', 'Restore this idea before editing it.');
    await validateLabels(tx, account, input.categoryId, input.tagIds);
    if (input.tagIds !== undefined) {
      await tx.ideaTagAssignment.deleteMany({
        where: { ideaId, workspaceId: account.workspaceId },
      });
      if (input.tagIds.length)
        await tx.ideaTagAssignment.createMany({
          data: input.tagIds.map((tagId) => ({ ideaId, tagId, workspaceId: account.workspaceId })),
        });
    }
    await tx.idea.update({
      where: { id: ideaId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined
          ? { content: jsonDocument(input.content), contentText: documentText(input.content) }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      },
    });
    return ideaDto(await requireIdea(account, ideaId, tx));
  };
  return transaction ? perform(transaction) : database().$transaction(perform);
}
export async function listIdeas(account: AccountRecord, search: URLSearchParams) {
  const parsed = IdeaListQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid vault filters.');
  const p = parsed.data;
  const cursor = cursorPosition(p.cursor);
  const tags = p.tagIds ? p.tagIds.split(',') : [];
  if (
    tags.length > 20 ||
    tags.some((t) => !Id.safeParse(t).success) ||
    new Set(tags).size !== tags.length
  )
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid tag filters.');
  const clauses: Prisma.Sql[] = [
    Prisma.sql`i."workspaceId"=${account.workspaceId}::uuid`,
    p.archived === 'true'
      ? Prisma.sql`i."archivedAt" IS NOT NULL`
      : Prisma.sql`i."archivedAt" IS NULL`,
  ];
  if (p.q)
    clauses.push(Prisma.sql`i."searchVector" @@ websearch_to_tsquery('simple'::regconfig,${p.q})`);
  if (p.categoryId) clauses.push(Prisma.sql`i."categoryId"=${p.categoryId}::uuid`);
  for (const tag of tags)
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "IdeaTagAssignment" t WHERE t."ideaId"=i.id AND t."workspaceId"=i."workspaceId" AND t."tagId"=${tag}::uuid)`,
    );
  if (p.storyId)
    clauses.push(
      Prisma.sql`(EXISTS (SELECT 1 FROM "IdeaStoryLink" l WHERE l."ideaId"=i.id AND l."workspaceId"=i."workspaceId" AND l."storyId"=${p.storyId}::uuid) OR EXISTS (SELECT 1 FROM "IdeaSceneLink" l WHERE l."ideaId"=i.id AND l."workspaceId"=i."workspaceId" AND l."storyId"=${p.storyId}::uuid))`,
    );
  if (p.sceneId)
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "IdeaSceneLink" l WHERE l."ideaId"=i.id AND l."workspaceId"=i."workspaceId" AND l."sceneId"=${p.sceneId}::uuid)`,
    );
  if (cursor)
    clauses.push(Prisma.sql`(i."createdAt",i.id)<(${cursor.createdAt},${cursor.id}::uuid)`);
  return database().$transaction(
    async (tx) => {
      const ids = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT i.id FROM "Idea" i WHERE ${Prisma.join(clauses, ' AND ')} ORDER BY i."createdAt" DESC,i.id DESC LIMIT ${p.limit + 1}`,
      );
      const rows = await tx.idea.findMany({
        where: { workspaceId: account.workspaceId, id: { in: ids.map((x) => x.id) } },
        include: ideaInclude,
        omit: { content: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return pageResult(
        rows,
        p.limit,
        (row) =>
          ({ ...baseDto(row), preview: row.contentText.slice(0, 200) }) satisfies IdeaSummary,
      );
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export type TaxonomyKind = 'categories' | 'tags';
export async function listTaxonomy(
  account: AccountRecord,
  kind: TaxonomyKind,
  search: URLSearchParams,
) {
  const parsed = TaxonomyQuery.safeParse(Object.fromEntries(search));
  if (!parsed.success)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid classification filters.');
  const p = parsed.data;
  const args = {
    where: {
      workspaceId: account.workspaceId,
      ...(p.q ? { name: { contains: p.q, mode: 'insensitive' as const } } : {}),
      ...prismaPosition(p.cursor),
    },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: p.limit + 1,
  };
  const rows =
    kind === 'categories'
      ? await database().ideaCategory.findMany(args)
      : await database().ideaTag.findMany(args);
  return pageResult(rows, p.limit, taxonomyDto);
}
export async function createTaxonomy(account: AccountRecord, kind: TaxonomyKind, name: string) {
  const data = { workspaceId: account.workspaceId, name, nameKey: taxonomyNameKey(name) };
  try {
    return taxonomyDto(
      kind === 'categories'
        ? await database().ideaCategory.create({ data })
        : await database().ideaTag.create({ data }),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new HttpError(409, 'REVISION_CONFLICT', 'This name already exists in your workspace.');
    throw error;
  }
}
