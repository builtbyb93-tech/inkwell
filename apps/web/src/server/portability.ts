import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { Prisma } from '@inkwell/db';
import {
  ProjectArchive,
  archiveMaxBytes,
  archiveMaxRecords,
  documentText,
  type AccountRecord,
} from '@inkwell/contracts';
import {
  ArchiveError,
  parseProjectArchive,
  archivePreview,
  validateArchiveGraph,
  orderedScenes,
  taxonomyNameKey,
} from '@inkwell/domain';
import { database } from './database';
import { HttpError, notFound } from './http';
const editable = ['id', 'createdAt', 'updatedAt', 'version', 'archivedAt'] as const;
function select<const K extends string>(...keys: K[]): { [P in K]: true } {
  return Object.fromEntries(keys.map((k) => [k, true])) as { [P in K]: true };
}
function dates<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
export async function exportProject(a: AccountRecord, projectId: string): Promise<ProjectArchive> {
  return database().$transaction(
    async (tx) => {
      const scope = { workspaceId: a.workspaceId, projectId };
      const project = await tx.project.findFirst({
        where: { id: projectId, workspaceId: a.workspaceId },
        select: select(...editable, 'title', 'description'),
      });
      if (!project) notFound();
      let records = 1,
        bytes = Buffer.byteLength(JSON.stringify(project));
      // Pages bound memory before any archive is returned. No account/session/receipt fields are read.
      async function collect<T extends { id: string }>(
        fetch: (cursor: string | undefined) => Promise<T[]>,
      ) {
        const out: T[] = [];
        let cursor: string | undefined;
        for (;;) {
          const rows = await fetch(cursor);
          for (const r of rows) {
            records++;
            bytes += Buffer.byteLength(JSON.stringify(r));
            if (records > archiveMaxRecords || bytes > archiveMaxBytes - 65536)
              throw new HttpError(
                413,
                'VALIDATION_ERROR',
                'This project exceeds the archive limits (10,000 records / 8 MiB).',
              );
            out.push(r);
          }
          if (rows.length < 100) break;
          cursor = rows.at(-1)!.id;
        }
        return out;
      }
      const page = (cursor: string | undefined) => ({
        take: 100,
        orderBy: { id: 'asc' as const },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const stories = await collect((c) =>
        tx.story.findMany({
          where: scope,
          select: select(...editable, 'title', 'synopsis', 'format', 'sequenceVersion'),
          ...page(c),
        }),
      );
      const canon = await collect((c) =>
        tx.canonRecord.findMany({
          where: scope,
          select: select(
            ...editable,
            'storyId',
            'kind',
            'scope',
            'name',
            'content',
            'contentSchemaVersion',
          ),
          ...page(c),
        }),
      );
      const overrides = await collect((c) =>
        tx.canonOverride.findMany({
          where: scope,
          select: select(
            'id',
            'createdAt',
            'updatedAt',
            'version',
            'storyId',
            'canonId',
            'hasName',
            'name',
            'hasContent',
            'content',
            'contentSchemaVersion',
            'baseVersion',
            'baseName',
            'baseContent',
            'baseContentSchemaVersion',
          ),
          ...page(c),
        }),
      );
      const groups = await collect((c) =>
        tx.plotGroup.findMany({
          where: scope,
          select: select(...editable, 'storyId', 'parentId', 'title', 'description'),
          ...page(c),
        }),
      );
      const scenes = await collect((c) =>
        tx.scene.findMany({
          where: scope,
          select: select(
            ...editable,
            'storyId',
            'groupId',
            'duplicatedFromId',
            'title',
            'content',
            'contentSchemaVersion',
            'status',
            'position',
          ),
          ...page(c),
        }),
      );
      const relationships = await collect((c) =>
        tx.canonRelationship.findMany({
          where: scope,
          select: select(...editable, 'storyId', 'fromId', 'toId', 'kind', 'label'),
          ...page(c),
        }),
      );
      const linkKeys = ['id', 'createdAt', 'storyId', 'sceneId', 'canonId'] as const;
      const sceneCharacters = await collect((c) =>
        tx.sceneCharacterLink.findMany({ where: scope, select: select(...linkKeys), ...page(c) }),
      );
      const sceneLocations = await collect((c) =>
        tx.sceneLocationLink.findMany({ where: scope, select: select(...linkKeys), ...page(c) }),
      );
      const relevant = {
        workspaceId: a.workspaceId,
        OR: [
          { storyLinks: { some: { projectId } } },
          { sceneLinks: { some: { projectId } } },
          { conversions: { some: { projectId } } },
        ],
      };
      const ideaRows = await collect((c) =>
        tx.idea.findMany({
          where: relevant,
          select: {
            ...select(...editable, 'title', 'content', 'contentSchemaVersion', 'categoryId'),
            tags: { select: { tagId: true } },
          },
          ...page(c),
        }),
      );
      const ideas = ideaRows.map((row) => {
        const { tags, ...fields } = row;
        return { ...fields, tagIds: tags.map((t) => t.tagId).sort() };
      });
      const categoryIds = ideas.map((i) => i.categoryId).filter((id): id is string => Boolean(id)),
        tagIds = ideas.flatMap((i) => i.tagIds);
      const categories = await collect((c) =>
        tx.ideaCategory.findMany({
          where: { workspaceId: a.workspaceId, id: { in: categoryIds } },
          select: select('id', 'createdAt', 'updatedAt', 'version', 'name'),
          ...page(c),
        }),
      );
      const tags = await collect((c) =>
        tx.ideaTag.findMany({
          where: { workspaceId: a.workspaceId, id: { in: tagIds } },
          select: select('id', 'createdAt', 'updatedAt', 'version', 'name'),
          ...page(c),
        }),
      );
      const ideaStoryLinks = await collect((c) =>
        tx.ideaStoryLink.findMany({
          where: scope,
          select: select('id', 'createdAt', 'ideaId', 'storyId'),
          ...page(c),
        }),
      );
      const ideaSceneLinks = await collect((c) =>
        tx.ideaSceneLink.findMany({
          where: scope,
          select: select('id', 'createdAt', 'ideaId', 'storyId', 'sceneId'),
          ...page(c),
        }),
      );
      const conversions = await collect((c) =>
        tx.ideaConversion.findMany({
          where: scope,
          select: select(
            'id',
            'createdAt',
            'ideaId',
            'kind',
            'parentStoryId',
            'targetStoryId',
            'targetCharacterId',
            'targetSceneId',
            'sourceVersion',
            'sourceContentSchemaVersion',
            'titleSnapshot',
            'contentSnapshot',
          ),
          ...page(c),
        }),
      );
      const archive = ProjectArchive.parse(
        dates({
          format: 'inkwell.project',
          version: 1,
          exportedAt: new Date(),
          project,
          stories,
          canon,
          overrides,
          groups,
          scenes,
          relationships,
          sceneCharacters,
          sceneLocations,
          categories,
          tags,
          ideas,
          ideaStoryLinks,
          ideaSceneLinks,
          conversions,
          assets: [],
        }),
      );
      validateArchiveGraph(archive);
      if (Buffer.byteLength(JSON.stringify(archive)) > archiveMaxBytes)
        throw new HttpError(
          413,
          'VALIDATION_ERROR',
          'This project exceeds the 8 MiB archive limit.',
        );
      return archive;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
  );
}
export function readArchive(text: string) {
  try {
    return parseProjectArchive(text);
  } catch (e) {
    if (e instanceof ArchiveError) throw new HttpError(400, 'VALIDATION_ERROR', e.message);
    throw e;
  }
}
export { archivePreview };
export async function importProject(a: AccountRecord, archive: ProjectArchive) {
  // Validate again at the service boundary, before the transaction writes anything.
  const data = readArchive(JSON.stringify(archive));
  const ids = new Map<string, string>();
  const remap = (kind: string, id: string) => {
    const key = kind + ':' + id;
    if (!ids.has(key)) ids.set(key, randomUUID());
    return ids.get(key)!;
  };
  const maybe = (kind: string, id: string | null) => (id ? remap(kind, id) : null);
  const projectId = remap('project', data.project.id),
    scope = { workspaceId: a.workspaceId, projectId };
  const timestamps = <
    T extends { createdAt: string; updatedAt?: string; archivedAt?: string | null },
  >(
    r: T,
  ) => ({
    ...r,
    createdAt: new Date(r.createdAt),
    ...('updatedAt' in r ? { updatedAt: new Date(r.updatedAt!) } : {}),
    ...('archivedAt' in r ? { archivedAt: r.archivedAt ? new Date(r.archivedAt) : null } : {}),
  });
  return database().$transaction(
    async (tx) => {
      await tx.project.create({
        data: { ...timestamps(data.project), id: projectId, workspaceId: a.workspaceId },
      });
      const batch = async <T>(rows: T[], write: (rows: T[]) => Promise<unknown>) => {
        for (let i = 0; i < rows.length; i += 200) await write(rows.slice(i, i + 200));
      };
      // Classification identities are workspace-wide. Reuse without changing existing names/content.
      for (const [kind, rows, model] of [
        ['category', data.categories, tx.ideaCategory],
        ['tag', data.tags, tx.ideaTag],
      ] as const) {
        const mapped = rows.map((r) => ({
          ...timestamps(r),
          id: remap(kind, r.id),
          workspaceId: a.workspaceId,
          nameKey: taxonomyNameKey(r.name),
        }));
        await batch(mapped, (r) => model.createMany({ data: r, skipDuplicates: true }));
        const args = {
          where: { workspaceId: a.workspaceId, nameKey: { in: mapped.map((r) => r.nameKey) } },
          select: { id: true, nameKey: true },
        } as const;
        const found =
          kind === 'category'
            ? await tx.ideaCategory.findMany(args)
            : await tx.ideaTag.findMany(args);
        const byName = new Map(found.map((r) => [r.nameKey, r.id]));
        for (const r of rows) ids.set(kind + ':' + r.id, byName.get(taxonomyNameKey(r.name))!);
      }
      await batch(
        data.stories.map((r) => ({ ...timestamps(r), ...scope, id: remap('story', r.id) })),
        (r) => tx.story.createMany({ data: r }),
      );
      await batch(
        data.canon.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('canon', r.id),
          storyId: maybe('story', r.storyId),
          content: r.content as Prisma.InputJsonValue,
          contentText: documentText(r.content),
        })),
        (r) => tx.canonRecord.createMany({ data: r }),
      );
      await batch(
        data.overrides.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('override', r.id),
          storyId: remap('story', r.storyId),
          canonId: remap('canon', r.canonId),
          content: r.content === null ? Prisma.DbNull : (r.content as Prisma.InputJsonValue),
          contentText: r.content === null ? null : documentText(r.content),
          baseContent: r.baseContent as Prisma.InputJsonValue,
        })),
        (r) => tx.canonOverride.createMany({ data: r }),
      );
      for (const root of [true, false])
        await batch(
          data.groups
            .filter((r) => !r.parentId === root)
            .map((r) => ({
              ...timestamps(r),
              ...scope,
              id: remap('group', r.id),
              storyId: remap('story', r.storyId),
              parentId: maybe('group', r.parentId),
            })),
          (r) => tx.plotGroup.createMany({ data: r }),
        );
      // Source-first insert order preserves immutable duplication provenance.
      await batch(
        orderedScenes(data.scenes).map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('scene', r.id),
          storyId: remap('story', r.storyId),
          groupId: maybe('group', r.groupId),
          duplicatedFromId: maybe('scene', r.duplicatedFromId),
          content: r.content as Prisma.InputJsonValue,
          contentText: documentText(r.content),
        })),
        (r) => tx.scene.createMany({ data: r }),
      );
      await batch(
        data.relationships.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('relationship', r.id),
          storyId: maybe('story', r.storyId),
          fromId: remap('canon', r.fromId),
          toId: remap('canon', r.toId),
        })),
        (r) => tx.canonRelationship.createMany({ data: r }),
      );
      for (const [kind, rows, model] of [
        ['sceneCharacter', data.sceneCharacters, tx.sceneCharacterLink],
        ['sceneLocation', data.sceneLocations, tx.sceneLocationLink],
      ] as const)
        await batch(
          rows.map((r) => ({
            ...timestamps(r),
            ...scope,
            id: remap(kind, r.id),
            storyId: remap('story', r.storyId),
            sceneId: remap('scene', r.sceneId),
            canonId: remap('canon', r.canonId),
          })),
          (r) => model.createMany({ data: r }),
        );
      await batch(
        data.ideas.map((r) => {
          const { tagIds, ...fields } = r;
          void tagIds;
          return {
            ...timestamps(fields),
            id: remap('idea', r.id),
            workspaceId: a.workspaceId,
            categoryId: maybe('category', r.categoryId),
            content: r.content as Prisma.InputJsonValue,
            contentText: documentText(r.content),
          };
        }),
        (r) => tx.idea.createMany({ data: r }),
      );
      await batch(
        data.ideas.flatMap((r) =>
          r.tagIds.map((t) => ({
            workspaceId: a.workspaceId,
            ideaId: remap('idea', r.id),
            tagId: remap('tag', t),
          })),
        ),
        (r) => tx.ideaTagAssignment.createMany({ data: r }),
      );
      await batch(
        data.ideaStoryLinks.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('ideaStory', r.id),
          ideaId: remap('idea', r.ideaId),
          storyId: remap('story', r.storyId),
        })),
        (r) => tx.ideaStoryLink.createMany({ data: r }),
      );
      await batch(
        data.ideaSceneLinks.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('ideaScene', r.id),
          ideaId: remap('idea', r.ideaId),
          storyId: remap('story', r.storyId),
          sceneId: remap('scene', r.sceneId),
        })),
        (r) => tx.ideaSceneLink.createMany({ data: r }),
      );
      await batch(
        data.conversions.map((r) => ({
          ...timestamps(r),
          ...scope,
          id: remap('conversion', r.id),
          ideaId: remap('idea', r.ideaId),
          parentStoryId: maybe('story', r.parentStoryId),
          targetStoryId: maybe('story', r.targetStoryId),
          targetCharacterId: maybe('canon', r.targetCharacterId),
          targetSceneId: maybe('scene', r.targetSceneId),
          contentSnapshot: r.contentSnapshot as Prisma.InputJsonValue,
          requestKey: randomUUID(),
          requestHash: createHash('sha256')
            .update('import:' + projectId + ':' + r.id)
            .digest('hex'),
        })),
        (r) => tx.ideaConversion.createMany({ data: r }),
      );
      return { projectId, counts: archivePreview(data).counts };
    },
    { timeout: 30000 },
  );
}
