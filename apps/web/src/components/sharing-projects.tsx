'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
export function SharingProjects() {
  const [items, setItems] = useState<ProjectRecord[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<{ items: ProjectRecord[]; nextCursor: string | null }>('/projects')
      .then((r) => {
        if (live) {
          setItems(r.items);
          setNext(r.nextCursor);
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Share / Keep control</p>
      <h1>Share a read-only copy.</h1>
      <p>Choose a project, then select exactly what to copy into a snapshot.</p>
      <ul className="record-list">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={'/projects/' + p.id + '/sharing'}>{p.title}</Link>
          </li>
        ))}
      </ul>
      {!items.length && <p>Create a project to begin.</p>}
      {error && <p role="alert">{error}</p>}
      {next && (
        <button
          className="quiet-button"
          onClick={async () => {
            try {
              const r = await api<{ items: ProjectRecord[]; nextCursor: string | null }>(
                '/projects?cursor=' + encodeURIComponent(next),
              );
              setItems((old) => [...old, ...r.items]);
              setNext(r.nextCursor);
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          More projects
        </button>
      )}
    </section>
  );
}
