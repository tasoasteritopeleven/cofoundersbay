'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  APP_LOCALES,
  LOCALE_CHANGE_EVENT,
  getStoredLocale,
  type AppLocale,
} from '@/lib/locale';
import { LOCALE_BCP47, ensureExtraCatalog, translate, type TranslateVars } from '@/lib/i18n/translate';

type I18nContextValue = {
  locale: AppLocale;
  bcp47: string;
  t: (source: string, vars?: TranslateVars) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  bcp47: 'en-US',
  t: (source, vars) => translate('en', source, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('en');
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    setLocale(getStoredLocale());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (APP_LOCALES.some((l) => l.value === next)) setLocale(next as AppLocale);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Only invalidate `t` when a catalog was genuinely added. Bumping the tick
    // unconditionally re-created `t`, then the context value, re-rendering every
    // useI18n consumer in the tree and re-running DomI18n's whole-document pass —
    // on every locale-effect run, including English, where nothing can change.
    ensureExtraCatalog(locale).then((loaded) => {
      if (loaded && !cancelled) setCatalogTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback((source: string, vars?: TranslateVars) => translate(locale, source, vars), [locale, catalogTick]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, bcp47: LOCALE_BCP47[locale], t }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
