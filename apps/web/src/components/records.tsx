'use client';
import { useHydrated } from './use-hydrated';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectRecord, StoryRecord } from '@inkwell/contracts';
import { api, message } from './api-client';

type RecordRow = ProjectRecord | StoryRecord;
type Page = { items: RecordRow[]; nextCursor: string | null };
export function RecordList({ projectId }: { projectId?: string }) {
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const path = projectId ? `/projects/${projectId}/stories` : '/projects';
  useEffect(() => {
    let live = true;
    setPending(true);
    setError('');
    api<Page>(`${path}?archived=${archived}`)
      .then((result) => {
        if (live) setPage(result);
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
  }, [path, archived]);
  return (
    <section className="workspace-card">
      <div className="section-heading">
        <h2>{projectId ? 'Stories in this project' : 'Your projects'}</h2>
        <Link
          className="button button-link"
          href={projectId ? `/projects/${projectId}/stories/new` : '/projects/new'}
        >
          {projectId ? 'New story' : 'New project'}
        </Link>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        Show archived {projectId ? 'stories' : 'projects'}
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {pending ? (
        <p role="status">Loading…</p>
      ) : page.items.length ? (
        <ul className="record-list">
          {page.items.map((row) => (
            <li key={row.id}>
              <div>
                <Link
                  href={
                    projectId ? `/projects/${projectId}/stories/${row.id}` : `/projects/${row.id}`
                  }
                >
                  {row.title}
                </Link>
                {'format' in row && row.format && <p className="field-help">{row.format}</p>}
              </div>
              <span className="field-help">
                {row.archivedAt ? 'Archived' : 'Updated'} {row.updatedAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <p className="empty-title">
            {archived
              ? 'Nothing archived.'
              : projectId
                ? 'Every story needs a beginning.'
                : 'A beginning is waiting.'}
          </p>
          <p>
            {archived
              ? 'Archived records will appear here.'
              : projectId
                ? 'Name a story and choose the format that fits it.'
                : 'Create a project for a world, series, or standalone story.'}
          </p>
        </div>
      )}
      {!pending && page.nextCursor && (
        <button
          className="quiet-button"
          onClick={async () => {
            setPending(true);
            try {
              const more = await api<Page>(
                `${path}?archived=${archived}&cursor=${encodeURIComponent(page.nextCursor ?? '')}`,
              );
              setPage({ items: [...page.items, ...more.items], nextCursor: more.nextCursor });
            } catch (err) {
              setError(message(err));
            } finally {
              setPending(false);
            }
          }}
        >
          Load more
        </button>
      )}
    </section>
  );
}

export function RecordEditor({ projectId, recordId }: { projectId?: string; recordId?: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const story = Boolean(projectId);
  const kind = story ? 'story' : 'project';
  const collection = story ? `/projects/${projectId}/stories` : '/projects';
  const path = recordId ? `${collection}/${recordId}` : collection;
  const [record, setRecord] = useState<RecordRow | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('');
  const [loading, setLoading] = useState(Boolean(recordId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let live = true;
    if (recordId) {
      api<RecordRow>(path)
        .then((row) => {
          if (live) {
            setRecord(row);
            setTitle(row.title);
            setContent('synopsis' in row ? row.synopsis : row.description);
            setFormat('format' in row ? row.format : '');
          }
        })
        .catch((err) => {
          if (live) setError(message(err));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }
    return () => {
      live = false;
    };
  }, [path, recordId]);
  const dirty = record
    ? title !== record.title ||
      content !== ('synopsis' in record ? record.synopsis : record.description) ||
      format !== ('format' in record ? record.format : '')
    : Boolean(title || content || format);
  async function reload() {
    setPending(true);
    try {
      const row = await api<RecordRow>(path);
      setRecord(row);
      setTitle(row.title);
      setContent('synopsis' in row ? row.synopsis : row.description);
      setFormat('format' in row ? row.format : '');
      setError('');
      setSaved('Current version loaded.');
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  }
  if (loading) return <p role="status">Loading {kind}…</p>;
  if (recordId && !record)
    return (
      <section>
        <h1>Unable to open this {kind}.</h1>
        <p role="alert">{error}</p>
        <Link href="/projects">Back to projects</Link>
      </section>
    );
  return (
    <section className="workspace-card editor-panel">
      <p className="eyebrow">
        {record?.archivedAt ? 'Archived' : recordId ? 'Develop' : 'Begin'} / {kind}
      </p>
      <h1>{recordId ? record?.title : `A new ${kind}.`}</h1>
      {story && <Link href={`/projects/${projectId}`}>Back to project</Link>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError('');
          setSaved('');
          try {
            const body = story
              ? { title, synopsis: content, format }
              : { title, description: content };
            const row = await api<RecordRow>(path, {
              method: recordId ? 'PATCH' : 'POST',
              body,
              ...(record ? { version: record.version } : {}),
            });
            if (!recordId) {
              router.push(
                story ? `/projects/${projectId}/stories/${row.id}` : `/projects/${row.id}`,
              );
              return;
            }
            setRecord(row);
            setTitle(row.title);
            setSaved('Saved.');
          } catch (err) {
            setError(message(err));
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Title
          <input
            name="title"
            disabled={!hydrated || pending}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved('');
            }}
            required
            maxLength={120}
          />
        </label>
        {story && (
          <div>
            <label>
              Story format
              <input
                name="format"
                disabled={!hydrated || pending}
                aria-describedby="story-format-help"
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value);
                  setSaved('');
                }}
                maxLength={80}
                placeholder="Novel, film, comic, animation…"
              />
            </label>
            <p id="story-format-help" className="field-help">
              Use any narrative format, or leave this blank.
            </p>
          </div>
        )}
        <label htmlFor="record-content">{story ? 'Synopsis' : 'Description'}</label>
        <textarea
          id="record-content"
          name="content"
          disabled={!hydrated || pending}
          rows={6}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved('');
          }}
          maxLength={10000}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="inline-actions">
          <button className="button" disabled={!hydrated || pending}>
            {pending ? 'Saving…' : recordId ? 'Save changes' : `Create ${kind}`}
          </button>
          <span role="status" className="save-state">
            {dirty ? 'Unsaved changes' : saved || (record ? 'All changes saved' : 'Not saved yet')}
          </span>
        </div>
      </form>
      {recordId && record && (
        <div className="record-actions">
          <button className="quiet-button" disabled={!hydrated || pending} onClick={reload}>
            Discard edits and reload
          </button>
          <button
            className="quiet-button"
            disabled={!hydrated || pending || dirty}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                const row = await api<RecordRow>(path, {
                  method: 'PATCH',
                  version: record.version,
                  body: { archived: !record.archivedAt },
                });
                setRecord(row);
                setSaved(row.archivedAt ? 'Archived.' : 'Restored.');
              } catch (err) {
                setError(message(err));
              } finally {
                setPending(false);
              }
            }}
          >
            {record.archivedAt ? 'Restore' : 'Archive'} {kind}
          </button>
        </div>
      )}
      {!story && record?.archivedAt && (
        <p className="field-help">
          This project and its stories are kept safely. Restore the project before changing its
          stories.
        </p>
      )}
    </section>
  );
}
