'use client';
import Link from 'next/link';
import { useState } from 'react';
import { plainDocument, type CanonRecord, type RichDocument } from '@inkwell/contracts';
import { RichTextEditor } from '@inkwell/editor/react';
import { RichTextView } from '@inkwell/editor/render';
import { api, message } from './api-client';
import { bibleUrl, canonPath, canonLabel, type BibleContext } from './canon-path';
import { useHydrated } from './use-hydrated';
type Mode = 'INHERIT' | 'CUSTOM' | 'CLEAR';
function modes(row: CanonRecord) {
  return {
    name: !row.override?.hasName ? 'INHERIT' : row.override.name === null ? 'CLEAR' : 'CUSTOM',
    content: !row.override?.hasContent
      ? 'INHERIT'
      : row.override.content === null
        ? 'CLEAR'
        : 'CUSTOM',
  } as { name: Mode; content: Mode };
}
export function CanonOverrideEditor({
  context: c,
  initial,
}: {
  context: BibleContext;
  initial: CanonRecord;
}) {
  const ready = useHydrated(),
    [row, setRow] = useState(initial),
    [nameMode, setNameMode] = useState<Mode>(modes(initial).name),
    [contentMode, setContentMode] = useState<Mode>(modes(initial).content),
    [name, setName] = useState(initial.override?.name ?? initial.name),
    [content, setContent] = useState<RichDocument>(initial.override?.content ?? initial.content),
    [editorKey, setEditorKey] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [choices, setChoices] = useState<Partial<Record<'name' | 'content', 'KEEP' | 'INHERIT'>>>({});
  const current = modes(row),
    dirty =
      nameMode !== current.name ||
      contentMode !== current.content ||
      (nameMode === 'CUSTOM' && name !== row.override?.name) ||
      (contentMode === 'CUSTOM' &&
        JSON.stringify(content) !== JSON.stringify(row.override?.content));
  const path = canonPath(c, row.id);
  function reset(r: CanonRecord) {
    setRow(r);
    setNameMode(modes(r).name);
    setContentMode(modes(r).content);
    setName(r.override?.name ?? r.name);
    setContent(r.override?.content ?? r.content);
    setEditorKey((k) => k + 1);
    setChoices({});
  }
  async function save() {
    setPending(true);
    setError('');
    try {
      const r = await api<CanonRecord>(canonPath(c, row.id, '/override'), {
        method: row.override ? 'PATCH' : 'POST',
        ...(row.override ? { version: row.override.version } : { createOnly: true }),
        body: {
          baseVersion: row.version,
          name: nameMode === 'CUSTOM' ? { mode: nameMode, value: name } : { mode: nameMode },
          content:
            contentMode === 'CUSTOM'
              ? { mode: contentMode, value: content }
              : { mode: contentMode },
        },
      });
      reset(r);
      setSaved('Story override saved. Shared canon is unchanged.');
    } catch (e) {
      setError(message(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="workspace-card editor-panel">
      <p className="eyebrow">Story override / {canonLabel(row.kind)}</p>
      <h1>{row.effective.name || 'Unnamed record'}</h1>
      <div className="inline-actions">
        <Link href={bibleUrl(c)}>Back to Story Bible</Link>
        <Link href={bibleUrl({ projectId: c.projectId }, row.id)}>Open project canon</Link>
      </div>
      <p>
        Changes here affect only this story. Choose inheritance, a custom value, or an explicit
        clear for each field.
      </p>
      {row.archivedAt && (
        <p role="status">
          Shared canon is archived. Your story content is preserved. Restore the shared record
          before editing this override.
        </p>
      )}
      {row.conflicts.length > 0 && (
        <section className="canon-review" aria-label="Review shared changes">
          <h2>Review shared changes</h2>
          <p>
            Your saved story values remain in place. Decide how each changed field should resolve.
          </p>
          {row.conflicts.map((field) => (
            <div className="canon-comparison" key={field}>
              <h3>{field === 'name' ? 'Name' : 'Notes'} changed</h3>
              <div className="canon-columns">
                <div>
                  <h4>Previously shared</h4>
                  {field === 'name' ? (
                    <p>{row.override?.baseName}</p>
                  ) : (
                    <RichTextView document={row.override?.baseContent ?? plainDocument('')} />
                  )}
                </div>
                <div>
                  <h4>Shared now</h4>
                  {field === 'name' ? <p>{row.name}</p> : <RichTextView document={row.content} />}
                </div>
                <div>
                  <h4>Saved story value</h4>
                  {field === 'name' ? (
                    <p>{row.override?.name ?? 'Explicitly cleared'}</p>
                  ) : row.override?.content ? (
                    <RichTextView document={row.override.content} />
                  ) : (
                    <p>Explicitly cleared</p>
                  )}
                </div>
              </div>
              <label>
                {field === 'name' ? 'Name' : 'Notes'} review decision
                <select
                  disabled={pending || !ready || dirty}
                  value={choices[field] ?? ''}
                  onChange={(e) =>
                    setChoices({ ...choices, [field]: e.target.value as 'KEEP' | 'INHERIT' })
                  }
                >
                  <option value="">Choose a decision</option>
                  <option value="KEEP">Keep saved story value</option>
                  <option value="INHERIT">Inherit current shared value</option>
                </select>
              </label>
            </div>
          ))}
          {dirty && (
            <p>
              Your unsaved draft is still here. Discard it explicitly before reviewing the saved
              override.
            </p>
          )}
          <button
            className="button"
            disabled={pending || !ready || dirty || row.conflicts.some((f) => !choices[f])}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                const r = await api<CanonRecord>(canonPath(c, row.id, '/override/review'), {
                  method: 'POST',
                  version: row.override!.version,
                  body: { baseVersion: row.version, ...choices },
                });
                reset(r);
                setSaved('Review saved.');
              } catch (e) {
                setError(message(e));
              } finally {
                setPending(false);
              }
            }}
          >
            Save review decisions
          </button>
        </section>
      )}
      <form
        aria-label="Edit story override"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={!ready || pending || Boolean(row.archivedAt) || row.conflicts.length > 0}
        >
          <label>
            Name behavior
            <select
              value={nameMode}
              onChange={(e) => {
                setNameMode(e.target.value as Mode);
                setSaved('');
              }}
            >
              <option value="INHERIT">Inherit shared name</option>
              <option value="CUSTOM">Use story name</option>
              <option value="CLEAR">Clear name for this story</option>
            </select>
          </label>
          {nameMode === 'CUSTOM' && (
            <label>
              Story name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
          )}
          {nameMode === 'INHERIT' && <p className="field-help">Shared name: {row.name}</p>}
          <label>
            Notes behavior
            <select
              value={contentMode}
              onChange={(e) => {
                setContentMode(e.target.value as Mode);
                setSaved('');
              }}
            >
              <option value="INHERIT">Inherit shared notes</option>
              <option value="CUSTOM">Use story notes</option>
              <option value="CLEAR">Clear notes for this story</option>
            </select>
          </label>
          {contentMode === 'CUSTOM' && (
            <RichTextEditor
              key={editorKey}
              value={content}
              onChange={setContent}
              disabled={!ready || pending || Boolean(row.archivedAt) || row.conflicts.length > 0}
              label="Story canon notes"
            />
          )}
          <button
            className="button"
            disabled={!ready || pending || Boolean(row.archivedAt) || row.conflicts.length > 0}
          >
            {pending ? 'Saving…' : 'Save story override'}
          </button>
        </fieldset>
        <p role="status" className="save-state">
          {dirty ? 'Unsaved story changes' : saved || 'Showing saved effective canon'}
        </p>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error} Your draft is still here.
        </p>
      )}
      <div className="inline-actions">
        <button
          className="quiet-button"
          disabled={!ready || pending}
          onClick={async () => {
            setPending(true);
            try {
              setRow(await api<CanonRecord>(path));
              setChoices({});
              setError('');
              setSaved('Current shared revision loaded; draft preserved.');
            } catch (e) {
              setError(message(e));
            } finally {
              setPending(false);
            }
          }}
        >
          Refresh comparison; keep draft
        </button>
        <button
          className="quiet-button"
          disabled={!ready || pending}
          onClick={() => {
            reset(row);
            setError('');
            setSaved('Unsaved override edits discarded.');
          }}
        >
          Discard unsaved override edits
        </button>
      </div>
      <details>
        <summary>Saved effective canon</summary>
        <p>{row.effective.name || 'Name explicitly cleared'}</p>
        <RichTextView document={row.effective.content} />
      </details>
    </section>
  );
}
