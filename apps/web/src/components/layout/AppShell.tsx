'use client';

import { ReactNode, createContext, useContext, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { useSidebar } from './SidebarContext';
import { resolvePageHeader } from '@/lib/page-registry';
import { BilingualText } from '@/components/common/BilingualText';
import { PageContextualHelp } from '@/components/common/PageContextualHelp';
import { cn } from '@/lib/utils';
import { appShellMainClasses } from '@/lib/layout-config';
import { AIComposer } from '@/components/ai/AIComposer';
import { CommandPaletteHost } from './CommandPaletteHost';
import { TOP_BANNER_STACK } from './useTopBannerHeight';
import { PageRail, type PageRailSection } from './PageRail';
import { usePageRail } from './PageRailContext';
import { PageHeaderSlot } from './PageHeaderSlot';

const MemoSideNav = memo(SideNav);
const MemoTopBar = memo(TopBar);
const MemoMobileBottomNav = memo(MobileBottomNav);

/**
 * True inside an <AppShellFrame>. Lets a page keep writing `<AppShell title=…>`
 * while the chrome actually lives in the segment layout above it — adopted
 * from origin/claude/project-audit-upgrade-y2ebnr (029642e, 7c9c97d).
 */
const InAppShellFrame = createContext(false);

/** useLayoutEffect on the client, useEffect during SSR (which warns otherwise). */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The <main> elements of every mounted AppShellFrame and standalone-page
 * MainLandmark, oldest first. Only the last entry carries id="main-content"
 * at any moment; see the effect in useLandmarkMain.
 */
const mountedMains: HTMLElement[] = [];

/**
 * Keeps `main#main-content` unique while route transitions hold two page
 * landmarks in the DOM at once (axe caught the pair once on /discover). The
 * newest commit strips every earlier landmark's id and claims it, in a layout
 * effect so the duplication never reaches the screen or the accessibility
 * tree; when the newest landmark unmounts, the previous one claims the id
 * back. The JSX keeps the id for SSR - the type scale keys off it and the
 * skip link resolves it without waiting for hydration.
 */
function useLandmarkMain(ref: { current: HTMLElement | null }) {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    mountedMains.push(el);
    for (const other of document.querySelectorAll<HTMLElement>('main#main-content')) {
      if (other !== el) other.removeAttribute('id');
    }
    el.setAttribute('id', 'main-content');
    return () => {
      const i = mountedMains.indexOf(el);
      if (i >= 0) mountedMains.splice(i, 1);
      const previous = mountedMains[mountedMains.length - 1];
      if (previous?.isConnected) previous.setAttribute('id', 'main-content');
    };
  }, []);
}

/**
 * The one <main> landmark of a standalone page (login, landing, public cards,
 * error pages) that renders no AppShellFrame. Same contract as the frame's
 * landmark: the id, the skip-link tabIndex, and the overlap dedupe.
 */
export function MainLandmark({
  children,
  className,
  ...props
}: { children: ReactNode } & Omit<React.ComponentPropsWithoutRef<'main'>, 'id' | 'tabIndex'>) {
  const ref = useRef<HTMLElement>(null);
  useLandmarkMain(ref);
  // tabIndex keeps this the skip-link target: focusable without painting an
  // outline ring.
  return (
    <main ref={ref} id="main-content" tabIndex={-1} className={cn('focus:outline-none', className)} {...props}>
      {children}
    </main>
  );
}


export type AppShellFrameProps = {
  children: ReactNode;
  /** Full-height layout (messages) — no page scroll, fills the viewport. */
  fullHeight?: boolean;
  /** Extra class on the <main> element. */
  contentClassName?: string;
};

/**
 * The persistent application chrome: sidebar, top bar, mobile nav and the
 * <main> landmark.
 *
 * Rendered by a segment `layout.tsx` rather than by each page, so navigating
 * between two pages in the same section no longer unmounts and remounts the
 * whole navigation — the sidebar keeps its scroll position, its queries are
 * not refetched, and `loading.tsx` renders inside the shell instead of
 * replacing it.
 */
