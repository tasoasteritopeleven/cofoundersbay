/**
 * Plain-language search for the people directory.
 *
 * "συνιδρυτής fintech Θεσσαλονίκη part-time" is four filters, not a phrase:
 * the `/discover` field used to send it as one string, and the API matched
 * it as one substring, so it found nobody. `readNaturalSearch` takes the
 * words it recognises out of the text and returns them as the same filter
 * values the Filters sheet sets; whatever it does not recognise (a name, a
 * skill, "technical") stays free text. It recognises a closed vocabulary
 * in English and Greek and guesses nothing else.
 *
 * Skills are deliberately left as text. The skill filter is an exact match
 * on a skill's name, so "developer" as a filter would drop every profile
 * that lists "TypeScript" instead; as text it still matches headlines,
 * bios and skill names.
 */

export type NaturalFilterKind = 'role' | 'industry' | 'stage' | 'availability' | 'fundingStage' | 'language' | 'location';

export interface NaturalFilter {
  kind: NaturalFilterKind;
  /** The value the Filters sheet uses for this choice. */
  value: string;
  en: string;
  el: string;
}

export interface NaturalSearch {
  roles: string[];
  industries: string[];
  stage: string[];
  availability: string[];
  fundingStage: string[];
  languages: string[];
  location: string | null;
  /** What was not recognised, in the order typed, without filler words. */
  rest: string;
  /** Every recognised term, in the order it was found, for "Understood as". */
  understood: NaturalFilter[];
}

/**
 * Lower case, with Greek accents and diaeresis removed, one character out for
 * every character in, so a position in the folded text is the same position
 * in the text as typed.
 */
