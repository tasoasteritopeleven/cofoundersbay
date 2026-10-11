/**
 * Saved searches in the preview demo.
 *
 * The API keeps saved searches in `SavedSearch` (`apps/api/src/saved-searches`);
 * before this module the demo answered `/api/saved-searches` with the generic
 * fallback, so the page listed nothing it could rename or alert on. These two
 * searches are the demo founder's own, in the shapes the API returns. State
 * lives in sessionStorage so a rename or an alert toggle survives navigation.
 */

import { CARD_COMMITMENTS, CARD_STAGES, foldSearchText, placeVariants } from '@cofounderbay/shared';
import { previewCommitmentsApi } from './commitments-world';

export interface DemoSavedSearch {
  id: string;
  scope?: 'people' | 'need_cards';
  name: string;
  query: string;
  filters: {
    roles?: string[]; skills?: string[]; industries?: string[]; locations?: string[]; stage?: string[];
    kinds?: string[]; remote?: string[]; categories?: string[]; commitments?: string[]; places?: string[];
  };
  alertsEnabled: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly';
  lastRun?: string;
  resultCount?: number;
  newResults?: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'cfb:demo-saved-searches:v1';
const FREQUENCIES = ['instant', 'daily', 'weekly'] as const;
const DAY = 86_400_000;
let memory: DemoSavedSearch[] | null = null;

function seed(now: number): DemoSavedSearch[] {
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
  return [
    {
      id: 'ss-commercial-athens',
      name: 'Commercial co-founder, Athens',
      query: 'sales partnerships',
      filters: { roles: ['founder'], industries: ['ClimateTech'], locations: ['Athens'] },
      alertsEnabled: true,
      alertFrequency: 'daily',
      lastRun: iso(3),
      resultCount: 4,
      newResults: 2,
      createdAt: iso(21),
      updatedAt: iso(3),
    },
    {
      // A need-card search (scope need_cards): other members' co-founder cards.
      id: 'ss-cofounder-cards',
      scope: 'need_cards',
      name: 'Co-founder cards',
      query: '',
      filters: { kinds: ['cofounder'] },
      alertsEnabled: true,
      alertFrequency: 'weekly',
      lastRun: iso(6),
      resultCount: 1,
      newResults: 1,
      createdAt: iso(14),
      updatedAt: iso(6),
    },
    {
      id: 'ss-fundraising-mentors',
      name: 'Fundraising mentors',
      query: 'fundraising',
      filters: { roles: ['mentor'] },
      alertsEnabled: false,
      alertFrequency: 'weekly',
      lastRun: iso(9),
      resultCount: 3,
      createdAt: iso(30),
      updatedAt: iso(9),
    },
  ];
}

function load(now: number): DemoSavedSearch[] {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as DemoSavedSearch[]) : seed(now);
  } catch {
    memory = seed(now);
  }
  return memory;
}

function save() {
  try {
    if (memory && typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage blocked: the demo keeps working for this page view.
  }
}

export function resetDemoSavedSearches() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function list(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, 20) : undefined;
}

