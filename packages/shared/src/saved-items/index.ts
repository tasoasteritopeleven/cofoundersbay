/**
 * Saved items: a listing or a job a member keeps to come back to, the way a
 * professional network's "Save" keeps a job. One rule for the API and the
 * demo world.
 *
 * Only what exists can be saved, and the title is copied from the source on
 * the server, so a saved row always names a real item. Saving is private:
 * nobody is told, and the poster never sees who saved their listing.
 */

export const SAVED_ITEM_KINDS = ['opportunity', 'job'] as const;
export type SavedItemKind = (typeof SAVED_ITEM_KINDS)[number];

/** At most this many saved rows per member. */
export const SAVED_ITEMS_LIMIT = 200;

export interface SavedItemView {
  kind: SavedItemKind;
  itemId: string;
  title: string;
  savedAt: string;
}

export function isSavedItemKind(value: unknown): value is SavedItemKind {
  return typeof value === 'string' && (SAVED_ITEM_KINDS as readonly string[]).includes(value);
}

/** Reads a save request; `null` when the kind or the id is missing or unknown. */
export function readSaveRequest(body: unknown): { kind: SavedItemKind; itemId: string } | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const itemId = typeof b.itemId === 'string' ? b.itemId.trim() : '';
  if (!isSavedItemKind(b.kind) || !itemId || itemId.length > 128) return null;
  return { kind: b.kind, itemId };
}
