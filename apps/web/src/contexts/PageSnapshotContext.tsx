'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * What the page currently has on screen, in a form the assistant can read.
 *
 * The assistant was "page-aware" only in the weakest sense: `usePageContext`
 * handed it `{ route, entity, role, locale }` — a path string. It could say
 * which page you were on and nothing about what was on it, so "what am I
 * looking at?" and "what should I do here?" were unanswerable, and every
 * suggestion it made was generic to the route rather than to your data.
 *
 * A page publishes this; the assistant reads it. Deliberately small: a state,
 * one sentence, and the figures the user can already see. It is a description
 * of the screen, never a second copy of the data — anything the assistant
 * needs in full it fetches through a declared read capability, which is the
 * path that carries the user's own credentials.
 */
export type PageSnapshot = {
  /** What the page calls itself, in the reader's language if it has both. */
  title?: string;
  /**
   * Whether the page can currently do its job. `empty` and `error` matter most:
   * they are the states where the assistant should offer a way forward rather
   * than describe features the user cannot reach.
   */
  state?: 'loading' | 'ready' | 'empty' | 'error' | 'demo';
  /** One line: what is on screen right now. */
  summary?: string;
  /** The numbers the user can see, named the way the page names them. */
  figures?: Record<string, string | number>;
  /**
   * What this page offers, as declared capability ids. Lets the assistant
   * prefer what is reachable here over what is merely possible somewhere.
   */
  actions?: readonly string[];
};

type Stored = PageSnapshot & { route: string };

type Ctx = {
  snapshot: Stored | null;
  publish: (route: string, snapshot: PageSnapshot | null) => void;
};

const PageSnapshotCtx = createContext<Ctx | null>(null);

export function PageSnapshotProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Stored | null>(null);
  // Compared by value, not by identity. Pages pass object literals, which are
  // a new reference on every render — storing those directly would set state
  // during every render and take the tree into an update loop.
  const lastSerialised = useRef<string>('');

  const publish = useCallback((route: string, next: PageSnapshot | null) => {
    const serialised = next ? JSON.stringify({ route, ...next }) : '';
    if (serialised === lastSerialised.current) return;
    lastSerialised.current = serialised;
    setSnapshot(next ? { route, ...next } : null);
  }, []);

  const value = useMemo(() => ({ snapshot, publish }), [snapshot, publish]);
  return <PageSnapshotCtx.Provider value={value}>{children}</PageSnapshotCtx.Provider>;
}

/**
 * Reads what the current page published.
 *
 * Returns `null` outside the provider and on pages that publish nothing, so
 * the assistant degrades to exactly the behaviour it had before: it knows the
 * route and nothing more.
 */
export function usePageSnapshot(): Stored | null {
  return useContext(PageSnapshotCtx)?.snapshot ?? null;
}

/**
 * Publishes this page's snapshot for as long as it is mounted.
 *
 * Pass `null` while the page has nothing meaningful to say yet, rather than a
 * half-filled snapshot — the assistant reading "0 matches" during a load would
 * tell the user they have none.
 */
export function usePublishPageSnapshot(route: string, snapshot: PageSnapshot | null): void {
  const ctx = useContext(PageSnapshotCtx);
  const publish = ctx?.publish;
  // Serialised so a fresh object literal with identical contents does not
  // re-run the effect on every render of the page.
  const key = snapshot ? JSON.stringify(snapshot) : '';

  useEffect(() => {
    if (!publish) return;
    publish(route, key ? (JSON.parse(key) as PageSnapshot) : null);
    // Clearing on unmount keeps a stale screen from being described after the
    // user has navigated away from it.
    return () => publish(route, null);
  }, [publish, route, key]);
}
