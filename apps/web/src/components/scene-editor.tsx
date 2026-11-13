'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SceneStatus,
  plainDocument,
  type RichDocument,
  type SceneRecord,
  type PlotGroupRecord,
} from '@inkwell/contracts';
import { RichTextEditor } from '@inkwell/editor/react';
import { RichTextView } from '@inkwell/editor/render';
import { api, message } from './api-client';
import { plotPath, plotUrl, plotLabel, type PlotContext } from './plot-path';
import { useHydrated } from './use-hydrated';
import { SceneReferences } from './scene-references';
export function SceneEditor({ context: c, sceneId }: { context: PlotContext; sceneId?: string }) {
  const ready = useHydrated(),
    router = useRouter(),
    [row, setRow] = useState<SceneRecord | null>(null),
    [title, setTitle] = useState(''),
    [content, setContent] = useState<RichDocument>(plainDocument('')),
    [status, setStatus] = useState<SceneStatus>('PLANNED'),
    [groupId, setGroupId] = useState(''),
    [groups, setGroups] = useState<{ items: PlotGroupRecord[]; nextCursor: string | null }>({
      items: [],
      nextCursor: null,
    }),
    [groupCursor, setGroupCursor] = useState(''),
    [loading, setLoading] = useState(Boolean(sceneId)),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [editorKey, setEditorKey] = useState(0),
    [refsRevision, setRefsRevision] = useState(0);
  const path = plotPath(c, '/scenes' + (sceneId ? '/' + sceneId : '')),
    groupsPath = plotPath(c, '/groups');
  function accept(r: SceneRecord) {
    setRow(r);
    setTitle(r.title);
    setContent(r.content);
    setStatus(r.status);
    setGroupId(r.groupId ?? '');
    setEditorKey((n) => n + 1);
  }
  useEffect(() => {
    let live = true;
    if (sceneId)
      api<SceneRecord>(path)
        .then((r) => {
          if (live) {
            setRow(r);
            setTitle(r.title);
            setContent(r.content);
            setStatus(r.status);
            setGroupId(r.groupId ?? '');
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
  }, [path, sceneId]);
  useEffect(() => {
    let live = true;
    if (!sceneId)
      api<{ items: PlotGroupRecord[]; nextCursor: string | null }>(
        groupsPath +
          '?limit=50' +
          (groupCursor ? '&cursor=' + encodeURIComponent(groupCursor) : ''),
      )
        .then((r) => {
          if (live)
            setGroups((old) => ({
              ...r,
              items: groupCursor ? [...old.items, ...r.items] : r.items,
            }));
        })
        .catch((e) => {
          if (live) setError(message(e));
        });
    return () => {
      live = false;
    };
  }, [groupsPath, groupCursor, sceneId]);
  const dirty = row
    ? title !== row.title ||
      status !== row.status ||
      JSON.stringify(content) !== JSON.stringify(row.content)
    : Boolean(title) ||
      JSON.stringify(content) !== JSON.stringify(plainDocument('')) ||
      status !== 'PLANNED' ||
      Boolean(groupId);
  async function save(body: unknown) {
    setPending(true);
    setError('');
    let navigating = false;
    try {
      const r = await api<SceneRecord>(path, {
        method: sceneId ? 'PATCH' : 'POST',
        body,
        ...(row ? { version: row.version } : {}),
      });
      if (!sceneId) {
        navigating = true;
        router.push(plotUrl(c, '/scenes/' + r.id));
        return;
      }
      accept(r);
      setSaved('Scene saved.');
    } catch (e) {
      setError(message(e));
    } finally {
      if (!navigating) setPending(false);
    }
  }
  async function reference(action: () => Promise<{ sceneVersion?: number }>) {
    setPending(true);
    setError('');
    try {
      const result = await action();
      if (result.sceneVersion !== undefined)
        setRow((old) => (old ? { ...old, version: result.sceneVersion! } : old));
      setSaved('References saved.');
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  if (loading) return <p role="status">Loading scene…</p>;
  return (
    <div className="stack">
      <section className="workspace-card editor-panel">
        <p className="eyebrow">Develop / Scene{row ? ' ' + (row.position + 1) : ''}</p>
        <h1>{row ? row.title : 'A new scene.'}</h1>
        <Link href={plotUrl(c)}>Back to Plot Board</Link>
        {sceneId && !row ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            {row && (
              <p className="field-help">
                {row.group?.title ?? 'Ungrouped'} · {plotLabel(row.status)}. Move or regroup from
                Plot Board.
              </p>
            )}
            {row?.duplicatedFromId && (
              <p>
                Duplicated from{' '}
                <Link href={plotUrl(c, '/scenes/' + row.duplicatedFromId)}>the original scene</Link>
                . This copy has independent content.
              </p>
            )}
            {row?.archivedAt && (
              <p>
                Archived. Its place and references are retained. Restore its group first if that
                group is archived.
              </p>
            )}
            <form
              aria-label="Edit scene"
              onSubmit={(e) => {
                e.preventDefault();
                void save({
                  title,
                  content,
                  status,
                  ...(!sceneId ? { groupId: groupId || null } : {}),
                });
              }}
            >
              <fieldset disabled={!ready || pending || Boolean(row?.archivedAt)}>
                <label>
                  Scene title
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSaved('');
                    }}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Scene status
                  <select
                    aria-label="Scene status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as SceneStatus);
                      setSaved('');
                    }}
                  >
                    {SceneStatus.options.map((s) => (
                      <option key={s} value={s}>
                        {plotLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                {!sceneId && (
                  <>
                    <label>
                      Plot group
                      <select
                        aria-label="Plot group"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                      >
                        <option value="">Ungrouped</option>
                        {groups.items.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {groups.nextCursor && (
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() => setGroupCursor(groups.nextCursor!)}
                      >
                        More possible plot groups
                      </button>
                    )}
                  </>
                )}
                <RichTextEditor
                  key={editorKey}
                  label="Scene content"
                  value={content}
                  onChange={(v) => {
                    setContent(v);
                    setSaved('');
                  }}
                  disabled={!ready || pending || Boolean(row?.archivedAt)}
                />
                <button className="button">
                  {pending ? 'Saving…' : sceneId ? 'Save scene' : 'Create scene'}
                </button>
              </fieldset>
            </form>
            <p role="status" className="save-state">
              {dirty
                ? 'Unsaved scene changes'
                : saved || (row ? 'All scene changes saved' : 'Not saved yet')}
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error} Your draft is still here.
              </p>
            )}
            {row && (
              <div className="inline-actions">
                <button
                  className="quiet-button"
                  disabled={!ready || pending || dirty}
                  onClick={() => void save({ archived: !row.archivedAt })}
                >
                  {row.archivedAt ? 'Restore scene' : 'Archive scene'}
                </button>
                <button
                  className="quiet-button"
                  disabled={!ready || pending || dirty || Boolean(row.archivedAt)}
                  onClick={async () => {
                    setPending(true);
                    setError('');
                    let navigating = false;
                    try {
                      const copy = await api<SceneRecord>(path + '/duplicate', {
                        method: 'POST',
                        version: row.version,
                      });
                      navigating = true;
                      router.push(plotUrl(c, '/scenes/' + copy.id));
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      if (!navigating) setPending(false);
                    }
                  }}
                >
                  Duplicate scene
                </button>
                <button
                  className="quiet-button"
                  disabled={!ready || pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      accept(await api<SceneRecord>(path));
                      setRefsRevision((n) => n + 1);
                      setError('');
                      setSaved('Current scene loaded.');
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Discard edits and reload scene
                </button>
              </div>
            )}
            {row && (
              <details>
                <summary>Saved scene preview</summary>
                <RichTextView document={row.content} />
              </details>
            )}
          </>
        )}
      </section>
      {row && (
        <SceneReferences
          key={refsRevision}
          context={c}
          sceneId={row.id}
          version={row.version}
          revision={refsRevision}
          disabled={!ready || pending || dirty || Boolean(row.archivedAt)}
          onWrite={reference}
        />
      )}
    </div>
  );
}
