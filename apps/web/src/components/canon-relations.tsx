'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RelationshipKind, type RelationshipRecord, type CanonSummary } from '@inkwell/contracts';
import { api, message } from './api-client';
import { bibleUrl, canonPath, canonLabel, withQuery, type BibleContext } from './canon-path';
import { useHydrated } from './use-hydrated';
type Page<T> = { items: T[]; nextCursor: string | null };
function RelationshipRow({
  row,
  c,
  disabled,
  onChange,
}: {
  row: RelationshipRecord;
  c: BibleContext;
  disabled: boolean;
  onChange: (row: RelationshipRecord, input: unknown) => void;
}) {
  const [label, setLabel] = useState(row.label);
  return (
    <li>
      <div>
        <Link href={bibleUrl(c, row.other.id)}>{row.other.name || 'Unnamed record'}</Link>
        <p className="field-help">
          {row.direction === 'OUTGOING' ? 'Outgoing' : 'Backlink'} · {canonLabel(row.kind)} ·{' '}
          {row.storyId ? 'Story relationship' : 'Project relationship'}
          {row.other.archived ? ' · Endpoint archived' : ''}
        </p>
        {row.editable ? (
          <form
            aria-label={'Edit relationship to ' + (row.other.name || 'Unnamed record')}
            onSubmit={(e) => {
              e.preventDefault();
              onChange(row, { label });
            }}
          >
            <label>
              Relationship label
              <input
                value={label}
                maxLength={80}
                disabled={disabled || Boolean(row.archivedAt)}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <button
              className="quiet-button"
              disabled={disabled || Boolean(row.archivedAt) || label === row.label}
            >
              Save relationship label
            </button>
            <button
              type="button"
              className="quiet-button"
              disabled={disabled || label !== row.label}
              onClick={() => onChange(row, { archived: !row.archivedAt })}
            >
              {row.archivedAt ? 'Restore relationship' : 'Archive relationship'}
            </button>
          </form>
        ) : (
          <p>
            {row.label}{' '}
            <span className="field-help">Edit this shared relationship in project canon.</span>
          </p>
        )}
      </div>
    </li>
  );
}
export function CanonRelations({
  context: c,
  recordId,
}: {
  context: BibleContext;
  recordId: string;
}) {
  const ready = useHydrated(),
    [data, setData] = useState<Page<RelationshipRecord>>({ items: [], nextCursor: null }),
    [targets, setTargets] = useState<Page<CanonSummary>>({ items: [], nextCursor: null }),
    [targetCursor, setTargetCursor] = useState(''),
    [toId, setToId] = useState(''),
    [kind, setKind] = useState<RelationshipKind>('RELATED'),
    [label, setLabel] = useState(''),
    [archived, setArchived] = useState(false),
    [cursor, setCursor] = useState(''),
    [refresh, setRefresh] = useState(0),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const path = canonPath(c, recordId, '/relationships'),
    targetPath = canonPath(c);
  useEffect(() => {
    let live = true;
    let url = withQuery(path, 'archived', String(archived));
    if (cursor) url = withQuery(url, 'cursor', cursor);
    api<Page<RelationshipRecord>>(url)
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
  }, [path, archived, cursor, refresh]);
  useEffect(() => {
    let live = true;
    api<Page<CanonSummary>>(
      targetCursor ? withQuery(targetPath, 'cursor', targetCursor) : targetPath,
    )
      .then((r) => {
        if (live)
          setTargets((old) => ({
            items: targetCursor ? [...old.items, ...r.items] : r.items,
            nextCursor: r.nextCursor,
          }));
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [targetPath, targetCursor]);
  async function write(row?: RelationshipRecord, input?: unknown) {
    setPending(true);
    setError('');
    try {
      await api(row ? canonPath(c, recordId, '/relationships/' + row.id) : path, {
        method: row ? 'PATCH' : 'POST',
        ...(row ? { version: row.version } : {}),
        body: row ? input : { toId, kind, label },
      });
      setCursor('');
      setRefresh((n) => n + 1);
      if (!row) {
        setToId('');
        setLabel('');
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="workspace-card">
      <h2>Relationships & backlinks</h2>
      <p>
        Project relationships are reusable. Story relationships connect shared or local canon only
        within this story.
      </p>
      <form
        aria-label="Add canon relationship"
        onSubmit={(e) => {
          e.preventDefault();
          void write();
        }}
      >
        <fieldset disabled={!ready || pending}>
          <label>
            Related canon
            <select required value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Choose a record</option>
              {targets.items
                .filter((r) => r.id !== recordId && !r.archivedAt)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || 'Unnamed record'} ({canonLabel(r.kind)})
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
              Load more possible records
            </button>
          )}
          <label>
            Relationship type
            <select value={kind} onChange={(e) => setKind(e.target.value as RelationshipKind)}>
              {RelationshipKind.options.map((k) => (
                <option value={k} key={k}>
                  {canonLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <p className="field-help">
            Knows: character → character. Member of: character or organization → organization.
            Located in: character, event or organization → location. Part of: matching location,
            lore, event or organization. Precedes: event → event. Related accepts any two records.
          </p>
          <label>
            New relationship label
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
          </label>
          <button className="button" disabled={!ready || pending || !toId}>
            {pending ? 'Saving…' : 'Add relationship'}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={archived}
          disabled={!ready || pending || loading}
          onChange={(e) => {
            setCursor('');
            setLoading(true);
            setArchived(e.target.checked);
          }}
        />
        Show archived relationships
      </label>
      {loading ? (
        <p role="status">Loading relationships…</p>
      ) : (
        <>
          <ul className="record-list canon-list">
            {data.items.map((r) => (
              <RelationshipRow
                key={r.id + ':' + r.version}
                row={r}
                c={c}
                disabled={!ready || pending}
                onChange={(row, input) => void write(row, input)}
              />
            ))}
          </ul>
          {!data.items.length && <p>No {archived ? 'archived ' : ''}relationships yet.</p>}
          {data.nextCursor && (
            <button
              className="quiet-button"
              disabled={pending}
              onClick={() => {
                setLoading(true);
                setCursor(data.nextCursor!);
              }}
            >
              More relationships
            </button>
          )}
        </>
      )}
    </section>
  );
}
