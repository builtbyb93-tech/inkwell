'use client';
import { useHydrated } from './use-hydrated';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  plainDocument,
  type IdeaSummary,
  type IdeaRecord,
  type TaxonomyRecord,
} from '@inkwell/contracts';
import { ideaTitle } from '@inkwell/domain';
import { api, message } from './api-client';
import { IdeaTaxonomy } from './idea-taxonomy';
type Page = { items: IdeaSummary[]; nextCursor: string | null };
export function IdeaVault({
  storyId = '',
  sceneId = '',
  initialArchived = false,
}: {
  storyId?: string;
  sceneId?: string;
  initialArchived?: boolean;
}) {
  const hydrated = useHydrated();
  const [capture, setCapture] = useState(''),
    [capturing, setCapturing] = useState(false),
    [captured, setCaptured] = useState<IdeaRecord | null>(null),
    [captureError, setCaptureError] = useState('');
  const [q, setQ] = useState(''),
    [category, setCategory] = useState<TaxonomyRecord | null>(null),
    [tags, setTags] = useState<TaxonomyRecord[]>([]),
    [archived, setArchived] = useState(initialArchived);
  const initial = new URLSearchParams();
  if (initialArchived) initial.set('archived', 'true');
  if (storyId) initial.set('storyId', storyId);
  if (sceneId) initial.set('sceneId', sceneId);
  const [filters, setFilters] = useState(initial.toString()),
    [refresh, setRefresh] = useState(0),
    [page, setPage] = useState<Page>({ items: [], nextCursor: null }),
    [pending, setPending] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setPending(true);
    setError('');
    setPage({ items: [], nextCursor: null });
    api<Page>('/ideas?' + filters)
      .then((p) => {
        if (live) setPage(p);
      })
      .catch((err) => {
        if (live) setError(message(err));
      })
      .finally(() => {
        if (live) setPending(false);
      });
    return () => {
      live = false;
    };
  }, [filters, refresh]);
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Capture / Connect / Return</p>
        <h1>Idea Vault.</h1>
        <p className="intro">A thought, a fragment, a beginning. Give it a place to stay.</p>
      </div>
      <section className="workspace-card">
        <h2>Quick capture</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setCapturing(true);
            setCaptureError('');
            try {
              const row = await api<IdeaRecord>('/ideas', {
                method: 'POST',
                body: { title: ideaTitle(capture), content: plainDocument(capture) },
              });
              setCaptured(row);
              setCapture('');
              setRefresh((n) => n + 1);
            } catch (err) {
              setCaptureError(message(err));
            } finally {
              setCapturing(false);
            }
          }}
        >
          <label htmlFor="quick-idea">Capture an idea</label>
          <textarea
            id="quick-idea"
            rows={3}
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            required
            maxLength={10000}
            disabled={!hydrated || capturing}
            placeholder="What if…"
          />
          <div className="inline-actions">
            <button className="button" disabled={!hydrated || capturing || !capture.trim()}>
              {capturing ? 'Capturing…' : 'Capture idea'}
            </button>
            <Link href="/ideas/new">Write with formatting</Link>
          </div>
          {captureError && (
            <p role="alert" className="form-error">
              {captureError}
            </p>
          )}
          {captured && (
            <p role="status" className="save-state">
              Captured. <Link href={`/ideas/${captured.id}`}>Open {captured.title}</Link>
            </p>
          )}
        </form>
      </section>
      <details className="workspace-card vault-filters">
        <summary>Search & filter ideas</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const params = new URLSearchParams();
            params.set('q', q);
            params.set('archived', String(archived));
            if (category) params.set('categoryId', category.id);
            if (tags.length) params.set('tagIds', tags.map((t) => t.id).join(','));
            const previous = new URLSearchParams(filters);
            for (const name of ['storyId', 'sceneId']) {
              const value = previous.get(name);
              if (value) params.set(name, value);
            }
            const next = params.toString();
            setFilters(next);
            setRefresh((n) => n + 1);
          }}
        >
          <label>
            Search ideas
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={200}
              placeholder="Words or a quoted phrase"
            />
          </label>
          <IdeaTaxonomy
            category={category}
            tags={tags}
            onCategory={setCategory}
            onTags={setTags}
            allowCreate={false}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Show archived ideas
          </label>
          <button className="button" disabled={pending}>
            Search vault
          </button>
        </form>
      </details>
      {(new URLSearchParams(filters).has('storyId') ||
        new URLSearchParams(filters).has('sceneId')) && (
        <div className="inline-actions">
          <span className="field-help">Showing ideas linked to this story or scene.</span>
          <Link href="/ideas">Open full vault</Link>
        </div>
      )}
      <section className="workspace-card">
        <div className="section-heading">
          <h2>
            {new URLSearchParams(filters).get('archived') === 'true'
              ? 'Archived ideas'
              : 'Your ideas'}
          </h2>
          <Link href="/ideas/new">New idea</Link>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {pending && !page.items.length ? (
          <p role="status">Loading ideas…</p>
        ) : page.items.length ? (
          <ul className="idea-list">
            {page.items.map((idea) => (
              <li key={idea.id}>
                <Link className="idea-title" href={`/ideas/${idea.id}`}>
                  {idea.title}
                </Link>
                <p>{idea.preview || 'A beginning, waiting for its next detail.'}</p>
                <div className="idea-labels">
                  {idea.category && <span>{idea.category.name}</span>}
                  {idea.tags.map((t) => (
                    <span key={t.id}>#{t.name}</span>
                  ))}
                  {idea.archivedAt && <span>Archived</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p className="empty-title">No ideas here yet.</p>
            <p>
              {filters
                ? 'Try different filters, or capture a new thought above.'
                : 'Capture the thought you don’t want to lose.'}
            </p>
          </div>
        )}
        {page.nextCursor && (
          <button
            className="quiet-button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const params = new URLSearchParams(filters);
                params.set('cursor', page.nextCursor ?? '');
                const next = await api<Page>('/ideas?' + params);
                setPage({ items: [...page.items, ...next.items], nextCursor: next.nextCursor });
              } catch (err) {
                setError(message(err));
              } finally {
                setPending(false);
              }
            }}
          >
            Load more ideas
          </button>
        )}
      </section>
    </div>
  );
}
