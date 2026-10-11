/**
 * Paid placement in discovery, labelled as what it is.
 *
 * The Pro plan sold "Priority in discovery" with nothing behind it. It is
 * now a separate, labelled slot: at most `PROMOTED_SLOTS` people on a paid
 * plan who *already match the search*, shown above the results under
 * "Promoted". The organic list keeps its order (the promoted people are
 * taken out of it, not moved within it), and nobody's match score changes.
 * Recommendations, the scout and matching never read the plan.
 */

export const PROMOTED_SLOTS = 2;

/** The plan feature that buys the slot. */
export const PROMOTION_FEATURE = 'priorityDiscovery';

/** Plans that sell it, for plan rows written before the feature key existed. */
export const PROMOTING_PLANS = ['pro', 'team', 'enterprise'] as const;

export function planPromotes(plan: { name?: string | null; features?: unknown } | null | undefined): boolean {
  if (!plan) return false;
  const features = (plan.features ?? {}) as Record<string, unknown>;
  if (features[PROMOTION_FEATURE] === false) return false;
  return features[PROMOTION_FEATURE] === true || (PROMOTING_PLANS as readonly string[]).includes(String(plan.name ?? '').toLowerCase());
}

/**
 * Splits a page of results into the promoted slot and the organic rest. Only
 * people already in `hits` can be promoted; the rest keep their order.
 */
export function splitPromoted<T extends { userId: string }>(hits: readonly T[], promotedUserIds: readonly string[], slots = PROMOTED_SLOTS): { promoted: T[]; organic: T[] } {
  const wanted = new Set(promotedUserIds);
  const promoted = hits.filter((h) => wanted.has(h.userId)).slice(0, slots);
  const taken = new Set(promoted.map((h) => h.userId));
  return { promoted, organic: hits.filter((h) => !taken.has(h.userId)) };
}

export const PROMOTED_COPY = {
  label: { en: 'Promoted', el: 'Προώθηση' },
  disclosure: {
    en: 'Paid placement for members on a paid plan who match this search. It does not change anyone’s match score or the order of the results below.',
    el: 'Πληρωμένη θέση για μέλη με συνδρομή που ταιριάζουν σε αυτή την αναζήτηση. Δεν αλλάζει τη βαθμολογία κανενός ούτε τη σειρά των αποτελεσμάτων παρακάτω.',
  },
  plan: { en: 'Promoted placement in discovery, always labelled “Promoted”', el: 'Προωθημένη θέση στην αναζήτηση, πάντα με την ένδειξη «Προώθηση»' },
} as const;
