import Link from 'next/link';
import { requireAccount } from '@/server/page-account';
import { summary } from '@/server/records';
export default async function Dashboard() {
  const account = await requireAccount();
  const data = await summary(account);
  return (
    <>
      <section className="welcome">
        <p className="eyebrow">Your creative space</p>
        <h1>
          A little room
          <br />
          for what comes next.
        </h1>
        <p className="intro">Welcome, {account.displayName}. Pick up a story or begin a new one.</p>
        <Link className="button button-link" href="/projects">
          Open projects
        </Link>
      </section>
      <div className="stats-grid">
        <section className="workspace-card">
          <h2>
            <Link href="/ideas">Idea Vault</Link>
          </h2>
          <p className="stat-number">{data.ideas}</p>
        </section>
        <section className="workspace-card">
          <h2>Projects</h2>
          <p className="stat-number">{data.projects}</p>
        </section>
        <section className="workspace-card">
          <h2>Stories</h2>
          <p className="stat-number">{data.stories}</p>
        </section>
      </div>
      <section className="workspace-card">
        <h2>Recently touched</h2>
        {data.recent.length ? (
          <ul className="record-list">
            {data.recent.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>{project.title}</Link>
                <span className="field-help">Updated {project.updatedAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Your first project is waiting. Give it a name and collect the stories that belong
            together.
          </p>
        )}
      </section>
      <section className="workspace-card">
        <h2>Recent ideas</h2>
        {data.recentIdeas.length ? (
          <ul className="record-list">
            {data.recentIdeas.map((idea) => (
              <li key={idea.id}>
                <Link href={`/ideas/${idea.id}`}>{idea.title}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Capture the thought you don’t want to lose in your <Link href="/ideas">Idea Vault</Link>
            .
          </p>
        )}
      </section>
      <section className="future-tools">
        <h2>Room to grow</h2>
        <p>
          Develop shared and story-specific canon in your Story Bible. Organize scenes in your Plot
          Board.
        </p>
      </section>
    </>
  );
}
