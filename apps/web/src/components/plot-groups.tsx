'use client';
import { useReliableEditor, ReliableStatus, draftSchemas } from './reliable-editor';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlotGroupRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
import { plotPath, plotUrl, type PlotContext } from './plot-path';
import { useHydrated } from './use-hydrated';
type GroupPage = { items: PlotGroupRecord[]; nextCursor: string | null };
export function PlotGroupList({ context: c }: { context: PlotContext }) {
  const [data, setData] = useState<GroupPage>({ items: [], nextCursor: null }),
    [archived, setArchived] = useState(false),
    [cursor, setCursor] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const path = plotPath(c, '/groups');
  useEffect(() => {
    let live = true;
    api<GroupPage>(
      path + '?archived=' + archived + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
    )
      .then((r) => {
        if (live) {
          setData((old) => ({ ...r, items: cursor ? [...old.items, ...r.items] : r.items }));
          setLoading(false);
          setError('');
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
  }, [path, archived, cursor]);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Organize / Plot groups</p>
      <h1>Room for every part.</h1>
      <div className="inline-actions">
        <Link href={plotUrl(c)}>Back to Plot Board</Link>
        <Link href={plotUrl(c, '/groups/new')}>New plot group</Link>
      </div>
      <p>
        Use root groups and one level of child groups. Scene order stays canonical across every
        group.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={archived}
          disabled={loading}
          onChange={(e) => {
            setCursor('');
            setArchived(e.target.checked);
            setLoading(true);
          }}
        />
        Show archived plot groups
      </label>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading groups…</p>
      ) : (
        <>
          <ul className="record-list">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link href={plotUrl(c, '/groups/' + r.id)}>{r.title}</Link>
                <span className="field-help">{r.parentId ? 'Child group' : 'Root group'}</span>
              </li>
            ))}
          </ul>
          {!data.items.length && <p>No {archived ? 'archived ' : ''}plot groups.</p>}
          {data.nextCursor && (
            <button
              className="quiet-button"
              onClick={() => {
                setLoading(true);
                setCursor(data.nextCursor!);
              }}
            >
              More plot groups
            </button>
          )}
        </>
      )}
    </section>
  );
}
function PlotGroupEditorInstance({
  context: c,
  groupId,
}: {
  context: PlotContext;
  groupId?: string;
}) {
  const ready = useHydrated(),
    router = useRouter(),
    [row, setRow] = useState<PlotGroupRecord | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [parent, setParent] = useState(''),
    [groups, setGroups] = useState<GroupPage>({ items: [], nextCursor: null }),
    [groupCursor, setGroupCursor] = useState(''),
    [loading, setLoading] = useState(Boolean(groupId)),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const path = plotPath(c, '/groups' + (groupId ? '/' + groupId : '')),
    base = plotPath(c, '/groups');
  function accept(r: PlotGroupRecord) {
    reliable.reset({ title: r.title, description: r.description, parentId: r.parentId }, r.version);
    setRow(r);
    setTitle(r.title);
    setDescription(r.description);
    setParent(r.parentId ?? '');
  }
  useEffect(() => {
    let live = true;
    if (groupId)
      api<PlotGroupRecord>(path)
        .then((r) => {
          if (live) {
            setRow(r);
            setTitle(r.title);
            setDescription(r.description);
            setParent(r.parentId ?? '');
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
  }, [path, groupId]);
  useEffect(() => {
    let live = true;
    api<GroupPage>(
      base + '?limit=50' + (groupCursor ? '&cursor=' + encodeURIComponent(groupCursor) : ''),
    )
      .then((r) => {
        if (live)
          setGroups((old) => ({ ...r, items: groupCursor ? [...old.items, ...r.items] : r.items }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [base, groupCursor]);
  const snapshot = (r: PlotGroupRecord) => ({
    title: r.title,
    description: r.description,
    parentId: r.parentId,
  });
  const reliable = useReliableEditor({
    kind: 'GROUP',
    slot: path,
    recordId: groupId,
    projectId: c.projectId,
    storyId: c.storyId,
    version: row?.version ?? 0,
    fields: { title, description, parentId: parent || null },
    baseline: row ? snapshot(row) : { title: '', description: '', parentId: null },
    schema: draftSchemas.GROUP,
    loaded: !loading,
    enabled: !pending && !row?.archivedAt,
    apply: (f) => {
      setTitle(f.title);
      setDescription(f.description);
      setParent(f.parentId ?? '');
    },
    ack: (f, v) => setRow((old) => (old ? { ...old, ...f, version: v } : old)),
    current: async () => {
      const r = await api<PlotGroupRecord>(path);
      return { version: r.version, fields: snapshot(r) };
    },
  });
  const dirty = reliable.dirty;
  async function save(body: unknown) {
    setPending(true);
    setError('');
    let navigating = false;
    try {
      const r = await api<PlotGroupRecord>(path, {
        method: groupId ? 'PATCH' : 'POST',
        body,
        ...(row ? { version: row.version } : {}),
      });
      if (!groupId) {
        await reliable.created();
        navigating = true;
        router.push(plotUrl(c, '/groups/' + r.id));
        return;
      }
      accept(r);
      setStatus('Plot group saved.');
    } catch (e) {
      setError(message(e));
    } finally {
      if (!navigating) setPending(false);
    }
  }
  if (loading) return <p role="status">Loading group…</p>;
  return (
    <section className="workspace-card editor-panel">
      <p className="eyebrow">Organize / Plot group</p>
      <h1>{row ? row.title : 'A new plot group.'}</h1>
      <Link href={plotUrl(c, '/groups')}>Back to plot groups</Link>
      {groupId && !row ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p>
            Only root and child groups are supported. Move or archive active children and scenes
            before archiving a group. Restore its parent before restoring a child.
          </p>
          {row?.archivedAt && <p>Archived group. Scene references are preserved.</p>}
          <form
            aria-label="Edit plot group"
            onSubmit={(e) => {
              e.preventDefault();
              if (groupId)
                void reliable.flush().then((ok) => {
                  if (ok) setStatus('Plot group saved.');
                });
              else void save({ title, description, parentId: parent || null });
            }}
          >
            <fieldset disabled={!ready || pending || Boolean(row?.archivedAt)}>
              <label>
                Group title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Group description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <label>
                Parent plot group
                <select
                  aria-label="Parent plot group"
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">Root group</option>
                  {parent && !groups.items.some((g) => g.id === parent) && (
                    <option value={parent}>Current parent group</option>
                  )}
                  {groups.items
                    .filter((g) => !g.parentId && g.id !== groupId)
                    .map((g) => (
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
                  More possible parent groups
                </button>
              )}
              <button className="button">
                {pending ? 'Saving…' : groupId ? 'Save plot group' : 'Create plot group'}
              </button>
            </fieldset>
          </form>
          <p role="status" className="save-state">
            {dirty ? 'Unsaved group changes' : status || 'Showing saved group'}
          </p>
          <ReliableStatus editor={reliable} />
          {error && (
            <p role="alert" className="form-error">
              {error} Your edits are still here.
            </p>
          )}
          {row && (
            <div className="inline-actions">
              <button
                className="quiet-button"
                disabled={!ready || pending || dirty || reliable.blocked}
                onClick={() => void save({ archived: !row.archivedAt })}
              >
                {row.archivedAt ? 'Restore plot group' : 'Archive plot group'}
              </button>
              <button
                className="quiet-button"
                disabled={!ready || pending || reliable.saving}
                onClick={async () => {
                  setPending(true);
                  try {
                    accept(await api<PlotGroupRecord>(path));
                    setError('');
                    setStatus('Current group loaded.');
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Discard edits and reload group
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function PlotGroupEditor(props: Parameters<typeof PlotGroupEditorInstance>[0]) {
  return (
    <PlotGroupEditorInstance
      key={props.context.projectId + ':' + props.context.storyId + ':' + (props.groupId ?? 'new')}
      {...props}
    />
  );
}
