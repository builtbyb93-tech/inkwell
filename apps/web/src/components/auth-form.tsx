'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, authPost, message } from './api-client';

export type AuthMode =
  | 'register'
  | 'sign-in'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'resend-verification';
const titles: Record<AuthMode, string> = {
  register: 'Make room for your stories.',
  'sign-in': 'Welcome back.',
  'forgot-password': 'Find your way back.',
  'reset-password': 'Choose a new password.',
  'verify-email': 'Confirm your email.',
  'resend-verification': 'A fresh link for your beginning.',
};
const buttons: Record<AuthMode, string> = {
  register: 'Create account',
  'sign-in': 'Sign in',
  'forgot-password': 'Send recovery link',
  'reset-password': 'Save new password',
  'verify-email': 'Verify email',
  'resend-verification': 'Send verification link',
};
export function AuthForm({ mode }: { mode: AuthMode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');
  useEffect(() => {
    if (mode === 'reset-password' || mode === 'verify-email') {
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
      setToken(value);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [mode]);
  const needsEmail = ['register', 'sign-in', 'forgot-password', 'resend-verification'].includes(
    mode,
  );
  const needsPassword = ['register', 'sign-in', 'reset-password'].includes(mode);
  const tokenMode = mode === 'reset-password' || mode === 'verify-email';
  return (
    <section className="auth-panel">
      <p className="eyebrow">Your creative space</p>
      <h1>{titles[mode]}</h1>
      {mode === 'register' && <p>One private workspace for your ideas, worlds, and stories.</p>}
      {mode === 'sign-in' && <p>Sign in with your verified email address.</p>}
      {tokenMode && !token && !success && (
        <p role="status">Open the complete link in your email, or request a new link below.</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError('');
          setSuccess('');
          const form = e.currentTarget;
          const values = new FormData(form);
          try {
            if (mode === 'sign-in') {
              await authPost('callback/credentials', {
                email: String(values.get('email')),
                password: String(values.get('password')),
              });
              window.location.assign('/dashboard');
              return;
            }
            const body =
              mode === 'register'
                ? {
                    email: values.get('email'),
                    password: values.get('password'),
                    displayName: values.get('displayName'),
                  }
                : needsEmail
                  ? { email: values.get('email') }
                  : mode === 'reset-password'
                    ? { token, password: values.get('password') }
                    : { token };
            const result = await api<{ message: string }>('/auth/' + mode, {
              method: 'POST',
              body,
            });
            setSuccess(result.message);
            form.reset();
            if (tokenMode) setToken('');
          } catch (err) {
            setError(message(err));
          } finally {
            setPending(false);
          }
        }}
      >
        {mode === 'register' && (
          <label>
            Your name
            <input name="displayName" autoComplete="name" required maxLength={80} />
          </label>
        )}
        {needsEmail && (
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
        )}
        {needsPassword && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'sign-in' ? 1 : 12}
              maxLength={128}
              aria-describedby={mode === 'sign-in' ? undefined : 'password-help'}
            />
          </label>
        )}
        {needsPassword && mode !== 'sign-in' && (
          <p id="password-help" className="field-help">
            Use 12–128 characters. A long, unique passphrase works well.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="save-state">
            {success}
          </p>
        )}
        <button className="button" disabled={pending || (tokenMode && !token)}>
          {pending ? 'Working…' : buttons[mode]}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/sign-in">Sign in</Link>
        <Link href="/register">Create account</Link>
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/resend-verification">Resend verification</Link>
      </div>
      <p className="field-help">Your stories stay private. AI is disabled.</p>
    </section>
  );
}
