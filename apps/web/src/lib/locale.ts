export const LOCALE_STORAGE_KEY = 'cfb_locale';

export const APP_LOCALES = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'el', label: 'Ελληνικά', short: 'ΕΛ' },
  { value: 'es', label: 'Español', short: 'ES' },
  { value: 'fr', label: 'Français', short: 'FR' },
  { value: 'de', label: 'Deutsch', short: 'DE' },
  { value: 'it', label: 'Italiano', short: 'IT' },
  { value: 'pt', label: 'Português', short: 'PT' },
  { value: 'zh', label: '中文', short: '中文' },
  { value: 'ja', label: '日本語', short: '日本語' },
] as const;

export type AppLocale = (typeof APP_LOCALES)[number]['value'];

export function getStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (APP_LOCALES.some((l) => l.value === stored)) return stored as AppLocale;
  return 'en';
}

export const LOCALE_CHANGE_EVENT = 'cfb-locale-change';

export function applyLocale(code: string) {
  const locale = APP_LOCALES.some((l) => l.value === code) ? code : 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    try {
      const raw = localStorage.getItem('ai-preferences');
      const prefs = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem('ai-preferences', JSON.stringify({ ...prefs, responseLanguage: locale }));
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }));
  }
}
