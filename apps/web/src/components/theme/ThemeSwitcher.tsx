'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Palette, Sparkles, Check, Minus, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { applyTheme, getStoredTheme, type ThemeName } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/common/I18nProvider';
import { BilingualText } from '@/components/common/BilingualText';
import { translate } from '@/lib/i18n/translate';

export const THEME_OPTIONS = [
  {
    name: 'dark' as ThemeName,
    label: 'Dark',
    description: 'Classic dark theme',
    icon: Moon,
    swatch: ['#0f172a', '#8b5cf6', '#1e293b'],
  },
  {
    name: 'light' as ThemeName,
    label: 'Light',
    description: 'Soft lilac on cool grey',
    icon: Sun,
    swatch: ['#f6f6f7', '#765fe7', '#6e659a'],
  },
  {
    name: 'system' as ThemeName,
    label: 'System',
    description: 'Adapts to OS preference',
    icon: Monitor,
    swatch: ['#172035', '#06b6d4', '#1e3a52'],
  },
  {
    name: 'alliance' as ThemeName,
    label: 'Cyan',
    description: 'Soft sky blue, cool and clear',
    icon: Palette,
    swatch: ['#f2f6f7', '#207da5', '#3c6e83'],
  },
  {
    name: 'cofounder' as ThemeName,
    label: 'Cofounder',
    description: 'Modern & vibrant',
    icon: Sparkles,
    swatch: ['#0a0a14', '#9333ea', '#00ccff'],
  },
  {
    name: 'minimal' as ThemeName,
    label: 'Mint',
    description: 'Warm cream with a soft mint',
    icon: Minus,
    swatch: ['#f7f5f0', '#c1e1c1', '#356735'],
  },
  {
    name: 'apricot' as ThemeName,
    label: 'Apricot',
    description: 'Warm neutral with a soft apricot',
    icon: Sunrise,
    swatch: ['#f7f6f5', '#b16018', '#876752'],
  },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('dark');
  const [mounted, setMounted] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    setMounted(true);
    const theme = getStoredTheme();
    setCurrentTheme(theme);
    applyTheme(theme);
  }, []);

  const handleThemeChange = (theme: ThemeName) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  if (!mounted) {
    return (
      // Placeholder until mount; the real switcher replaces it.
      <Button variant="ghost" size="icon" className={cn('relative h-9 w-9', className)} aria-label={t('Theme')} disabled>
        <Moon className="icon-sm" />
      </Button>
    );
  }

  const CurrentIcon = THEME_OPTIONS.find((t) => t.name === currentTheme)?.icon || Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative h-9 w-9', className)} aria-label={t('Theme')}>
          <CurrentIcon className="icon-sm transition-all" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <BilingualText en="Choose Theme" el={translate('el', 'Choose Theme')} compact />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {THEME_OPTIONS.map((theme, idx) => {
          const isActive = currentTheme === theme.name;
          return (
            <div key={theme.name}>
              {idx === 3 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <BilingualText
                      en="Custom Themes"
                      el={translate('el', 'Custom Themes')}
                      compact
                      secondaryClassName="text-muted-foreground"
                    />
                  </DropdownMenuLabel>
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleThemeChange(theme.name)}
                className={cn(
                  'flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2',
                  isActive && 'bg-accent/60'
                )}
              >
                <div className="flex shrink-0 overflow-hidden rounded-md border border-border" style={{ width: 36, height: 28 }}>
                  <div style={{ background: theme.swatch[0], flex: 1 }} />
                  <div style={{ background: theme.swatch[1], width: 8 }} />
                  <div style={{ background: theme.swatch[2], width: 8 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <BilingualText
                    en={theme.label}
                    el={translate('el', theme.label)}
                    stacked
                    primaryClassName="text-sm font-medium leading-tight"
                    secondaryClassName="leading-tight"
                  />
                  <BilingualText
                    en={theme.description}
                    el={translate('el', theme.description)}
                    stacked
                    primaryClassName="text-2xs leading-tight text-muted-foreground"
                    secondaryClassName="text-2xs leading-tight text-muted-foreground"
                  />
                </div>
                {isActive && <Check className="ml-auto icon-sm text-primary-accessible shrink-0" />}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
