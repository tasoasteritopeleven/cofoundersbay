import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NON_GUARANTEE_COPY } from '@cofounderbay/shared';

/**
 * Wherever equity, percentages or funding appear, the page says that the
 * platform organises the decision and does not promise funding or income.
 *
 * One component carries the sentence; this list is the surfaces that must
 * render it. A page that starts showing equity or a raise belongs here.
 */
const SURFACES = [
  'src/components/commitments/NeedCard.tsx',
  'src/components/commitments/ThreadWorkspace.tsx',
  'src/app/projects/[projectId]/page.tsx',
  'src/app/opportunities/page.tsx',
  'src/app/fundraising/page.tsx',
  'src/app/pitch/[id]/page.tsx',
];

describe('non-guarantee sentence', () => {
  it.each(SURFACES)('%s renders it', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/<NonGuaranteeNote\b/);
  });

  it('says the same thing in both languages and promises nothing', () => {
    expect(NON_GUARANTEE_COPY.en).toMatch(/does not promise funding, income or returns/);
    expect(NON_GUARANTEE_COPY.el).toMatch(/Δεν υπόσχεται χρηματοδότηση, εισόδημα ή αποδόσεις/);
  });

  it('is not dropped from the need card when equity or an investor introduction is on it', () => {
    const card = readFileSync('src/components/commitments/NeedCard.tsx', 'utf8');
    expect(card).toContain("const showsMoney = Boolean(card.offer.equity) || card.kind === 'investor_intro';");
    expect(card).toContain('{showsMoney ? <NonGuaranteeNote /> : null}');
  });
});
