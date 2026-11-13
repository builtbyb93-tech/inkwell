'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ProjectRecord, StoryRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
export function PlotPicker({ projectId }: { projectId?: string }) {
  const [rows, setRows] = useState<(ProjectRecord | StoryRecord)[]>([]),
    [next, setNext] = useState<string | null>(null),
    [cursor, setCursor] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const path = projectId ? `/projects/${projectId}/stories` : '/projects';
  useEffect(() => {
    let live = true;
    api<{ items: (ProjectRecord | StoryRecord)[]; nextCursor: string | null }>(
      path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
    )
      .then((r) => {
        if (live) {
          setRows((old) => (cursor ? [...old, ...r.items] : r.items));
          setNext(r.nextCursor);
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
  }, [path, cursor]);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Organize / Plot Board</p>
      <h1>{projectId ? 'Choose a story.' : 'Find the thread of your story.'}</h1>
      <p>
        {projectId
          ? 'Each story has one scene sequence and its own plot groups.'
          : 'Choose a project, then a story to organize its scenes.'}
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          <ul className="record-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={
                    projectId
                      ? `/projects/${projectId}/stories/${r.id}/plot`
                      : `/projects/${r.id}/plot`
                  }
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
          {!rows.length && (
            <p>
              Create a{' '}
              <Link href={projectId ? `/projects/${projectId}/stories/new` : '/projects/new'}>
                {projectId ? 'story' : 'project'}
              </Link>{' '}
              to begin.
            </p>
          )}
          {next && (
            <button
              className="quiet-button"
              onClick={() => {
                setLoading(true);
                setCursor(next);
              }}
            >
              More {projectId ? 'stories' : 'projects'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
