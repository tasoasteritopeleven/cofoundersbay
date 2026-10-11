/**
 * Contact details and off-platform moves, found in free text.
 *
 * The first conversation about a commitment - a co-founder seat, equity, an
 * investor introduction - stays inside the platform until both people have
 * separately said they want to discuss terms. Until then a message carrying
 * a phone number, an email address, a link, a social handle, an invitation to
 * another app or payment details is refused (not rewritten), and the sender is
 * told which kind it carried. The same check runs in the browser as the
 * person types and on the server, which is the enforcement point.
 *
 * Tuned for the people who use this product: Greek mobile and landline
 * numbers with or without +30/0030, Viber (the default messenger in Greece),
 * IBANs written in groups, the Greek «παπάκι» for @, and «πάρε με τηλέφωνο».
 * It is a filter against casual leakage and harvesting, not a guarantee.
 * Funding amounts, equity ranges and years are not phone numbers, which is
 * why a run needs nine digits before it counts - whether the digits are
 * typed or spelled out («six nine eight one…», «έξι εννιά οκτώ…»).
 */

export type ContactKind = 'email' | 'payment' | 'link' | 'phone' | 'handle' | 'messenger';

export type ContactHit = { kind: ContactKind; index: number; length: number };

type Rule = { kind: ContactKind; pattern: RegExp; accept?: (match: string) => boolean };

const digitsIn = (text: string) => (text.match(/\d/g) ?? []).length;

/** Luhn, so a 16-digit card number is told apart from a long phone run. */
function passesLuhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const TLDS = 'com|net|org|io|co|ai|app|dev|me|eu|gr|cy|uk|de|fr|it|es|xyz|link|ly|gg|to|tv|info|biz|page|site|online|store';

// Single digits as words, accented and unaccented; «oh» for zero the way
// numbers are dictated in English. Each is matched only as a whole word.
const DIGIT_WORD =
  'zero|one|two|three|four|five|six|seven|eight|nine|oh|' +
  'μηδέν|μηδεν|ένα|ενα|ένας|ενας|μία|μια|δύο|δυο|τρία|τρεις|τρια|' +
  'τέσσερα|τεσσερα|τέσσερις|τεσσερις|πέντε|πεντε|έξι|εξι|' +
  'επτά|επτα|εφτά|εφτα|οκτώ|οκτω|οχτώ|οχτω|εννέα|εννεα|εννιά|εννια';