export function AppShellFrame({
  children,
  fullHeight = false,
  contentClassName,
}: AppShellFrameProps) {
  const { expanded, mounted } = useSidebar();
  const { pinned: railPinned, hasRail } = usePageRail();
  const mainRef = useRef<HTMLElement>(null);
  useLandmarkMain(mainRef);

  return (
    <InAppShellFrame.Provider value={true}>
      <CommandPaletteHost>
      <div
        className={cn('bg-background', fullHeight ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]')}
        style={{ paddingTop: TOP_BANNER_STACK }}
      >
        {/* Skip link lives once in app/layout.tsx so it is never duplicated in the tab order. */}

        {/* Fixed left sidebar — rail from `sm`, drawer from `lg`; hidden below `sm` */}
        <MemoSideNav />

        {/* Main column — offset by sidebar width on lg+ */}
        <div
          // Named group, so anything inside can lay itself out for the width
          // the rail actually leaves rather than for the viewport.
          data-rail={hasRail ? (railPinned ? 'pinned' : 'strip') : 'none'}
          className={cn(
            'group/shell flex min-w-0 flex-col',
            fullHeight ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]',
            'transition-[margin-left] duration-200 ease-out',
            // Rail from `sm` (68px), drawer from `lg`. Below `sm` the nav is the
            // bottom bar and the column takes the full width.
            'sm:ml-[4.25rem]',
            (mounted ? expanded : true) ? 'lg:ml-[15rem]' : 'lg:ml-[4.25rem]',
            // The page rail, on the other side. The collapsed strip is always
            // reserved on a page that has one, so pinning and unpinning slides
            // the panel rather than reflowing the whole column twice.
            'transition-[margin-right] duration-200 ease-out',
            hasRail && (railPinned ? 'lg:mr-[calc(var(--page-rail-width)+3.25rem)]' : 'lg:mr-[3.25rem]'),
          )}
        >
          <MemoTopBar />

          {fullHeight ? (
            <main
              ref={mainRef}
              id="main-content"
              // tabIndex keeps this the skip-link target: focusable without
              // painting an outline ring.
              tabIndex={-1}
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-hidden focus:outline-none',
                // Phone clearance covers the bottom nav and the page-tools button
                // above it. From `sm` there is no bottom nav.
                'pb-[calc(10rem+env(safe-area-inset-bottom,0px))] sm:pb-0',
                contentClassName,
              )}
            >
              {children}
            </main>
          ) : (
            <main
              ref={mainRef}
              id="main-content"
              tabIndex={-1}
              // No width cap. The column is already offset by the sidebar's own
              // width, so "full width" here means exactly the space the sidebar
              // leaves, never over it.
              className={cn(appShellMainClasses, contentClassName)}
            >
              {children}
            </main>
          )}

          <MemoMobileBottomNav />
        </div>
      </div>
      </CommandPaletteHost>
    </InAppShellFrame.Provider>
  );
}

type AppShellProps = {
  title?: string;
  description?: string;
  /**
   * Greek heading, for the rare page whose header cannot be a constant — a
   * count folded into the sentence, say. Everywhere else the pair lives in the
   * page registry and neither of these is passed: `resolvePageHeader` already
   * took overrides for them, but there was no prop to supply one, so a page
   * with a dynamic English description had no way to make the Greek match.
   */
  titleEl?: string;
  descriptionEl?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Show contextual help from page registry when available */
  showHelp?: boolean;
  /** Full-height layout (messages page) — no scroll, fills viewport */
  fullHeight?: boolean;
  /** Extra class on the content wrapper */
  contentClassName?: string;
  /** Extra class on the page H1 — founder overview scales the title locally. */
  titleClassName?: string;
  /**
   * Contextual Ask AI prompt. Defaults to the page title when omitted.
   * Pass `false` to hide (AI workspace, pages that already own the CTA).
   */
  askAi?: string | false;
  /**
   * The page's supporting tools, in the right-hand rail.
   *
   * Filters, view switches, export, page settings, secondary figures - the
   * controls that are *about* the page rather than the page itself. The main
   * column then carries only what the page exists to do.
   *
   * Omit it and nothing changes: a page without a rail keeps the full width.
   */
  rail?: PageRailSection[];
};

/**
 * Page-level shell.
 *
 * Inside an <AppShellFrame> (i.e. the segment layout already mounted the
 * chrome) this renders only the page header and body, so every existing
 * `<AppShell title=…>` call site keeps working unchanged and never produces a
 * second sidebar. Outside a frame it renders the frame itself, which is how
 * pages in sections that have no layout frame continue to work.
 */
