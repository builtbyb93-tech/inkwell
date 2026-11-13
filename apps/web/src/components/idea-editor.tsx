'use client';
import { useHydrated } from './use-hydrated';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  plainDocument,
  type RichDocument,
  type IdeaRecord,
  type TaxonomyRecord,
} from '@inkwell/contracts';
import { RichTextEditor } from '@inkwell/editor/react';
import { api, message } from './api-client';
import { IdeaTaxonomy } from './idea-taxonomy';
import { IdeaRelations } from './idea-relations';
export function IdeaEditor({ ideaId }: { ideaId?: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [record, setRecord] = useState<IdeaRecord | null>(null),
    [title, setTitle] = useState(''),
    [content, setContent] = useState<RichDocument>(plainDocument('')),
    [category, setCategory] = useState<TaxonomyRecord | null>(null),
    [tags, setTags] = useState<TaxonomyRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(ideaId)),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [epoch, setEpoch] = useState(0);
  function load(row: IdeaRecord) {
    setRecord(row);
    setTitle(row.title);
    setContent(row.content);
    setCategory(row.category);
    setTags(row.tags);
    setEpoch((n) => n + 1);
  }
  useEffect(() => {
    let live = true;
    if (ideaId)
      api<IdeaRecord>('/ideas/' + ideaId)
        .then((row) => {
          if (live) load(row);
        })
        .catch((err) => {
          if (live) setError(message(err));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    return () => {
      live = false;
    };
  }, [ideaId]);
  const dirty = record
    ? title !== record.title ||
      JSON.stringify(content) !== JSON.stringify(record.content) ||
      (category?.id ?? null) !== (record.category?.id ?? null) ||
      tags
        .map((t) => t.id)
        .sort()
        .join(',') !==
        record.tags
          .map((t) => t.id)
          .sort()
          .join(',')
    : Boolean(title || content.content.some((n) => n.content?.length) || category || tags.length);
  if (loading) return <p role="status">Loading idea…</p>;
  if (ideaId && !record)
    return (
      <section>
        <h1>Unable to open this idea.</h1>
        <p role="alert">{error}</p>
        <Link href="/ideas">Back to Idea Vault</Link>
      </section>
    );
  return (
    <div className="stack">
      <section className="workspace-card editor-panel">
        <Link href="/ideas">Back to Idea Vault</Link>
        <p className="eyebrow">
          {record?.archivedAt ? 'Archived / Kept safely' : 'A little room for a thought'}
        </p>
        <h1>{record?.title ?? 'A new idea.'}</h1>
        <form
          aria-label="Edit idea"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError('');
            setSaved('');
            try {
              const row = await api<IdeaRecord>(ideaId ? '/ideas/' + ideaId : '/ideas', {
                method: ideaId ? 'PATCH' : 'POST',
                ...(record ? { version: record.version } : {}),
                body: {
                  title,
                  content,
                  categoryId: category?.id ?? null,
                  tagIds: tags.map((t) => t.id),
                },
              });
              if (!ideaId) {
                router.push('/ideas/' + row.id);
                return;
              }
              setRecord(row);
              setTitle(row.title);
              setContent(row.content);
              setCategory(row.category);
              setTags(row.tags);
              setSaved('Saved.');
            } catch (err) {
              setError(message(err));
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Idea title
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved('');
              }}
              required
              maxLength={120}
              disabled={!hydrated || pending || Boolean(record?.archivedAt)}
            />
          </label>
          <RichTextEditor
            key={epoch}
            value={content}
            onChange={(value) => {
              setContent(value);
              setSaved('');
            }}
            disabled={!hydrated || pending || Boolean(record?.archivedAt)}
          />
          <IdeaTaxonomy
            category={category}
            tags={tags}
            onCategory={setCategory}
            onTags={setTags}
            onBusy={setPending}
            disabled={!hydrated || pending || Boolean(record?.archivedAt)}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="inline-actions">
            <button
              className="button"
              disabled={!hydrated || pending || Boolean(record?.archivedAt)}
            >
              {pending ? 'Saving…' : ideaId ? 'Save idea' : 'Create idea'}
            </button>
            <span role="status" className="save-state">
              {dirty
                ? 'Unsaved changes'
                : saved || (record ? 'All changes saved' : 'Not saved yet')}
            </span>
          </div>
        </form>
        {record && (
          <div className="record-actions">
            <button
              className="quiet-button"
              disabled={!hydrated || pending}
              onClick={async () => {
                setPending(true);
                try {
                  load(await api<IdeaRecord>('/ideas/' + record.id));
                  setError('');
                  setSaved('Current version loaded.');
                } catch (err) {
                  setError(message(err));
                } finally {
                  setPending(false);
                }
              }}
            >
              Discard edits and reload
            </button>
            <button
              className="quiet-button"
              disabled={!hydrated || pending || dirty}
              onClick={async () => {
                setPending(true);
                setError('');
                try {
                  const row = await api<IdeaRecord>('/ideas/' + record.id, {
                    method: 'PATCH',
                    version: record.version,
                    body: { archived: !record.archivedAt },
                  });
                  setRecord(row);
                  setSaved(
                    row.archivedAt ? 'Archived. Content and connections are kept.' : 'Restored.',
                  );
                } catch (err) {
                  setError(message(err));
                } finally {
                  setPending(false);
                }
              }}
            >
              {record.archivedAt ? 'Restore idea' : 'Archive idea'}
            </button>
          </div>
        )}
      </section>
      {record && (
        <IdeaRelations
          key={epoch}
          ideaId={record.id}
          version={record.version}
          disabled={dirty || Boolean(record.archivedAt)}
          pending={pending}
          onBusy={setPending}
          onVersion={(version) => setRecord((row) => (row ? { ...row, version } : row))}
        />
      )}
    </div>
  );
}
