import { describe, expect, it } from 'vitest';
import { choosePhonePlaceholder, splitBilingualPlaceholder } from './phone-placeholder';

const FULL = 'Search by name, skills, industry… · Αναζήτηση με όνομα, δεξιότητες, κλάδο…';

describe('choosePhonePlaceholder', () => {
  it('keeps a bilingual placeholder when it fits or the viewport is not a phone', () => {
    expect(choosePhonePlaceholder(FULL, false, 'en', 420, 200)).toBe(FULL);
    expect(choosePhonePlaceholder(FULL, true, 'en', 180, 200)).toBe(FULL);
  });

  it('keeps only the primary language when the pair is wider than the field', () => {
    expect(choosePhonePlaceholder(FULL, true, 'en', 420, 200)).toBe('Search by name, skills, industry…');
    expect(choosePhonePlaceholder(FULL, true, 'el', 420, 200)).toBe('Αναζήτηση με όνομα, δεξιότητες, κλάδο…');
  });

  it('ignores strings that are not a bilingual pair', () => {
    expect(splitBilingualPlaceholder('Just English')).toBeNull();
    expect(choosePhonePlaceholder('Pinch to zoom · Drag to pan', true, 'en', 400, 100)).toBe(
      'Pinch to zoom · Drag to pan',
    );
  });
});
