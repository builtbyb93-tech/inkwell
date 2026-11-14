'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveMaxBytes, type ImportPreview } from '@inkwell/contracts';
import { api, message } from './api-client';
export function ProjectExport({ projectId }: { projectId: string }) {
  return (
    <div className="workspace-card">
      <h2>Keep a copy</h2>
      <p>
        Export this project, including archived records, canon overrides, scenes, relationships, and
        relevant source ideas. Other projects’ links stay private.
      </p>
      <a
        className="button button-link"
        href={'/api/v1/projects/' + projectId + '/export'}
        download="inkwell-project.json"
      >
        Export project JSON
      </a>
    </div>
  );
}
export function ProjectImport() {
  const router = useRouter(),
    [text, setText] = useState(''),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Bring your stories along</p>
      <h1>Import a project.</h1>
      <p>
        Choose an Inkwell version 1 JSON archive, up to 8 MiB and 10,000 records. Import creates a
        separate project with new IDs.
      </p>
      <label>
        Project archive
        <input
          type="file"
          accept=".json,application/json"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setText('');
            setPreview(null);
            setError('');
            if (!file) return;
            if (file.size > archiveMaxBytes) {
              setError('Choose an archive of 8 MiB or smaller.');
              return;
            }
            setPending(true);
            try {
              const body = await file.text();
              const result = await api<ImportPreview>('/imports/preview', {
                method: 'POST',
                body: JSON.parse(body),
              });
              setText(body);
              setPreview(result);
            } catch (e) {
              setError(e instanceof SyntaxError ? 'This file is not valid JSON.' : message(e));
            } finally {
              setPending(false);
            }
          }}
        />
      </label>
      {pending && <p role="status">Checking your archive…</p>}
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div className="recovery-choice">
          <h2>{preview.title}</h2>
          <dl>
            {Object.entries(preview.counts)
              .filter(([, n]) => n > 0)
              .map(([kind, n]) => (
                <div key={kind}>
                  <dt>{kind}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
          </dl>
          <ul>
            {preview.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <button
            className="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                const result = await api<{ projectId: string }>('/imports', {
                  method: 'POST',
                  body: JSON.parse(text),
                });
                router.push('/projects/' + result.projectId);
              } catch (e) {
                setError(message(e));
                setPending(false);
              }
            }}
          >
            Import as a separate project
          </button>
        </div>
      )}
    </section>
  );
}
