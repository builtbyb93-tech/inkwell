import Link from 'next/link';
import { ThemeSelect } from './theme-select';
import { SignOutButton } from './sign-out';

export function AppFrame({ children, name }: { children: React.ReactNode; name?: string }) {
  const navigation =
    name !== undefined
      ? [
          ['/dashboard', 'Overview'],
          ['/projects', 'Projects & stories'],
          ['/settings', 'Account & privacy'],
        ]
      : [
          ['/', 'Overview'],
          ['/sign-in', 'Sign in'],
          ['/register', 'Create account'],
        ];
  const links = (
    <>
      {navigation.map(([href, label]) => (
        <Link key={href} href={href ?? '/'}>
          {label}
        </Link>
      ))}
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="mobile-header">
        <Link className="wordmark" href={name !== undefined ? '/dashboard' : '/'}>
          Inkwell<span aria-hidden="true">.</span>
        </Link>
        <details>
          <summary>Explore</summary>
          <nav aria-label="Mobile navigation">{links}</nav>
        </details>
      </header>
      <aside className="sidebar">
        <Link className="wordmark" href={name !== undefined ? '/dashboard' : '/'}>
          Inkwell<span aria-hidden="true">.</span>
        </Link>
        <p className="sidebar-note">A home for your stories.</p>
        <nav aria-label="Main navigation">{links}</nav>
        <div className="sidebar-footer">
          <p>Make room for the next idea.</p>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <div className="topbar">
          <span className="status-label">
            {name !== undefined ? name : 'Every great story starts somewhere.'}
          </span>
          <div className="inline-actions">
            <ThemeSelect />
            {name !== undefined && <SignOutButton />}
          </div>
        </div>
        {children}
        <footer className="page-footer">Inkwell · Every great story starts somewhere.</footer>
      </main>
    </div>
  );
}
