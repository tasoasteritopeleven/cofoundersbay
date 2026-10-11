const SEP = ' · ';
const GREEK = /[\u0370-\u03FF]/;

export type PhonePrimary = 'en' | 'el';

/**
 * A placeholder built by `bilingualInline` is "English · Ελληνικά".
 * On a phone that string is wider than the field, so the second language
 * shows up as a clipped "· Α". Above the phone breakpoint, or when the
 * full string already fits, it is left alone.
 */
export function splitBilingualPlaceholder(value: string): { en: string; el: string } | null {
  const index = value.indexOf(SEP);
  if (index <= 0) return null;
  const en = value.slice(0, index).trim();
  const el = value.slice(index + SEP.length).trim();
  if (!en || !el) return null;
  if (!GREEK.test(en) && !GREEK.test(el)) return null;
  return { en, el };
}

export function choosePhonePlaceholder(
  full: string,
  phone: boolean,
  primary: PhonePrimary,
  fullWidthPx: number,
  availablePx: number,
): string {
  const parts = splitBilingualPlaceholder(full);
  if (!parts || !phone) return full;
  if (fullWidthPx <= availablePx) return full;
  return primary === 'el' ? parts.el : parts.en;
}
