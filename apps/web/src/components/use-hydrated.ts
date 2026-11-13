'use client';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const client = () => true;
const server = () => false;
/** SSR controls wait for their event handlers before accepting draft input. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, client, server);
}
