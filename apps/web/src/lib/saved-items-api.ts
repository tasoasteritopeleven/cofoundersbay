import type { SavedItemKind, SavedItemView } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** A member's saved listings and jobs (`/api/saved-items`). Always an array. */
export async function listSavedItems(kind?: SavedItemKind): Promise<SavedItemView[]> {
  const res = await apiRequest<{ items?: unknown }>(`/api/saved-items${kind ? `?kind=${kind}` : ''}`);
  const items = Array.isArray(res?.items) ? (res.items as SavedItemView[]) : [];
  return items.filter((i) => i && typeof i.itemId === 'string');
}

export async function saveItem(kind: SavedItemKind, itemId: string): Promise<SavedItemView | null> {
  const res = await apiRequest<{ item?: SavedItemView }>('/api/saved-items', {
    method: 'POST',
    body: JSON.stringify({ kind, itemId }),
  });
  return res?.item ?? null;
}

export async function unsaveItem(kind: SavedItemKind, itemId: string): Promise<void> {
  await apiRequest(`/api/saved-items/${encodeURIComponent(kind)}/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}
