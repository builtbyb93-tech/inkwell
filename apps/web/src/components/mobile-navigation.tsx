'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function MobileNavigation({ children }: { children: React.ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null),
    pathname = usePathname();
  useEffect(() => {
    details.current?.removeAttribute('open');
  }, [pathname]);
  return (
    <details
      ref={details}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !(event.target instanceof Element) ||
          !event.target.closest('a')
        )
          return;
        event.currentTarget.open = false;
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
    >
      <summary>Explore</summary>
      <nav aria-label="Mobile navigation">{children}</nav>
    </details>
  );
}
