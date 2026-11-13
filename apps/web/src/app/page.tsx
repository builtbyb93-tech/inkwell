import { EmptyState } from '@inkwell/ui';
import { ThemeSelect } from '@/components/theme-select';
import Link from 'next/link';

const navigation = [
  ['overview', 'Overview'],
  ['ideas', 'Idea Vault'],
  ['projects', 'Projects & stories'],
  ['bible', 'Story Bible'],
  ['plot', 'Plot Board'],
] as const;

export default function Home() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="mobile-header">
        <a className="wordmark" href="#overview">
          Inkwell<span aria-hidden="true">.</span>
        </a>
        <details>
          <summary>Explore</summary>
          <nav aria-label="Mobile navigation">
            {navigation.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </details>
      </header>
      <aside className="sidebar">
        <a className="wordmark" href="#overview">
          Inkwell<span aria-hidden="true">.</span>
        </a>
        <p className="sidebar-note">A home for your stories.</p>
        <nav aria-label="Main navigation">
          {navigation.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>Make room for the next idea.</p>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <div className="topbar">
          <Link href="/sign-in">Sign in</Link>
          <ThemeSelect />
        </div>
        <section id="overview" className="welcome" aria-labelledby="welcome-heading">
          <p className="eyebrow">Your creative space</p>
          <h1 id="welcome-heading">
            Every great story <br />
            starts somewhere.
          </h1>
          <p className="intro">
            Gather the sparks. Connect the details. Find a little more room for the story only you
            can tell.
          </p>
          <p className="preview-note">
            Your ideas deserve a place of their own. Begin with a private project and the stories
            that belong to it.
          </p>
          <Link className="button button-link" href="/register">
            Create your workspace
          </Link>
        </section>
        <div className="section-grid">
          <section id="ideas" className="workspace-card" aria-labelledby="ideas-heading">
            <p className="eyebrow">01 / Capture</p>
            <h2 id="ideas-heading">Idea Vault</h2>
            <p>A place for the thought you don’t want to lose.</p>
            <EmptyState title="Leave room for a spark">
              Quick capture, tags, and connections are coming soon.
            </EmptyState>
          </section>
          <section id="projects" className="workspace-card" aria-labelledby="projects-heading">
            <p className="eyebrow">02 / Develop</p>
            <h2 id="projects-heading">Projects & stories</h2>
            <p>One project. All the stories that belong to it.</p>
            <EmptyState title="A beginning is waiting">
              Create an account to start organizing your projects and stories.
            </EmptyState>
          </section>
          <section id="bible" className="workspace-card" aria-labelledby="bible-heading">
            <p className="eyebrow">03 / Connect</p>
            <h2 id="bible-heading">Story Bible</h2>
            <p>Keep your worlds consistent, and your stories distinct.</p>
            <EmptyState title="Your world, in one place">
              Characters, locations, lore, events, and organizations are coming soon.
            </EmptyState>
          </section>
          <section id="plot" className="workspace-card" aria-labelledby="plot-heading">
            <p className="eyebrow">04 / Shape</p>
            <h2 id="plot-heading">Plot Board</h2>
            <p>Find the sequence that brings your story to life.</p>
            <EmptyState title="See the shape of a story">
              Scene cards and flexible plot groups are coming soon.
            </EmptyState>
          </section>
        </div>
        <footer className="page-footer">Inkwell · Every great story starts somewhere.</footer>
      </main>
    </div>
  );
}
