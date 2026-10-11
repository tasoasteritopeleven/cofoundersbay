'use client';

import { QueryClient, QueryClientProvider, type Query } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useEffect, useRef, useState } from 'react';
import { ApiError, ApiNetworkError, getMe, type TenantMembershipItem } from '@/lib/api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        retry: (failureCount, error) => {
          if (error instanceof ApiNetworkError) return false;
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        networkMode: 'online',
      },
      mutations: { retry: 0 },
    },
  });
}

function discardUnscopedSnapshot() {
  try {
    window.sessionStorage.removeItem('cfb:rq-v1');
  } catch {}
}

function cookie(name: string) {
  return document.cookie.split('; ').find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function contextSignals() {
  if (typeof window === 'undefined') return '';
  let demo = false;
  let workspace: string | null = null;
  try {
    demo = window.localStorage.getItem('cfb_demo_data') === '1';
    workspace = window.localStorage.getItem('cfb_default_workspace');
  } catch {}
  return JSON.stringify([
    window.location.host, cookie('cfb_session'), cookie('cfb_preview_demo'), cookie('cfb_primary_role'), demo, workspace,
  ]);
}

function hasSessionSignal() {
  if (cookie('cfb_session') || cookie('cfb_preview_demo') === '1' || window.location.hostname.endsWith('.trycloudflare.com')) return true;
  try {
    return window.localStorage.getItem('cfb_demo_data') === '1';
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tenantIdentity(key: readonly unknown[], data: any): string | undefined {
  if (key[0] !== 'tenant' || data === undefined) return undefined;
  if (key[1] === 'memberships') {
    const memberships = (data?.memberships ?? []) as TenantMembershipItem[];
    const active = memberships.find(membership => membership.isActive) ?? memberships[0];
    return JSON.stringify([active?.tenant?.id ?? null, active?.id ?? null, active?.role ?? null]);
  }
  if (key[1] === 'by-slug') return JSON.stringify(data?.id ?? null);
  if (key[1] === 'by-domain') return JSON.stringify(data?.tenant?.id ?? null);
  return undefined;
}

function makeBoundary(revision = 0) {
  return { client: makeQueryClient(), revision, signals: contextSignals(), identity: null as string | null };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [boundary, setBoundary] = useState(makeBoundary);
  const current = useRef(boundary);
  const queryClient = boundary.client;

  useEffect(() => {
    let disposed = false;
    let validation = 0;
    const tenants = new Map<string, string>();
    discardUnscopedSnapshot();

    const isCurrent = () => !disposed && current.current === boundary;
    let persistenceScope: string | null = null;
    let unsubscribePersistence: (() => void) | undefined;
    let removeSnapshot: (() => void) | undefined;
    const startPersistence = async () => {
      if (!isCurrent() || persistenceScope || !boundary.identity || ['anonymous', 'unverified'].includes(boundary.identity) || !tenants.size) return;
      const scope = JSON.stringify([boundary.identity, boundary.signals, [...tenants].sort()]);
      const key = `cfb:rq-v2:${encodeURIComponent(scope)}`;
      persistenceScope = scope;
      const persister = createSyncStoragePersister({
        key,
        throttleTime: 250,
        storage: {
          getItem: (item) => { try { return window.sessionStorage.getItem(item); } catch { return null; } },
          setItem: (item, value) => { if (isCurrent() && persistenceScope === scope) { try { window.sessionStorage.setItem(item, value); } catch {} } },
          removeItem: (item) => { try { window.sessionStorage.removeItem(item); } catch {} },
        },
      });
      removeSnapshot = () => { persister.removeClient(); };
      const options = {
        queryClient, persister, maxAge: 15 * 60_000, buster: '2026-09-scoped',
        dehydrateOptions: {
          shouldDehydrateQuery: (query: Query) => query.state.status === 'success' && query.queryKey[0] !== 'tenant',
          shouldDehydrateMutation: () => false,
        },
      };
      try {
        const snapshot = await persister.restoreClient();
        if (!isCurrent() || persistenceScope !== scope) return;
        await persistQueryClientRestore({ ...options, persister: { ...persister, restoreClient: () => isCurrent() ? snapshot : undefined } });
        if (isCurrent() && persistenceScope === scope) unsubscribePersistence = persistQueryClientSubscribe(options);
      } catch {
        persister.removeClient();
      }
    };
    const reset = () => {
      if (!isCurrent()) return;
      const next = makeBoundary(boundary.revision + 1);
      current.current = next;
      unsubscribePersistence?.();
      removeSnapshot?.();
      persistenceScope = null;
      void queryClient.cancelQueries();
      queryClient.clear();
      discardUnscopedSnapshot();
      setBoundary(next);
    };
    const checkSignals = () => {
      if (!isCurrent()) return true;
      if (contextSignals() === boundary.signals) return false;
      reset();
      return true;
    };
    const checkIdentity = async () => {
      if (checkSignals()) return;
      const request = ++validation;
      try {
        const result = hasSessionSignal() ? await getMe() : null;
        if (!isCurrent() || request !== validation || checkSignals()) return;
        if (result && !result.user?.id) throw new Error('Missing session identity');
        const identity = result ? JSON.stringify([result.user.id, result.user.role]) : 'anonymous';
        if (boundary.identity !== null && boundary.identity !== identity) reset();
        else { boundary.identity = identity; void startPersistence(); }
      } catch {
        if (!isCurrent() || request !== validation) return;
        if (boundary.identity !== null && boundary.identity !== 'unverified') reset();
        else boundary.identity = 'unverified';
      }
    };
    const refresh = () => { void checkIdentity(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || ['user', 'cfb_demo_data', 'cfb_default_workspace', 'accessToken', 'refreshToken'].includes(event.key)) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (checkSignals() || event.type !== 'updated' || event.action.type !== 'success') return;
      const identity = tenantIdentity(event.query.queryKey, event.query.state.data);
      if (identity === undefined) return;
      const previous = tenants.get(event.query.queryHash);
      tenants.set(event.query.queryHash, identity);
      if (previous !== undefined && previous !== identity) reset();
      else void startPersistence();
    });
    window.addEventListener('cfb:login', reset);
    window.addEventListener('cfb:logout', reset);
    window.addEventListener('cfb:user', refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkSignals, 500);
    refresh();
    return () => {
      disposed = true;
      unsubscribePersistence?.();
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('cfb:login', reset);
      window.removeEventListener('cfb:logout', reset);
      window.removeEventListener('cfb:user', refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [boundary, queryClient]);

  // When the API comes back online (after a circuit-breaker blackout or server restart),
  // invalidate every query that is currently in 'error' state so pages automatically
  // re-fetch and recover without requiring a manual browser refresh.
  useEffect(() => {
    const handleApiOnline = () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.state.status === 'error',
      });
    };
    window.addEventListener('cfb:api-online', handleApiOnline);
    return () => window.removeEventListener('cfb:api-online', handleApiOnline);
  }, [queryClient]);

  return <QueryClientProvider key={boundary.revision} client={queryClient}>{children}</QueryClientProvider>;
}
