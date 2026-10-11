/**
 * Greek for the dimensions `/api/dashboard/venture-readiness` reports.
 *
 * The endpoint labels them in English, so every surface that prints one has to
 * translate it or leak English into a Greek sentence. Keyed by `key` rather
 * than by label, so a wording change upstream cannot silently drop the
 * translation; an unknown key falls back to whatever the server sent.
 *
 * These name platform engagement, not investor readiness - /readiness scores
 * that separately, across its own six dimensions.
 */
const VENTURE_DIMENSION_EL: Record<string, string> = {
  profile: 'Βάθος προφίλ',
  research: 'Βάθος έρευνας',
  artifacts: 'Ποιότητα παραδοτέων',
  collaboration: 'Συνεργασία',
  momentum: 'Ορμή (14 ημ.)',
  ecosystem: 'Συμμετοχή στο οικοσύστημα',
};

export function ventureDimensionEl(key: string | undefined, fallback: string): string {
  return (key ? VENTURE_DIMENSION_EL[key] : undefined) ?? fallback;
}
