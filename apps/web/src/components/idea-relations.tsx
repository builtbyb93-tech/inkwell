'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type {
  ProjectRecord,
  StoryRecord,
  IdeaLinkRecord,
  IdeaConversionRecord,
  ConversionResult,
} from '@inkwell/contracts';
import { api, message } from './api-client';
type Page<T> = { items: T[]; nextCursor: string | null };
type SceneOption = { id: string; title: string; position: number };
const empty = <T,>(): Page<T> => ({ items: [], nextCursor: null });
export function conversionHref(c: IdeaConversionRecord) {
  if (c.kind === 'STORY') return `/projects/${c.projectId}/stories/${c.targetStoryId}`;
  if (c.kind === 'CHARACTER') return `/projects/${c.projectId}/characters/${c.targetCharacterId}`;
  return `/projects/${c.projectId}/stories/${c.parentStoryId}/scenes/${c.targetSceneId}`;
}
export function IdeaRelations({
  ideaId,
  version,
  disabled,
  pending,
  onBusy,
  onVersion,
}: {
  ideaId: string;
  version: number;
  disabled: boolean;
  pending: boolean;
  onBusy: (busy: boolean) => void;
  onVersion: (version: number) => void;
}) {
  const prefix = useId();
  const [projects, setProjects] = useState<Page<ProjectRecord>>(empty),
    [stories, setStories] = useState<Page<StoryRecord>>(empty),
    [scenes, setScenes] = useState<Page<SceneOption>>(empty);
  const [projectId, setProjectId] = useState(''),
    [storyId, setStoryId] = useState(''),
    [sceneId, setSceneId] = useState('');
  const [linkKind, setLinkKind] = useState<'STORY' | 'SCENE'>('STORY'),
    [conversionKind, setConversionKind] = useState<'STORY' | 'CHARACTER' | 'SCENE'>('STORY');
  const [storyLinks, setStoryLinks] = useState<Page<IdeaLinkRecord>>(empty),
    [sceneLinks, setSceneLinks] = useState<Page<IdeaLinkRecord>>(empty),
    [conversions, setConversions] = useState<Page<IdeaConversionRecord>>(empty);
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const retry = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    let live = true;
    api<Page<ProjectRecord>>('/projects?limit=50')
      .then((p) => {
        if (live) setProjects(p);
      })
      .catch((err) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    setStoryId('');
    setSceneId('');
    setStories(empty());
    setScenes(empty());
    if (projectId)
      api<Page<StoryRecord>>(`/projects/${projectId}/stories?limit=50`)
        .then((p) => {
          if (live) setStories(p);
        })
        .catch((err) => {
          if (live) setError(message(err));
        });
    return () => {
      live = false;
    };
  }, [projectId]);
  useEffect(() => {
    let live = true;
    setSceneId('');
    setScenes(empty());
    if (projectId && storyId)
      api<Page<SceneOption>>(`/projects/${projectId}/stories/${storyId}/scenes?limit=50`)
        .then((p) => {
          if (live) setScenes(p);
        })
        .catch((err) => {
          if (live) setError(message(err));
        });
    return () => {
      live = false;
    };
  }, [projectId, storyId]);
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Page<IdeaLinkRecord>>(`/ideas/${ideaId}/links?kind=STORY`),
      api<Page<IdeaLinkRecord>>(`/ideas/${ideaId}/links?kind=SCENE`),
      api<Page<IdeaConversionRecord>>(`/ideas/${ideaId}/conversions`),
    ])
      .then(([s, c, r]) => {
        if (live) {
          setStoryLinks(s);
          setSceneLinks(c);
          setConversions(r);
        }
      })
      .catch((err) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, [ideaId, refresh]);
  async function mutate(action: () => Promise<{ ideaVersion: number }>, success: string) {
    onBusy(true);
    setError('');
    setSaved('');
    try {
      const result = await action();
      onVersion(result.ideaVersion);
      setRefresh((n) => n + 1);
      setSaved(success);
    } catch (err) {
      setError(message(err));
    } finally {
      onBusy(false);
    }
  }
  async function moreOptions(kind: 'projects' | 'stories' | 'scenes') {
    const page = kind === 'projects' ? projects : kind === 'stories' ? stories : scenes;
    const base =
      kind === 'projects'
        ? '/projects'
        : kind === 'stories'
          ? `/projects/${projectId}/stories`
          : `/projects/${projectId}/stories/${storyId}/scenes`;
    if (!page.nextCursor) return;
    try {
      if (kind === 'projects') {
        const next = await api<Page<ProjectRecord>>(
          base + '?limit=50&cursor=' + encodeURIComponent(page.nextCursor),
        );
        setProjects({ items: [...projects.items, ...next.items], nextCursor: next.nextCursor });
      } else if (kind === 'stories') {
        const next = await api<Page<StoryRecord>>(
          base + '?limit=50&cursor=' + encodeURIComponent(page.nextCursor),
        );
        setStories({ items: [...stories.items, ...next.items], nextCursor: next.nextCursor });
      } else {
        const next = await api<Page<SceneOption>>(
          base + '?limit=50&cursor=' + encodeURIComponent(page.nextCursor),
        );
        setScenes({ items: [...scenes.items, ...next.items], nextCursor: next.nextCursor });
      }
    } catch (err) {
      setError(message(err));
    }
  }
  async function moreLinks(kind: 'STORY' | 'SCENE') {
    const page = kind === 'STORY' ? storyLinks : sceneLinks;
    if (!page.nextCursor) return;
    try {
      const next = await api<Page<IdeaLinkRecord>>(
        `/ideas/${ideaId}/links?kind=${kind}&cursor=${encodeURIComponent(page.nextCursor)}`,
      );
      const merged = { items: [...page.items, ...next.items], nextCursor: next.nextCursor };
      if (kind === 'STORY') setStoryLinks(merged);
      else setSceneLinks(merged);
    } catch (err) {
      setError(message(err));
    }
  }
  const blocked = disabled || pending;
  return (
    <section className="workspace-card">
      <h2>Connect this idea</h2>
      <p>
        Link an existing story or scene, or develop this idea into a new record. Your original stays
        here.
      </p>
      {disabled && (
        <p className="field-help">Save or restore this idea before linking or converting.</p>
      )}
      <fieldset disabled={blocked} className="target-picker">
        <legend>Destination</legend>
        <label htmlFor={prefix + 'project'}>Target project</label>
        <select
          id={prefix + 'project'}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Choose a project</option>
          {projects.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {projects.nextCursor && (
          <button type="button" className="quiet-button" onClick={() => moreOptions('projects')}>
            Load more projects
          </button>
        )}
        <label htmlFor={prefix + 'story'}>Target story</label>
        <select
          id={prefix + 'story'}
          value={storyId}
          onChange={(e) => setStoryId(e.target.value)}
          disabled={!projectId}
        >
          <option value="">Choose a story</option>
          {stories.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {stories.nextCursor && (
          <button type="button" className="quiet-button" onClick={() => moreOptions('stories')}>
            Load more stories
          </button>
        )}
        <label htmlFor={prefix + 'scene'}>Target scene</label>
        <select
          id={prefix + 'scene'}
          value={sceneId}
          onChange={(e) => setSceneId(e.target.value)}
          disabled={!storyId}
        >
          <option value="">Choose an existing scene</option>
          {scenes.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.position + 1}. {s.title}
            </option>
          ))}
        </select>
        {scenes.nextCursor && (
          <button type="button" className="quiet-button" onClick={() => moreOptions('scenes')}>
            Load more scenes
          </button>
        )}
        <div className="relation-actions">
          <label htmlFor={prefix + 'link'}>Link an existing</label>
          <select
            id={prefix + 'link'}
            value={linkKind}
            onChange={(e) => setLinkKind(e.target.value as 'STORY' | 'SCENE')}
          >
            <option value="STORY">Story</option>
            <option value="SCENE">Scene</option>
          </select>
          <button
            type="button"
            className="quiet-button"
            disabled={!projectId || !storyId || (linkKind === 'SCENE' && !sceneId)}
            onClick={() =>
              mutate(
                () =>
                  api(`/ideas/${ideaId}/links`, {
                    method: 'POST',
                    version,
                    body:
                      linkKind === 'STORY'
                        ? { kind: linkKind, projectId, storyId }
                        : { kind: linkKind, projectId, storyId, sceneId },
                  }),
                'Reference linked.',
              )
            }
          >
            Link reference
          </button>
        </div>
        <div className="relation-actions">
          <label htmlFor={prefix + 'conversion'}>Create from this idea</label>
          <select
            id={prefix + 'conversion'}
            value={conversionKind}
            onChange={(e) => setConversionKind(e.target.value as typeof conversionKind)}
          >
            <option value="STORY">New story</option>
            <option value="CHARACTER">Character shared with the project</option>
            <option value="SCENE">New scene in the selected story</option>
          </select>
          <button
            type="button"
            className="button"
            disabled={!projectId || (conversionKind === 'SCENE' && !storyId)}
            onClick={() =>
              mutate(async () => {
                const body =
                  conversionKind === 'SCENE'
                    ? { kind: conversionKind, projectId, storyId }
                    : { kind: conversionKind, projectId };
                const signature = JSON.stringify({ body, version });
                if (retry.current?.signature !== signature)
                  retry.current = { signature, key: crypto.randomUUID() };
                const result = await api<ConversionResult>(`/ideas/${ideaId}/conversions`, {
                  method: 'POST',
                  version,
                  requestKey: retry.current.key,
                  body,
                });
                retry.current = null;
                return result;
              }, 'Record created. The source idea is preserved.')
            }
          >
            Create record
          </button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="save-state">
          {saved}
        </p>
      )}
      <div className="related-records">
        <h3>Story references</h3>
        {storyLinks.items.length ? (
          <ul>
            {storyLinks.items.map((link) => (
              <li key={link.id}>
                <Link href={`/projects/${link.projectId}/stories/${link.storyId}`}>
                  {link.title}
                </Link>
                {link.archived && <span> · Archived</span>}
                {link.converted ? (
                  <span className="field-help"> · Created from this idea</span>
                ) : (
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={blocked}
                    onClick={() =>
                      mutate(
                        () =>
                          api(`/ideas/${ideaId}/links/STORY/${link.id}`, {
                            method: 'DELETE',
                            version,
                          }),
                        'Reference removed.',
                      )
                    }
                  >
                    Remove story reference
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-help">No story references yet.</p>
        )}
        {storyLinks.nextCursor && (
          <button className="quiet-button" onClick={() => moreLinks('STORY')}>
            Load more story references
          </button>
        )}
        <h3>Scene references</h3>
        {sceneLinks.items.length ? (
          <ul>
            {sceneLinks.items.map((link) => (
              <li key={link.id}>
                <Link
                  href={`/projects/${link.projectId}/stories/${link.storyId}/scenes/${link.sceneId}`}
                >
                  {link.title}
                </Link>
                {link.archived && <span> · Archived</span>}
                {link.converted ? (
                  <span className="field-help"> · Created from this idea</span>
                ) : (
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={blocked}
                    onClick={() =>
                      mutate(
                        () =>
                          api(`/ideas/${ideaId}/links/SCENE/${link.id}`, {
                            method: 'DELETE',
                            version,
                          }),
                        'Reference removed.',
                      )
                    }
                  >
                    Remove scene reference
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-help">No scene references yet.</p>
        )}
        {sceneLinks.nextCursor && (
          <button className="quiet-button" onClick={() => moreLinks('SCENE')}>
            Load more scene references
          </button>
        )}
        <h3>Created from this idea</h3>
        {conversions.items.length ? (
          <ul>
            {conversions.items.map((c) => (
              <li key={c.id}>
                <Link href={conversionHref(c)}>
                  {c.kind === 'STORY' ? 'Story' : c.kind === 'SCENE' ? 'Scene' : 'Character'}:{' '}
                  {c.titleSnapshot}
                </Link>
                <span className="field-help"> · Source version {c.sourceVersion}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-help">
            Conversion keeps a copy of the source and never removes the idea.
          </p>
        )}
        {conversions.nextCursor && (
          <button
            className="quiet-button"
            onClick={async () => {
              try {
                const next = await api<Page<IdeaConversionRecord>>(
                  `/ideas/${ideaId}/conversions?cursor=${encodeURIComponent(conversions.nextCursor ?? '')}`,
                );
                setConversions({
                  items: [...conversions.items, ...next.items],
                  nextCursor: next.nextCursor,
                });
              } catch (err) {
                setError(message(err));
              }
            }}
          >
            Load more created records
          </button>
        )}
      </div>
    </section>
  );
}
