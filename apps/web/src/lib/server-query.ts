import { QueryClient } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { getAbsoluteApiOrigin } from './api-origin';

/**
 * Create a fresh QueryClient for server-side prefetching.
 * Each request gets its own client to avoid cross-request data leaks.
 */
export function getServerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
      },
    },
  });
}

/**
 * Server-side authenticated fetch against the NestJS API.
 * Forwards the cfb_session cookie so the API recognises the user.
 * Falls back gracefully — if the API is unreachable, returns null
 * so the page can still render a client-only fallback.
 */
export async function serverFetch<T>(
  endpoint: string,
  opts?: { timeout?: number },
): Promise<T | null> {
  const apiBase = getAbsoluteApiOrigin();
  const timeout = opts?.timeout ?? 4_000;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('cfb_session');
  const accessToken = cookieStore.get('cfb_access_token');
  if (
    sessionCookie?.value === 'preview-demo' ||
    cookieStore.get('cfb_preview_demo')?.value === '1'
  ) {
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken.value}`;
  }
  if (sessionCookie) {
    headers['Cookie'] = `cfb_session=${sessionCookie.value}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(`${apiBase}${endpoint}`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timer);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API unreachable — degrade gracefully, client will refetch
    return null;
  }
}