// Order matters: an earlier rule claims its span, so an email is not also
// reported as a link and an IBAN is not also reported as a phone number.
const RULES: Rule[] = [
  { kind: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'email', pattern: /[\w.+-]+\s*[([{]\s*at\s*[)\]}]\s*[\w-]+\s*(?:[([{]\s*dot\s*[)\]}]|\.|\s+dot\s+)\s*[a-z]{2,}\b/gi },
  { kind: 'email', pattern: /\b[\w.+-]+\s+at\s+[\w-]+\s+dot\s+[a-z]{2,}\b/gi },
  { kind: 'email', pattern: /[\w.+-]+\s+παπάκι\s+[\w-]+/giu },
  // IBAN, written whole or in groups of four (GR16 0110 1250 0000 0001 2300 695).
  { kind: 'payment', pattern: /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/g, accept: (m) => digitsIn(m) >= 10 },
  { kind: 'payment', pattern: /\b\d(?:[ -]?\d){12,18}\b/g, accept: passesLuhn },
  { kind: 'payment', pattern: /\b0x[a-fA-F0-9]{40}\b/g },
  { kind: 'payment', pattern: /\b(?:bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,39}\b/g },
  { kind: 'payment', pattern: /\b(?:paypal(?:\.me)?|revolut|venmo|cash\s?app|iban|swift\s+code|bic\s+code)\b/gi },
  { kind: 'payment', pattern: /\biris\s+(?:pay|payments?)\b|μέσω\s+iris/giu },
  { kind: 'link', pattern: /\bhttps?:\/\/\S+/gi },
  { kind: 'link', pattern: /\bwww\.\S+/gi },
  { kind: 'link', pattern: /\b(?:t|wa)\.me\/\S+/gi },
  { kind: 'link', pattern: new RegExp(`\\b[a-z0-9][a-z0-9-]{1,62}(?:\\.[a-z0-9-]{1,62})*\\.(?:${TLDS})\\b(?:/\\S*)?`, 'gi') },
  // Nine digits or more, allowing the separators people type. Greek numbers
  // are ten digits (69..., 21...), twelve with +30.
  { kind: 'phone', pattern: /(?:\+|\b00)?\d[\d\s().-]{6,}\d/g, accept: (m) => digitsIn(m) >= 9 },
  // The same run spelled out, word by word, in either language. A phone
  // dictated aloud («six nine eight one two…», «έξι εννιά οκτώ ένα δύο…»)
  // is nine or more consecutive digit words; ordinary prose never runs
  // that many together, so no phone-shaped context is required.
  {
    kind: 'phone',
    pattern: new RegExp(
      `(?<![\\p{L}])(?:${DIGIT_WORD})(?:[\\s,.;·-]+(?:${DIGIT_WORD})){8,}(?![\\p{L}])`,
      'giu',
    ),
  },
  { kind: 'phone', pattern: /(?:(?<![\p{L}])τηλ\.?|τηλέφωνο|τηλεφωνο|(?<![\p{L}])κιν\.?|κινητό|κινητο|\btel\.?|\bphone|\bmobile)\s*[:：]?\s*\+?\d[\d\s.-]{3,}/giu },
  { kind: 'handle', pattern: /(?:^|(?<=[\s(]))@[A-Za-z0-9_][A-Za-z0-9_.]{1,29}/g },
  // Naming the app is an invitation to leave: these are almost never used
  // for anything else.
  { kind: 'messenger', pattern: /\b(?:whats\s?app|viber|wechat|signal\s+app)\b|βάιμπερ|βαιμπερ|γουάτσαπ|γουατσαπ/giu },
  // An app that is also a company (a former employer is fine to mention)
  // counts only when the sentence asks to be found there.
  {
    kind: 'messenger',
    pattern: /\b(?:add|find|dm|message|msg|ping|text|reach|contact)\s+me\s+(?:on|at|via)\b|\b(?:call|text|ring)\s+me\b|\bmy\s+(?:number|cell|mobile|phone|email|e-mail|linkedin|instagram|insta|telegram|facebook|tiktok|twitter|handle)\s+(?:is|:)/gi,
  },
  {
    kind: 'messenger',
    pattern: /(?:πάρε|παρε|πάρτε|παρτε)\s+με\s+(?:ένα\s+|ενα\s+)?(?:τηλέφωνο|τηλεφωνο)|(?<![\p{L}])(?:στο|το)\s+(?:κινητό|κινητο|viber|βάιμπερ)\s+μου|(?:βρες|βρείτε|βρειτε)\s+με\s+(?:στο|στην|στα)(?![\p{L}])/giu,
  },
];

/** Every contact detail in the text, earliest first, never overlapping. */
export function findContactDetails(text: string): ContactHit[] {
  if (!text) return [];
  const claimed: Array<[number, number]> = [];
  const hits: ContactHit[] = [];
  const overlaps = (start: number, end: number) => claimed.some(([s, e]) => start < e && end > s);

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const raw = match[0];
      const start = match.index ?? 0;
      const end = start + raw.length;
      if (!raw.trim() || overlaps(start, end)) continue;
      if (rule.accept && !rule.accept(raw)) continue;
      claimed.push([start, end]);
      hits.push({ kind: rule.kind, index: start, length: raw.length });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** The kinds found, each once, in a stable order. */
export function contactKinds(text: string): ContactKind[] {
  const found = new Set(findContactDetails(text).map((hit) => hit.kind));
  return CONTACT_KIND_ORDER.filter((kind) => found.has(kind));
}

export const CONTACT_KIND_ORDER: readonly ContactKind[] = ['phone', 'email', 'link', 'handle', 'messenger', 'payment'];

/** How a refusal names what it found, in both languages. */
export const CONTACT_KIND_COPY: Record<ContactKind, { en: string; el: string }> = {
  phone: { en: 'a phone number', el: 'αριθμό τηλεφώνου' },
  email: { en: 'an email address', el: 'διεύθυνση email' },
  link: { en: 'a link', el: 'σύνδεσμο' },
  handle: { en: 'a social handle', el: 'λογαριασμό κοινωνικού δικτύου' },
  messenger: { en: 'a move to another app', el: 'μετάβαση σε άλλη εφαρμογή' },
  payment: { en: 'payment details', el: 'στοιχεία πληρωμής' },
};

/** «a phone number and a link» / «αριθμό τηλεφώνου και σύνδεσμο». */
export function describeContactKinds(kinds: readonly ContactKind[]): { en: string; el: string } {
  const join = (parts: string[], and: string) =>
    parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
  return {
    en: join(kinds.map((k) => CONTACT_KIND_COPY[k].en), 'and'),
    el: join(kinds.map((k) => CONTACT_KIND_COPY[k].el), 'και'),
  };
}
