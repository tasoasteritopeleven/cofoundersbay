'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  resolveBilingualPair,
  useLanguagePreference,
} from '@/lib/i18n/LanguagePreferenceContext';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { useI18n } from '@/components/common/I18nProvider';

const SEARCH_EN = 'Search founders, mentors, skills…';
const SEARCH_EL = 'Αναζήτηση ιδρυτών, μεντόρων, δεξιοτήτων…';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { primary, showSecondary } = useLanguagePreference();
  const { t } = useI18n();
  const resolved = resolveBilingualPair(SEARCH_EN, SEARCH_EL, primary, showSecondary);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : '/search');
  }

  return (
    <>
      {/* min-w keeps this a search field rather than a three-character stub: at
          834px the bar's fixed-size right-hand controls had squeezed it to "Sea". */}
      <form onSubmit={submit} className="relative hidden w-full min-w-[11rem] max-w-md md:block">
        <CfbGlyph name="search" className="pointer-events-none absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={resolved.primaryText}
          className="pl-9"
          lang={resolved.primaryLang}
          aria-label={t('Search')}
        />
      </form>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 md:hidden"
        onClick={() => router.push('/search')}
        aria-label={t('Search')}
      >
        <CfbGlyph name="search" className="icon-md" />
      </Button>
    </>
  );
}
