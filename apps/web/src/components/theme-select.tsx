'use client';

import { useEffect, useSyncExternalStore } from 'react';

const key = 'inkwell-theme';
const event = 'inkwell-theme-change';
let memoryTheme = 'system';
let persistenceUnavailable = false;

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(event, callback);
  };
}

function getTheme() {
  if (persistenceUnavailable) return memoryTheme;
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return memoryTheme;
  }
}

export function ThemeSelect() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'system');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="theme-control">
      <label htmlFor="theme-preference">Theme</label>
      <select
        id="theme-preference"
        value={theme}
        onChange={(e) => {
          memoryTheme = e.target.value;
          try {
            localStorage.setItem(key, e.target.value);
          } catch {
            // Reads may still work when writes fail because storage is full.
            persistenceUnavailable = true;
          }
          window.dispatchEvent(new Event(event));
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
