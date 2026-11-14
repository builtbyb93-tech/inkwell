'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  openRecovery,
  clearRecovery,
  type RecoveryIdentity,
  type RecoveryLease,
} from '@/client/recovery';
type RecoveryContext = {
  lease: RecoveryLease | null;
  ready: boolean;
  error: string;
  clear: (options?: { signOut?: boolean; enabled?: boolean }) => Promise<void>;
};
const Context = createContext<RecoveryContext>({
  lease: null,
  ready: false,
  error: '',
  clear: async () => {},
});
export function useRecovery() {
  return useContext(Context);
}
export function RecoveryProvider({
  identity,
  children,
}: {
  identity: RecoveryIdentity;
  children: React.ReactNode;
}) {
  const [lease, setLease] = useState<RecoveryLease | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    let live = true;
    openRecovery(identity)
      .then((l) => {
        if (live) setLease(l);
      })
      .catch(() => {
        if (live) setError('Device recovery is unavailable. Online saves still work.');
      })
      .finally(() => {
        if (live) setReady(true);
      });
    const changed = () => {
      setLease(null);
      setError('Device recovery changed in another tab. Reload to use it again.');
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('inkwell-recovery');
      channel.current.onmessage = (e) => {
        if (e.data?.owner === identity.owner) changed();
      };
    }
    const storage = (e: StorageEvent) => {
      if (e.key === 'inkwell-recovery-event' && e.newValue) {
        try {
          if (JSON.parse(e.newValue).owner === identity.owner) changed();
        } catch {
          /* Browser notifications are optional; IndexedDB lease checks remain authoritative. */
        }
      }
    };
    window.addEventListener('storage', storage);
    const expired = () => {
      void clear({ signOut: true });
    };
    window.addEventListener('inkwell-session-expired', expired);
    return () => {
      live = false;
      channel.current?.close();
      window.removeEventListener('storage', storage);
      window.removeEventListener('inkwell-session-expired', expired);
    };
    // Identity is fixed by the authenticated layout for this browser session.
  }, [identity.owner, identity.tag, identity.startedAt]);
  async function clear(options: { signOut?: boolean; enabled?: boolean } = {}) {
    setLease(null);
    try {
      const next = await clearRecovery(identity, options);
      setLease(options.signOut ? null : next);
      setError('');
      const event = { owner: identity.owner, at: Date.now() };
      channel.current?.postMessage(event);
      try {
        localStorage.setItem('inkwell-recovery-event', JSON.stringify(event));
      } catch {
        /* Browser notifications are optional; IndexedDB lease checks remain authoritative. */
      }
    } catch {
      setError(
        'Could not clear device recovery. Close this browser profile if you are on a shared device.',
      );
      throw new Error('Could not clear device recovery.');
    }
  }
  return <Context.Provider value={{ lease, ready, error, clear }}>{children}</Context.Provider>;
}
export function RecoverySettings() {
  const r = useRecovery(),
    [status, setStatus] = useState('');
  return (
    <section className="workspace-card">
      <h2>Recovery on this device</h2>
      <p>
        Unsaved drafts stay on this browser for seven days and are cleared on sign-out. Restore is
        always your choice. Browser storage may be removed by your device; online saves remain the
        source of truth.
      </p>
      <p>
        Up to 50 drafts, 64 KiB each. This browser stores an encrypted copy and its key; use a
        private browser profile on shared devices.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={r.lease?.enabled ?? false}
          disabled={!r.ready || !r.lease}
          onChange={async (e) => {
            try {
              await r.clear({ enabled: e.target.checked });
              setStatus(
                e.target.checked
                  ? 'Device recovery enabled.'
                  : 'Device recovery disabled and drafts cleared.',
              );
            } catch {
              setStatus('Unable to update device recovery.');
            }
          }}
        />
        Keep unsaved drafts on this device
      </label>
      <button
        className="quiet-button"
        disabled={!r.ready || !r.lease}
        onClick={async () => {
          try {
            await r.clear();
            setStatus('Device recovery drafts cleared.');
          } catch {
            setStatus('Unable to clear drafts.');
          }
        }}
      >
        Clear device recovery drafts
      </button>
      <p role="status">{status || r.error}</p>
    </section>
  );
}
