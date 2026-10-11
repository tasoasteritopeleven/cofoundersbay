/** Bilingual copy — English is canonical; Greek is additive (never replaces EN in UI). */
export type BilingualPair = {
  en: string;
  el: string;
};

export type PageMetaEl = {
  title: string;
  description: string;
  section?: string;
};
