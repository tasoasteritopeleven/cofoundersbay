'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { restorePreviewDemoSessionIfNeeded } from '@/lib/preview-demo';

/**
 * Check if the user has an active session.
 * Returns true when the session presence cookie exists.
 */
function checkSession(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.cookie.includes('cfb_session=')) return true;
  if (document.cookie.includes('cfb_preview_demo=1')) return true;
  try {
    return (
      window.localStorage.getItem('cfb_demo_data') === '1' ||
      window.location.hostname.endsWith('.trycloudflare.com')
    );
  } catch {
    return false;
  }
}

type Listener = () => void;

const listeners = new Set<Listener>();
let bound = false;

function emitSessionChange() {
  listeners.forEach((listener) => listener());
}

function bindSessionEvents() {
  if (bound || typeof window === 'undefined') return;

  const notify = () => emitSessionChange();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      emitSessionChange();
    }
  };

  window.addEventListener('cfb:login', notify);
  window.addEventListener('cfb:logout', notify);
  window.addEventListener('storage', notify);
  window.addEventListener('focus', notify);
  window.addEventListener('pageshow', notify);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  bound = true;
}

function subscribe(listener: Listener) {
  bindSessionEvents();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hook to detect if user has an active session.
 * Prevents hydration mismatch by always starting with false on the server.
 */
export function useSession() {
  const hasSession = useSyncExternalStore(subscribe, checkSession, () => false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (restorePreviewDemoSessionIfNeeded()) {
      emitSessionChange();
    }
    setMounted(true);
  }, []);

  return { hasSession, mounted, refresh: emitSessionChange };
}

/**
 * Simple hook that just returns hasSession boolean.
 * For use in components that only need the boolean value.
 */
export function useHasSession(): boolean {
  return useSyncExternalStore(subscribe, checkSession, () => false);
}
