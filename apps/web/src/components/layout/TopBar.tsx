'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Globe, Keyboard, Languages, MoreHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';
import { MobileNav } from './MobileNav';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { NotificationsBell } from './NotificationsBell';
import { BilingualText } from '@/components/common/BilingualText';
import { commonEn, commonEl } from '@/lib/i18n/strings-common';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { STATUS } from '@/lib/semantic-colors';
import { useOpenCommandPalette } from './CommandPaletteHost';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/common/I18nProvider';
import { TOP_BANNER_STACK } from './useTopBannerHeight';

/**
 * Shared preview-demo chip. Lives in the phone bar and the sidebar user row.
 */
export function PreviewDemoBadge({ className }: { className?: string }) {
  const user = useCurrentUser();
  if (user?.email !== 'demo@cofounderbay.com') return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/register"
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-2xs font-medium transition-colors',
              STATUS.warning.chip,
              'hover:brightness-95',
              className,
            )}
          >
            <Sparkles className="icon-sm" aria-hidden="true" />
            <BilingualText en="Demo" el="Δείγμα" compact secondaryClassName="hidden" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-[220px]">
          <p className="text-xs">
            <BilingualText en={commonEn('demo_mode_banner')} el={commonEl('demo_mode_banner')} />
          </p>
          <p className="mt-1 text-xs font-medium text-status-warning underline underline-offset-2">
            <BilingualText en={commonEn('create_free_account')} el={commonEl('create_free_account')} />
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MobileToolsMenu({ onCommand }: { onCommand: () => void }) {
  const { showDemoData, toggleDemoData } = useDemoData();
  const { displayMode, setDisplayMode } = useLanguagePreference();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t('More tools')}
        >
          <MoreHorizontal className="icon-sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuItem onClick={onCommand}>
          <Keyboard className="mr-2 icon-sm shrink-0" aria-hidden="true" />
          <BilingualText en="Command palette" el="Παλέτα εντολών" compact />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings#language')}>
          <Globe className="mr-2 icon-sm shrink-0" aria-hidden="true" />
          <BilingualText en="Language" el="Γλώσσα" compact />
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setDisplayMode(displayMode === 'bilingual' ? 'primary-only' : 'bilingual')}
        >
          <Languages className="mr-2 icon-sm shrink-0" aria-hidden="true" />
          <BilingualText
            en={displayMode === 'bilingual' ? 'Primary language only' : 'Bilingual display'}
            el={displayMode === 'bilingual' ? 'Μόνο κύρια γλώσσα' : 'Δίγλωσση εμφάνιση'}
            compact
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleDemoData}>
          {showDemoData ? <Eye className="mr-2 icon-sm shrink-0" aria-hidden="true" /> : <EyeOff className="mr-2 icon-sm shrink-0" aria-hidden="true" />}
          <BilingualText
            en={showDemoData ? 'Hide sample data' : 'Show sample data'}
            el={showDemoData ? 'Απόκρυψη δείγματος δεδομένων' : 'Εμφάνιση δείγματος δεδομένων'}
            compact
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Phone-only chrome. From `sm` the sidebar rail keeps search + notifications
 * and folds palette, theme, and locale into the account menu — a sticky top
 * bar there would only steal vertical space without widening the column.
 */
export function TopBar() {
  const pathname = usePathname();
  const setCommandOpen = useOpenCommandPalette();

  const isAuthPage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/auth');

  if (isAuthPage) return null;

  return (
    <header
      style={{ top: TOP_BANNER_STACK }}
      className="sticky z-30 flex h-12 min-h-12 items-center gap-0.5 border-b border-border bg-background/80 px-2 backdrop-blur-md safe-x sm:hidden"
    >
      <MobileNav />
      <SearchBar />
      <div className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-0.5">
        <PreviewDemoBadge className="hidden xs:inline-flex" />
        <MobileToolsMenu onCommand={() => setCommandOpen(true)} />
        <LanguageSwitcher iconOnly className="h-9 w-9" />
        <ThemeSwitcher className="h-9 w-9" />
        <NotificationsBell className="h-9 w-9" />
        <UserMenu />
      </div>
    </header>
  );
}
