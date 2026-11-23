/**
 * How the reader uses the platform, kept on this device, and what it suggests.
 *
 * Nothing here leaves the browser. Pages are counted by their registry path
 * (`/profiles/[userId]`, never whose profile), per day, for 30 days; moves
 * from one page to the next are counted the same way. Turning it off in
 * Settings stops the counting and keeps nothing new; clearing it removes it.
 *
 * Three things read it:
 *  - the homes and the command palette, which put the reader's own pages
 *    first ("Your pages": what they pinned, then what they open most);
 *  - the `g 1`…`g 6` keys, one for each of those pages;
 *  - the assistant (`get_usage_insights`), which says what it sees and
 *    proposes a shortcut, a pin, or a quicker way to do a repeated job.
 *
 * Adaptable, not adaptive: navigation never reorders itself (the sidebar,
 * the tab bar and the palette's own lists keep their places, which is what
 * people learn); the reader's own pages sit in a separate, labelled place,
 * and anything the platform suggests waits for the reader to accept it.
 */

import { getPageMeta, PAGE_REGISTRY } from '@/lib/page-registry';

export const USAGE_WINDOW_DAYS = 30;
/** How many of the reader's pages a home or the palette shows. */
export const MAX_SHORTCUTS = 6;
const DAY_MS = 24 * 60 * 60_000;
const PREFIX = 'cfb:usage:';
export const USAGE_EVENT = 'cfb:usage-change';

/** How the reader moved: through the palette, a `g` key, the assistant or one of their own pages. */
export type UsageVia = 'palette' | 'chord' | 'assistant' | 'shortcut';

export type UsageStore = {
  v: 1;
  /** Off: nothing is counted (the pins stay, they are the reader's choice). */
  enabled: boolean;
  /** Registry path → day (YYYY-MM-DD) → visits. */
  visits: Record<string, Record<string, number>>;
  /** "from>to" → day → moves. */
  moves: Record<string, Record<string, number>>;
  /** How the reader got around, in total. */
  via: Partial<Record<UsageVia, number>>;
  /** The reader's pinned pages, in their order. */
  pins: string[];
  /** Pages the reader took out of "Your pages". */
  hidden: string[];
  /** Suggestions the reader dismissed, by id, with when. */
  dismissed: Record<string, number>;
  /**
   * What the reader did with the suggestions, in total: taken (pinned, or
   * tried with the assistant) or set aside. The measure of whether they help
   * (docs §107.7-8, §111); counted here, on this device, like the rest.
   */
  outcomes: { accepted: number; dismissed: number };
};

export const EMPTY_USAGE: UsageStore = { v: 1, enabled: true, visits: {}, moves: {}, via: {}, pins: [], hidden: [], dismissed: {}, outcomes: { accepted: 0, dismissed: 0 } };

/* ── Storage ─────────────────────────────────────────────────────────── */

function accountKey(): string {
  try {
    const raw = window.localStorage.getItem('user');
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === 'string' && id ? id : 'anon';
  } catch {
    return 'anon';
  }
}

