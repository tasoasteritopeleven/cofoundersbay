'use client';

import { useCallback } from 'react';
import { formatDate } from './format';
import { useLanguagePreference } from './LanguagePreferenceContext';

/**
 * A date in the reader's language: "8 Oct" for an English reader, «8 Οκτ»
 * for a Greek one. Formatted in UTC like every date (see `formatDate`), so
 * the server and the first client render agree; the language preference
 * resolves after hydration through its own store.
 *
 * 54 call sites in 39 files wrote `toLocaleDateString('en-GB', { month… })`
 * and showed English month and day names to Greek readers. They call this.
 */
export function useDateFormat(): (value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string {
  const { primary } = useLanguagePreference();
  const lang = primary === 'el' ? 'el' : 'en';
  return useCallback((value, options) => formatDate(value, lang, options), [lang]);
}

/**
 * A calendar picker's date, in the reader's language and the reader's own
 * time zone. Pickers build their days with the local constructor
 * (`new Date(year, month, d)`): formatting those in UTC named the previous
 * day east of UTC, so in Athens choosing 1 October read "Wednesday,
 * 30 September" and October's grid was titled "September". Client-only:
 * call it in pickers and dialogs, never in server-rendered text.
 */
export function useLocalDateFormat(): (value: Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string {
  const { primary } = useLanguagePreference();
  const locale = primary === 'el' ? 'el-GR' : 'en-GB';
  return useCallback((value, options) => {
    if (!value || Number.isNaN(value.getTime())) return '';
    return value.toLocaleDateString(locale, options);
  }, [locale]);
}
