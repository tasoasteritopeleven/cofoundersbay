'use client';

import { useEffect, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { APP_LOCALES, applyLocale, getStoredLocale, LOCALE_CHANGE_EVENT, type AppLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/common/I18nProvider';

function useAppLocale() {
  const [locale, setLocale] = useState<AppLocale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLocale(getStoredLocale());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (APP_LOCALES.some((l) => l.value === next)) setLocale(next as AppLocale);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  }, []);

  return { locale, setLocale, mounted };
}

export function LanguageSwitcher({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { locale, setLocale, mounted } = useAppLocale();
  const { t } = useI18n();

  const handleChange = (next: AppLocale) => {
    setLocale(next);
    applyLocale(next);
  };

  if (!mounted) {
    return (
      // Placeholder until mount; the real switcher replaces it.
      <Button variant="ghost" size="icon" className={cn('relative h-9 w-9 shrink-0', className)} aria-label={t('Language')} disabled>
          <Globe className="icon-sm" />
      </Button>
    );
  }

  const current = APP_LOCALES.find((l) => l.value === locale) ?? APP_LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative shrink-0',
            iconOnly ? 'h-8 w-8 px-0' : 'h-9 min-w-9 w-auto gap-1 px-1.5',
            className,
          )}
          aria-label={`${t('Language')}: ${current.label}`}
          title={t('Language')}
        >
          <Globe className="icon-sm shrink-0" />
          {!iconOnly && <span className="text-2xs font-semibold tabular-nums">{current.short}</span>}
          <span className="sr-only">{t('Change language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel>{t('Language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {APP_LOCALES.map((lang) => {
          const isActive = locale === lang.value;
          return (
            <DropdownMenuItem
              key={lang.value}
              onClick={() => handleChange(lang.value)}
              className={cn('flex min-h-11 cursor-pointer items-center gap-2', isActive && 'bg-accent/60')}
            >
              <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {lang.short}
              </span>
              <span className="flex-1 text-sm font-medium">{lang.label}</span>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary-accessible" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LanguageChipGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {APP_LOCALES.map((lang) => {
        const isActive = value === lang.value;
        return (
          <button
            key={lang.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(lang.value)}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}

/** Full chip picker for sheets / settings — works without a dropdown. */
export function LanguagePanel({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, mounted } = useAppLocale();
  const { t } = useI18n();

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="px-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/80">
          {t('Language')}
        </p>
      )}
      <LanguageChipGrid
        value={locale}
        onChange={(next) => {
          const code = APP_LOCALES.some((l) => l.value === next) ? (next as AppLocale) : 'en';
          setLocale(code);
          applyLocale(code);
        }}
      />
    </div>
  );
}
