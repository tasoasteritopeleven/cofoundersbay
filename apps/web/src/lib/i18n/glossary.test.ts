import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';

/**
 * The product's Greek, held to one glossary and one voice.
 *
 * A reader meets the same idea on many pages; when it has a different name on
 * each ("εισαγωγή", "σύσταση" and "γνωριμία" for one intro), every new screen
 * is a small puzzle. These checks read both catalogues the DOM pass uses and
 * fail on the renderings the glossary rules out, so a new string cannot bring
 * one back. The glossary itself lives in docs/PLATFORM_DESIGN_AI_PLAN.md §33.
 */

const json = JSON.parse(readFileSync(join(__dirname, 'messages', 'el.json'), 'utf8')) as Record<string, string>;
const live = CATALOG.el;
// What a reader actually sees for each key: catalog.ts is looked up first.
const effective: Record<string, string> = { ...json, ...live };
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const entries = Object.entries(effective).filter(([, v]) => GREEK.test(v));

const W = '(?<![\\p{L}])';
const word = (w: string) => new RegExp(`${W}${w}(?![\\p{L}])`, 'u');

function offenders(test: (key: string, value: string) => boolean): string[] {
  return entries.filter(([k, v]) => test(k, v)).map(([k, v]) => `${k} -> ${v}`);
}

describe('the Greek glossary', () => {
  it('reads both catalogues', () => {
    expect(entries.length).toBeGreaterThan(2500);
  });

  it('gives the keys the two catalogues share one Greek value', () => {
    // catalog.ts wins at runtime, so a different el.json value was dead text
    // that looked like a fix and was never shown.
    const split = Object.keys(live)
      .filter((k) => k in json && json[k] !== live[k])
      .map((k) => `${k}: catalog.ts "${live[k]}" / el.json "${json[k]}"`);
    expect(split).toEqual([]);
  });

  it('calls an intro between people «γνωριμία»', () => {
    expect(offenders((k, v) => /\bintros?\b/i.test(k) && !/onboarding/i.test(k) && /εισαγωγ|σύστασ|συστάσ/.test(v))).toEqual([]);
  });

  it('calls a draft «προσχέδιο», never a plan («σχέδιο»)', () => {
    expect(offenders((k, v) => /\bdraft\b/i.test(k) && word('σχέδι').test(v))).toEqual([]);
  });

  it('keeps "pitch deck" and "data room" as founders say them', () => {
    expect(offenders((_, v) => /παρουσίαση pitch|δωμάτιο δεδομένων|αίθουσα δεδομένων/i.test(v))).toEqual([]);
  });

  it('calls a funnel «χοάνη», in the catalogues and in every source file', () => {
    // «Χωνί προφίλ» on /analytics, «Χωνί συμφωνιών» for investors, «Χοάνη»
    // nowhere: two words for one chart. Page copy lives in TSX and string
    // modules too, so this one reads the source tree, not only the catalogues.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(join(dir, d.name)) : /\.(tsx?|json)$/.test(d.name) && !/\.test\./.test(d.name) ? [join(dir, d.name)] : [],
      );
    const src = join(__dirname, '..', '..');
    const hits = walk(src).filter((f) => /[Χχ]ωνί/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(src.length + 1));
    expect([...offenders((_, v) => /[Χχ]ωνί/.test(v)), ...hits]).toEqual([]);
  });

  it('calls TAM «συνολικά προσβάσιμη αγορά»', () => {
    expect(offenders((_, v) => /διευθύνσιμ|διευθυνσιοδοτ/i.test(v))).toEqual([]);
  });

  it('calls a badge «έμβλημα», not a signal («σήμα»)', () => {
    expect(offenders((k, v) => /badge/i.test(k) && (word('σήμα').test(v) || word('σήματα').test(v) || word('σημάτων').test(v)))).toEqual([]);
  });

  it('calls a tenant «οργανισμός», never a lessee', () => {
    expect(offenders((k, v) => /tenant/i.test(k) && /ενοικιαστ|μισθωτ/i.test(v))).toEqual([]);
  });

  it('names mentoring in Greek: μέντορας, καθοδήγηση, καθοδηγούμενοι', () => {
    // The mentor dashboard read «Πίνακας ελέγχου mentor», «Αιτήματα mentees»
    // and «Αιτήματα mentoring» beside «μέντορες» and «καθοδηγούμενοι» on the
    // next page. Checked in both catalogues and in the page-title catalogue
    // and page registry, where those three came from.
    const LOANWORD = /(?<![\p{L}/{])(?:mentors?|mentees?|mentoring|mentorship)(?![\p{L}])/iu;
    const fromCatalogues = offenders((_, v) => LOANWORD.test(v));
    const source = ['strings-pages.ts', '../page-registry.ts']
      .map((f) => readFileSync(join(__dirname, f), 'utf8'))
      .join('\n');
    const greekSide = [...source.matchAll(/(?:title|description|helpTitleEl|titleEl|descriptionEl):\s*'([^']*)'/g)]
      .map((m) => m[1])
      .filter((v) => GREEK.test(v) && LOANWORD.test(v));
    expect([...fromCatalogues, ...greekSide]).toEqual([]);
  });

  it('writes Greek units after numbers, never "2w" or "5h"', () => {
    // «πριν 2w» was the report that started this pass.
    expect(offenders((_, v) => /\d\s?(?:w|d|h|mo|y|min|hrs?)\b/.test(v))).toEqual([]);
  });

  it('addresses the reader formally, except in what the reader says to the assistant', () => {
    // The UI's voice is «Πατήστε», «σας». A request the reader sends to the
    // assistant ("Save Elena to my shortlist") is in the reader's own voice,
    // which is informal on purpose; those carry "my", "me" or "I" in English.
    const INFORMAL = new RegExp(
      `${W}(?:σου|σένα|Πάτησε|πάτησε|Πρόσθεσε|Δες|δες|Κάνε|Ξεκίνα|Συμπλήρωσε|Διάλεξε|Άνοιξε|Γράψε|Φτιάξε|Μπες|ψάχνεις|θέλεις|μπορείς|Είσαι|είσαι|Έχεις|έχεις|Συνδέσου)(?![\\p{L}])`,
      'u',
    );
    const USER_VOICE = /\b(my|me|I|I'm|I've|I'd)\b|“[^”]*”|^Find a technical cofounder/;
    expect(offenders((k, v) => INFORMAL.test(v.replace(/«[^»]*»/g, '')) && !USER_VOICE.test(k))).toEqual([]);
  });
});
