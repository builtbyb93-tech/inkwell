'use client';
import { useHydrated } from './use-hydrated';
import { useState } from 'react';
import { authPost, message } from './api-client';
export function SignOutButton() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="quiet-button"
        disabled={!hydrated || pending}
        onClick={async () => {
          setPending(true);
          try {
            await authPost('signout');
            window.location.assign('/sign-in');
          } catch (err) {
            setError(message(err));
            setPending(false);
          }
        }}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