function storageKey(): string {
  return `${PREFIX}${accountKey()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A stored value read back defensively: storage is anyone's to edit. */
export function parseUsage(raw: string | null): UsageStore {
  if (!raw) return { ...EMPTY_USAGE };
  try {
    const value = JSON.parse(raw) as Partial<UsageStore>;
    if (!isRecord(value) || value.v !== 1) return { ...EMPTY_USAGE };
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : []);
    const counts = (rec: unknown): Record<string, Record<string, number>> => {
      if (!isRecord(rec)) return {};
      const out: Record<string, Record<string, number>> = {};
      for (const [key, days] of Object.entries(rec)) {
        if (!isRecord(days)) continue;
        const clean: Record<string, number> = {};
        for (const [day, n] of Object.entries(days)) if (typeof n === 'number' && n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day)) clean[day] = n;
        if (Object.keys(clean).length) out[key] = clean;
      }
      return out;
    };
    const via: Partial<Record<UsageVia, number>> = {};
    if (isRecord(value.via)) {
      for (const k of ['palette', 'chord', 'assistant', 'shortcut'] as const) {
        const n = value.via[k];
        if (typeof n === 'number' && n > 0) via[k] = n;
      }
    }
    const dismissed: Record<string, number> = {};
    if (isRecord(value.dismissed)) for (const [id, at] of Object.entries(value.dismissed)) if (typeof at === 'number') dismissed[id] = at;
    const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
    const outcomes = isRecord(value.outcomes)
      ? { accepted: count(value.outcomes.accepted), dismissed: count(value.outcomes.dismissed) }
      : { accepted: 0, dismissed: 0 };
    return {
      v: 1,
      enabled: value.enabled !== false,
      visits: counts(value.visits),
      moves: counts(value.moves),
      via,
      pins: strings(value.pins).slice(0, MAX_SHORTCUTS),
      hidden: strings(value.hidden),
      dismissed,
      outcomes,
    };
  } catch {
    return { ...EMPTY_USAGE };
  }
}

export function readUsage(): UsageStore {
  if (typeof window === 'undefined') return { ...EMPTY_USAGE };
  try {
    return parseUsage(window.localStorage.getItem(storageKey()));
  } catch {
    return { ...EMPTY_USAGE };
  }
}

function writeUsage(store: UsageStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    // Storage full or blocked: the platform works the same without it.
  }
  try {
    window.dispatchEvent(new Event(USAGE_EVENT));
  } catch {
    // No window events in this environment.
  }
}

function update(change: (store: UsageStore) => UsageStore): UsageStore {
  const next = change(readUsage());
  writeUsage(next);
  return next;
}

/* ── What counts as a page ───────────────────────────────────────────── */

/** Pages nobody needs a shortcut to: the homes, sign-in, onboarding, the demo door. */
const NOT_A_SHORTCUT = /^\/($|dashboard(\/|$)|login|register|forgot-password|reset-password|verify|auth|onboarding|demo|unauthorized|offline|privacy|terms|landing|pricing|p\/|invite\/|share\/)/;

/**
 * The registry path a pathname belongs to: `/profiles/user-elena` counts as
 * `/profiles/[userId]`, so nothing stored says whose page it was.
 */
export function pageKey(pathname: string): string | null {
  const path = (pathname.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  const exact = PAGE_REGISTRY.find((p) => p.path === path);
  if (exact) return exact.path;
  const meta = getPageMeta(path);
  if (!meta) return null;
  // A dynamic page: its pattern from the registry, by the shape of the path.
  const pattern = PAGE_REGISTRY.find((p) => p.path.includes('[') && new RegExp(`^${p.path.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(path));
  return pattern?.path ?? null;
}

/** Whether a page key can be a shortcut: a static page that is not a home. */
export function canShortcut(key: string): boolean {
  return !key.includes('[') && !NOT_A_SHORTCUT.test(key) && PAGE_REGISTRY.some((p) => p.path === key);
}

export type PageLabel = { en: string; el: string };

export function pageLabel(key: string): PageLabel {
  const meta = getPageMeta(key);
  const en = meta?.title ?? key;
  return { en, el: meta?.titleEl ?? en };
}

/* ── Recording ───────────────────────────────────────────────────────── */

