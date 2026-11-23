/**
 * What is new since the reader was last here (docs §115): a reason to come back
 * that is true. Only what arrived, counted from the notifications themselves;
 * nothing arrives on a first visit, and a quiet day says nothing at all.
 */

const LAST_VISIT = 'cfb.home.lastVisit';
const THIS_SESSION = 'cfb.home.sinceVisit';

type Kind = 'messages' | 'people' | 'matches' | 'rest';

const KIND = new Map<string, Kind>([
  ['message', 'messages'], ['messages', 'messages'], ['direct', 'messages'],
  ['connection_request', 'people'], ['connection_accepted', 'people'], ['intro_request', 'people'], ['follow_new', 'people'],
  ['match', 'matches'], ['match_suggestion', 'matches'],
]);

const LABEL: Record<Kind, { en: string; el: string }> = {
  messages: { en: 'messages', el: 'μηνύματα' },
  people: { en: 'people', el: 'άτομα' },
  matches: { en: 'matches', el: 'αντιστοιχίσεις' },
  rest: { en: 'other', el: 'άλλα' },
};

const kindOf = (type: string): Kind => KIND.get(type) ?? 'rest';

type VisitNotification = { id?: string; type: string; createdAt: string };

export async function notificationsSince(
  lastVisitMs: number,
  readPage: (cursor: string | null) => Promise<{ notifications: VisitNotification[]; nextCursor: string | null }>,
  signal?: AbortSignal,
) {
  const items: VisitNotification[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    signal?.throwIfAborted();
    const page = await readPage(cursor);
    signal?.throwIfAborted();
    if (!Array.isArray(page?.notifications)) throw new Error('Missing notifications');
    items.push(...page.notifications);
    if (page.notifications.some((item) => Date.parse(item?.createdAt) <= lastVisitMs)) break;

    cursor = page.nextCursor;
    if (cursor === null) break;
    if (typeof cursor !== 'string' || !cursor || seenCursors.has(cursor)) throw new Error('Invalid notification cursor');
    seenCursors.add(cursor);
  } while (cursor);

  return sinceLastVisit(items, lastVisitMs);
}

export function sinceLastVisit(items: readonly VisitNotification[], lastVisitMs: number | null): { en: string; el: string } | null {
  if (lastVisitMs === null) return null;
  const counts = new Map<Kind, number>();
  const seen = new Set<string>();
  for (const item of items) {
    const created = Date.parse(item?.createdAt);
    if (!Number.isFinite(created) || created <= lastVisitMs || (item.id && seen.has(item.id))) continue;
    if (item.id) seen.add(item.id);
    const kind = kindOf(item.type);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const order: Kind[] = ['messages', 'people', 'matches', 'rest'];
  const parts = order.filter((kind) => counts.has(kind)).map((kind) => ({ count: counts.get(kind) as number, label: LABEL[kind] }));
  return {
    en: `Since your last visit: ${parts.map((part) => `${part.label.en} ${part.count}`).join(' · ')}`,
    el: `Από την τελευταία φορά: ${parts.map((part) => `${part.label.el} ${part.count}`).join(' · ')}`,
  };
}

/**
 * When the reader was last on the home, before this visit. The mark moves on at
 * once, but a reload in the same session keeps the line it already showed.
 */
export function readLastVisit(userId: string, demo: boolean, now = Date.now()): number | null {
  if (!userId) return null;
  const suffix = `:${demo ? 'demo' : 'member'}:${userId}`;
  const valid = (value: string | null) => {
    const time = Number(value);
    return Number.isFinite(time) && time > 0 && time <= now && now - time <= 30 * 86_400_000 ? time : null;
  };
  try {
    const held = window.sessionStorage.getItem(THIS_SESSION + suffix);
    if (held !== null) return valid(held);
    const stored = valid(window.localStorage.getItem(LAST_VISIT + suffix));
    window.sessionStorage.setItem(THIS_SESSION + suffix, stored === null ? '' : String(stored));
    window.localStorage.setItem(LAST_VISIT + suffix, String(now));
    return stored;
  } catch {
    return null;
  }
}
