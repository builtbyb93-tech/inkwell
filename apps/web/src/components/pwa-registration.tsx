'use client';
import { useEffect } from 'react';
export function PwaRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      window.isSecureContext &&
      'serviceWorker' in navigator
    ) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          // Installation is optional; network-backed story organization stays usable.
        });
    }
  }, []);
  return null;
}
