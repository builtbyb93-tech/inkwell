'use client';
import { useEffect, useState, useRef } from 'react';
import type { SharedSnapshot } from '@inkwell/contracts';
import { api, message } from './api-client';
import { SnapshotDocumentView } from './snapshot-document';
export function SharedViewer() {
  const [data, setData] = useState<SharedSnapshot | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [downloading, setDownloading] = useState(false),
    token = useRef('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!value || !/^[-_A-Za-z0-9]{43}$/.test(value)) {
      setError('Open the complete share link to view this copy.');
      setLoading(false);
      return;
    }
    token.current = value;
    let live = true,
      busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const result = await api<SharedSnapshot>('/shared/view', {
          method: 'POST',
          body: { token: value },
        });
        if (live) {
          if (new Date(result.expiresAt).getTime() <= Date.now()) {
            setData(null);
            setError('This share link has expired.');
          } else {
            setData(result);
            setError('');
          }
        }
      } catch (e) {
        if (live) {
          setData(null);
          setError(message(e));
        }
      } finally {
        busy = false;
        if (live) setLoading(false);
      }
    }
    void refresh();
    const poll = setInterval(() => {
        if (document.visibilityState === 'visible') void refresh();
      }, 30000),
      focus = () => {
        if (document.visibilityState === 'visible') {
          setData(null);
          setLoading(true);
          void refresh();
        }
      };
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('focus', focus);
    return () => {
      live = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('focus', focus);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const expires = new Date(data.expiresAt).getTime();
    const tick = () => {
      if (Date.now() >= expires) {
        setData(null);
        setError('This share link has expired.');
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data]);
  return (
    <section className="workspace-card">
      <p className="eyebrow">Shared with you / Read only</p>
      {loading && !data ? (
        <p role="status">Opening shared copy…</p>
      ) : data ? (
        <>
          <SnapshotDocumentView document={data.document} />
          <p className="field-help">
            This link expires {new Date(data.expiresAt).toLocaleString()}.
          </p>
          {data.allowDownload && (
            <button
              className="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const response = await fetch('/api/v1/shared/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token.current }),
                    cache: 'no-store',
                  });
                  if (!response.ok) {
                    const result = await response.json();
                    setData(null);
                    setError(result.error?.message ?? 'This share link is unavailable.');
                    return;
                  }
                  const blob = await response.blob(),
                    url = URL.createObjectURL(blob),
                    a = document.createElement('a');
                  a.href = url;
                  a.download = 'inkwell-snapshot.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch {
                  setError('Unable to download. Please try again.');
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? 'Preparing download…' : 'Download shared JSON'}
            </button>
          )}
        </>
      ) : (
        <h1>Shared copy unavailable.</h1>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
