'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>A pause in the story.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <p>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </main>
  );
}
