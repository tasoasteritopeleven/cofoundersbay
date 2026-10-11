import type { CfbGlyphName } from '@/components/icons/CfbGlyph';

/**
 * Empty-state prompts for the copilot. English is what `sendMessage` and the
 * planner receive, so these stay in lockstep with SAMPLE_ASK on
 * `/ai/capabilities` wherever a capability already has the same ask.
 *
 * Reads look something up. Writes change something you own and wait for
 * confirm — the empty state has to say that before the click, not only on
 * the ActionCard that follows it.
 */
export type CopilotStarterKind = 'read' | 'write';

export type CopilotStarter = {
  en: string;
  el: string;
  kind: CopilotStarterKind;
  glyph: CfbGlyphName;
  /** Full-page empty state. Default true. */
  page?: boolean;
  /** Popup empty state. Default true. */
  popup?: boolean;
};

export const COPILOT_STARTERS: CopilotStarter[] = [
  { en: 'What should I do next?', el: 'Τι να κάνω μετά;', kind: 'read', glyph: 'spark' },
  { en: 'Show my best matches', el: 'Δείξε τις καλύτερες αντιστοιχίσεις', kind: 'read', glyph: 'matches' },
  { en: 'Find a technical cofounder in Athens', el: 'Βρες τεχνικό συνιδρυτή στην Αθήνα', kind: 'read', glyph: 'people' },
  { en: 'How is my fundraising going?', el: 'Πώς πάει η χρηματοδότησή μου;', kind: 'read', glyph: 'wallet' },
  { en: 'Save Elena to my shortlist', el: 'Αποθήκευσε την Elena στη λίστα', kind: 'write', glyph: 'bookmark' },
  { en: 'Remove Elena from my shortlist', el: 'Βγάλε την Elena από τη λίστα', kind: 'write', glyph: 'bookmark', popup: false },
  { en: 'Connect with Elena', el: 'Στείλε αίτημα σύνδεσης στην Elena', kind: 'write', glyph: 'people' },
];

export function copilotStartersFor(surface: 'page' | 'popup'): {
  reads: CopilotStarter[];
  writes: CopilotStarter[];
} {
  const visible = COPILOT_STARTERS.filter((starter) =>
    surface === 'popup' ? starter.popup !== false : starter.page !== false,
  );
  return {
    reads: visible.filter((starter) => starter.kind === 'read'),
    writes: visible.filter((starter) => starter.kind === 'write'),
  };
}

export const COPILOT_PRODUCT_LINKS: { href: string; en: string; el: string }[] = [
  { href: '/matches', en: 'Matches', el: 'Αντιστοιχίσεις' },
  { href: '/messages', en: 'Messages', el: 'Μηνύματα' },
  { href: '/fundraising', en: 'Fundraising', el: 'Χρηματοδότηση' },
  { href: '/research', en: 'Research', el: 'Έρευνα' },
  { href: '/calendar', en: 'Calendar', el: 'Ημερολόγιο' },
  { href: '/builder', en: 'Builder', el: 'Builder' },
  { href: '/builder/applications', en: 'Applications', el: 'Αιτήσεις' },
];
