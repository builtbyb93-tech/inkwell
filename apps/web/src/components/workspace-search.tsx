'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  SearchKind,
  CanonKind,
  type SearchPage,
  type ProjectRecord,
  type StoryRecord,
} from '@inkwell/contracts';
import { api, message } from './api-client';
export function WorkspaceSearch() {
  const [q, setQ] = useState(''),
    [kind, setKind] = useState(''),
    [canonKind, setCanonKind] = useState(''),
    [archive, setArchive] = useState('active'),
    [projectId, setProjectId] = useState(''),
    [storyId, setStoryId] = useState(''),
    [page, setPage] = useState<SearchPage | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [applied, setApplied] = useState('');
  async function search(cursor?: string) {
    setPending(true);
    setError('');
    try {
      const params = cursor
        ? new URLSearchParams(applied)
        : new URLSearchParams({
            q,
            archive,
            ...(kind ? { kinds: kind } : {}),
            ...(canonKind ? { canonKind } : {}),
            ...(projectId ? { projectId } : {}),
            ...(storyId ? { storyId } : {}),
          });
      if (cursor) params.set('cursor', cursor);
      const result = await api<SearchPage>('/search?' + params);
      setPage((old) =>
        cursor ? { ...result, items: [...(old?.items ?? []), ...result.items] } : result,
      );
      if (!cursor) setApplied(params.toString());
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="workspace-card">
      <p className="eyebrow">Find a thread</p>
      <h1>Search your workspace.</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Search words
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <div className="filter-grid">
          <label>
            Record type
            <select aria-label="Record type" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Every type</option>
              {SearchKind.options.map((k) => (
                <option key={k} value={k}>
                  {k.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Canon type
            <select
              aria-label="Canon type"
              value={canonKind}
              onChange={(e) => setCanonKind(e.target.value)}
            >
              <option value="">Any canon type</option>
              {CanonKind.options.map((k) => (
                <option key={k} value={k}>
                  {k.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Archive status
            <select
              aria-label="Archive status"
              value={archive}
              onChange={(e) => setArchive(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">Active and archived</option>
            </select>
          </label>
        </div>
        <div className="filter-grid">
          <ScopeSelect
            label="Project"
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setStoryId('');
            }}
            archived={archive !== 'active'}
          />
          {projectId && (
            <ScopeSelect
              key={projectId + archive}
              label="Story"
              projectId={projectId}
              value={storyId}
              onChange={setStoryId}
              archived={archive !== 'active'}
            />
          )}
        </div>
        <button className="button" disabled={pending}>
          {pending ? 'Searching…' : 'Search workspace'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {page && (
        <>
          <p role="status">
            {page.items.length ? `${page.items.length} results shown` : 'No matching records.'}
          </p>
          <ul className="record-list">
            {page.items.map((r) => (
              <li key={r.kind + r.resultId}>
                <div>
                  <span className="eyebrow">
                    {r.kind.toLowerCase()}
                    {r.archived ? ' · Archived' : ''}
                  </span>
                  <h2>
                    <Link href={r.href}>{r.title || 'Name explicitly cleared'}</Link>
                  </h2>
                  <p>{r.excerpt}</p>
                </div>
              </li>
            ))}
          </ul>
          {page.nextCursor && (
            <button
              className="quiet-button"
              disabled={pending}
              onClick={() => void search(page.nextCursor!)}
            >
              More search results
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ScopeSelect({
  label,
  projectId,
  value,
  onChange,
  archived,
}: {
  label: string;
  projectId?: string;
  value: string;
  onChange: (v: string) => void;
  archived: boolean;
}) {
  type Row = ProjectRecord | StoryRecord;
  type Page = { items: Row[]; nextCursor: string | null };
  const [rows, setRows] = useState<Row[]>([]),
    [next, setNext] = useState<(string | null)[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const path = projectId ? '/projects/' + projectId + '/stories' : '/projects';
  useEffect(() => {
    let live = true;
    setBusy(true);
    Promise.all(
      (archived ? [false, true] : [false]).map((flag) => api<Page>(path + '?archived=' + flag)),
    )
      .then((pages) => {
        if (live) {
          setRows(pages.flatMap((p) => p.items));
          setNext(pages.map((p) => p.nextCursor));
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [path, archived]);
  return (
    <div>
      <label>
        {label}
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
        >
          <option value="">Every {label.toLowerCase()}</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
              {r.archivedAt ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      {next.some(Boolean) && (
        <button
          type="button"
          className="quiet-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const pages = await Promise.all(
                next.map((cursor, i) =>
                  cursor
                    ? api<Page>(
                        path + '?archived=' + Boolean(i) + '&cursor=' + encodeURIComponent(cursor),
                      )
                    : Promise.resolve(null),
                ),
              );
              setRows((old) => [...old, ...pages.flatMap((p) => p?.items ?? [])]);
              setNext(pages.map((p) => p?.nextCursor ?? null));
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          More {label.toLowerCase()} options
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
