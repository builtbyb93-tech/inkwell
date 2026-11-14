'use client';
import { useReliableEditor, ReliableStatus, draftSchemas } from './reliable-editor';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CanonKind, plainDocument, type RichDocument, type CanonRecord } from '@inkwell/contracts';
import { RichTextEditor } from '@inkwell/editor/react';
import { RichTextView } from '@inkwell/editor/render';
import { api, message } from './api-client';
import { bibleUrl, canonPath, canonLabel, type BibleContext } from './canon-path';
import { useHydrated } from './use-hydrated';
import { CanonOverrideEditor } from './canon-override';
import { CanonRelations } from './canon-relations';
import { CanonSceneReferences } from './scene-references';
function CanonDetailInstance({
  context: c,
  recordId,
}: {
  context: BibleContext;
  recordId: string;
}) {
  const [row, setRow] = useState<CanonRecord | null>(null),
    [error, setError] = useState('');
  const path = canonPath(c, recordId);
  useEffect(() => {
    let live = true;
    api<CanonRecord>(path)
      .then((r) => {
        if (live) setRow(r);
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, [path]);
  if (error)
    return (
      <section className="workspace-card">
        <h1>Unable to open this canon.</h1>
        <p role="alert">{error}</p>
        <Link href={bibleUrl(c)}>Back to Story Bible</Link>
      </section>
    );
  if (!row) return <p role="status">Loading canon…</p>;
  return (
    <div className="stack">
      {c.storyId && row.scope === 'SHARED' ? (
        <CanonOverrideEditor initial={row} context={c} />
      ) : (
        <CanonEditor initial={row} context={c} />
      )}
      <CanonRelations context={c} recordId={recordId} />
      {(row.kind === 'CHARACTER' || row.kind === 'LOCATION') && (
        <CanonSceneReferences context={c} recordId={recordId} />
      )}
      {row.kind === 'CHARACTER' && row.scope === 'SHARED' && (
        <Link href={`/projects/${c.projectId}/characters/${recordId}`}>
          Character overview and source ideas
        </Link>
      )}
    </div>
  );
}
function CanonEditorInstance({
  context: c,
  initial,
}: {
  context: BibleContext;
  initial?: CanonRecord;
}) {
  const ready = useHydrated(),
    router = useRouter();
  const [row, setRow] = useState(initial),
    [kind, setKind] = useState<CanonKind>(initial?.kind ?? 'CHARACTER'),
    [name, setName] = useState(initial?.name ?? ''),
    [content, setContent] = useState<RichDocument>(initial?.content ?? plainDocument('')),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [editorKey, setEditorKey] = useState(0);
  const snapshot = (r: CanonRecord) => ({ kind: r.kind, name: r.name, content: r.content });
  const reliable = useReliableEditor({
    kind: 'CANON',
    slot: canonPath(c, row?.id),
    recordId: row?.id,
    projectId: c.projectId,
    storyId: c.storyId,
    version: row?.version ?? 0,
    fields: { kind, name, content },
    baseline: row
      ? snapshot(row)
      : { kind: 'CHARACTER' as const, name: '', content: plainDocument('') },
    schema: draftSchemas.CANON,
    loaded: true,
    enabled: !pending && !row?.archivedAt,
    saveFields: (f) => ({ name: f.name, content: f.content }),
    apply: (f) => {
      setKind(f.kind);
      setName(f.name);
      setContent(f.content);
      setEditorKey((n) => n + 1);
    },
    ack: (f, v) =>
      setRow((old) =>
        old
          ? {
              ...old,
              name: f.name,
              content: f.content,
              effective: { name: f.name, content: f.content },
              version: v,
            }
          : old,
      ),
    current: async () => {
      const r = await api<CanonRecord>(canonPath(c, row?.id));
      return { version: r.version, fields: snapshot(r) };
    },
  });
  const dirty = reliable.dirty;
  function accept(r: CanonRecord) {
    reliable.reset(snapshot(r), r.version);
    setRow(r);
    setName(r.name);
    setContent(r.content);
    setEditorKey((k) => k + 1);
  }
  async function action(body: unknown) {
    setPending(true);
    setError('');
    try {
      const r = await api<CanonRecord>(canonPath(c, row?.id), {
        method: row ? 'PATCH' : 'POST',
        body,
        ...(row ? { version: row.version } : {}),
      });
      if (!row) {
        await reliable.created();
        router.push(bibleUrl(c, r.id));
        return;
      }
      accept(r);
      setSaved('Saved.');
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="workspace-card editor-panel">
      <p className="eyebrow">
        {c.storyId ? 'Story-only' : 'Shared universe'} / {row ? canonLabel(row.kind) : 'New canon'}
      </p>
      <h1>{row ? row.name : 'A new canon record.'}</h1>
      <Link href={bibleUrl(c)}>Back to Story Bible</Link>
      {row?.archivedAt && (
        <p role="status">
          Archived. Restore this record to edit it. References and overrides are preserved.
        </p>
      )}
      <form
        aria-label="Edit canon"
        onSubmit={(e) => {
          e.preventDefault();
          if (row)
            void reliable.flush().then((ok) => {
              if (ok) setSaved('Saved.');
            });
          else void action({ kind, name, content });
        }}
      >
        <fieldset disabled={!ready || pending || Boolean(row?.archivedAt)}>
          {!row && (
            <label>
              Record type
              <select value={kind} onChange={(e) => setKind(e.target.value as CanonKind)}>
                {CanonKind.options.map((k) => (
                  <option key={k} value={k}>
                    {canonLabel(k)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Canon name
            <input
              value={name}
              maxLength={120}
              required
              onChange={(e) => {
                setName(e.target.value);
                setSaved('');
              }}
            />
          </label>
          <RichTextEditor
            key={editorKey}
            value={content}
            onChange={(v) => {
              setContent(v);
              setSaved('');
            }}
            disabled={!ready || pending || Boolean(row?.archivedAt)}
            label="Canon notes"
          />
          <button className="button" disabled={!ready || pending || Boolean(row?.archivedAt)}>
            {pending ? 'Saving…' : row ? 'Save canon' : 'Create canon'}
          </button>
        </fieldset>
        <p role="status" className="save-state">
          {dirty ? 'Unsaved changes' : saved || 'All changes saved'}
        </p>
      </form>
      <ReliableStatus editor={reliable} />
      {error && (
        <p role="alert" className="form-error">
          {error} Your draft is still here.
        </p>
      )}
      {row && (
        <div className="inline-actions">
          <button
            className="quiet-button"
            disabled={!ready || pending || reliable.saving}
            onClick={async () => {
              setPending(true);
              try {
                accept(await api<CanonRecord>(canonPath(c, row.id)));
                setError('');
                setSaved('Current version loaded.');
              } catch (e) {
                setError(message(e));
              } finally {
                setPending(false);
              }
            }}
          >
            Discard edits and reload canon
          </button>
          <button
            className="quiet-button"
            disabled={!ready || pending || dirty || reliable.blocked}
            onClick={() => void action({ archived: !row.archivedAt })}
          >
            {row.archivedAt ? 'Restore canon' : 'Archive canon'}
          </button>
        </div>
      )}
      {row && (
        <details>
          <summary>Saved canon preview</summary>
          <RichTextView document={row.content} />
        </details>
      )}
    </section>
  );
}

export function CanonDetail(props: Parameters<typeof CanonDetailInstance>[0]) {
  return (
    <CanonDetailInstance
      key={props.context.projectId + ':' + (props.context.storyId ?? '') + ':' + props.recordId}
      {...props}
    />
  );
}

export function CanonEditor(props: Parameters<typeof CanonEditorInstance>[0]) {
  return (
    <CanonEditorInstance
      key={
        props.context.projectId +
        ':' +
        (props.context.storyId ?? '') +
        ':' +
        (props.initial?.id ?? 'new')
      }
      {...props}
    />
  );
}
