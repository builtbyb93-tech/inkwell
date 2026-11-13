'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TargetRecord, IdeaSummary } from '@inkwell/contracts';
import { RichTextView } from '@inkwell/editor/render';
import { api, message } from './api-client';
export function IdeaTargetView({
  projectId,
  storyId,
  targetId,
  kind,
}: {
  projectId: string;
  storyId?: string;
  targetId: string;
  kind: 'CHARACTER' | 'SCENE';
}) {
  const [target, setTarget] = useState<TargetRecord | null>(null),
    [error, setError] = useState('');
  const path =
    kind === 'CHARACTER'
      ? `/projects/${projectId}/characters/${targetId}`
      : `/projects/${projectId}/stories/${storyId}/scenes/${targetId}`;
  useEffect(() => {
    let live = true;
    api<TargetRecord>(path)
      .then((row) => {
        if (live) setTarget(row);
      })
      .catch((err) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, [path]);
  if (error)
    return (
      <section>
        <h1>Unable to open this record.</h1>
        <p role="alert">{error}</p>
        <Link href="/ideas">Back to Idea Vault</Link>
      </section>
    );
  if (!target) return <p role="status">Loading record…</p>;
  return (
    <div className="stack">
      <section className="workspace-card">
        <p className="eyebrow">
          {kind === 'CHARACTER'
            ? 'Character / Shared with this project'
            : 'Scene / Part of your story'}
        </p>
        <h1>{target.title}</h1>
        <Link
          href={storyId ? `/projects/${projectId}/stories/${storyId}` : `/projects/${projectId}`}
        >
          Back to {storyId ? 'story' : 'project'}
        </Link>
        <RichTextView document={target.content} />
        <p className="field-help">
          {kind === 'CHARACTER'
            ? 'Character editing is coming with Story Bible.'
            : 'Scene editing and organization are coming with Plot Board.'}
        </p>
      </section>
      <section className="workspace-card">
        <h2>Source ideas</h2>
        <ul>
          {target.sources.map((source) => (
            <li key={source.id}>
              <Link href={`/ideas/${source.id}`}>{source.title}</Link>
              {source.archived && ' · Archived'}
            </li>
          ))}
        </ul>
        {kind === 'SCENE' && <Link href={`/ideas?sceneId=${targetId}`}>View all linked ideas</Link>}
      </section>
    </div>
  );
}
export function SourceIdeas({ storyId }: { storyId: string }) {
  const [active, setActive] = useState<IdeaSummary[]>([]),
    [archived, setArchived] = useState<IdeaSummary[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ items: IdeaSummary[] }>(`/ideas?storyId=${storyId}`),
      api<{ items: IdeaSummary[] }>(`/ideas?storyId=${storyId}&archived=true`),
    ])
      .then(([a, b]) => {
        if (live) {
          setActive(a.items);
          setArchived(b.items);
        }
      })
      .catch((err) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, [storyId]);
  return (
    <section className="workspace-card">
      <h2>Connected ideas</h2>
      {error && <p role="alert">{error}</p>}
      {active.length || archived.length ? (
        <ul>
          {[...active, ...archived].map((idea) => (
            <li key={idea.id}>
              <Link href={`/ideas/${idea.id}`}>{idea.title}</Link>
              {idea.archivedAt && ' · Archived'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-help">
          Link a thought from your Idea Vault, or develop an idea into a new story.
        </p>
      )}
      <div className="inline-actions">
        <Link href={`/ideas?storyId=${storyId}`}>View linked ideas</Link>
        <Link href={`/ideas?storyId=${storyId}&archived=true`}>View archived source ideas</Link>
      </div>
    </section>
  );
}
