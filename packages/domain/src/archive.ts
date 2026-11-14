import {
  ProjectArchive,
  archiveMaxBytes,
  archiveMaxRecords,
  type ImportPreview,
} from '@inkwell/contracts';
import { validCanonRelationship } from './canon';
import { taxonomyNameKey } from './index';
export class ArchiveError extends Error {}
const invalid = () => {
  throw new ArchiveError('This archive contains invalid or inconsistent records.');
};
export function parseProjectArchive(text: string): ProjectArchive {
  if (new TextEncoder().encode(text).length > archiveMaxBytes)
    throw new ArchiveError('Archives must be 8 MiB or smaller.');
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > 64) invalid();
    } else if (char === '}' || char === ']') depth--;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid();
  }
  if (raw && typeof raw === 'object' && 'version' in raw && raw.version !== 1)
    throw new ArchiveError('Unsupported archive version. No records were imported.');
  const result = ProjectArchive.safeParse(raw);
  if (!result.success) return invalid();
  validateArchiveGraph(result.data);
  return result.data;
}
export function archivePreview(a: ProjectArchive): ImportPreview {
  return {
    title: a.project.title,
    counts: Object.fromEntries(
      Object.entries(a)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, (v as unknown[]).length]),
    ),
    notes: [
      'A separate project and new record IDs will be created.',
      'Matching category and tag names reuse your existing classifications.',
      'Only this project’s Idea Vault links are included. Archived records are preserved.',
      'This format contains structured text only; no attachments or private account data.',
    ],
  };
}
export function validateArchiveGraph(a: ProjectArchive) {
  const lists = Object.values(a).filter(Array.isArray);
  if (1 + lists.reduce((n, v) => n + v.length, 0) > archiveMaxRecords) invalid();
  function map<T extends { id: string }>(rows: T[]) {
    const m = new Map(rows.map((r) => [r.id, r]));
    if (m.size !== rows.length) invalid();
    return m;
  }
  const stories = map(a.stories),
    canon = map(a.canon),
    groups = map(a.groups),
    scenes = map(a.scenes),
    ideas = map(a.ideas),
    cats = map(a.categories),
    tags = map(a.tags);
  for (const rows of [
    a.overrides,
    a.relationships,
    a.sceneCharacters,
    a.sceneLocations,
    a.ideaStoryLinks,
    a.ideaSceneLinks,
    a.conversions,
  ])
    map<{ id: string }>(rows);
  const unique = (values: string[]) => {
    if (new Set(values).size !== values.length) invalid();
  };
  const story = (s: string) => {
    if (!stories.has(s)) invalid();
  };
  const applicable = (c: ProjectArchive['canon'][number] | undefined, s: string | null) => {
    if (!c || (c.scope === 'STORY' && c.storyId !== s)) invalid();
    return c!;
  };
  unique(a.categories.map((t) => taxonomyNameKey(t.name)));
  unique(a.tags.map((t) => taxonomyNameKey(t.name)));
  for (const c of a.canon) {
    if (c.scope === 'STORY') {
      if (!c.storyId) invalid();
      story(c.storyId!);
    } else if (c.storyId !== null) invalid();
  }
  unique(a.overrides.map((o) => o.canonId + o.storyId));
  for (const o of a.overrides) {
    story(o.storyId);
    const c = canon.get(o.canonId);
    if (
      !c ||
      c.scope !== 'SHARED' ||
      o.baseVersion > c.version ||
      (!o.hasName && o.name !== null) ||
      (!o.hasContent && o.content !== null)
    )
      invalid();
  }
  for (const g of a.groups) {
    story(g.storyId);
    if (g.parentId) {
      const p = groups.get(g.parentId);
      if (
        !p ||
        p.id === g.id ||
        p.parentId ||
        p.storyId !== g.storyId ||
        (!g.archivedAt && p.archivedAt)
      )
        invalid();
    }
  }
  unique(a.scenes.map((s) => s.storyId + ':' + s.position));
  for (const s of a.scenes) {
    story(s.storyId);
    if (s.groupId) {
      const g = groups.get(s.groupId);
      if (!g || g.storyId !== s.storyId || (!s.archivedAt && g.archivedAt)) invalid();
    }
    if (s.duplicatedFromId) {
      const p = scenes.get(s.duplicatedFromId);
      if (!p || p.storyId !== s.storyId) invalid();
    }
  }
  orderedScenes(a.scenes);
  unique(a.relationships.map((r) => [r.storyId, r.fromId, r.toId, r.kind].join(':')));
  for (const r of a.relationships) {
    if (r.storyId) story(r.storyId);
    const f = applicable(canon.get(r.fromId), r.storyId),
      t = applicable(canon.get(r.toId), r.storyId);
    if (f.id === t.id || !validCanonRelationship(r.kind, f.kind, t.kind)) invalid();
  }
  for (const [rows, kind] of [
    [a.sceneCharacters, 'CHARACTER'],
    [a.sceneLocations, 'LOCATION'],
  ] as const) {
    unique(rows.map((r) => r.sceneId + r.canonId));
    for (const r of rows) {
      const s = scenes.get(r.sceneId),
        c = applicable(canon.get(r.canonId), r.storyId);
      if (!s || s.storyId !== r.storyId || c.kind !== kind) invalid();
    }
  }
  for (const i of a.ideas) {
    if (i.categoryId && !cats.has(i.categoryId)) invalid();
    unique(i.tagIds);
    if (i.tagIds.some((t) => !tags.has(t))) invalid();
  }
  unique(a.ideaStoryLinks.map((l) => l.ideaId + l.storyId));
  unique(a.ideaSceneLinks.map((l) => l.ideaId + l.sceneId));
  for (const l of a.ideaStoryLinks) {
    if (!ideas.has(l.ideaId)) invalid();
    story(l.storyId);
  }
  for (const l of a.ideaSceneLinks) {
    const s = scenes.get(l.sceneId);
    if (!ideas.has(l.ideaId) || !s || s.storyId !== l.storyId) invalid();
  }
  for (const c of a.conversions) {
    const i = ideas.get(c.ideaId);
    if (!i || c.sourceVersion > i.version) invalid();
    if (c.kind === 'STORY') {
      if (!c.targetStoryId || c.targetCharacterId || c.targetSceneId || c.parentStoryId) invalid();
      story(c.targetStoryId!);
    } else if (c.kind === 'CHARACTER') {
      const t = canon.get(c.targetCharacterId ?? '');
      if (
        !t ||
        t.kind !== 'CHARACTER' ||
        t.scope !== 'SHARED' ||
        c.targetStoryId ||
        c.targetSceneId ||
        c.parentStoryId
      )
        invalid();
    } else {
      const t = scenes.get(c.targetSceneId ?? '');
      if (!t || t.storyId !== c.parentStoryId || c.targetStoryId || c.targetCharacterId) invalid();
    }
  }
}
export function orderedScenes(rows: ProjectArchive['scenes']) {
  const byId = new Map(rows.map((r) => [r.id, r])),
    children = new Map<string, ProjectArchive['scenes']>(),
    queue = rows.filter((r) => !r.duplicatedFromId),
    out: ProjectArchive['scenes'] = [];
  for (const r of rows)
    if (r.duplicatedFromId) {
      if (!byId.has(r.duplicatedFromId)) invalid();
      const siblings = children.get(r.duplicatedFromId) ?? [];
      siblings.push(r);
      children.set(r.duplicatedFromId, siblings);
    }
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i]!;
    out.push(r);
    queue.push(...(children.get(r.id) ?? []));
  }
  if (out.length !== rows.length) invalid();
  return out;
}
