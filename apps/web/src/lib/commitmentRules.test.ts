import { describe, expect, it } from 'vitest';
import {
  assessNeedCard,
  canReviseTerms,
  cardOfferChanges,
  contactKinds,
  daysUntilHistory,
  deriveCardOutcome,
  describeContactKinds,
  findPromiseClaims,
  isInHistory,
  ladderRung,
  MAX_TERMS_REVISIONS,
  revisionsLeft,
  termsChanges,
  validateTerms,
  type NeedCardInput,
} from '@cofounderbay/shared';

/**
 * The rules both apps enforce for a commitment: what the first conversation
 * may not carry, what a card may not promise, what makes a card publishable,
 * and how terms are versioned. The server runs the same functions, so these
 * are the acceptance tests for both.
 */

describe('contact details in a protected conversation', () => {
  it.each([
    ['Call me on 6912345678', 'phone'],
    ['my mobile: +30 691 234 5678', 'phone'],
    ['0030 210 1234567 any time', 'phone'],
    ['τηλ. 210 123 4567', 'phone'],
    ['κιν: 6944 12', 'phone'],
    ['βρες με στο instagram', 'messenger'],
    ['γράψε μου στο κινητό μου', 'messenger'],
    ['write to elena@harbor.io', 'email'],
    ['elena (at) harbor (dot) io', 'email'],
    ['elena παπάκι gmail', 'email'],
    ['see https://harbor.example/deck', 'link'],
    ['www.harbor.gr has the deck', 'link'],
    ['our site is harbor.ai', 'link'],
    ['t.me/elena_p', 'link'],
    ['ping @elena_p there', 'handle'],
    ['add me on viber', 'messenger'],
    ['Στείλε στο βάιμπερ', 'messenger'],
    ['πάρε με τηλέφωνο αύριο', 'messenger'],
    ['find me on LinkedIn', 'messenger'],
    ['IBAN GR16 0110 1250 0000 0001 2300 695', 'payment'],
    ['send it via revolut', 'payment'],
    ['card 4111 1111 1111 1111', 'payment'],
    ['call me at six nine eight one two three four five six seven', 'phone'],
    ['reach me on six-nine-eight, one-two-three, four-five-six-seven', 'phone'],
    ['το κινητό μου είναι έξι εννιά οκτώ ένα δύο τρία τέσσερα πέντε έξι επτά', 'phone'],
  ])('finds %s', (text, kind) => {
    expect(contactKinds(text)).toContain(kind);
  });

  it.each([
    'We raised $375K of a $750K seed and need 10–15% for a CTO.',
    'Vesting over 48 months with a 12-month cliff, 40 hours a week.',
    'Pilots ran from 2024-2026 with 3 terminals in Piraeus.',
    'I spent four years as an engineer at Facebook and Telegram.',
    'Revenue grew 300% to €1.200.000 ARR last year.',
    'Node.js and Next.js on the server, 99.9% uptime.',
    'Let us meet at 5pm on the platform call.',
    'Θέλουμε 8–12% equity και 30 ώρες την εβδομάδα.',
    'One or two founders, maybe three advisors and five angels.',
    'Nine out of ten startups here need a technical partner.',
    'Τρεις συνιδρυτές, δύο μέντορες και μία επένδυση το 2026.',
    'Η οκτώ χρόνια πορεία της μία ομάδας στα πέντε προϊόντα.',
  ])('leaves alone: %s', (text) => {
    expect(contactKinds(text)).toEqual([]);
  });

  it('names what it found in both languages', () => {
    expect(describeContactKinds(['phone', 'link'])).toEqual({ en: 'a phone number and a link', el: 'αριθμό τηλεφώνου και σύνδεσμο' });
  });
});

describe('promise language', () => {
  it.each([
    'Guaranteed 3x return within two years',
    'A risk-free entry into the seed',
    'Sure profit for early partners',
    'Εγγυημένη απόδοση για τους πρώτους',
    'Σίγουρο κέρδος μέσα σε ένα χρόνο',
    'Επένδυση χωρίς ρίσκο',
  ])('flags %s', (text) => {
    expect(findPromiseClaims(text).length).toBeGreaterThan(0);
  });

  it.each([
    'We do not guarantee funding or returns.',
    'There is no guarantee the round closes.',
    'Δεν εγγυόμαστε χρηματοδότηση.',
    'Χωρίς υποσχέσεις: η απόφαση είναι δική σας.',
  ])('accepts the honest form: %s', (text) => {
    expect(findPromiseClaims(text)).toEqual([]);
  });
});

const READY: NeedCardInput = {
  kind: 'cofounder',
  title: 'Technical co-founder for Harbor',
  exists: 'A working founder workspace with $375K of a $750K seed committed.',
  goal: 'Ship the workspace to the first twenty paying teams this year.',
  missing: 'A technical co-founder who has taken a real-time product to production.',
  offerRole: 'CTO and co-founder',
  offerEquity: '10–15%',
  offerHours: 40,
  offerScope: 'Own the platform and hire the first two engineers.',
  category: 'B2B SaaS',
  place: 'Athens, Greece',
  isRemote: false,
  stage: 'building',
  commitment: 'full_time',
};