export function foldSearchText(text: string): string {
  let out = '';
  for (const ch of String(text ?? '').normalize('NFC')) {
    const f = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    out += f.length === ch.length ? f : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out;
}

interface Term {
  kind: NaturalFilterKind;
  value: string;
  en: string;
  el: string;
  /** Patterns over folded text; `*` at the end of a word means "any ending". */
  words: string[];
}

/*
 * Greek nouns decline («Θεσσαλονίκη», «της Θεσσαλονίκης»; «συνιδρυτής»,
 * «συνιδρυτή»), so a Greek key is a stem followed by `*`. Longer phrases
 * come before the shorter words inside them ("angel investor" before
 * "investor", "series a" before "a").
 */
const TERMS: Term[] = [
  // Roles: the four directory roles of the Filters sheet.
  { kind: 'role', value: 'founder', en: 'Founder', el: 'Ιδρυτής', words: ['co-founder*', 'co founder*', 'cofounder*', 'founder*', 'συνιδρυτ*', 'ιδρυτ*'] },
  { kind: 'role', value: 'mentor', en: 'Mentor', el: 'Μέντορας', words: ['mentor*', 'μεντορ*', 'καθοδηγητ*'] },
  { kind: 'role', value: 'investor', en: 'Investor', el: 'Επενδυτής', words: ['angel investor*', 'business angel*', 'investor*', 'angel*', 'vcs', 'vc', 'επενδυτ*'] },
  { kind: 'role', value: 'org', en: 'Organisation', el: 'Οργανισμός', words: ['organisation*', 'organization*', 'incubator*', 'accelerator*', 'οργανισμ*', 'θερμοκοιτιδ*', 'επιταχυντ*'] },

  // Industries: the values of the sheet's industry list.
  { kind: 'industry', value: 'Fintech', en: 'Fintech', el: 'Fintech', words: ['fintech*', 'χρηματοοικονομικη τεχνολογια'] },
  { kind: 'industry', value: 'Healthtech', en: 'Healthtech', el: 'Υγεία', words: ['healthtech*', 'health tech', 'medtech', 'υγει*'] },
  { kind: 'industry', value: 'AI/ML', en: 'AI/ML', el: 'AI/ML', words: ['ai/ml', 'machine learning', 'artificial intelligence', 'τεχνητη νοημοσυνη', 'μηχανικη μαθηση'] },
  { kind: 'industry', value: 'E-commerce', en: 'E-commerce', el: 'Ηλεκτρονικό εμπόριο', words: ['e-commerce', 'ecommerce', 'ηλεκτρονικο εμποριο', 'ηλεκτρονικου εμποριου'] },
  { kind: 'industry', value: 'SaaS', en: 'SaaS', el: 'SaaS', words: ['saas'] },
  { kind: 'industry', value: 'Marketplace', en: 'Marketplace', el: 'Marketplace', words: ['marketplace*'] },
  { kind: 'industry', value: 'Gaming', en: 'Gaming', el: 'Παιχνίδια', words: ['gaming', 'games', 'video games', 'βιντεοπαιχνιδι*'] },
  { kind: 'industry', value: 'Education', en: 'Education', el: 'Εκπαίδευση', words: ['edtech', 'education', 'εκπαιδευσ*'] },
  { kind: 'industry', value: 'Climate', en: 'Climate', el: 'Κλίμα', words: ['climate tech', 'climatetech', 'climate', 'cleantech', 'κλιμα*'] },
  { kind: 'industry', value: 'Web3/Crypto', en: 'Web3/Crypto', el: 'Web3/Crypto', words: ['web3', 'crypto', 'blockchain'] },
  { kind: 'industry', value: 'Hardware', en: 'Hardware', el: 'Hardware', words: ['hardware'] },
  { kind: 'industry', value: 'Enterprise', en: 'Enterprise', el: 'Enterprise', words: ['b2b', 'enterprise'] },
  { kind: 'industry', value: 'Consumer', en: 'Consumer', el: 'Καταναλωτικά', words: ['b2c', 'consumer'] },

  // Startup stage.
  { kind: 'stage', value: 'idea', en: 'Idea stage', el: 'Στάδιο ιδέας', words: ['idea stage', 'idea', 'ιδεα*'] },
  { kind: 'stage', value: 'mvp', en: 'MVP', el: 'MVP', words: ['mvp'] },
  { kind: 'stage', value: 'traction', en: 'Traction', el: 'Έλξη', words: ['traction', 'ελξη'] },
  { kind: 'stage', value: 'scaling', en: 'Scaling', el: 'Κλιμάκωση', words: ['scaling', 'scale-up', 'scaleup', 'κλιμακωσ*'] },

  // Time commitment.
  { kind: 'availability', value: 'full-time', en: 'Full-time', el: 'Πλήρης απασχόληση', words: ['full-time', 'full time', 'fulltime', 'πληρης απασχολησ*', 'πληρους απασχολησ*', 'πληρη απασχολησ*'] },
  { kind: 'availability', value: 'part-time', en: 'Part-time', el: 'Μερική απασχόληση', words: ['part-time', 'part time', 'parttime', 'μερικη απασχολησ*', 'μερικης απασχολησ*'] },
  { kind: 'availability', value: 'weekends', en: 'Weekends only', el: 'Μόνο Σαββατοκύριακα', words: ['weekends', 'weekend', 'σαββατοκυριακ*'] },
  { kind: 'availability', value: 'flexible', en: 'Flexible', el: 'Ευέλικτα', words: ['flexible hours', 'flexible', 'ευελικτ*'] },

  // Funding stage.
  { kind: 'fundingStage', value: 'pre-seed', en: 'Pre-seed', el: 'Pre-seed', words: ['pre-seed', 'pre seed', 'preseed'] },
  { kind: 'fundingStage', value: 'seed', en: 'Seed', el: 'Seed', words: ['seed'] },
  { kind: 'fundingStage', value: 'series-a', en: 'Series A', el: 'Series A', words: ['series a', 'series-a'] },
  { kind: 'fundingStage', value: 'series-b', en: 'Series B+', el: 'Series B+', words: ['series b', 'series-b', 'series c'] },
  { kind: 'fundingStage', value: 'bootstrapped', en: 'Bootstrapped', el: 'Ιδία κεφάλαια', words: ['bootstrapped', 'bootstrapping', 'ιδια κεφαλαια'] },

  // Languages spoken.
  { kind: 'language', value: 'Greek', en: 'Speaks Greek', el: 'Μιλά ελληνικά', words: ['greek speaking', 'speaks greek', 'ελληνοφων*', 'μιλα ελληνικα'] },
  { kind: 'language', value: 'English', en: 'Speaks English', el: 'Μιλά αγγλικά', words: ['english speaking', 'speaks english', 'αγγλοφων*', 'μιλα αγγλικα'] },
];

/**
 * Places, with every spelling the directory may hold. `value` is what the
 * location filter carries; `variants` is what the API matches for it, so a
 * profile written «Θεσσαλονίκη» is found by "Thessaloniki" and the reverse.
 */
export const PLACE_ALIASES: ReadonlyArray<{ value: string; el: string; words: string[]; variants: string[] }> = [
  { value: 'Athens', el: 'Αθήνα', words: ['athens', 'athina', 'αθην*'], variants: ['Athens', 'Athina', 'Αθήνα'] },
  { value: 'Thessaloniki', el: 'Θεσσαλονίκη', words: ['thessaloniki', 'salonica', 'θεσσαλονικ*', 'σαλονικ*'], variants: ['Thessaloniki', 'Θεσσαλονίκη'] },
  { value: 'Patras', el: 'Πάτρα', words: ['patras', 'patra', 'πατρα', 'πατρας'], variants: ['Patras', 'Patra', 'Πάτρα'] },
  { value: 'Heraklion', el: 'Ηράκλειο', words: ['heraklion', 'iraklio', 'ηρακλει*'], variants: ['Heraklion', 'Iraklio', 'Ηράκλειο'] },
  { value: 'Larissa', el: 'Λάρισα', words: ['larissa', 'larisa', 'λαρισ*'], variants: ['Larissa', 'Larisa', 'Λάρισα'] },
  { value: 'Volos', el: 'Βόλος', words: ['volos', 'βολο*'], variants: ['Volos', 'Βόλος'] },
  { value: 'Ioannina', el: 'Ιωάννινα', words: ['ioannina', 'ιωαννιν*'], variants: ['Ioannina', 'Ιωάννινα'] },
  { value: 'Chania', el: 'Χανιά', words: ['chania', 'χανι*'], variants: ['Chania', 'Χανιά'] },
  { value: 'Nicosia', el: 'Λευκωσία', words: ['nicosia', 'λευκωσι*'], variants: ['Nicosia', 'Λευκωσία'] },
  { value: 'Limassol', el: 'Λεμεσός', words: ['limassol', 'λεμεσ*'], variants: ['Limassol', 'Λεμεσός'] },
  { value: 'Cyprus', el: 'Κύπρος', words: ['cyprus', 'κυπρ*'], variants: ['Cyprus', 'Κύπρος'] },
  { value: 'Greece', el: 'Ελλάδα', words: ['greece', 'ελλαδ*'], variants: ['Greece', 'Ελλάδα', 'Hellas'] },
  { value: 'Berlin', el: 'Βερολίνο', words: ['berlin', 'βερολιν*'], variants: ['Berlin', 'Βερολίνο'] },
  { value: 'London', el: 'Λονδίνο', words: ['london', 'λονδιν*'], variants: ['London', 'Λονδίνο'] },
];

/** Words that carry no search meaning on their own, in either language. */
const FILLER = new Set(
  [
    'a', 'an', 'the', 'in', 'at', 'on', 'for', 'from', 'with', 'and', 'or', 'of', 'to', 'who', 'is', 'are', 'based', 'near', 'around',
    'find', 'me', 'i', 'need', 'want', 'looking', 'look', 'search', 'show', 'someone', 'somebody', 'people', 'person', 'profiles', 'profile',
    'ψαχνω', 'ψαξε', 'βρες', 'βρειτε', 'θελω', 'χρειαζομαι', 'δειξε', 'μου', 'εναν', 'ενα', 'μια', 'μιας', 'καποιον', 'καποιον', 'καποια',
    'στην', 'στη', 'στο', 'στον', 'στα', 'στις', 'στους', 'σε', 'με', 'για', 'και', 'η', 'ο', 'το', 'τη', 'την', 'τον', 'του', 'της', 'των',
    'απο', 'που', 'ειναι', 'κοντα', 'ατομα', 'ατομο', 'προφιλ', 'ανθρωπους', 'ανθρωπο',
  ].map(foldSearchText),
);

function pattern(word: string): RegExp {
  const stem = word.endsWith('*');
  const body = (stem ? word.slice(0, -1) : word).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${body}${stem ? '[\\p{L}]*' : ''})(?=$|[^\\p{L}\\p{N}])`, 'u');
}

const COMPILED = TERMS.map((t) => ({ ...t, patterns: t.words.map(pattern) }));
const PLACES = PLACE_ALIASES.map((p) => ({ ...p, patterns: p.words.map(pattern) }));

/** Reads a typed query into directory filters and the free text that remains. */
export function readNaturalSearch(text: string): NaturalSearch {
  const original = String(text ?? '').normalize('NFC').slice(0, 300);
  // The folded text and the typed text line up character for character, so a
  // recognised word is blanked in both and what remains keeps its accents.
  let folded = foldSearchText(original);
  let remaining = original;
  const out: NaturalSearch = { roles: [], industries: [], stage: [], availability: [], fundingStage: [], languages: [], location: null, rest: '', understood: [] };
  const found: Array<NaturalFilter & { at: number }> = [];

  const take = (patterns: RegExp[]): number => {
    for (const re of patterns) {
      const m = re.exec(folded);
      if (m) {
        const start = m.index + m[1].length;
        const blank = ' '.repeat(m[2].length);
        folded = folded.slice(0, start) + blank + folded.slice(start + m[2].length);
        remaining = remaining.slice(0, start) + blank + remaining.slice(start + m[2].length);
        return start;
      }
    }
    return -1;
  };

  for (const term of COMPILED) {
    const at = take(term.patterns);
    if (at < 0) continue;
    const list = term.kind === 'role' ? out.roles : term.kind === 'industry' ? out.industries : term.kind === 'stage' ? out.stage : term.kind === 'availability' ? out.availability : term.kind === 'fundingStage' ? out.fundingStage : out.languages;
    if (!list.includes(term.value)) {
      list.push(term.value);
      found.push({ kind: term.kind, value: term.value, en: term.en, el: term.el, at });
    }
  }
  for (const place of PLACES) {
    const at = take(place.patterns);
    if (at < 0) continue;
    // One place: the first one named is the filter; another stays as text.
    if (!out.location) {
      out.location = place.value;
      found.push({ kind: 'location', value: place.value, en: place.value, el: place.el, at });
    }
  }

  // What is left, as typed, without filler words.
  const restWords = (remaining.match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-']*/gu) ?? [])
    .map((w) => w.replace(/[.\-']+$/, ''))
    .filter((w) => w && (w.length > 1 || /\p{N}/u.test(w)) && !FILLER.has(foldSearchText(w)));
  out.rest = restWords.join(' ');
  out.understood = found.sort((a, b) => a.at - b.at).map(({ at: _at, ...f }) => f);
  return out;
}

/** Every spelling of a place, for a location filter; the value alone when it is not one we know. */
export function placeVariants(location: string): string[] {
  const value = location.trim();
  if (!value) return [];
  const f = foldSearchText(value);
  const hit = PLACES.find((p) => p.patterns.some((re) => re.test(f)) || p.variants.some((v) => foldSearchText(v) === f));
  return hit ? [...new Set([value, ...hit.variants])] : [value];
}
