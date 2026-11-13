'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PlotPage, SceneCard, SceneRecord, PlotGroupRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
import { plotPath, plotUrl, queryPath, plotLabel, type PlotContext } from './plot-path';
import { useHydrated } from './use-hydrated';
type Move = { direction?: 'EARLIER' | 'LATER'; beforeId?: string | null; groupId?: string | null };
function SceneTile({
  row,
  c,
  groups,
  scenes,
  disabled,
  onMove,
  archived,
}: {
  row: SceneCard;
  c: PlotContext;
  groups: { id: string; title: string }[];
  scenes: SceneCard[];
  disabled: boolean;
  onMove: (id: string, input: Move) => void;
  archived: boolean;
}) {
  const [groupId, setGroupId] = useState(row.groupId ?? ''),
    [beforeId, setBeforeId] = useState(row.id);
  return (
    <li
      data-scene-id={row.id}
      className="plot-tile"
      onDragOver={(e) => {
        if (!disabled && !archived) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const source = e.dataTransfer.getData('application/x-inkwell-scene');
        if (
          !disabled &&
          !archived &&
          source &&
          source !== row.id &&
          scenes.some((r) => r.id === source)
        )
          onMove(source, { beforeId: row.id });
      }}
    >
      <article aria-labelledby={'scene-heading-' + row.id}>
        <div className="inline-actions">
          <span className="eyebrow">
            Scene {row.position + 1} · {plotLabel(row.status)}
          </span>
          {!archived && (
            <button
              type="button"
              className="quiet-button drag-handle"
              draggable={!disabled}
              disabled={disabled}
              aria-label={'Drag scene ' + row.title}
              onDragStart={(e) => {
                if (disabled) return;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/x-inkwell-scene', row.id);
              }}
            >
              Drag
            </button>
          )}
        </div>
        <h2 id={'scene-heading-' + row.id}>
          <Link id={'scene-open-' + row.id} href={plotUrl(c, '/scenes/' + row.id)}>
            {row.title}
          </Link>
        </h2>
        <p className="field-help">
          {row.groupTitle ?? 'Ungrouped'}
          {row.duplicatedFromId ? ' · Duplicated scene' : ''}
        </p>
        {row.excerpt && <p className="scene-excerpt">{row.excerpt}</p>}
        <p className="field-help">
          {row.counts.characters} characters · {row.counts.locations} locations · {row.counts.ideas}{' '}
          ideas
        </p>
        {!archived && (
          <>
            <div className="inline-actions">
              <button
                className="quiet-button"
                disabled={disabled}
                onClick={() => onMove(row.id, { direction: 'EARLIER' })}
              >
                Move earlier
              </button>
              <button
                className="quiet-button"
                disabled={disabled}
                onClick={() => onMove(row.id, { direction: 'LATER' })}
              >
                Move later
              </button>
            </div>
            <details className="scene-move">
              <summary>Move or regroup scene</summary>
              <form
                aria-label={'Move scene ' + row.title}
                onSubmit={(e) => {
                  e.preventDefault();
                  onMove(row.id, {
                    groupId: groupId || null,
                    ...(beforeId === row.id ? {} : { beforeId: beforeId || null }),
                  });
                }}
              >
                <fieldset disabled={disabled}>
                  <label>
                    Destination group
                    <select
                      aria-label="Destination group"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      <option value="">Ungrouped</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Insert before
                    <select
                      aria-label="Insert before"
                      value={beforeId}
                      onChange={(e) => setBeforeId(e.target.value)}
                    >
                      <option value={row.id}>Keep sequence position</option>
                      <option value="">End of full story</option>
                      {scenes
                        .filter((s) => s.id !== row.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Scene {s.position + 1}: {s.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="button">Apply scene move</button>
                </fieldset>
              </form>
            </details>
          </>
        )}
      </article>
    </li>
  );
}
export function PlotBoard({ context: c }: { context: PlotContext }) {
  const ready = useHydrated(),
    [data, setData] = useState<PlotPage | null>(null),
    [groups, setGroups] = useState<PlotGroupRecord[]>([]),
    [groupCursor, setGroupCursor] = useState<string | null>(null),
    [cursor, setCursor] = useState(''),
    [groupFilter, setGroupFilter] = useState(''),
    [archived, setArchived] = useState(false),
    [view, setView] = useState<'board' | 'list'>('board'),
    [refresh, setRefresh] = useState(0),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const focusId = useRef<string | null>(null),
    notice = useRef<HTMLParagraphElement>(null),
    path = plotPath(c);
  useEffect(() => {
    let live = true;
    api<PlotPage>(
      queryPath(path, {
        ...(cursor ? { cursor } : {}),
        ...(groupFilter ? { groupId: groupFilter } : {}),
        archived: String(archived),
      }),
    )
      .then((r) => {
        if (live) {
          setData((old) => ({ ...r, items: cursor && old ? [...old.items, ...r.items] : r.items }));
          if (!cursor) {
            setGroups(r.groups);
            setGroupCursor(r.groupCursor);
          }
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
  }, [path, cursor, groupFilter, archived, refresh]);
  useEffect(() => {
    if (!loading && focusId.current) {
      const el = document.getElementById('scene-open-' + focusId.current);
      (el ?? notice.current)?.focus();
      focusId.current = null;
    }
  }, [data, loading]);
  function reload() {
    setCursor('');
    setLoading(true);
    setError('');
    setRefresh((n) => n + 1);
  }
  async function move(sceneId: string, input: Move) {
    if (!data) return;
    setPending(true);
    setError('');
    try {
      const r = await api<{ scene: SceneRecord; sequenceVersion: number }>(
        plotPath(c, '/scenes/' + sceneId + '/move'),
        { method: 'POST', version: data.sequenceVersion, body: input },
      );
      setStatus(r.scene.title + ' is at story position ' + (r.scene.position + 1) + '.');
      focusId.current = sceneId;
      reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  const options = new Map(groups.map((g) => [g.id, g.title]));
  for (const r of data?.items ?? [])
    if (r.groupId && !options.has(r.groupId))
      options.set(r.groupId, r.groupTitle ?? 'Current group');
  const destinationGroups = [...options].map(([id, title]) => ({ id, title }));
  return (
    <div className="stack">
      <section className="workspace-card">
        <p className="eyebrow">Organize / Plot Board</p>
        <h1>{data ? data.storyTitle + ' — Plot Board' : 'Your story, in sequence.'}</h1>
        <p>
          One scene sequence, with flexible groups. Drag scenes on desktop, or use the movement
          controls on any device. Scene numbers always refer to the full story.
        </p>
        <div className="inline-actions">
          <Link className="button" href={plotUrl(c, '/scenes/new')}>
            New scene
          </Link>
          <Link href={plotUrl(c, '/groups/new')}>New plot group</Link>
          <Link href={`/projects/${c.projectId}/stories/${c.storyId}`}>Back to story</Link>
          <Link href={`/projects/${c.projectId}/stories/${c.storyId}/canon`}>Story Bible</Link>
        </div>
      </section>
      <section className="workspace-card plot-controls" aria-label="Plot view controls">
        <div className="inline-actions">
          <button
            className="quiet-button"
            aria-pressed={view === 'board'}
            disabled={!ready}
            onClick={() => setView('board')}
          >
            Board view
          </button>
          <button
            className="quiet-button"
            aria-pressed={view === 'list'}
            disabled={!ready}
            onClick={() => setView('list')}
          >
            List view
          </button>
          <button className="quiet-button" disabled={!ready || pending || loading} onClick={reload}>
            Refresh plot
          </button>
        </div>
        <label>
          Filter plot group
          <select
            aria-label="Filter plot group"
            disabled={!ready || pending || loading}
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setCursor('');
              setLoading(true);
            }}
          >
            <option value="">Full story</option>
            <option value="ungrouped">Ungrouped scenes</option>
            {destinationGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={archived}
            disabled={!ready || pending || loading}
            onChange={(e) => {
              setArchived(e.target.checked);
              setCursor('');
              setLoading(true);
            }}
          />
          Show archived scenes
        </label>
        {groupFilter && (
          <p className="field-help">
            Earlier/later moves follow the full story sequence, including scenes outside this
            filter.
          </p>
        )}
        <details>
          <summary>Plot groups</summary>
          <ul className="plot-groups">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={plotUrl(c, '/groups/' + g.id)}>{g.title}</Link>
                {g.parentId && <span className="field-help"> · Child group</span>}
              </li>
            ))}
          </ul>
          {!groups.length && <p>No active plot groups yet. Scenes can stay ungrouped.</p>}
          {groupCursor && (
            <button
              className="quiet-button"
              disabled={pending || loading}
              onClick={async () => {
                setPending(true);
                try {
                  const r = await api<{
                    items: PlotGroupRecord[];
                    nextCursor: string | null;
                    sequenceVersion: number;
                  }>(plotPath(c, '/groups?limit=50&cursor=' + encodeURIComponent(groupCursor)));
                  if (r.sequenceVersion !== data?.sequenceVersion) {
                    setError('The plot changed. Refresh it before choosing a group.');
                    return;
                  }
                  setGroups((old) => [...old, ...r.items]);
                  setGroupCursor(r.nextCursor);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setPending(false);
                }
              }}
            >
              More plot groups
            </button>
          )}
          <Link href={plotUrl(c, '/groups')}>Manage active and archived groups</Link>
        </details>
      </section>
      <p role="status" aria-live="polite" tabIndex={-1} ref={notice} className="save-state">
        {loading ? 'Loading plot…' : status || 'Showing saved story order'}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error} Refresh the plot to load its current sequence.
        </p>
      )}
      {data && (
        <>
          <ul
            aria-label="Story scenes"
            className={view === 'board' ? 'plot-scenes plot-board' : 'plot-scenes plot-list'}
          >
            {data.items.map((r) => (
              <SceneTile
                key={r.id + ':' + data.sequenceVersion}
                row={r}
                c={c}
                groups={destinationGroups}
                scenes={data.items}
                disabled={!ready || pending || loading}
                onMove={(id, input) => void move(id, input)}
                archived={archived}
              />
            ))}
          </ul>
          {!loading && !data.items.length && (
            <section className="workspace-card">
              <h2>{archived ? 'No archived scenes.' : 'Make room for the first scene.'}</h2>
              <p>
                {archived
                  ? 'Archived scenes retain their place in the full sequence.'
                  : 'Create a scene or convert an idea from your Idea Vault.'}
              </p>
            </section>
          )}
          {data.nextCursor && (
            <button
              className="quiet-button"
              disabled={pending || loading}
              onClick={() => {
                setCursor(data.nextCursor!);
                setLoading(true);
              }}
            >
              More scenes in sequence
            </button>
          )}
        </>
      )}
    </div>
  );
}
