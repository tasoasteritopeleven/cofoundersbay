import { CARD_COMMITMENTS, CARD_STAGES, isInHistory, placeVariants, foldSearchText, type CommitmentKind } from '@cofounderbay/shared';
import type { CommitmentCard } from '@/lib/commitments-api';
import { statusEl } from '@/components/common/StatusText';

/**
 * The need-card wall on /opportunities: which cards the board shows, the four
 * chips that narrow it (category, place, stage, commitment) and the counts
 * each chip offers. One module for the section, the page's assistant
 * controls and the saved-search alert, so the three cannot disagree.
 */

/** The newest cards the board reads at once (the API's own cap per request). */
export const BOARD_LIMIT = 100;

export const CHIP_KEYS = ['category', 'place', 'stage', 'commitment'] as const;
export type ChipKey = (typeof CHIP_KEYS)[number];
/** '' is "any". */
export type CardChips = Record<ChipKey, string>;
export const NO_CHIPS: CardChips = { category: '', place: '', stage: '', commitment: '' };

export const CHIP_LABEL: Record<ChipKey, { en: string; el: string }> = {
  category: { en: 'Category', el: 'Κατηγορία' },
  place: { en: 'Place', el: 'Τόπος' },
  stage: { en: 'Stage', el: 'Στάδιο' },
  commitment: { en: 'Commitment', el: 'Δέσμευση' },
};

/** The city part of a place ("Athens, Greece" → "Athens"), which is what people choose between. */
export function cityOf(place: string | null | undefined): string {
  return (place ?? '').split(',')[0]?.trim() ?? '';
}

/**
 * What the board shows any member: other people's cards that still take
 * interest, plus agreed ones for thirty days, inside the page's type,
 * remote and word filters.
 */
export function boardCards(
  cards: readonly CommitmentCard[],
  { kinds, remoteOnly, search, now }: { kinds: readonly CommitmentKind[]; remoteOnly: boolean; search: string; now: number },
): CommitmentCard[] {
  const words = search.trim().toLowerCase();
  return cards
    .filter((c) => !c.isMine && kinds.includes(c.kind))
    .filter((c) => c.outcome === 'open' || c.outcome === 'in_discussion' || (c.outcome === 'agreed' && !isInHistory(c.settledAt, now)))
    .filter((c) => !remoteOnly || c.isRemote)
    .filter((c) => !words || `${c.title} ${c.exists} ${c.goal} ${c.missing} ${c.offer?.role ?? ''} ${c.category} ${c.place ?? ''}`.toLowerCase().includes(words));
}

function fits(card: CommitmentCard, key: ChipKey, value: string): boolean {
  if (!value) return true;
  if (key === 'category') return foldSearchText(card.category ?? '') === foldSearchText(value);
  if (key === 'place') {
    const place = foldSearchText(card.place ?? '');
    return placeVariants(value).some((v) => place.includes(foldSearchText(v)));
  }
  if (key === 'stage') return card.stage === value;
  return card.commitment === value;
}

/** The cards every set chip allows; `except` leaves one chip out (for that chip's own counts). */
export function applyChips(cards: readonly CommitmentCard[], chips: CardChips, except?: ChipKey): CommitmentCard[] {
  return cards.filter((c) => CHIP_KEYS.every((k) => k === except || fits(c, k, chips[k])));
}

export type ChipOption = { value: string; en: string; el: string; count: number };

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function enumLabel(value: string): { en: string; el: string } {
  const el = statusEl(value);
  return { en: humanize(value), el: el ? el.charAt(0).toUpperCase() + el.slice(1) : humanize(value) };
}

/**
 * Each chip's choices with how many cards each would show, counted with the
 * other chips applied (faceted), so a choice never promises cards it would
 * not show. A chosen value stays listed even at zero, so it can be seen and
 * changed; stages and commitments keep their product order.
 */
