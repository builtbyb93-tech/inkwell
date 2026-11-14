import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@inkwell/db';
import {
  SearchQuery,
  SearchKind,
  type SearchPage,
  type SearchResult,
  type AccountRecord,
} from '@inkwell/contracts';
import { canonicalJson, decodeSearchCursor, encodeSearchCursor } from '@inkwell/domain';
import { database } from './database';
import { getProject, getStory } from './records';
import { HttpError } from './http';
export async function searchWorkspace(
  a: AccountRecord,
  search: URLSearchParams,
): Promise<SearchPage> {
  const input = SearchQuery.safeParse(Object.fromEntries(search));
  if (!input.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Check the search filters.');
  const p = input.data;
  let kinds: SearchKind[] = p.kinds
    ? (p.kinds.split(',') as SearchKind[])
    : [...SearchKind.options];
  if (
    !kinds.length ||
    new Set(kinds).size !== kinds.length ||
    kinds.some((k) => !SearchKind.safeParse(k).success)
  )
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose valid record types.');
  if (p.canonKind) kinds = kinds.filter((k) => k === 'CANON' || k === 'OVERRIDE');
  if (p.projectId) await getProject(a, p.projectId);
  const selectedStory = p.storyId ? await getStory(a, p.projectId!, p.storyId) : null;
  const hash = createHash('sha256')
      .update(canonicalJson({ workspaceId: a.workspaceId, ...p, cursor: undefined, kinds }))
      .digest('hex'),
    cursor = p.cursor ? decodeSearchCursor(p.cursor) : null;
  if (p.cursor && (!cursor || cursor.hash !== hash))
    throw new HttpError(400, 'VALIDATION_ERROR', 'This cursor belongs to another search.');
  const sql = Prisma.sql,
    ws = sql`${a.workspaceId}::uuid`,
    pid = p.projectId ? sql`${p.projectId}::uuid` : null,
    sid = p.storyId ? sql`${p.storyId}::uuid` : null,
    empty = Prisma.empty;
  const archive = (own: Prisma.Sql, parents: Prisma.Sql = sql`false`, activeException = false) =>
    p.archive === 'all'
      ? sql`true`
      : p.archive === 'archived'
        ? sql`(${own} OR ${parents})`
        : sql`(NOT (${parents}) AND ${activeException ? sql`true` : sql`NOT (${own})`})`;
  const projection = (
    kind: SearchKind,
    resultId: Prisma.Sql,
    id: Prisma.Sql,
    type: Prisma.Sql,
    title: Prisma.Sql,
    body: Prisma.Sql,
    project: Prisma.Sql,
    story: Prisma.Sql,
    archived: Prisma.Sql,
    vector: Prisma.Sql,
  ) =>
    sql`${kind}::text AS kind,${resultId} AS "resultId",${id} AS id,${type}::text AS "recordType",${title} AS title,left(${body},180) AS excerpt,${project}::uuid AS "projectId",${story}::uuid AS "storyId",${archived} AS archived,ts_rank_cd(${vector},n.query) AS rank`;
  const branches: Prisma.Sql[] = [];
  if (kinds.includes('PROJECT') && !sid)
    branches.push(
      sql`SELECT ${projection('PROJECT', sql`p.id`, sql`p.id`, sql`NULL`, sql`p.title`, sql`p.description`, sql`p.id`, sql`NULL`, sql`p."archivedAt" IS NOT NULL`, sql`p."searchVector"`)} FROM "Project" p CROSS JOIN n WHERE p."workspaceId"=${ws} ${pid ? sql`AND p.id=${pid}` : empty} AND ${archive(sql`p."archivedAt" IS NOT NULL`)} AND p."searchVector" @@ n.query`,
    );
  if (kinds.includes('STORY'))
    branches.push(
      sql`SELECT ${projection('STORY', sql`s.id`, sql`s.id`, sql`NULL`, sql`s.title`, sql`s.synopsis`, sql`s."projectId"`, sql`s.id`, sql`(s."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL)`, sql`s."searchVector"`)} FROM "Story" s JOIN "Project" p ON p.id=s."projectId" AND p."workspaceId"=s."workspaceId" CROSS JOIN n WHERE s."workspaceId"=${ws} ${pid ? sql`AND s."projectId"=${pid}` : empty} ${sid ? sql`AND s.id=${sid}` : empty} AND ${archive(sql`s."archivedAt" IS NOT NULL`, sql`p."archivedAt" IS NOT NULL`)} AND s."searchVector" @@ n.query`,
    );
  if (kinds.includes('IDEA')) {
    const projectLink = pid
      ? sql`AND (EXISTS(SELECT 1 FROM "IdeaStoryLink" l WHERE l."ideaId"=i.id AND l."workspaceId"=${ws} AND l."projectId"=${pid} ${sid ? sql`AND l."storyId"=${sid}` : empty}) OR EXISTS(SELECT 1 FROM "IdeaSceneLink" l WHERE l."ideaId"=i.id AND l."workspaceId"=${ws} AND l."projectId"=${pid} ${sid ? sql`AND l."storyId"=${sid}` : empty}) OR EXISTS(SELECT 1 FROM "IdeaConversion" l WHERE l."ideaId"=i.id AND l."workspaceId"=${ws} AND l."projectId"=${pid} ${sid ? sql`AND (l."parentStoryId"=${sid} OR l."targetStoryId"=${sid})` : empty}))`
      : empty;
    branches.push(
      sql`SELECT ${projection('IDEA', sql`i.id`, sql`i.id`, sql`NULL`, sql`i.title`, sql`i."contentText"`, sql`NULL`, sql`NULL`, sql`i."archivedAt" IS NOT NULL`, sql`i."searchVector"`)} FROM "Idea" i CROSS JOIN n WHERE i."workspaceId"=${ws} ${projectLink} AND ${archive(sql`i."archivedAt" IS NOT NULL`)} AND i."searchVector" @@ n.query`,
    );
  }
  if (kinds.includes('CANON'))
    branches.push(
      sql`SELECT ${projection('CANON', sql`c.id`, sql`c.id`, sql`c.kind`, sql`c.name`, sql`c."contentText"`, sql`c."projectId"`, sid ? sql`coalesce(c."storyId",${sid})` : sql`c."storyId"`, sql`(c."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL OR s."archivedAt" IS NOT NULL OR ${Boolean(selectedStory?.archivedAt)})`, sql`c."searchVector"`)} FROM "Character" c JOIN "Project" p ON p.id=c."projectId" AND p."workspaceId"=c."workspaceId" LEFT JOIN "Story" s ON s.id=c."storyId" AND s."workspaceId"=c."workspaceId" CROSS JOIN n WHERE c."workspaceId"=${ws} ${pid ? sql`AND c."projectId"=${pid}` : empty} ${sid ? sql`AND (c.scope='SHARED' OR c."storyId"=${sid}) AND NOT EXISTS(SELECT 1 FROM "CanonOverride" o WHERE o."canonId"=c.id AND o."storyId"=${sid} AND o."workspaceId"=${ws} AND (o."hasName" OR o."hasContent"))` : empty} ${p.canonKind ? sql`AND c.kind=${p.canonKind}::"CanonKind"` : empty} AND ${archive(sql`c."archivedAt" IS NOT NULL`, sql`(p."archivedAt" IS NOT NULL OR s."archivedAt" IS NOT NULL OR ${Boolean(selectedStory?.archivedAt)})`)} AND c."searchVector" @@ n.query`,
    );
  if (kinds.includes('OVERRIDE') || (sid && kinds.includes('CANON')))
    branches.push(
      sql`SELECT ${projection('OVERRIDE', sql`o.id`, sql`c.id`, sql`c.kind`, sql`o."effectiveName"`, sql`o."effectiveText"`, sql`o."projectId"`, sql`o."storyId"`, sql`(c."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL OR s."archivedAt" IS NOT NULL)`, sql`o."searchVector"`)} FROM "CanonOverride" o JOIN "Character" c ON c.id=o."canonId" AND c."workspaceId"=o."workspaceId" JOIN "Story" s ON s.id=o."storyId" AND s."workspaceId"=o."workspaceId" JOIN "Project" p ON p.id=o."projectId" AND p."workspaceId"=o."workspaceId" CROSS JOIN n WHERE o."workspaceId"=${ws} AND (o."hasName" OR o."hasContent") ${pid ? sql`AND o."projectId"=${pid}` : empty} ${sid ? sql`AND o."storyId"=${sid}` : empty} ${p.canonKind ? sql`AND c.kind=${p.canonKind}::"CanonKind"` : empty} AND ${archive(sql`c."archivedAt" IS NOT NULL`, sql`(s."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL)`, true)} AND o."searchVector" @@ n.query`,
    );
  for (const [kind, table] of [
    ['SCENE', 'Scene'],
    ['GROUP', 'PlotGroup'],
  ] as const) {
    if (!kinds.includes(kind)) continue;
    const tableSql = kind === 'SCENE' ? sql`"Scene"` : sql`"PlotGroup"`,
      vector = sql`r."searchVector"`,
      body = table === 'Scene' ? sql`r."contentText"` : sql`r.description`;
    branches.push(
      sql`SELECT ${projection(kind, sql`r.id`, sql`r.id`, sql`NULL`, sql`r.title`, body, sql`r."projectId"`, sql`r."storyId"`, sql`(r."archivedAt" IS NOT NULL OR s."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL)`, vector)} FROM ${tableSql} r JOIN "Story" s ON s.id=r."storyId" AND s."workspaceId"=r."workspaceId" JOIN "Project" p ON p.id=r."projectId" AND p."workspaceId"=r."workspaceId" CROSS JOIN n WHERE r."workspaceId"=${ws} ${pid ? sql`AND r."projectId"=${pid}` : empty} ${sid ? sql`AND r."storyId"=${sid}` : empty} AND ${archive(sql`r."archivedAt" IS NOT NULL`, sql`(s."archivedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL)`)} AND ${vector} @@ n.query`,
    );
  }
  if (!branches.length) return { items: [], nextCursor: null };
  const rows = await database().$queryRaw<(Omit<SearchResult, 'href'> & { rank: number })[]>(
    sql`WITH n AS(SELECT websearch_to_tsquery('simple'::regconfig,${p.q}) AS query),matches AS(${Prisma.join(branches, ' UNION ALL ')}) SELECT * FROM matches ${cursor ? sql`WHERE rank<${cursor.rank}::real OR (rank=${cursor.rank}::real AND (kind,"resultId")>(${cursor.kind},${cursor.resultId}::uuid))` : empty} ORDER BY rank DESC,kind ASC,"resultId" ASC LIMIT ${p.limit + 1}`,
  );
  const items = rows.slice(0, p.limit),
    last = items.at(-1);
  return {
    items: items.map((r) => ({
      id: r.id,
      resultId: r.resultId,
      kind: r.kind,
      recordType: r.recordType,
      title: r.title,
      excerpt: r.excerpt,
      projectId: r.projectId,
      storyId: r.storyId,
      archived: r.archived,
      href: href(r),
    })),
    nextCursor:
      rows.length > p.limit && last
        ? encodeSearchCursor({ rank: last.rank, kind: last.kind, resultId: last.resultId, hash })
        : null,
  };
}
function href(r: Omit<SearchResult, 'href'>) {
  if (r.kind === 'IDEA') return '/ideas/' + r.id;
  const project = '/projects/' + r.projectId;
  if (r.kind === 'PROJECT') return project;
  if (r.kind === 'STORY') return project + '/stories/' + r.id;
  const story = r.storyId ? '/stories/' + r.storyId : '';
  if (r.kind === 'CANON' || r.kind === 'OVERRIDE') return project + story + '/canon/' + r.id;
  return project + story + '/plot/' + (r.kind === 'SCENE' ? 'scenes/' : 'groups/') + r.id;
}
