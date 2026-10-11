import { lookup as nodeLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

type LookupAddress = { address: string; family: number };
type LookupAll = (hostname: string) => Promise<LookupAddress[]>;
type FetchLike = typeof fetch;

export type SafeWebhookInput = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type SafeWebhookOptions = {
  allowedHosts?: readonly string[];
  lookupAll?: LookupAll;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home', '.lan'];
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const BLOCKED_HEADERS = new Set([
  'connection', 'content-length', 'expect', 'forwarded', 'host', 'proxy-authorization',
  'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via',
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
]);

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const value = address.toLowerCase().split('%', 1)[0];
  if (value === '::' || value === '::1') return false;
  if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return false;
  if (value.startsWith('ff') || value.startsWith('2001:db8:')) return false;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIpv4(mapped[1]);
  return true;
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

function normalizedHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function parseTarget(rawUrl: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Webhook URL is invalid');
  }
  if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
  if (url.username || url.password) throw new Error('Webhook URL credentials are not allowed');

  const host = normalizedHost(url.hostname);
  if (!host || host === 'localhost' || host === 'metadata.google.internal' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error('Webhook target is not a public host');
  }
  if (allowedHosts.length && !allowedHosts.map(normalizedHost).includes(host)) {
    throw new Error('Webhook target is not in AUTOMATION_WEBHOOK_ALLOWED_HOSTS');
  }
  return url;
}

function normalizedMethod(value?: string): string {
  const method = (value || 'POST').trim().toUpperCase();
  if (!ALLOWED_METHODS.has(method)) throw new Error(`Webhook method ${method || '(empty)'} is not allowed`);
  return method;
}

function normalizedHeaders(value?: Record<string, string>): Record<string, string> {
  const entries = Object.entries(value ?? {});
  if (entries.length > 32) throw new Error('Webhook headers exceed the limit of 32');
  const result: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [rawName, rawValue] of entries) {
    const name = rawName.trim();
    const lower = name.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || BLOCKED_HEADERS.has(lower)) {
      throw new Error(`Webhook header ${name || '(empty)'} is not allowed`);
    }
    const headerValue = String(rawValue);
    if (headerValue.length > 8_192 || /[\r\n]/.test(headerValue)) throw new Error(`Webhook header ${name} is invalid`);
    result[name] = headerValue;
  }
  return result;
}

async function resolvePublicTarget(url: URL, lookupAll: LookupAll): Promise<void> {
  const host = normalizedHost(url.hostname);
  if (isIP(host)) {
    if (!isPublicNetworkAddress(host)) throw new Error('Webhook target resolves to a non-public address');
    return;
  }
  const addresses = await lookupAll(host);
  if (!addresses.length || addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    throw new Error('Webhook target resolves to a non-public address');
  }
}

/**
 * Executes a bounded webhook without redirects. DNS is checked immediately
 * before delivery; an egress firewall remains the definitive rebinding guard.
 */
export async function sendSafeWebhook(input: SafeWebhookInput, options: SafeWebhookOptions = {}) {
  const allowedHosts = (options.allowedHosts ?? []).map((host) => host.trim()).filter(Boolean);
  const url = parseTarget(input.url, allowedHosts);
  const method = normalizedMethod(input.method);
  const headers = normalizedHeaders(input.headers);
  const body = method === 'GET' ? undefined : JSON.stringify(input.body ?? {});
  if (body && Buffer.byteLength(body, 'utf8') > 256 * 1024) throw new Error('Webhook body exceeds 256 KiB');

  const lookupAll: LookupAll = options.lookupAll ?? (async (hostname) =>
    nodeLookup(hostname, { all: true, verbatim: true }));
  await resolvePublicTarget(url, lookupAll);

  const response = await (options.fetchImpl ?? fetch)(url, {
    method,
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  try {
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
    return { status: response.status, method, destination: `${url.origin}${url.pathname}` };
  } finally {
    await response.body?.cancel().catch(() => undefined);
  }
}