export function dayOf(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bump(rec: Record<string, Record<string, number>>, key: string, day: string): Record<string, Record<string, number>> {
  const days = { ...(rec[key] ?? {}) };
  days[day] = (days[day] ?? 0) + 1;
  return { ...rec, [key]: days };
}

/** Drops days older than the window, and keys left with none. */
export function prune(store: UsageStore, now: number): UsageStore {
  const oldest = dayOf(now - (USAGE_WINDOW_DAYS - 1) * DAY_MS);
  const keep = (rec: Record<string, Record<string, number>>) => {
    const out: Record<string, Record<string, number>> = {};
    for (const [key, days] of Object.entries(rec)) {
      const kept = Object.fromEntries(Object.entries(days).filter(([day]) => day >= oldest));
      if (Object.keys(kept).length) out[key] = kept;
    }
    return out;
  };
  const dismissed = Object.fromEntries(Object.entries(store.dismissed).filter(([, at]) => now - at < 90 * DAY_MS));
  return { ...store, visits: keep(store.visits), moves: keep(store.moves), dismissed };
}

/** One visit, and the move that led to it. Nothing is counted while it is off. */
export function recordVisit(pathname: string, previous: string | null, now = Date.now()): void {
  const key = pageKey(pathname);
  if (!key) return;
  const store = readUsage();
  if (!store.enabled) return;
  const day = dayOf(now);
  let next: UsageStore = { ...store, visits: bump(store.visits, key, day) };
  const from = previous ? pageKey(previous) : null;
  if (from && from !== key) next = { ...next, moves: bump(next.moves, `${from}>${key}`, day) };
  writeUsage(prune(next, now));
}

export function recordVia(via: UsageVia): void {
  const store = readUsage();
  if (!store.enabled) return;
  writeUsage({ ...store, via: { ...store.via, [via]: (store.via[via] ?? 0) + 1 } });
}

/* ── The reader's choices ────────────────────────────────────────────── */

export type PinResult = { ok: true; index: number } | { ok: false; reason: 'not_a_page' | 'already' | 'full' | 'not_pinned' };

/** Pins a page at the end, or at `index`. Refuses a no-op, so an undo never unpins what the reader pinned. */
export function pinPage(key: string, index?: number): PinResult {
  if (!canShortcut(key)) return { ok: false, reason: 'not_a_page' };
  const store = readUsage();
  if (store.pins.includes(key)) return { ok: false, reason: 'already' };
  if (store.pins.length >= MAX_SHORTCUTS) return { ok: false, reason: 'full' };
  const pins = [...store.pins];
  const at = index === undefined ? pins.length : Math.max(0, Math.min(index, pins.length));
  pins.splice(at, 0, key);
  writeUsage({ ...store, pins, hidden: store.hidden.filter((h) => h !== key) });
  return { ok: true, index: at };
}

/** Unpins a page; the result says where it was, so an undo can put it back there. */
export function unpinPage(key: string): PinResult {
  const store = readUsage();
  const index = store.pins.indexOf(key);
  if (index < 0) return { ok: false, reason: 'not_pinned' };
  writeUsage({ ...store, pins: store.pins.filter((p) => p !== key) });
  return { ok: true, index };
}

/** Moves a pinned page one place earlier (-1) or later (+1). */
export function movePin(key: string, step: -1 | 1): number | undefined {
  update((store) => {
    const i = store.pins.indexOf(key);
    const j = i + step;
    if (i < 0 || j < 0 || j >= store.pins.length) return store;
    const pins = [...store.pins];
    [pins[i], pins[j]] = [pins[j], pins[i]];
    return { ...store, pins };
  });
  const index = readUsage().pins.indexOf(key);
  return index >= 0 ? index + 1 : undefined;
}

/** Takes a page out of "Your pages" (and unpins it); it can come back from Settings. */
export function hidePage(key: string): void {
  update((store) => ({ ...store, pins: store.pins.filter((p) => p !== key), hidden: store.hidden.includes(key) ? store.hidden : [...store.hidden, key] }));
}

export function unhidePage(key: string): void {
  update((store) => ({ ...store, hidden: store.hidden.filter((h) => h !== key) }));
}

export function dismissSuggestion(id: string, now = Date.now()): void {
  update((store) => ({
    ...store,
    dismissed: { ...store.dismissed, [id]: now },
    outcomes: id in store.dismissed ? store.outcomes : { ...store.outcomes, dismissed: store.outcomes.dismissed + 1 },
  }));
}

/**
 * A suggestion the reader took: pinned, or tried with the assistant. It is
 * counted once and quieted, as a dismissed one is, so it does not come back.
 */
export function acceptSuggestion(id: string, now = Date.now()): void {
  update((store) => ({
    ...store,
    dismissed: { ...store.dismissed, [id]: now },
    outcomes: id in store.dismissed ? store.outcomes : { ...store.outcomes, accepted: store.outcomes.accepted + 1 },
  }));
}

/** «Προτάσεις ως τώρα: 3 έγιναν δεκτές, 1 παραμερίστηκε (75%).», or nothing before the first. */
export function suggestionOutcomeCopy(store: UsageStore): { en: string; el: string } | null {
  const { accepted, dismissed } = store.outcomes;
  const total = accepted + dismissed;
  if (!total) return null;
  const rate = Math.round((accepted / total) * 100);
  return {
    en: `Suggestions so far: ${accepted} taken, ${dismissed} set aside (${rate}% taken).`,
    el: `Προτάσεις ως τώρα: ${accepted} ${accepted === 1 ? 'έγινε δεκτή' : 'έγιναν δεκτές'}, ${dismissed} ${dismissed === 1 ? 'παραμερίστηκε' : 'παραμερίστηκαν'} (${rate}% αποδοχή).`,
  };
}

/** On or off. Off keeps the pins (a choice) and stops counting. */
export function setUsageEnabled(enabled: boolean): void {
  update((store) => ({ ...store, enabled }));
}

/** Forgets what was counted; the pins and the on/off choice stay. */
export function clearUsageHistory(): void {
  update((store) => ({ ...store, visits: {}, moves: {}, via: {}, dismissed: {}, outcomes: { accepted: 0, dismissed: 0 } }));
}

/* ── Analysis ────────────────────────────────────────────────────────── */

export type PageUse = { key: string; label: PageLabel; week: number; month: number; score: number; lastDay: string };

function sumSince(days: Record<string, number>, since: string): number {
  return Object.entries(days).reduce((n, [day, count]) => (day >= since ? n + count : n), 0);
}

/**
 * Pages by use: this week's visits weigh most, and older ones fade (a visit
 * a week ago counts half). Ties go to the more recent page.
 */
export function pageUse(store: UsageStore, now: number): PageUse[] {
  const week = dayOf(now - 6 * DAY_MS);
  const month = dayOf(now - (USAGE_WINDOW_DAYS - 1) * DAY_MS);
  const today = Date.parse(`${dayOf(now)}T00:00:00`);
  return Object.entries(store.visits)
    .map(([key, days]) => {
      const score = Object.entries(days).reduce((s, [day, count]) => {
        const age = Math.max(0, (today - Date.parse(`${day}T00:00:00`)) / DAY_MS);
        return day >= month ? s + count * Math.pow(0.5, age / 7) : s;
      }, 0);
      const lastDay = Object.keys(days).sort().pop() ?? '';
      return { key, label: pageLabel(key), week: sumSince(days, week), month: sumSince(days, month), score, lastDay };
    })
    .filter((p) => p.month > 0)
    .sort((a, b) => b.score - a.score || b.lastDay.localeCompare(a.lastDay));
}

export type Shortcut = { key: string; label: PageLabel; pinned: boolean; week: number };

/**
 * "Your pages": the pinned ones in the reader's order, then the most used
 * (opened at least three times this month), up to six. A page counts once.
 */
export function yourPages(store: UsageStore, now: number, limit = MAX_SHORTCUTS): Shortcut[] {
  const use = pageUse(store, now);
  const weekOf = (key: string) => use.find((p) => p.key === key)?.week ?? 0;
  const pinned = store.pins.filter(canShortcut).map((key) => ({ key, label: pageLabel(key), pinned: true, week: weekOf(key) }));
  const frequent = use
    .filter((p) => p.month >= 3 && canShortcut(p.key) && !store.pins.includes(p.key) && !store.hidden.includes(p.key))
    .map((p) => ({ key: p.key, label: p.label, pinned: false, week: p.week }));
  return [...pinned, ...frequent].slice(0, limit);
}

/** The `g` letters `useCommandPalette` already binds, so a tip names a key that works. */
export const GO_CHORDS: Record<string, string> = { '/discover': 'd', '/profile': 'p', '/ai': 'a', '/messages': 'm', '/settings': 's' };

export type SuggestionKind = 'pin' | 'chord' | 'palette' | 'workflow' | 'assistant';

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  /** What to do, one sentence. */
  title: PageLabel;
  /** Why: what the platform saw, with the numbers. */
  evidence: PageLabel;
  /** A page the suggestion is about, when it is about one. */
  page?: string;
  /** For `pin`: the page to pin. For `workflow`/`assistant`: a question for the assistant. */
  ask?: PageLabel;
};