export function chipOptions(cards: readonly CommitmentCard[], chips: CardChips): Record<ChipKey, ChipOption[]> {
  const out = {} as Record<ChipKey, ChipOption[]>;
  for (const key of CHIP_KEYS) {
    const pool = applyChips(cards, chips, key);
    let values: { value: string; en: string; el: string }[];
    if (key === 'stage') values = CARD_STAGES.map((v) => ({ value: v, ...enumLabel(v) }));
    else if (key === 'commitment') values = CARD_COMMITMENTS.map((v) => ({ value: v, ...enumLabel(v) }));
    else {
      // One choice per spelling-insensitive value, named by its most common
      // spelling on the whole board, so a narrower pool cannot rename it.
      const valueOf = (c: CommitmentCard) => (key === 'category' ? (c.category ?? '').trim() : cityOf(c.place));
      const spellings = new Map<string, Map<string, number>>();
      for (const c of cards) {
        const v = valueOf(c);
        if (!v) continue;
        const forms = spellings.get(foldSearchText(v)) ?? new Map<string, number>();
        forms.set(v, (forms.get(v) ?? 0) + 1);
        spellings.set(foldSearchText(v), forms);
      }
      const named = (folded: string, fallback: string) =>
        [...(spellings.get(folded)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
      const seen = new Map<string, string>();
      for (const c of pool) {
        const v = valueOf(c);
        if (v && !seen.has(foldSearchText(v))) seen.set(foldSearchText(v), named(foldSearchText(v), v));
      }
      if (chips[key] && !seen.has(foldSearchText(chips[key]))) seen.set(foldSearchText(chips[key]), chips[key]);
      values = [...seen.values()].map((v) => ({ value: v, en: v, el: v }));
    }
    const counted = values
      .map((v) => ({ ...v, count: pool.filter((c) => fits(c, key, v.value)).length }))
      .filter((o) => o.count > 0 || o.value === chips[key]);
    out[key] = key === 'category' || key === 'place' ? counted.sort((a, b) => b.count - a.count || a.en.localeCompare(b.en)) : counted;
  }
  return out;
}

/** The chosen chips in reading order, for the empty state and the alert's name. */
export function chipSummary(chips: CardChips): { en: string; el: string } | null {
  const set = CHIP_KEYS.filter((k) => chips[k]);
  if (!set.length) return null;
  const valueOf = (k: ChipKey, lang: 'en' | 'el') =>
    k === 'stage' || k === 'commitment' ? enumLabel(chips[k])[lang] : chips[k];
  return {
    en: set.map((k) => `${CHIP_LABEL[k].en}: ${valueOf(k, 'en')}`).join(' · '),
    el: set.map((k) => `${CHIP_LABEL[k].el}: ${valueOf(k, 'el')}`).join(' · '),
  };
}

export function activeChipCount(chips: CardChips): number {
  return CHIP_KEYS.filter((k) => chips[k]).length;
}

/** Chips from a link (`?category=&place=&stage=&commitment=`), keeping only valid stage and commitment values. */
export function chipsFromParams(params: URLSearchParams): CardChips {
  const stage = params.get('stage') ?? '';
  const commitment = params.get('commitment') ?? '';
  return {
    category: (params.get('category') ?? '').slice(0, 60),
    place: (params.get('place') ?? '').slice(0, 60),
    stage: (CARD_STAGES as readonly string[]).includes(stage) ? stage : '',
    commitment: (CARD_COMMITMENTS as readonly string[]).includes(commitment) ? commitment : '',
  };
}

/** The saved-search filters the API's need-card alert reads (`categories`, `places`, `stage`, `commitments`). */
export function chipsToSavedFilters(chips: CardChips): Record<string, string[]> {
  return {
    ...(chips.category ? { categories: [chips.category] } : {}),
    ...(chips.place ? { places: [chips.place] } : {}),
    ...(chips.stage ? { stage: [chips.stage] } : {}),
    ...(chips.commitment ? { commitments: [chips.commitment] } : {}),
  };
}

/** The other way, for opening a saved need-card search in /opportunities. */
export function savedFiltersToParams(filters: Partial<Record<string, string[]>> | undefined, params: URLSearchParams): void {
  const first = (key: string) => filters?.[key]?.[0];
  const pairs: [ChipKey, string | undefined][] = [
    ['category', first('categories')],
    ['place', first('places')],
    ['stage', first('stage')],
    ['commitment', first('commitments')],
  ];
  for (const [key, value] of pairs) if (value) params.set(key, value);
}

/** The chips as `listCommitmentCards` filters, for the server once the board is full. */
export function chipsToCardFilters(chips: CardChips): Partial<Record<ChipKey, string>> {
  const out: Partial<Record<ChipKey, string>> = {};
  for (const key of CHIP_KEYS) if (chips[key]) out[key] = chips[key];
  return out;
}
