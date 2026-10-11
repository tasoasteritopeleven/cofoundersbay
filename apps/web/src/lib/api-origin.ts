/**
 * Resolves the API origin for HTTP and WebSocket clients.
 *
 * Dev (NEXT_PUBLIC_API_USE_PROXY=1): browser calls use same-origin `/api/*`
 * rewrites (see next.config.ts). SSR still needs an absolute upstream target.
 *
 * Production / explicit NEXT_PUBLIC_API_URL: always use the configured origin.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

const DEFAULT_API_ORIGIN = 'http://127.0.0.1:3001';

function proxyTarget(): string {
  return trimTrailingSlash(
    process.env.API_PROXY_TARGET ??
      process.env.NEXT_PUBLIC_API_URL ??
      DEFAULT_API_ORIGIN,
  );
}

/** HTTP API base (no trailing slash). Empty string = same-origin (dev proxy). */
export function getApiOrigin(): string {
  // Dev proxy wins over .env.local NEXT_PUBLIC_API_URL so browser uses same-origin /api/*
  if (process.env.NEXT_PUBLIC_API_USE_PROXY === '1') {
    if (typeof window !== 'undefined') return '';
    return proxyTarget();
  }

  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return trimTrailingSlash(explicit);

  return DEFAULT_API_ORIGIN;
}

/** Always absolute — OAuth redirects, email links, server-side fetches. */
export function getAbsoluteApiOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return trimTrailingSlash(explicit);
  return proxyTarget();
}

/** Socket.IO connect target (must be absolute). */
export function getSocketOrigin(): string {
  const httpOrigin = getApiOrigin();
  if (httpOrigin) return httpOrigin;
  if (typeof window !== 'undefined') return window.location.origin;
  return proxyTarget();
}

/** Native WebSocket URL (ws/wss) — same routing as Socket.IO in dev proxy mode. */
export function getNativeWebSocketOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const socketOrigin = getSocketOrigin();
  return socketOrigin.replace(/^http(s?):/, (_, s) => (s ? 'wss:' : 'ws:'));
}

export function isDevApiProxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_API_USE_PROXY === '1';
}
