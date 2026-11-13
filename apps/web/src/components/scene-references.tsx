'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  SceneCanonReference,
  SceneIdeaReference,
  CanonSummary,
  IdeaSummary,
  IdeaRecord,
  CanonSceneReference,
} from '@inkwell/contracts';
import { api, message } from './api-client';
import { plotPath, plotUrl, type PlotContext } from './plot-path';
import { canonPath, type BibleContext } from './canon-path';
type Page<T> = { items: T[]; nextCursor: string | null };
type ReferenceWrite = (action: () => Promise<{ sceneVersion?: number }>) => Promise<boolean>;
export function SceneReferences({
  context: c,
  sceneId,
  version,
  revision,
  disabled,
  onWrite,
}: {
  context: PlotContext;
  sceneId: string;
  version: number;
  revision: number;
  disabled: boolean;
  onWrite: ReferenceWrite;
}) {
  const [kind, setKind] = useState<'CHARACTER' | 'LOCATION'>('CHARACTER'),
    [refs, setRefs] = useState<Page<SceneCanonReference>>({ items: [], nextCursor: null }),
    [ideas, setIdeas] = useState<Page<SceneIdeaReference>>({ items: [], nextCursor: null }),
    [targets, setTargets] = useState<Page<CanonSummary>>({ items: [], nextCursor: null }),
    [ideaTargets, setIdeaTargets] = useState<Page<IdeaSummary>>({ items: [], nextCursor: null }),
    [canonId, setCanonId] = useState(''),
    [ideaId, setIdeaId] = useState(''),
    [cursor, setCursor] = useState(''),
    [ideaCursor, setIdeaCursor] = useState(''),
    [targetCursor, setTargetCursor] = useState(''),
    [ideaTargetCursor, setIdeaTargetCursor] = useState(''),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState('');
  const base = plotPath(c, '/scenes/' + sceneId),
    canonBase = `/projects/${c.projectId}/canon?storyId=${c.storyId}&kind=${kind}&limit=50`;
  useEffect(() => {
    let live = true;
    api<Page<SceneCanonReference>>(
      base + '/canon-links?kind=' + kind + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
    )
      .then((r) => {
        if (live)
          setRefs((old) => ({ ...r, items: cursor ? [...old.items, ...r.items] : r.items }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [base, kind, cursor, revision, refresh]);
  useEffect(() => {
    let live = true;
    api<Page<SceneIdeaReference>>(
      base + '/ideas' + (ideaCursor ? '?cursor=' + encodeURIComponent(ideaCursor) : ''),
    )
      .then((r) => {
        if (live)
          setIdeas((old) => ({ ...r, items: ideaCursor ? [...old.items, ...r.items] : r.items }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [base, ideaCursor, revision, refresh]);
  useEffect(() => {
    let live = true;
    api<Page<CanonSummary>>(
      canonBase + (targetCursor ? '&cursor=' + encodeURIComponent(targetCursor) : ''),
    )
      .then((r) => {
        if (live)
          setTargets((old) => ({
            ...r,
            items: targetCursor ? [...old.items, ...r.items] : r.items,
          }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [canonBase, targetCursor, refresh]);
  useEffect(() => {
    let live = true;
    api<Page<IdeaSummary>>(
      '/ideas?limit=50' +
        (ideaTargetCursor ? '&cursor=' + encodeURIComponent(ideaTargetCursor) : ''),
    )
      .then((r) => {
        if (live)
          setIdeaTargets((old) => ({
            ...r,
            items: ideaTargetCursor ? [...old.items, ...r.items] : r.items,
          }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [ideaTargetCursor, refresh]);
  function refreshReferences() {
    setCursor('');
    setIdeaCursor('');
    setRefresh((n) => n + 1);
    setError('');
  }
  return (
    <section className="workspace-card">
      <h2>Scene references</h2>
      <p>
        Characters and locations resolve in this story’s Bible. Idea references keep their original
        source; conversion sources cannot be removed. Save or discard scene edits before changing
        references.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        aria-label="Link scene canon"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await onWrite(() =>
              api<{ sceneVersion: number }>(base + '/canon-links', {
                method: 'POST',
                version,
                body: { kind, canonId },
              }),
            )
          ) {
            setCanonId('');
            refreshReferences();
          }
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            Canon reference type
            <select
              aria-label="Canon reference type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setCanonId('');
                setCursor('');
                setTargetCursor('');
              }}
            >
              <option value="CHARACTER">Character</option>
              <option value="LOCATION">Location</option>
            </select>
          </label>
          <label>
            Canon record
            <select
              aria-label="Canon record"
              value={canonId}
              required
              onChange={(e) => setCanonId(e.target.value)}
            >
              <option value="">Choose a record</option>
              {targets.items
                .filter((r) => !r.archivedAt)
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name || 'Unnamed record'}
                  </option>
                ))}
            </select>
          </label>
          {targets.nextCursor && (
            <button
              type="button"
              className="quiet-button"
              onClick={() => setTargetCursor(targets.nextCursor!)}
            >
              More possible canon records
            </button>
          )}
          <button className="button">Link canon record</button>
        </fieldset>
      </form>
      <ul className="record-list">
        {refs.items.map((r) => (
          <li key={r.id}>
            <div>
              <Link href={`/projects/${c.projectId}/stories/${c.storyId}/canon/${r.canonId}`}>
                {r.name || 'Unnamed record'}
              </Link>
              {r.archived && <span className="field-help"> · Archived canon</span>}
            </div>
            <button
              className="quiet-button"
              disabled={disabled}
              onClick={async () => {
                if (
                  await onWrite(() =>
                    api<{ sceneVersion: number }>(base + '/canon-links', {
                      method: 'DELETE',
                      version,
                      body: { kind: r.kind, canonId: r.canonId },
                    }),
                  )
                )
                  refreshReferences();
              }}
            >
              Remove canon reference
            </button>
          </li>
        ))}
      </ul>
      {!refs.items.length && (
        <p>No {kind === 'CHARACTER' ? 'character' : 'location'} references.</p>
      )}
      {refs.nextCursor && (
        <button
          className="quiet-button"
          disabled={disabled}
          onClick={() => setCursor(refs.nextCursor!)}
        >
          More canon references
        </button>
      )}
      <h3>Idea references</h3>
      <form
        aria-label="Link scene idea"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await onWrite(async () => {
              const source = await api<IdeaRecord>('/ideas/' + ideaId);
              await api('/ideas/' + ideaId + '/links', {
                method: 'POST',
                version: source.version,
                body: { kind: 'SCENE', projectId: c.projectId, storyId: c.storyId, sceneId },
              });
              return {};
            })
          ) {
            setIdeaId('');
            refreshReferences();
          }
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            Source idea
            <select
              aria-label="Source idea"
              value={ideaId}
              required
              onChange={(e) => setIdeaId(e.target.value)}
            >
              <option value="">Choose an idea</option>
              {ideaTargets.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          {ideaTargets.nextCursor && (
            <button
              type="button"
              className="quiet-button"
              onClick={() => setIdeaTargetCursor(ideaTargets.nextCursor!)}
            >
              More possible ideas
            </button>
          )}
          <button className="button">Link idea reference</button>
        </fieldset>
      </form>
      <ul className="record-list">
        {ideas.items.map((r) => (
          <li key={r.id}>
            <div>
              <Link href={'/ideas/' + r.ideaId}>{r.title}</Link>
              {r.archived && <span className="field-help"> · Archived idea</span>}
              {r.converted && <p className="field-help">Conversion source retained</p>}
            </div>
            {!r.converted && (
              <button
                className="quiet-button"
                disabled={disabled}
                onClick={async () => {
                  if (
                    await onWrite(async () => {
                      await api('/ideas/' + r.ideaId + '/links/SCENE/' + r.id, {
                        method: 'DELETE',
                        version: r.ideaVersion,
                      });
                      return {};
                    })
                  )
                    refreshReferences();
                }}
              >
                Remove idea reference
              </button>
            )}
          </li>
        ))}
      </ul>
      {!ideas.items.length && <p>No idea references.</p>}
      {ideas.nextCursor && (
        <button
          className="quiet-button"
          disabled={disabled}
          onClick={() => setIdeaCursor(ideas.nextCursor!)}
        >
          More idea references
        </button>
      )}
      <button className="quiet-button" disabled={disabled} onClick={refreshReferences}>
        Refresh references
      </button>
    </section>
  );
}
export function CanonSceneReferences({
  context: c,
  recordId,
}: {
  context: BibleContext;
  recordId: string;
}) {
  const [data, setData] = useState<Page<CanonSceneReference>>({ items: [], nextCursor: null }),
    [cursor, setCursor] = useState(''),
    [error, setError] = useState('');
  const base = canonPath(c, recordId, '/scene-references');
  useEffect(() => {
    let live = true;
    api<Page<CanonSceneReference>>(
      base +
        (cursor ? (base.includes('?') ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) : ''),
    )
      .then((r) => {
        if (live)
          setData((old) => ({ ...r, items: cursor ? [...old.items, ...r.items] : r.items }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [base, cursor]);
  return (
    <section className="workspace-card">
      <h2>Referenced by scenes</h2>
      {error && <p role="alert">{error}</p>}
      <ul className="record-list">
        {data.items.map((r) => (
          <li key={r.id}>
            <Link
              href={plotUrl({ projectId: c.projectId, storyId: r.storyId }, '/scenes/' + r.sceneId)}
            >
              {r.title}
            </Link>
            <span className="field-help">
              {r.storyTitle}
              {r.archived ? ' · Archived scene or parent' : ''}
            </span>
          </li>
        ))}
      </ul>
      {!data.items.length && !error && <p>No scene references yet.</p>}
      {data.nextCursor && (
        <button className="quiet-button" onClick={() => setCursor(data.nextCursor!)}>
          More scene backlinks
        </button>
      )}
    </section>
  );
}