describe('the posting guide', () => {
  it('accepts a complete card and scores it 100', () => {
    const result = assessNeedCard(READY);
    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
  });

  it('blocks a card without one of the three sentences', () => {
    const result = assessNeedCard({ ...READY, missing: 'A CTO' });
    expect(result.ready).toBe(false);
    expect(result.checks.find((c) => c.id === 'missing')?.ok).toBe(false);
  });

  it('blocks contact details anywhere on the card', () => {
    const result = assessNeedCard({ ...READY, offerScope: 'Own the platform; details on harbor.io/jobs' });
    expect(result.ready).toBe(false);
    expect(result.contact).toEqual(['link']);
  });

  it('blocks promised returns', () => {
    expect(assessNeedCard({ ...READY, goal: 'Guaranteed exit to a strategic buyer within two years.' }).ready).toBe(false);
  });

  it('requires equity for a seat, not for an investor introduction', () => {
    expect(assessNeedCard({ ...READY, offerEquity: '' }).ready).toBe(false);
    expect(assessNeedCard({ ...READY, kind: 'investor_intro', offerEquity: '' }).ready).toBe(true);
  });

  it('requires all four filters, accepting remote in place of a place', () => {
    expect(assessNeedCard({ ...READY, stage: 'someday' }).ready).toBe(false);
    expect(assessNeedCard({ ...READY, place: '', isRemote: true }).ready).toBe(true);
    expect(assessNeedCard({ ...READY, place: '', isRemote: false }).ready).toBe(false);
  });

  it('treats one phone screen as advice, not a gate', () => {
    const long = assessNeedCard({ ...READY, offerScope: `${'Own the platform and the hiring plan. '.repeat(5)}`.slice(0, 200), exists: `${READY.exists} ${'More context. '.repeat(10)}`.slice(0, 220) });
    expect(long.checks.find((c) => c.id === 'one_screen')?.required).toBe(false);
  });

  it('counts an offer change as a new card version and ignores spacing', () => {
    expect(cardOfferChanges(READY, { offerEquity: '12–15%' })).toEqual(['offerEquity']);
    expect(cardOfferChanges(READY, { offerRole: '  cto and  CO-FOUNDER ' })).toEqual([]);
    expect(cardOfferChanges(READY, { title: 'New title' })).toEqual([]);
  });
});

describe('versioned terms', () => {
  const v1 = { role: 'CTO', equityPct: 10, vestingMonths: 48, cliffMonths: 12, hoursPerWeek: 40, scope: 'Platform and first hires' };

  it('treats a changed number as substantive and a re-spaced word as not', () => {
    expect(termsChanges(v1, { ...v1, equityPct: 12 })).toEqual(['equityPct']);
    expect(termsChanges(v1, { ...v1, scope: ' platform AND first  hires' })).toEqual([]);
  });

  it('validates ranges and the cliff against vesting', () => {
    expect(validateTerms(v1)).toEqual([]);
    expect(validateTerms({ ...v1, equityPct: 140 })).toContain('equity_range');
    expect(validateTerms({ ...v1, cliffMonths: 60, vestingMonths: 24 })).toContain('cliff_after_vesting');
    expect(validateTerms({ ...v1, hoursPerWeek: 0 })).toContain('hours_range');
    expect(validateTerms(v1, 'call me on 6912345678')).toContain('contact');
    expect(validateTerms(v1, 'Guaranteed exit')).toContain('promise');
  });

  it('allows three revisions after the first proposal, never while the deal room is open', () => {
    expect(revisionsLeft({ revisions: 0, versions: 0 })).toBe(MAX_TERMS_REVISIONS);
    expect(canReviseTerms({ revisions: 2, versions: 3, dealRoomActive: false, step: 'terms' }).ok).toBe(true);
    expect(canReviseTerms({ revisions: 3, versions: 4, dealRoomActive: false, step: 'terms' })).toEqual({ ok: false, reason: 'limit' });
    expect(canReviseTerms({ revisions: 0, versions: 1, dealRoomActive: true, step: 'agreed' })).toEqual({ ok: false, reason: 'frozen' });
    expect(canReviseTerms({ revisions: 0, versions: 0, dealRoomActive: false, step: 'conversation' })).toEqual({ ok: false, reason: 'step' });
  });
});

describe('outcomes and history', () => {
  it('derives a card outcome from its threads', () => {
    expect(deriveCardOutcome(false, [])).toBe('open');
    expect(deriveCardOutcome(false, ['interest'])).toBe('open');
    expect(deriveCardOutcome(false, ['interest', 'conversation'])).toBe('in_discussion');
    expect(deriveCardOutcome(false, ['terms', 'agreed'])).toBe('agreed');
    expect(deriveCardOutcome(true, ['agreed'])).toBe('closed');
  });

  it('keeps a settled card in view for thirty days', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(daysUntilHistory('2026-09-26T12:00:00Z', now)).toBe(20);
    expect(isInHistory('2026-09-26T12:00:00Z', now)).toBe(false);
    expect(isInHistory('2026-08-01T12:00:00Z', now)).toBe(true);
    expect(isInHistory(null, now)).toBe(false);
  });

  it('places a thread on the five-rung ladder', () => {
    expect(ladderRung('interest', false)).toBe(0);
    expect(ladderRung('conversation', false)).toBe(1);
    expect(ladderRung('conversation', true)).toBe(2);
    expect(ladderRung('terms', true)).toBe(3);
    expect(ladderRung('agreed', true)).toBe(4);
    expect(ladderRung('closed', true)).toBe(-1);
  });
});