export function AppShell({
  title,
  description,
  titleEl,
  descriptionEl,
  actions,
  children,
  showHelp = false,
  fullHeight = false,
  contentClassName,
  titleClassName,
  askAi,
  rail,
}: AppShellProps) {
  const insideFrame = useContext(InAppShellFrame);
  const pathname = usePathname() ?? '/';
  const resolved = resolvePageHeader(pathname, { title, description, titleEl, descriptionEl });
  const pageTitle = resolved.title;
  const pageTitleEl = resolved.titleEl;
  const pageDescription = resolved.description;
  const pageDescriptionEl = resolved.descriptionEl;
  const showAskAi = Boolean(pageTitle) && askAi !== false;
  const [metaSlot, setMetaSlot] = useState<HTMLDivElement | null>(null);
  const askAiPrompt =
    typeof askAi === 'string'
      ? askAi
      : `Help me with ${pageTitle ?? 'this page'}${pageDescription ? `: ${pageDescription}` : ''}. What should I do next?`;

  const headerShown = Boolean(pageTitle || pageDescription || actions || showAskAi || showHelp);

  const body = fullHeight ? (
    children
  ) : (
    // Inside a frame the <main> belongs to the layout above, so a page-level
    // contentClassName (e.g. overflow-x-clip on /analytics, /discover,
    // /matches, pitch-deck) lands on this wrapper instead — same clipping.
    <div className={cn('space-y-5', insideFrame && contentClassName)}>
      {headerShown && (
        <header className="space-y-3">
          {/* Stacks under a pinned rail: at that width a side-by-side header
              gives the title about 90px and the Ask AI bar the rest. */}
          <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6 group-data-[rail=pinned]/shell:lg:flex-col group-data-[rail=pinned]/shell:lg:gap-3">
            {/* A floor for the title. The Ask AI bar asked for 57.5rem and would
                not shrink, so at 1440px the title kept ~370px and 10 of 138
                bilingual titles broke mid-phrase ("Founder dashboard · Πίνακας
                / ελέγχου ιδρυτή"). Now the bar gives way down to 20rem before
                the title does; at 1920px nothing changes. */}
            <div className="min-w-0 flex-1 lg:min-w-[min(100%,42rem)] group-data-[rail=pinned]/shell:lg:min-w-0" data-page-header="">
              {pageTitle && (
                <h1 className={cn('page-title text-balance text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl', titleClassName)}>
                  <BilingualText en={pageTitle} el={pageTitleEl} />
                </h1>
              )}
              {pageDescription && (
                <p className="page-lead mt-0.5 max-w-prose text-sm leading-snug text-muted-foreground">
                  <BilingualText
                    en={pageDescription}
                    el={pageDescriptionEl}
                    stacked
                    wrap
                    secondaryFrom="lg"
                  />
                </p>
              )}
            </div>
            {(showHelp || showAskAi) && (
              <div className="flex w-full min-w-0 items-center gap-2 lg:mt-0.5 lg:w-[min(100%,57.5rem)] lg:min-w-[20rem] lg:shrink lg:justify-end group-data-[rail=pinned]/shell:lg:w-full">
                {showHelp && <PageContextualHelp compact defaultOpen={false} />}
                {showAskAi && (
                  <AIComposer
                    prompt={askAiPrompt}
                    className="w-full min-w-0"
                  />
                )}
              </div>
            )}
          </section>
          {/* Always present, hidden while empty: the header's actions, and the
              slot page-level notes portal into (PageHeaderSlot). */}
          <div ref={setMetaSlot} className="flex flex-wrap items-center gap-2 empty:hidden">
            {actions}
          </div>
        </header>
      )}
      <PageHeaderSlot.Provider value={{ inHeader: headerShown, slot: metaSlot }}>{children}</PageHeaderSlot.Provider>
    </div>
  );

  // The rail travels with the body, inside or outside a frame, so a page keeps
  // its tools whichever way its section mounts the chrome.
  const withRail = rail && rail.length > 0 ? (
    <>
      {body}
      <PageRail sections={rail} />
    </>
  ) : (
    body
  );

  if (insideFrame) return withRail;

  return (
    <AppShellFrame fullHeight={fullHeight} contentClassName={contentClassName}>
      {withRail}
    </AppShellFrame>
  );
}
