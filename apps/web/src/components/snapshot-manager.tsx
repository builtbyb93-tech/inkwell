'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import type {
  SnapshotOption,
  SnapshotPreview,
  SnapshotSummary,
  ShareLinkRecord,
  ProjectRecord,
} from '@inkwell/contracts';
import { api, message } from './api-client';
import { ScopeSelect } from './workspace-search';
import { SnapshotDocumentView } from './snapshot-document';
import { useHydrated } from './use-hydrated';
type Page<T> = { items: T[]; nextCursor: string | null };
const kinds = [
  ['STORY', 'Story details'],
  ['IDEA', 'Source ideas'],
  ['CANON', 'Story Bible'],
  ['SCENE', 'Scenes'],
  ['GROUP', 'Plot groups'],
];
export function SnapshotManager({
  projectId,
  initialStoryId = '',
}: {
  projectId: string;
  initialStoryId?: string;
}) {
  const ready = useHydrated(),
    [project, setProject] = useState<ProjectRecord | null>(null),
    [storyId, setStoryId] = useState(initialStoryId),
    [kind, setKind] = useState('STORY'),
    [archive, setArchive] = useState(false),
    [cursor, setCursor] = useState(''),
    [options, setOptions] = useState<Page<SnapshotOption>>({ items: [], nextCursor: null }),
    [selected, setSelected] = useState<SnapshotOption[]>([]),
    [includeProject, setIncludeProject] = useState(false),
    [relationships, setRelationships] = useState(false),
    [title, setTitle] = useState(''),
    [preview, setPreview] = useState<SnapshotPreview | null>(null),
    [snapshots, setSnapshots] = useState<Page<SnapshotSummary>>({ items: [], nextCursor: null }),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const path = '/projects/' + projectId + '/snapshots';
  useEffect(() => {
    let live = true;
    api<ProjectRecord>('/projects/' + projectId)
      .then((r) => {
        if (live) setProject(r);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [projectId]);
  useEffect(() => {
    let live = true;
    api<Page<SnapshotSummary>>(path)
      .then((r) => {
        if (live) setSnapshots(r);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [path, revision]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const p = new URLSearchParams({
      kind,
      archive: archive ? 'archived' : 'active',
      ...(storyId ? { storyId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    api<Page<SnapshotOption>>(path + '/options?' + p)
      .then((r) => {
        if (live)
          setOptions((old) => ({ ...r, items: cursor ? [...old.items, ...r.items] : r.items }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, kind, storyId, archive, cursor]);
  const count = selected.length + Number(includeProject);
  return (
    <div className="stack">
      <section className="workspace-card">
        <p className="eyebrow">Share a finished thread</p>
        <h1>Read-only snapshots.</h1>
        <Link href={'/projects/' + projectId}>Back to {project?.title ?? 'project'}</Link>
        <p>
          Choose exactly what to copy. Preview the frozen copy before creating a link. Nothing is
          shared automatically.
        </p>
        <p className="field-help">
          Copies include selected names, notes and scene statuses. Source history, revisions, tags
          and unselected references stay private. There are no attachments in this text format.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError('');
            try {
              const ids = (type: string) =>
                selected.filter((r) => r.kind === type).map((r) => r.id);
              const result = await api<SnapshotPreview>(path, {
                method: 'POST',
                body: {
                  title,
                  ...(storyId ? { storyId } : {}),
                  selection: {
                    project: includeProject,
                    storyIds: ids('STORY'),
                    ideaIds: ids('IDEA'),
                    canonIds: ids('CANON'),
                    sceneIds: ids('SCENE'),
                    groupIds: ids('GROUP'),
                    relationships,
                  },
                },
              });
              setPreview(result);
              setRevision((n) => n + 1);
            } catch (e) {
              setError(message(e));
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset disabled={!ready || pending}>
            <label>
              Snapshot title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <ScopeSelect
              label="Story context"
              allLabel="Shared project canon"
              projectId={projectId}
              value={storyId}
              archived
              onChange={(v) => {
                setStoryId(v);
                setSelected([]);
                setCursor('');
              }}
            />
            <p className="field-help">
              Choose a story to copy its effective canon. Shared project canon allows selection
              across the project. Changing context clears the current selection.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeProject}
                onChange={(e) => setIncludeProject(e.target.checked)}
              />
              Include project title and description
            </label>
            <div className="filter-grid">
              <label>
                Content to select
                <select
                  aria-label="Content to select"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setCursor('');
                  }}
                >
                  {kinds.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={archive}
                  onChange={(e) => {
                    setArchive(e.target.checked);
                    setCursor('');
                  }}
                />
                Show archived content
              </label>
            </div>
            {loading ? (
              <p role="status">Loading choices…</p>
            ) : (
              <>
                <ul className="snapshot-choices">
                  {options.items.map((row) => (
                    <li key={row.kind + row.id}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selected.some((r) => r.kind === row.kind && r.id === row.id)}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, row]
                                : old.filter((r) => r.kind !== row.kind || r.id !== row.id),
                            )
                          }
                        />
                        {row.title || 'Name explicitly cleared'}
                        {row.archived ? ' (archived)' : ''}
                      </label>
                    </li>
                  ))}
                </ul>
                {!options.items.length && <p>No matching content in this context.</p>}
                {options.nextCursor && (
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => setCursor(options.nextCursor!)}
                  >
                    More choices
                  </button>
                )}
              </>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={relationships}
                onChange={(e) => setRelationships(e.target.checked)}
              />
              Include active connections only between selected records
            </label>
            <p role="status">{count} selected. Up to 1,000 records and 8 MiB.</p>
            {selected.length > 0 && (
              <details>
                <summary>Review selection</summary>
                <ul>
                  {selected.map((r) => (
                    <li key={r.kind + r.id}>
                      {r.title || 'Name explicitly cleared'}{' '}
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() =>
                          setSelected((old) =>
                            old.filter((v) => v.kind !== r.kind || v.id !== r.id),
                          )
                        }
                        aria-label={'Remove ' + (r.title || 'unnamed record')}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <button
              className="button"
              disabled={!ready || pending || count === 0 || count > 1000 || !title.trim()}
            >
              {pending ? 'Creating private copy…' : 'Create private snapshot and preview'}
            </button>
          </fieldset>
        </form>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
      {preview && (
        <section className="workspace-card">
          <p className="eyebrow">Private preview / Exactly what recipients will see</p>
          <SnapshotDocumentView document={preview.document} preview />
          <SnapshotLinks
            key={preview.snapshot.id}
            projectId={projectId}
            snapshot={preview.snapshot}
          />
        </section>
      )}
      <section className="workspace-card">
        <h2>Your frozen copies</h2>
        <ul className="record-list">
          {snapshots.items.map((r) => (
            <li key={r.id}>
              <span>
                {r.title} · {r.recordCount} records
              </span>
              <button
                className="quiet-button"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError('');
                  try {
                    setPreview(await api<SnapshotPreview>(path + '/' + r.id));
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Preview {r.title}
              </button>
            </li>
          ))}
        </ul>
        {!snapshots.items.length && <p>No snapshots yet.</p>}
        {snapshots.nextCursor && (
          <button
            className="quiet-button"
            onClick={async () => {
              try {
                const more = await api<Page<SnapshotSummary>>(
                  path + '?cursor=' + encodeURIComponent(snapshots.nextCursor!),
                );
                setSnapshots((old) => ({ ...more, items: [...old.items, ...more.items] }));
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            More snapshots
          </button>
        )}
      </section>
    </div>
  );
}
function SnapshotLinks({ projectId, snapshot }: { projectId: string; snapshot: SnapshotSummary }) {
  const ready = useHydrated(),
    [expiry, setExpiry] = useState(''),
    [downloads, setDownloads] = useState(false),
    [url, setUrl] = useState(''),
    [page, setPage] = useState<Page<ShareLinkRecord>>({ items: [], nextCursor: null }),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    input = useRef<HTMLInputElement>(null);
  const path = '/projects/' + projectId + '/snapshots/' + snapshot.id + '/links';
  useEffect(() => {
    let live = true;
    api<Page<ShareLinkRecord>>(path)
      .then((r) => {
        if (live) setPage(r);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [path]);
  return (
    <section className="snapshot-links">
      <h3>Share this copy</h3>
      <p>
        Choose an expiry time and download permission. Changes need a new link. Revocation stops
        future requests; it cannot recall content someone already copied.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError('');
          setStatus('');
          try {
            const result = await api<{ link: ShareLinkRecord; token: string }>(path, {
              method: 'POST',
              body: { expiresAt: new Date(expiry).toISOString(), allowDownload: downloads },
            });
            setPage((old) => ({ ...old, items: [result.link, ...old.items] }));
            setUrl(window.location.origin + '/share#token=' + result.token);
            setStatus('Link created. Copy it now; it is shown only here.');
          } catch (e) {
            setError(message(e));
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={!ready || pending}>
          <label>
            Link expiry (your local time)
            <input
              type="datetime-local"
              value={expiry}
              required
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={downloads}
              onChange={(e) => setDownloads(e.target.checked)}
            />
            Allow JSON download
          </label>
          <button className="button" disabled={!ready || pending || !expiry}>
            Create read-only link
          </button>
        </fieldset>
      </form>
      {url && (
        <div className="recovery-choice">
          <label>
            Share link
            <input ref={input} value={url} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="quiet-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setStatus('Share link copied.');
              } catch {
                input.current?.focus();
                input.current?.select();
                setStatus('Select and copy the share link above.');
              }
            }}
          >
            Copy share link
          </button>
        </div>
      )}
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      <ul className="record-list">
        {page.items.map((r) => (
          <li key={r.id}>
            <div>
              <p>Created {new Date(r.createdAt).toLocaleString()}</p>
              <p className="field-help">
                Expires {new Date(r.expiresAt).toLocaleString()} ·{' '}
                {r.allowDownload ? 'Downloads allowed' : 'View only'}
                {r.revokedAt ? ' · Revoked' : ''}
              </p>
            </div>
            <button
              className="quiet-button"
              disabled={!ready || pending || Boolean(r.revokedAt)}
              onClick={async () => {
                setPending(true);
                setError('');
                try {
                  const result = await api<ShareLinkRecord>(path + '/' + r.id, {
                    method: 'DELETE',
                    version: r.version,
                  });
                  setPage((old) => ({
                    ...old,
                    items: old.items.map((v) => (v.id === r.id ? result : v)),
                  }));
                  setStatus('Share link revoked.');
                } catch (e) {
                  setError(message(e));
                } finally {
                  setPending(false);
                }
              }}
            >
              Revoke link
            </button>
          </li>
        ))}
      </ul>
      {page.nextCursor && (
        <button
          className="quiet-button"
          onClick={async () => {
            try {
              const more = await api<Page<ShareLinkRecord>>(
                path + '?cursor=' + encodeURIComponent(page.nextCursor!),
              );
              setPage((old) => ({ ...more, items: [...old.items, ...more.items] }));
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          More share links
        </button>
      )}
    </section>
  );
}
