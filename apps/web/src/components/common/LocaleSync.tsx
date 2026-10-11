'use client';

import { useEffect } from 'react';
import { applyLocale, getStoredLocale } from '@/lib/locale';

/** Apply the stored UI/AI locale after mount so SSR html lang stays stable. */
export function LocaleSync() {
  useEffect(() => {
    applyLocale(getStoredLocale());
  }, []);
  return null;
}
