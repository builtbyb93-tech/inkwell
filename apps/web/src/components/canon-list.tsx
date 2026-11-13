'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CanonKind, type CanonSummary, type ProjectRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
import { canonPath, bibleUrl, canonLabel, withQuery, type BibleContext } from './canon-path';
import { useHydrated } from './use-hydrated';
type Page<T> = { items: T[]; nextCursor: string | null };
export function BibleProjects() {
  const [data, setData] = useState<Page<ProjectRecord>>({ items: [], nextCursor: null }),
    [error, setError] = useState(''),
    [cursor, setCursor] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    api<Page<ProjectRecord>>('/projects' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''))
      .then((r) => {
        if (live) {
          setData((old) => ({
            items: cursor ? [...old.items, ...r.items] : r.items,
            nextCursor: r.nextCursor,
          }));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [cursor]);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Develop / Story Bible</p>
      <h1>Your worlds, connected.</h1>
      <p>
        Choose a project to develop shared characters, places, lore, events and organizations. Open
        a story’s Bible for its own canon and overrides.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading projects…</p>
      ) : (
        <>
          <ul className="record-list">
            {data.items.map((p) => (
              <li key={p.id}>
                <Link href={bibleUrl({ projectId: p.id })}>{p.title}</Link>
              </li>
            ))}
          </ul>
          {!data.items.length && (
            <p>
              Create a <Link href="/projects/new">project</Link> to start your Story Bible.
            </p>
          )}
          {data.nextCursor && (
            <button className="quiet-button" onClick={() => setCursor(data.nextCursor!)}>
              More projects
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function CanonList({ context: c }: { context: BibleContext }) {
  const ready = useHydrated(),
    [data, setData] = useState<Page<CanonSummary>>({ items: [], nextCursor: null }),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState(''),
    [archived, setArchived] = useState(false),
    [filter, setFilter] = useState(''),
    [cursor, setCursor] = useState(''),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const path = canonPath(c),
    key = JSON.stringify(c);
  useEffect(() => {
    let live = true;
    let url = path;
    const search = new URLSearchParams(filter);
    for (const [k, v] of search) url = withQuery(url, k, v);
    if (cursor) url = withQuery(url, 'cursor', cursor);
    api<Page<CanonSummary>>(url)
      .then((r) => {
        if (live) {
          setData((old) => ({
            items: cursor ? [...old.items, ...r.items] : r.items,
            nextCursor: r.nextCursor,
          }));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [path, key, filter, cursor, refresh]);
  return (
    <div className="stack">
      <section className="workspace-card">
        <p className="eyebrow">{c.storyId ? 'Story-specific' : 'Shared universe'} / Story Bible</p>
        <h1>{c.storyId ? 'This story’s canon.' : 'A world worth keeping.'}</h1>
        <p>
          {c.storyId
            ? 'Shared canon and story-only records live side by side. Overrides affect only this story.'
            : 'Build the canon every story in this project can reuse.'}
        </p>
        <div className="inline-actions">
          <Link className="button" href={bibleUrl(c, 'new')}>
            New {c.storyId ? 'story-only' : 'shared'} record
          </Link>
          <Link
            href={
              c.storyId
                ? `/projects/${c.projectId}/stories/${c.storyId}`
                : `/projects/${c.projectId}`
            }
          >
            Back to {c.storyId ? 'story' : 'project'}
          </Link>
          {c.storyId && <Link href={bibleUrl({ projectId: c.projectId })}>Open project canon</Link>}
        </div>
      </section>
      <section className="workspace-card">
        <h2>Canon records</h2>
        <form
          aria-label="Filter canon"
          className="canon-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const p = new URLSearchParams();
            if (query) p.set('q', query);
            if (kind) p.set('kind', kind);
            if (archived) p.set('archived', 'true');
            setLoading(true);
            setError('');
            setCursor('');
            setFilter(p.toString());
            setRefresh((n) => n + 1);
          }}
        >
          <label>
            Search canon
            <input
              value={query}
              disabled={!ready || loading}
              maxLength={120}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Record type
            <select
              value={kind}
              disabled={!ready || loading}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">All types</option>
              {CanonKind.options.map((k) => (
                <option key={k} value={k}>
                  {canonLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={archived}
              disabled={!ready || loading}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Show archived canon
          </label>
          <button className="button" disabled={!ready || loading}>
            Filter canon
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p role="status">Loading canon…</p>
        ) : (
          <>
            <ul className="record-list canon-list">
              {data.items.map((r) => (
                <li key={r.id}>
                  <div>
                    <Link href={bibleUrl(c, r.id)}>{r.name || 'Unnamed record'}</Link>
                    <p className="field-help">
                      {canonLabel(r.kind)} ·{' '}
                      {r.scope === 'STORY'
                        ? 'Story-only'
                        : r.overridden
                          ? 'Story override'
                          : 'Project canon'}
                      {r.archivedAt ? ' · Shared or local record archived' : ''}
                      {r.conflicts.length ? ' · Review shared changes' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!data.items.length && (
              <p>
                No canon records here yet. Capture a character, place, event, organization or piece
                of lore.
              </p>
            )}
            {data.nextCursor && (
              <button
                className="quiet-button"
                onClick={() => {
                  setLoading(true);
                  setCursor(data.nextCursor!);
                }}
              >
                More canon records
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
