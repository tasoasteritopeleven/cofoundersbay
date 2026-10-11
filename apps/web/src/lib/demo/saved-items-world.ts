/**
 * Saved listings and jobs in the preview demo, with the API's rules
 * (`apps/api/src/saved-items`, `packages/shared/src/saved-items`): only an
 * item that exists can be saved, its title comes from the source, saving
 * twice keeps one row, and removing is idempotent. State lives in
 * sessionStorage so a save survives navigation; rows carry ages, not dates.
 */

import { readSaveRequest, isSavedItemKind, SAVED_ITEMS_LIMIT, type SavedItemKind, type SavedItemView } from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';

const STORAGE_KEY = 'cfb:demo-saved-items:v1';

type Row = { kind: SavedItemKind; itemId: string; title: string; ageMs: number; savedAt: number };
let memory: Row[] | null = null;

function load(): Row[] {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as Row[]) : [];
  } catch {
    memory = [];
  }
  return memory;
}

function persist() {
  try {
    if (memory && typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage blocked: the demo keeps working for this page view.
  }
}

export function resetDemoSavedItems() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const view = (r: Row): SavedItemView => ({ kind: r.kind, itemId: r.itemId, title: r.title, savedAt: new Date(r.savedAt).toISOString() });

/**
 * Answers `/api/saved-items…` for the demo, or `undefined` for any other path.
 * `titleOf` looks the item up in the demo's own listings and jobs.
 */
export function previewSavedItemsApi(
  pathname: string,
  query: URLSearchParams,
  method: string,
  body: Record<string, unknown>,
  now: number,
  titleOf: (kind: SavedItemKind, itemId: string) => string | null,
): unknown {
  if (!pathname.startsWith('/api/saved-items')) return undefined;
  const rows = load();
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api','saved-items', kind?, itemId?]

  if (parts.length === 2 && method === 'GET') {
    const kind = query.get('kind') ?? '';
    if (kind && !isSavedItemKind(kind)) throw new DemoRefusal(400, 'Unknown kind');
    return { items: rows.filter((r) => !kind || r.kind === kind).sort((a, b) => b.savedAt - a.savedAt).map(view) };
  }
  if (parts.length === 2 && method === 'POST') {
    const req = readSaveRequest(body);
    if (!req) throw new DemoRefusal(400, 'kind and itemId are required');
    const title = titleOf(req.kind, req.itemId);
    if (title === null) throw new DemoRefusal(404, 'That item does not exist', { messageEl: 'Αυτό το στοιχείο δεν υπάρχει.' });
    const existing = rows.find((r) => r.kind === req.kind && r.itemId === req.itemId);
    if (existing) return { item: view(existing), saved: true };
    if (rows.length >= SAVED_ITEMS_LIMIT) throw new DemoRefusal(400, `You can keep up to ${SAVED_ITEMS_LIMIT} saved items; remove one first`);
    const row: Row = { kind: req.kind, itemId: req.itemId, title, ageMs: 0, savedAt: now };
    rows.push(row);
    persist();
    return { item: view(row), saved: true };
  }
  if (parts.length === 4 && method === 'DELETE') {
    const [, , kind, itemId] = parts;
    if (!isSavedItemKind(kind)) throw new DemoRefusal(400, 'Unknown kind');
    memory = rows.filter((r) => !(r.kind === kind && r.itemId === itemId));
    persist();
    return { saved: false };
  }
  return undefined;
}
