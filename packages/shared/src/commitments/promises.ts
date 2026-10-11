/**
 * Promise language: what a card must not claim.
 *
 * The platform organises a decision about equity, a seat or a round; it does
 * not promise funding, income or returns, and a card that does so speaks for
 * the platform as much as for its author. A "guaranteed return" or «σίγουρο
 * κέρδος» is refused before publishing, in the posting guide and on the
 * server, with the reason. Saying that something is *not* guaranteed is the
 * honest sentence and passes: a match preceded by a negation is skipped.
 */

export type PromiseHit = { index: number; length: number; text: string };

const PROMISE_PATTERNS: RegExp[] = [
  /\bguarantee(?:d|s)?\b/gi,
  /\brisk[\s-]?free\b/gi,
  /\b(?:sure|certain|assured|fixed)\s+(?:profits?|returns?|income|payout)\b/gi,
  /\bpassive\s+income\b/gi,
  /\bget\s+rich\b/gi,
  /\b(?:will|to)\s+(?:definitely\s+)?(?:10x|double|triple)\s+(?:your\s+)?(?:money|investment|capital)\b/gi,
  /\b\d{2,3}\s?%\s+(?:guaranteed\s+)?(?:annual\s+)?returns?\b/gi,
  /εγγυημέν\p{L}*|εγγυημεν\p{L}*|εγγυ(?:άται|ωμαστε|όμαστε|ούμαστε)|εγγύηση/giu,
  /σίγουρ\p{L}*\s+(?:κέρδ\p{L}*|απόδοσ\p{L}*|αποδόσ\p{L}*|εισόδημα|έσοδα|χρηματοδότηση)/giu,
  /(?:χωρίς|μηδενικό|μηδενικός)\s+(?:ρίσκο|κίνδυνο)/giu,
  /παθητικό\s+εισόδημα/giu,
  /(?:διπλασιάσ|τριπλασιάσ)\p{L}*\s+(?:τα\s+χρήματα|την\s+επένδυση|το\s+κεφάλαιο)/giu,
];

/** "we do not guarantee", «δεν εγγυόμαστε», "no guarantee" — the honest form. */
// `\b` is ASCII-only even with the `u` flag, so a word start is spelled out.
const NEGATION_BEFORE = /(?:(?:^|[^\p{L}])(?:no|not|never|without|cannot|nor|δεν|μην|ούτε|καμία|κανένα|χωρίς)|n't)\s+(?:\p{L}+\s+){0,2}$/iu;

export function findPromiseClaims(text: string): PromiseHit[] {
  if (!text) return [];
  const hits: PromiseHit[] = [];
  for (const pattern of PROMISE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const before = text.slice(Math.max(0, index - 40), index);
      // «χωρίς ρίσκο» is itself the promise, so «χωρίς» negates only other words.
      const isRiskFree = /^(?:χωρίς|μηδενικ)/iu.test(match[0]);
      if (!isRiskFree && NEGATION_BEFORE.test(before)) continue;
      hits.push({ index, length: match[0].length, text: match[0] });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function hasPromiseClaims(text: string): boolean {
  return findPromiseClaims(text).length > 0;
}

/**
 * The sentence shown wherever equity, percentages or funding appear. Kept
 * here so the web app, the public card and the server's own copy agree.
 */
export const NON_GUARANTEE_COPY = {
  en: 'CoFounderBay organises the decision. It does not promise funding, income or returns.',
  el: 'Το CoFounderBay οργανώνει την απόφαση. Δεν υπόσχεται χρηματοδότηση, εισόδημα ή αποδόσεις.',
} as const;