/**
 * Repeated moves the platform has a shorter way for. Each names the way,
 * and only ways that exist: the match card's own Message button, its preview,
 * the assistant's drafts.
 */
const WORKFLOWS: Array<{ from: string; to: string; id: string; title: PageLabel; ask?: PageLabel }> = [
  {
    from: '/matches', to: '/messages', id: 'wf-match-message',
    title: { en: 'Message from the match card: its Message button opens the conversation without leaving Matches.', el: 'Στείλτε μήνυμα από την κάρτα αντιστοίχισης: το κουμπί «Μήνυμα» ανοίγει τη συνομιλία χωρίς να φύγετε από τις Αντιστοιχίσεις.' },
  },
  {
    from: '/matches', to: '/profiles/[userId]', id: 'wf-match-preview',
    title: { en: 'Click a match card’s body for its preview: the profile opens beside the list.', el: 'Πατήστε στο σώμα μιας κάρτας για την προεπισκόπηση: το προφίλ ανοίγει δίπλα στη λίστα.' },
  },
  {
    from: '/milestones', to: '/milestones/new', id: 'wf-milestone-draft',
    title: { en: 'Ask the assistant to draft a milestone: it fills the form and you check it.', el: 'Ζητήστε από τον βοηθό να συντάξει ένα ορόσημο: συμπληρώνει τη φόρμα και εσείς την ελέγχετε.' },
    ask: { en: 'Draft a milestone for this week', el: 'Σύνταξε ένα ορόσημο για αυτή την εβδομάδα' },
  },
  {
    from: '/events', to: '/events/create', id: 'wf-event-draft',
    title: { en: 'Ask the assistant to draft an event: it fills the form and you check it.', el: 'Ζητήστε από τον βοηθό να συντάξει μια εκδήλωση: συμπληρώνει τη φόρμα και εσείς την ελέγχετε.' },
    ask: { en: 'Draft an event', el: 'Σύνταξε μια εκδήλωση' },
  },
  {
    from: '/notifications', to: '/messages', id: 'wf-notifications-summary',
    title: { en: 'Ask the assistant what is new: one answer for notifications and unread messages.', el: 'Ρωτήστε τον βοηθό τι νέο υπάρχει: μία απάντηση για ειδοποιήσεις και αδιάβαστα μηνύματα.' },
    ask: { en: 'What is new for me?', el: 'Τι νέο υπάρχει για μένα;' },
  },
  {
    from: '/discover', to: '/search', id: 'wf-search-words',
    title: { en: 'Describe who you are looking for to the assistant, in your own words: it turns them into the search.', el: 'Περιγράψτε στον βοηθό ποιον ψάχνετε, με δικά σας λόγια: τα κάνει αναζήτηση.' },
    ask: { en: 'Find a technical co-founder in Athens', el: 'Βρες τεχνικό συνιδρυτή στην Αθήνα' },
  },
];

