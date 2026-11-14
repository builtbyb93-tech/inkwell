'use client';
import { useRecovery } from './recovery-provider';
import { useHydrated } from './use-hydrated';
import { useState } from 'react';
import type { AccountRecord } from '@inkwell/contracts';
import { api, message } from './api-client';
export function AccountSettings({ initial }: { initial: AccountRecord }) {
  const hydrated = useHydrated(),
    recovery = useRecovery();
  const [account, setAccount] = useState(initial);
  const [name, setName] = useState(initial.displayName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  return (
    <>
      <section className="workspace-card editor-panel">
        <h2>Your account</h2>
        <p>{account.email} · Email verified</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError('');
            setSaved('');
            try {
              const result = await api<AccountRecord>('/account', {
                method: 'PATCH',
                version: account.version,
                body: { displayName: name },
              });
              setAccount(result);
              setName(result.displayName);
              setSaved('Saved.');
            } catch (err) {
              setError(message(err));
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Your name
            <input
              value={name}
              disabled={!hydrated || pending}
              onChange={(e) => {
                setName(e.target.value);
                setSaved('');
              }}
              required
              maxLength={80}
            />
          </label>
          <button className="button" disabled={!hydrated || pending}>
            {pending ? 'Saving…' : 'Save account'}
          </button>
          <p role="status" className="save-state">
            {saved}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </form>
      </section>
      <section className="workspace-card">
        <h2>Privacy & AI</h2>
        <p>Your workspace is private. Sharing is coming in a later milestone.</p>
        <p>
          <strong>AI is disabled.</strong> Your story content is not sent to an AI provider. Core
          organization needs no AI service.
        </p>
        <p>Theme preference stays in this browser; use the theme control above.</p>
      </section>
      <section className="workspace-card">
        <h2>Session security</h2>
        <p>
          End all signed-in sessions, including this one. Password recovery also ends existing
          sessions.
        </p>
        <button
          className="quiet-button"
          disabled={!hydrated || pending}
          onClick={async () => {
            setPending(true);
            setError('');
            try {
              await api('/account/sessions/revoke', { method: 'POST' });
              try {
                await recovery.clear({ signOut: true });
              } catch {
                /* Server sessions have already been revoked. */
              }
              window.location.assign('/sign-in');
            } catch (err) {
              setError(message(err));
              setPending(false);
            }
          }}
        >
          Sign out all devices
        </button>
      </section>
    </>
  );
}
