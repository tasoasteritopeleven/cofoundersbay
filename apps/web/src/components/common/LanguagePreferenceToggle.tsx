'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useLanguagePreference,
  type LanguageDisplayMode,
  type PrimaryLanguage,
} from '@/lib/i18n/LanguagePreferenceContext';
import { BilingualText } from '@/components/common/BilingualText';
import { commonEn, commonEl } from '@/lib/i18n/strings-common';
import { bilingualAria } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

const PRIMARY_OPTIONS: { value: PrimaryLanguage; labelEn: string; labelEl: string }[] = [
  { value: 'en', labelEn: 'English primary', labelEl: 'Αγγλικά κύρια' },
  { value: 'el', labelEn: 'Greek primary', labelEl: 'Ελληνικά κύρια' },
];

const DISPLAY_OPTIONS: { value: LanguageDisplayMode; labelEn: string; labelEl: string }[] = [
  {
    value: 'bilingual',
    labelEn: 'Bilingual (primary + secondary)',
    labelEl: 'Δίγλωσση (κύρια + δευτερεύουσα)',
  },
  {
    value: 'primary-only',
    labelEn: 'Primary language only',
    labelEl: 'Μόνο κύρια γλώσσα',
  },
];

export function LanguagePreferenceToggle({ className }: { className?: string }) {
  const { primary, setPrimary, displayMode, setDisplayMode, mounted } = useLanguagePreference();

  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground', className)}
          aria-label={bilingualAria('Display language settings', 'Ρυθμίσεις γλώσσας εμφάνισης')}
          title={bilingualAria('Language', 'Γλώσσα')}
        >
          <Languages className="icon-sm" />
          <span className="sr-only">{primary === 'el' ? 'EL' : 'EN'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          <BilingualText
            en={commonEn('primary_language')}
            el={commonEl('primary_language')}
          />
        </DropdownMenuLabel>
        {PRIMARY_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setPrimary(opt.value)}
            className={cn(primary === opt.value && 'bg-primary/5')}
          >
            <BilingualText en={opt.labelEn} el={opt.labelEl} stacked />
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          <BilingualText en={commonEn('language_display')} el={commonEl('language_display')} />
        </DropdownMenuLabel>
        {DISPLAY_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setDisplayMode(opt.value)}
            className={cn(displayMode === opt.value && 'bg-primary/5')}
          >
            <BilingualText en={opt.labelEn} el={opt.labelEl} stacked />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