/** Forms the assistant drafts, so a reader filling them by hand hears that it can. */
const DRAFTED_FORMS = ['/milestones/new', '/events/create', '/commitments/new', '/profile/edit', '/projects/create', '/updates'];

/**
 * What the platform would suggest, best first. Each suggestion rests on
 * counts it states; dismissed ones stay quiet for 90 days. `keyboard` is
 * false on a touch screen, where keys are no help.
 */
export function usageSuggestions(store: UsageStore, now: number, opts: { keyboard: boolean }): Suggestion[] {
  const use = pageUse(store, now);
  const out: Suggestion[] = [];
  const quiet = (id: string) => id in store.dismissed;
  const navigations = use.reduce((n, p) => n + p.month, 0);

  // A page opened four or more times this week, not pinned: pin it.
  for (const page of use) {
    if (page.week < 4 || !canShortcut(page.key) || store.pins.includes(page.key) || store.hidden.includes(page.key)) continue;
    const id = `pin:${page.key}`;
    if (quiet(id) || store.pins.length >= MAX_SHORTCUTS) continue;
    out.push({
      id, kind: 'pin', page: page.key,
      title: { en: `Pin “${page.label.en}” to your pages.`, el: `Καρφιτσώστε «${page.label.el}» στις σελίδες σας.` },
      evidence: { en: `Opened ${page.week} times this week.`, el: `Την ανοίξατε ${page.week} φορές αυτή την εβδομάδα.` },
    });
    if (out.filter((s) => s.kind === 'pin').length >= 2) break;
  }

  // Keys, for a reader who navigates a lot with a keyboard and has not used them.
  if (opts.keyboard) {
    const chordPage = use.find((p) => p.week >= 3 && GO_CHORDS[p.key]);
    if (chordPage && !(store.via?.chord ?? 0) && !quiet(`chord:${chordPage.key}`)) {
      const letter = GO_CHORDS[chordPage.key];
      out.push({
        id: `chord:${chordPage.key}`, kind: 'chord', page: chordPage.key,
        title: { en: `Press g, then ${letter}, to open “${chordPage.label.en}” from anywhere.`, el: `Πατήστε g και μετά ${letter} για «${chordPage.label.el}» από οποιαδήποτε σελίδα.` },
        evidence: { en: `Opened ${chordPage.week} times this week.`, el: `Την ανοίξατε ${chordPage.week} φορές αυτή την εβδομάδα.` },
      });
    }
    if (navigations >= 20 && !(store.via?.palette ?? 0) && !quiet('palette')) {
      out.push({
        id: 'palette', kind: 'palette',
        title: { en: 'Press Ctrl+K (⌘K on a Mac) and type: any page, person or command, without the menus.', el: 'Πατήστε Ctrl+K (⌘K σε Mac) και γράψτε: οποιαδήποτε σελίδα, άνθρωπος ή εντολή, χωρίς μενού.' },
        evidence: { en: `${navigations} page visits this month, all through the menus.`, el: `${navigations} επισκέψεις σελίδων αυτόν τον μήνα, όλες από τα μενού.` },
      });
    }
  }

  // Repeated moves with a shorter way.
  const month = dayOf(now - (USAGE_WINDOW_DAYS - 1) * DAY_MS);
  for (const flow of WORKFLOWS) {
    const days = store.moves[`${flow.from}>${flow.to}`];
    const count = days ? sumSince(days, month) : 0;
    if (count < 3 || quiet(flow.id)) continue;
    const from = pageLabel(flow.from);
    const to = pageLabel(flow.to);
    out.push({
      id: flow.id, kind: 'workflow', title: flow.title, ask: flow.ask,
      evidence: { en: `You went from ${from.en} to ${to.en} ${count} times this month.`, el: `Πήγατε από «${from.el}» σε «${to.el}» ${count} φορές αυτόν τον μήνα.` },
    });
  }

  // Forms filled by hand that the assistant drafts.
  const handFilled = DRAFTED_FORMS.map((key) => ({ key, month: use.find((p) => p.key === key)?.month ?? 0 })).filter((f) => f.month > 0);
  const formVisits = handFilled.reduce((n, f) => n + f.month, 0);
  if (formVisits >= 2 && !(store.via?.assistant ?? 0) && !quiet('assistant-drafts')) {
    const names = handFilled.map((f) => pageLabel(f.key));
    out.push({
      id: 'assistant-drafts', kind: 'assistant',
      title: { en: 'The assistant fills these forms for you: say what you need, then check and save.', el: 'Ο βοηθός συμπληρώνει αυτές τις φόρμες για εσάς: πείτε τι χρειάζεστε, ελέγξτε και αποθηκεύστε.' },
      evidence: { en: `Filled by hand ${formVisits} times this month: ${names.map((n) => n.en).join(', ')}.`, el: `Συμπληρώθηκαν με το χέρι ${formVisits} φορές αυτόν τον μήνα: ${names.map((n) => n.el).join(', ')}.` },
    });
  }
  return out;
}

/** Whether this screen has a keyboard worth suggesting keys for: a fine pointer that can hover. */
export function hasKeyboardPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** Whether there is enough to say anything: a handful of visits, not one. */
export function hasUsage(store: UsageStore, now: number): boolean {
  return pageUse(store, now).reduce((n, p) => n + p.month, 0) >= 5;
}
