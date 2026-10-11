'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActiveNavHref, getSectionsForMode, modeForPath, type SidebarMode } from './nav-modes';
import { ModeSwitcher } from './ModeSwitcher';
import { useSidebar } from './SidebarContext';
import { useSidebarMode } from '@/hooks/use-sidebar-mode';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { OptimizedLink } from '@/components/common/OptimizedLink';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NAV_LINK_DESCRIPTIONS } from '@/lib/nav-descriptions';
import {
  getNavDescriptionEl,
  getNavLabelEl,
  getNavSectionEl,
} from '@/lib/i18n/strings-nav';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { commonEn, commonEl } from '@/lib/i18n/strings-common';
import { Logo, LogoIcon } from '@/components/brand/Logo';
import { CfbGlyph, NavIcon, sectionNavGlyphs } from '@/components/icons/CfbGlyph';
import { isPreviewDemo } from '@/lib/preview-demo';
import { useStoredUser } from '@/hooks/useStoredUser';
import { useRoleOptional } from '@/contexts/RoleContext';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { PreviewDemoBadge } from './TopBar';
import { Button } from '@/components/ui/button';

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { expanded, isRail, toggle, mounted } = useSidebar();
  const { messages: unreadMessages, intros: pendingIntros, notifications: unreadNotifications } = useUnreadCounts();
  const user = useStoredUser();
  const role = useRoleOptional();
  const primaryRole = role?.primaryRole;
  const [mode, setMode] = useSidebarMode();
  // Between `sm` and `lg` the aside is a fixed 68px rail, so it renders its
  // collapsed contents regardless of the stored preference; the preference
  // still governs from `lg` up, where the 240px drawer fits.
  // Same first paint as AppShellFrame: expanded until `mounted`, so a stored
  // collapse cannot disagree with the server HTML (OptimizedLink attributes
  // and the logo link's aria-label both follow `showLabels`).
  const pinnedLabels = (mounted ? expanded : true) && !isRail;

  /*
   * Hover peek, the same gesture the page rail on the right answers to. A
   * collapsed sidebar (or the tablet rail) widens to the full drawer while a
   * mouse rests on it, over the page rather than pushing it, and folds back
   * when the pointer leaves, on Escape, or on navigation. The edge button
   * still pins it open for good. Touch and pen taps do not peek: on a tablet
   * a tap is a choice, and a drawer opening under the finger would steal it.
   */
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<number | null>(null);
  // Closing the drawer under a resting pointer (Escape, a link chosen from
  // it) reflows the sidebar, and the browser answers with a fresh
  // pointerenter that would reopen it at once. Held until the pointer leaves.
  const peekHeld = useRef(false);
  const clearPeekTimer = useCallback(() => {
    if (peekTimer.current !== null) {
      window.clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  }, []);
  const startPeek = useCallback((event: React.PointerEvent) => {
    if (pinnedLabels || event.pointerType !== 'mouse' || peekHeld.current) return;
    clearPeekTimer();
    // A short intent delay, so sweeping the pointer across to the page does
    // not flash the drawer open.
    peekTimer.current = window.setTimeout(() => setPeeking(true), 180);
  }, [pinnedLabels, clearPeekTimer]);
  const endPeek = useCallback(() => {
    peekHeld.current = false;
    clearPeekTimer();
    peekTimer.current = window.setTimeout(() => setPeeking(false), 140);
  }, [clearPeekTimer]);
  const peekingRef = useRef(false);
  peekingRef.current = peeking;
  const closePeek = useCallback(() => {
    clearPeekTimer();
    if (peekingRef.current) peekHeld.current = true;
    setPeeking(false);
  }, [clearPeekTimer]);
  useEffect(() => clearPeekTimer, [clearPeekTimer]);
  useEffect(() => {
    if (pinnedLabels) setPeeking(false);
  }, [pinnedLabels]);
  useEffect(() => {
    closePeek();
  }, [pathname, closePeek]);
  useEffect(() => {
    if (!peeking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePeek();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peeking, closePeek]);
  const showLabels = pinnedLabels || (mounted && peeking);

  // Redirect to login when session expires
  useEffect(() => {
    const handleLogout = () => {
      if (isPreviewDemo()) return;
      router.replace('/login');
    };
    window.addEventListener('cfb:logout', handleLogout);
    return () => window.removeEventListener('cfb:logout', handleLogout);
  }, [router]);

  // Handle mode change with persistence
  const handleModeChange = useCallback((newMode: SidebarMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfb:sidebar-mode', newMode);
    }
  }, [setMode]);

  // primaryRole comes from RoleContext (root-level, API-backed — the single source
  // of truth per docs/AI_PLATFORM_UPGRADE_PLAN.md §1.2). user?.role is a coarser
  // string cached in localStorage at login and only used as a fallback while
  // RoleContext is still loading or if it failed to fetch.
  const effectiveRole = primaryRole ?? user?.role;
  const sections = useMemo(
    () => getSectionsForMode(mode, effectiveRole),
    [mode, effectiveRole],
  );
  const glyphs = useMemo(() => sectionNavGlyphs(sections), [sections]);

  // A page reached from anywhere (a card, the assistant, a notification)
  // shows the list it lives in: on /discover the sidebar stayed on Work with
  // nothing lit while Explore held the page. Only a navigation, or the stored
  // mode arriving after mount, moves it; a click on the switch sticks.
  useEffect(() => {
    if (!mounted) return;
    const next = modeForPath(pathname, mode, effectiveRole);
    if (next !== mode) setMode(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, effectiveRole, mounted]);
  // The most specific entry only, as MobileNav does: a prefix test lit
  // "Admin console" (/admin) on every admin page, beside the page's own
  // entry, and General (/settings) beside every settings page.
  const activeHref = getActiveNavHref(pathname, sections);

  // The current page's entry in view. Messages sits below the fold of the
  // founder's Work list at 900px, so the page was lit where nobody could see.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mounted) return;
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeHref, mode, mounted]);

  // Hide sidebar on auth pages
  const isAuthPage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/auth');

  if (isAuthPage) return null;

  const rail = !showLabels;
  const railSlot =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-[36px] lg:w-[36px]';
  const chromeIcon = rail ? 'icon-md' : 'icon-sm';

  const badgeFor = (href: string, badgeType?: 'messages' | 'connections' | 'notifications'): number => {
    if (badgeType === 'messages' || href === '/messages') return unreadMessages;
    if (badgeType === 'connections' || href === '/connections') return pendingIntros;
    if (badgeType === 'notifications' || href === '/notifications') return unreadNotifications;
    return 0;
  };

  return (
    <TooltipProvider delayDuration={400}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full flex-col overflow-x-visible border-r border-border bg-card/98 backdrop-blur-sm',
          'transition-[width] duration-200 ease-out will-change-[width]',
          // Rail from `sm`, drawer from `lg`. Width is pure CSS so the shell is
          // correct on first paint; only the contents wait for `isRail`.
          'hidden sm:flex',
          'max-sm:pointer-events-none max-sm:invisible',
          'w-[4.25rem]',
          (mounted ? expanded : true) ? 'lg:w-[15rem]' : 'lg:w-[4.25rem]',
          // Peeking floats the full drawer over the page; the page keeps its
          // margin, so nothing underneath moves. Only after mount: a peek
          // class on the first client paint would not have been on the server.
          mounted && peeking && 'w-[15rem] shadow-modal lg:w-[15rem]',
        )}
        onPointerEnter={startPeek}
        onPointerLeave={endPeek}
        data-rail={mounted && rail ? 'true' : undefined}
        data-peek={mounted && peeking ? 'true' : undefined}
        aria-label={bilingualAria(commonEn('main_navigation'), commonEl('main_navigation'))}
      >
        {/* ── Logo header ── */}
        <div
          className={cn(
            'flex h-14 flex-shrink-0 items-center overflow-x-hidden border-b border-border',
            showLabels ? 'justify-start pl-2 pr-3' : 'justify-center px-0',
          )}
        >
          {showLabels ? (
            <OptimizedLink href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <Logo size="sm" />
            </OptimizedLink>
          ) : (
            <OptimizedLink
              href="/"
              // Collapsed, the logo is the mark alone - no wordmark to name the
              // link - so every page with a collapsed sidebar (and the research
              // canvas, which always collapses it) had a nameless home link.
              aria-label="CoFounderBay home"
              className="flex h-11 w-11 items-center justify-center hover:opacity-80 transition-opacity"
            >
              <LogoIcon size={35} />
            </OptimizedLink>
          )}
        </div>

        {/* ── Mode Switcher ── */}
        <ModeSwitcher currentMode={mode} onModeChange={handleModeChange} variant={showLabels ? 'list' : 'rail'} />

        {/* ── Navigation ── */}
        <nav ref={navRef} className={cn('flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-hide', rail && 'flex flex-col items-center')}>
          {sections.map(({ section, links }, sectionIndex) => (
            <div key={section} className={cn('mb-0.5', rail && 'flex w-full flex-col items-center')}>
              {/* nav-section-label, not plain text-xs: these section headings
                  take the display steps' -2% per pass while the links under them
                  take the +2% of the body scale. The uppercase + tracking classes
                  still mark a kicker; globals.css paints them as the source
                  title case (Dashboard), not DASHBOARD. */}
              {showLabels ? (
                <p className="nav-section-label mx-3 mb-1 mt-2.5 text-xs text-muted-foreground first:mt-1">
                  <BilingualText
                    en={section}
                    el={getNavSectionEl(section)}
                    stacked
                    primaryClassName="font-semibold uppercase tracking-widest"
                    secondaryClassName="normal-case tracking-normal"
                  />
                </p>
              ) : (
                <div className="mx-auto my-1.5 h-px w-6 bg-border/50" />
              )}
              <ul className={cn('space-y-0.5', showLabels ? 'px-2' : 'flex w-full flex-col items-center px-0')}>
                {links.map(({ href, label, icon: Icon, badge: badgeType }, linkIndex) => {
                  const active = href === activeHref;
                  const badge = badgeFor(href, badgeType);

                  const navHint = NAV_LINK_DESCRIPTIONS[href];
                  const navHintEl = getNavDescriptionEl(href);
                  const labelEl = getNavLabelEl(href);

                  // Remote introduced the /ai hub; use the Bot lucide glyph as the
                  // navigational icon for AI Assistant / Ask AI entries.
                  const FallbackIcon = href === '/ai' ? Bot : Icon;

                  const link = (
                    <OptimizedLink
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      title={
                        mounted && !showLabels
                          ? bilingualAria(
                              navHint ?? label,
                              navHintEl ?? labelEl,
                            )
                          : undefined
                      }
                      className={cn(
                        'group relative flex items-center rounded-lg text-sm transition-all duration-150 min-w-0 overflow-hidden',
                        showLabels ? 'gap-2 px-2 py-1.5' : cn(railSlot, 'justify-center p-0'),
                        active
                          ? 'bg-primary/8 text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                      )}
                    >
                      {/* Active left bar */}
                      {active && showLabels && (
                        <span
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}

                      {/* Icon + badge (collapsed) */}
                      <span className="relative flex-shrink-0">
                        <NavIcon
                          href={href}
                          name={glyphs[sectionIndex]?.[linkIndex] ?? null}
                          fallback={FallbackIcon}
                          className={cn(
                            chromeIcon,
                            active ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground',
                          )}
                        />
                        {badge > 0 && !showLabels && (
                          <span
                            aria-hidden="true"
                            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold leading-none text-primary-foreground ring-2 ring-card"
                          >
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </span>
                      {!showLabels && <span className="sr-only">{bilingualAria(label, labelEl)}</span>}

                      {/* Label + badge (expanded) */}
                      {showLabels && (
                        <>
                          {/* Wraps rather than truncates: a cut label ("Αποθηκευμένες
                              αναζ…") is a name the reader has to hover to finish. */}
                          <BilingualText en={label} el={labelEl} stacked wrap className="min-w-0 flex-1" />
                          {badge > 0 && (
                            <span
                              aria-hidden="true"
                              className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold leading-none text-primary-foreground"
                            >
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </>
                      )}
                      {badge > 0 && (
                        <span className="sr-only">
                          {bilingualAria(`${badge} unread`, `${badge} ${badge === 1 ? 'αδιάβαστο' : 'αδιάβαστα'}`)}
                        </span>
                      )}
                    </OptimizedLink>
                  );

                  return (
                    <li key={`${section}-${href}`} className={rail ? 'flex w-full justify-center' : undefined}>
                      {showLabels && navHint ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[240px] text-xs">
                            <p className="font-medium text-foreground">
                              <BilingualText en={label} el={labelEl} />
                            </p>
                            {navHint && (
                              <p className="text-muted-foreground">
                                <BilingualText en={navHint} el={navHintEl} />
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Search + bell stay in the rail; command/locale/theme/demo live in UserMenu. */}
        <div className={cn('flex-shrink-0 border-t border-border', showLabels ? 'space-y-1 p-2' : 'flex flex-col items-center gap-0.5 px-0 py-1.5')}>
          <div className={cn(showLabels ? 'flex items-center gap-0.5' : 'flex flex-col items-center gap-0.5')}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('shrink-0 text-muted-foreground', rail ? railSlot : 'h-8 w-8')}
              onClick={() => router.push('/search')}
              aria-label={bilingualAria('Search', 'Αναζήτηση')}
            >
              <CfbGlyph name="search" className={chromeIcon} />
            </Button>
            <NotificationsBell className={rail ? railSlot : 'h-8 w-8'} />
          </div>
          {showLabels && <PreviewDemoBadge className="max-w-full justify-start" />}
          {mounted ? (
            <UserMenu variant="sidebar" rail={rail} />
          ) : (
            <div className={cn('rounded-lg bg-secondary/40', showLabels ? 'h-10' : 'mx-auto h-9 w-9')} />
          )}
        </div>

        {mounted && !isRail && (
          <button
            type="button"
            data-sidebar-edge-toggle=""
            onClick={toggle}
            // The pinned state, not the peek: while peeking, this button is
            // what keeps the drawer open after the pointer leaves.
            aria-expanded={pinnedLabels}
            aria-label={bilingualAria(
              pinnedLabels ? commonEn('collapse_sidebar') : commonEn('expand_sidebar'),
              pinnedLabels ? commonEl('collapse_sidebar') : commonEl('expand_sidebar'),
            )}
            className="absolute right-0 top-1/2 z-50 flex h-6 w-6 min-w-[24px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25"
          >
            {pinnedLabels ? (
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        )}
      </aside>
    </TooltipProvider>
  );
}
