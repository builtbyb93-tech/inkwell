'use client';
import { useEffect, useId, useState } from 'react';
import type { TaxonomyRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
type Page = { items: TaxonomyRecord[]; nextCursor: string | null };
const empty: Page = { items: [], nextCursor: null };
const merge = (a: TaxonomyRecord[], b: TaxonomyRecord[]) =>
  Array.from(new Map([...a, ...b].map((row) => [row.id, row])).values());
export function IdeaTaxonomy({
  category,
  tags,
  onCategory,
  onTags,
  disabled = false,
  allowCreate = true,
  onBusy,
}: {
  category: TaxonomyRecord | null;
  tags: TaxonomyRecord[];
  onCategory: (record: TaxonomyRecord | null) => void;
  onTags: (records: TaxonomyRecord[]) => void;
  disabled?: boolean;
  allowCreate?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const categoryId = useId();
  const [categories, setCategories] = useState<Page>(empty),
    [tagPage, setTagPage] = useState<Page>(empty);
  const [newCategory, setNewCategory] = useState(''),
    [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([api<Page>('/idea-taxonomy/categories'), api<Page>('/idea-taxonomy/tags')])
      .then(([c, t]) => {
        if (live) {
          setCategories(c);
          setTagPage(t);
        }
      })
      .catch((err) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, []);
  async function more(kind: 'categories' | 'tags') {
    const page = kind === 'categories' ? categories : tagPage;
    if (!page.nextCursor) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<Page>(
        `/idea-taxonomy/${kind}?cursor=${encodeURIComponent(page.nextCursor)}`,
      );
      const value = { items: merge(page.items, next.items), nextCursor: next.nextCursor };
      if (kind === 'categories') setCategories(value);
      else setTagPage(value);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function create(kind: 'categories' | 'tags') {
    const name = kind === 'categories' ? newCategory : newTag;
    if (!name.trim()) return;
    setBusy(true);
    onBusy?.(true);
    setError('');
    try {
      const record = await api<TaxonomyRecord>(`/idea-taxonomy/${kind}`, {
        method: 'POST',
        body: { name },
      });
      if (kind === 'categories') {
        setCategories((p) => ({ ...p, items: merge([record], p.items) }));
        onCategory(record);
        setNewCategory('');
      } else {
        setTagPage((p) => ({ ...p, items: merge([record], p.items) }));
        onTags(merge(tags, [record]));
        setNewTag('');
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <fieldset className="taxonomy-panel" disabled={disabled || busy}>
      <legend>Organize</legend>
      <label htmlFor={categoryId}>Category</label>
      <select
        id={categoryId}
        value={category?.id ?? ''}
        onChange={(e) =>
          onCategory(
            merge(category ? [category] : [], categories.items).find(
              (c) => c.id === e.target.value,
            ) ?? null,
          )
        }
      >
        <option value="">Uncategorized</option>
        {merge(category ? [category] : [], categories.items).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {categories.nextCursor && (
        <button type="button" className="quiet-button" onClick={() => more('categories')}>
          Load more categories
        </button>
      )}
      {allowCreate && (
        <div className="inline-create">
          <label>
            New category name
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              maxLength={50}
            />
          </label>
          <button
            type="button"
            className="quiet-button"
            onClick={() => create('categories')}
            disabled={!newCategory.trim()}
          >
            Add category
          </button>
        </div>
      )}
      <fieldset className="tag-options">
        <legend>Tags</legend>
        {merge(tags, tagPage.items).length ? (
          merge(tags, tagPage.items).map((t) => (
            <label className="checkbox-label" key={t.id}>
              <input
                type="checkbox"
                checked={tags.some((x) => x.id === t.id)}
                disabled={!tags.some((x) => x.id === t.id) && tags.length >= 20}
                onChange={(e) =>
                  onTags(e.target.checked ? [...tags, t] : tags.filter((x) => x.id !== t.id))
                }
              />
              {t.name}
            </label>
          ))
        ) : (
          <p className="field-help">No tags yet.</p>
        )}
      </fieldset>
      {tagPage.nextCursor && (
        <button type="button" className="quiet-button" onClick={() => more('tags')}>
          Load more tags
        </button>
      )}
      {allowCreate && (
        <div className="inline-create">
          <label>
            New tag name
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={50} />
          </label>
          <button
            type="button"
            className="quiet-button"
            onClick={() => create('tags')}
            disabled={!newTag.trim() || tags.length >= 20}
          >
            Add tag
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