/** Answers `/api/saved-searches…` for the demo, or `undefined` for any other path. */
export function previewSavedSearchesApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/saved-searches')) return undefined;
  const rows = load(now);
  const stamp = new Date(now).toISOString();
  const [, , , id, action] = pathname.split('/');

  if (!id) {
    if (method === 'GET') return { searches: [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    if (method === 'POST') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      const raw = (body.filters ?? {}) as Record<string, unknown>;
      const cards = body.scope === 'need_cards';
      const search: DemoSavedSearch = {
        id: `ss-demo-${now.toString(36)}`,
        scope: cards ? 'need_cards' : 'people',
        name: name || 'Untitled search',
        query: typeof body.query === 'string' ? body.query.trim().slice(0, 200) : '',
        // The same keys the API keeps for each scope; anything else is dropped.
        filters: cards
          ? {
              kinds: list(raw.kinds)?.filter((k) => ['cofounder', 'equity_role', 'investor_intro'].includes(k)),
              remote: list(raw.remote)?.includes('true') ? ['true'] : undefined,
              stage: list(raw.stage)?.filter((v) => (CARD_STAGES as readonly string[]).includes(v)),
              commitments: list(raw.commitments)?.filter((v) => (CARD_COMMITMENTS as readonly string[]).includes(v)),
              categories: list(raw.categories),
              places: list(raw.places),
            }
          : { roles: list(raw.roles), skills: list(raw.skills), industries: list(raw.industries), locations: list(raw.locations), stage: list(raw.stage) },
        alertsEnabled: body.alertsEnabled === true,
        alertFrequency: (FREQUENCIES as readonly unknown[]).includes(body.alertFrequency) ? (body.alertFrequency as DemoSavedSearch['alertFrequency']) : 'daily',
        createdAt: stamp,
        updatedAt: stamp,
      };
      if (cards) search.resultCount = matchingCards(search, now).length;
      rows.unshift(search);
      save();
      return { search };
    }
    return undefined;
  }

  const row = rows.find((r) => r.id === decodeURIComponent(id));
  if (!row) return { search: null };
  if (action === 'run' && method === 'POST') {
    row.lastRun = stamp;
    row.newResults = undefined;
    if (row.scope === 'need_cards') {
      const results = matchingCards(row, now);
      row.resultCount = results.length;
      save();
      return { results, count: results.length };
    }
    save();
    return { results: [], count: row.resultCount ?? 0 };
  }
  if (method === 'PATCH') {
    if (typeof body.name === 'string' && body.name.trim()) row.name = body.name.trim().slice(0, 80);
    if (typeof body.alertsEnabled === 'boolean') row.alertsEnabled = body.alertsEnabled;
    if ((FREQUENCIES as readonly unknown[]).includes(body.alertFrequency)) row.alertFrequency = body.alertFrequency as DemoSavedSearch['alertFrequency'];
    row.updatedAt = stamp;
    save();
    return { search: row };
  }
  if (method === 'DELETE') {
    rows.splice(rows.indexOf(row), 1);
    save();
    return { ok: true };
  }
  return undefined;
}

/**
 * Other people's need cards that still take interest (open or in discussion)
 * and fit a need-card search, from the demo
 * commitments world: what the API's alert would count. Never the demo
 * founder's own cards.
 */
function matchingCards(search: DemoSavedSearch, now: number): Array<{ id: string; title: string; kind: string }> {
  const board = previewCommitmentsApi('/api/commitments/cards', '/api/commitments/cards', 'GET', {}, now) as { cards?: Array<Record<string, unknown>> } | undefined;
  const words = search.query.toLowerCase().split(/\s+/).filter(Boolean);
  return (board?.cards ?? [])
    .filter((c) => c.isMine !== true && (c.outcome === 'open' || c.outcome === 'in_discussion'))
    .filter((c) => !search.filters.kinds?.length || search.filters.kinds.includes(String(c.kind)))
    .filter((c) => !search.filters.remote?.length || c.isRemote === true)
    // The API's other need-card filters, read the same way (findCards).
    .filter((c) => !search.filters.stage?.length || search.filters.stage.includes(String(c.stage)))
    .filter((c) => !search.filters.commitments?.length || search.filters.commitments.includes(String(c.commitment)))
    .filter((c) => !search.filters.categories?.length || search.filters.categories.some((v) => foldSearchText(v) === foldSearchText(String(c.category ?? ''))))
    .filter((c) => !search.filters.places?.length || search.filters.places.flatMap((p) => placeVariants(p)).some((v) => foldSearchText(String(c.place ?? '')).includes(foldSearchText(v))))
    .filter((c) => words.every((w) => `${c.title} ${c.exists} ${c.goal} ${c.missing}`.toLowerCase().includes(w)))
    .map((c) => ({ id: String(c.id), title: String(c.title), kind: String(c.kind) }));
}
