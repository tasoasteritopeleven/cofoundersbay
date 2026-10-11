'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, PanelRight, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BilingualText } from '@/components/common/BilingualText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { bilingualAria } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import {
  PAGE_RAIL_COLLAPSED_WIDTH,
  PAGE_RAIL_WIDTH,
  usePageRail,
} from './PageRailContext';

/**
 * One group of a page's supporting tools.
 *
 * A section is a *family*, not a pile: filters, or export, or settings - the
 * thing a reader is looking for when they look right. Splitting them means the
 * collapsed rail can show one icon per family, which is what makes a 52px
 * strip legible at all.
 */
export type PageRailSection = {
  id: string;
  glyph: CfbGlyphName;
  labelEn: string;
  labelEl: string;
  /** Rendered only while the rail is open, so a closed rail costs nothing. */
  content: ReactNode;
  /**
   * A number worth seeing without opening the rail - active filters, pending
   * items. Zero and null both mean "no badge"; a badge reading 0 is noise.
   */
  badge?: number | string | null;
  /**
   * Greek for a badge that is a word rather than a count (/analytics shows
   * its window: "7d", «7 ημ.»). A word badge is never added to the phone
   * button's total: that number means things waiting, and the period counted
   * there as one.
   */
  badgeEl?: string | null;
};

/**
 * The page rail.
 *
 * Every page's supporting controls, moved out of the reading column and kept
 * one gesture away. Nothing is removed by moving here: each control keeps its
 * label, its tooltip and its keyboard path, and the rail is reachable at every
 * width - as a rail on the desktop, as a sheet below `lg`, where there is no
 * room for a second one.
 *
 * Opening works two ways, and they mean different things. Hovering *peeks*:
 * the panel floats over the page, nothing reflows, and it closes when the
 * pointer leaves. Clicking the pin *keeps* it: the preference persists and the
 * main column is laid out around it. Reflowing on hover would move the text
 * under the reader every time they crossed the right edge, which is why the
 * two are separate.
 */
export function PageRail({ sections }: { sections: PageRailSection[] }) {
  const { primary } = useLanguagePreference();
  const badgeText = (section: PageRailSection) => {
    const badge = section.badge === 0 || section.badge == null ? null : section.badge;
    if (badge == null) return null;
    return { shown: primary === 'el' && section.badgeEl ? section.badgeEl : badge, en: badge, el: section.badgeEl ?? badge };
  };
  const { pinned, peeked, open, togglePinned, setPeeked, registerRailPresence, registerRailOpener, registerRailSections } = usePageRail();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState<string | null>(null);
  /* Which section is open at full size. A section is legible in the panel
     and comfortable here; this is the second, not a substitute. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The dialog opens from state, not from a Radix trigger, so Radix has no
  // trigger to hand focus back to and it fell to <body> on close. The button
  // that opened it is remembered and refocused instead.
  const expandButton = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tell the frame a rail exists, so the main column reserves the strip and the
  // floating chat button steps aside. Presence is counted per mounted rail:
  // unregistering on unmount releases only this rail's claim, so a rail that
  // outlives it keeps the width it needs. An empty rail renders nothing and
  // claims nothing.
  const railId = useRef<object>({});
  useEffect(() => {
    if (sections.length === 0) return;
    return registerRailPresence(railId.current);
  }, [sections.length, registerRailPresence]);

  // The table of contents, for the assistant: ids, labels and badges, never
  // the content. Emptied on unmount so a page without a rail is not described
  // with the last page's sections.
  const summaryKey = JSON.stringify(sections.map((s) => [s.id, s.labelEn, s.labelEl, s.badge ?? null]));
  useEffect(() => {
    registerRailSections(
      (JSON.parse(summaryKey) as [string, string, string, number | string | null][]).map(
        ([id, labelEn, labelEl, badge]) => ({ id, labelEn, labelEl, badge }),
      ),
    );
  }, [summaryKey, registerRailSections]);
  useEffect(() => () => registerRailSections([]), [registerRailSections]);

  // The first section is the one a reader most likely wants; opening the rail
  // with everything collapsed would cost a second click to do anything.
  useEffect(() => {
    if (open && !activeId && sections.length > 0) setActiveId(sections[0].id);
  }, [open, activeId, sections]);

  // `openRailSection` (a shortcut, a canvas command, an assistant action) lands
  // here: select the section and open whichever surface this width uses - a
  // peek on the desktop, the sheet below `lg`.
  //
  // One surface per width. The sheet's content is portaled, so the `lg:hidden`
  // wrapper does not hide it: opening both put a modal bottom sheet over the
  // desktop peek. Without matchMedia (tests, very old engines) the sheet is
  // the one that works at every width.
  useEffect(() => {
    registerRailOpener((id) => {
      setActiveId(id);
      setSheetExpanded(id);
      const desktop =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(min-width: 1024px)').matches;
      if (desktop) setPeeked(true);
      else setSheetOpen(true);
    });
  }, [registerRailOpener, setPeeked]);

  // Escape closes a peek. It deliberately does not unpin: Escape dismisses what
  // is floating, it does not undo a preference.
  useEffect(() => {
    if (!peeked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeeked(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peeked, setPeeked]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (sections.length === 0) return null;

  const openPeek = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!pinned) setPeeked(true);
  };

  // A short grace period: crossing the seam between the strip and the panel, or
  // overshooting a target by a few pixels, should not slam the panel shut.
  const closePeek = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      // Pointer exit must not dismiss a panel while keyboard focus is in it.
      if (!document.activeElement?.closest('[data-page-rail]')) setPeeked(false);
    }, 180);
  };

  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const expanded = sections.find((section) => section.id === expandedId) ?? null;

  const totalBadge = sections.reduce((sum, section) => {
    const b = section.badge;
    return sum + (typeof b === 'number' ? b : 0);
  }, 0);

  return (
    <TooltipProvider delayDuration={300}>
      {/*
        Below `lg` there is no room for a second rail, so the same sections open
        as a bottom sheet from a floating button. This path did not exist in the
        first cut - the strip was `hidden lg:flex` and nothing replaced it - so
        every control a page had moved into its rail was simply gone on a tablet
        or a phone. The sheet is the same `sections` array: same labels, same
        badges, same content, same handlers. The button sits above the mobile
        bottom nav and clear of the chat bubble, which is desktop-only.
      */}
      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={bilingualAria(
                totalBadge ? `Page tools, ${totalBadge} active` : 'Page tools',
                totalBadge ? `Εργαλεία σελίδας, ${totalBadge} ενεργά` : 'Εργαλεία σελίδας',
              )}
              className="tap-target fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-11 w-auto min-w-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-foreground shadow-lg sm:bottom-6"
            >
              <SlidersHorizontal className="icon-md" aria-hidden="true" />
              <span className="text-xs font-medium">
                <BilingualText en="Tools" el="Εργαλεία" compact />
              </span>
              {totalBadge > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-primary px-1 text-center text-2xs font-semibold leading-[1.1rem] text-primary-foreground"
                  aria-hidden="true"
                >
                  {totalBadge}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle><BilingualText en="Page tools" el="Εργαλεία σελίδας" /></SheetTitle>
              <SheetDescription>
                <BilingualText
                  en="Everything this page offers beyond its main content."
                  el="Ό,τι προσφέρει αυτή η σελίδα πέρα από το κύριο περιεχόμενο."
                  compact wrap
                />
              </SheetDescription>
            </SheetHeader>
            <ul className="mt-3 divide-y divide-border/60">
              {sections.map((section) => {
                const expanded = (sheetExpanded ?? sections[0]?.id) === section.id;
                const badge = badgeText(section);
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setSheetExpanded(expanded ? '' : section.id)}
                      aria-expanded={expanded}
                      aria-controls={`page-rail-sheet-${section.id}`}
                      className="tap-target flex min-h-12 w-full items-center gap-3 py-2 text-left"
                    >
                      <CfbGlyph name={section.glyph} className="icon-md shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        <BilingualText en={section.labelEn} el={section.labelEl} compact />
                      </span>
                      {badge != null && (
                        <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold leading-5 text-primary-foreground">{badge.shown}</span>
                      )}
                      <ChevronDown className={cn('icon-sm shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {expanded && (
                      <div id={`page-rail-sheet-${section.id}`} className="pb-4 pl-9">
                        {section.content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </SheetContent>
        </Sheet>
      </div>

      <aside
        data-page-rail=""
        aria-label={bilingualAria('Page tools', 'Εργαλεία σελίδας')}
        // Desktop only; below `lg` the sheet above carries the same sections.
        // Same layer as the left sidebar (SideNav is z-40): the two are the
        // same kind of chrome, and a peeked panel has to float over anything a
        // page puts in its own column. At z-30 the research canvas's toolbar
        // (z-50 inside a non-isolated column) sat on top of the panel's header
        // and its first rows, and clicks landed on the toolbar instead.
        className="fixed bottom-0 right-0 top-0 z-40 hidden lg:flex"
        // Glass while it floats over the page, the sidebar's surface while
        // pinned (globals.css, "Page rail surface").
        data-peek={peeked && !pinned ? 'true' : undefined}
        style={{ paddingTop: 'var(--top-banner-stack, 0px)' }}
        onMouseEnter={openPeek}
        onMouseLeave={closePeek}
        onFocusCapture={openPeek}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closePeek();
        }}
      >
        <div className="flex h-full">
          {/* The panel. Rendered to the left of the strip so the strip stays
              flush with the window edge whether or not the panel is out. */}
          <div
            className={cn(
              'h-full overflow-hidden border-l border-border transition-[width,opacity] duration-200 ease-out',
              open ? 'opacity-100' : 'w-0 opacity-0',
              // A peek floats over the page; a pin is part of the layout, so it
              // casts no shadow and needs none.
              peeked && !pinned ? 'shadow-modal' : '',
            )}
            style={{ width: open ? PAGE_RAIL_WIDTH : 0 }}
            data-rail-surface=""
            aria-hidden={!open}
          >
            {open && (
              <div className="flex h-full w-full flex-col">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  {/* Stacked, not inline-truncated: "PLATFORM TOTALS · ΣΥΝΟΛΑ
                      ΠΛΑΤΦΟΡΜΑΣ" is wider than the panel, and an ellipsis on
                      the one line that names what the reader is looking at is
                      the wrong thing to lose. Two short lines fit any label the
                      contract test lets through. */}
                  <div className="min-w-0 text-xs font-semibold uppercase leading-snug tracking-wider text-muted-foreground">
                    <BilingualText en={active.labelEn} el={active.labelEl} stacked wrap />
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    ref={expandButton}
                    type="button"
                    onClick={() => setExpandedId(active.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
                    aria-label={bilingualAria(
                      `Open ${active.labelEn} at full size`,
                      `Άνοιγμα «${active.labelEl}» σε πλήρες μέγεθος`,
                    )}
                  >
                    <Maximize2 className="icon-sm" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePinned}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
                    aria-pressed={pinned}
                    aria-label={
                      pinned
                        ? bilingualAria('Unpin page tools', 'Ξεκαρφίτσωμα εργαλείων')
                        : bilingualAria('Keep page tools open', 'Διατήρηση εργαλείων ανοιχτών')
                    }
                  >
                    {pinned ? (
                      <ChevronRight className="icon-sm" aria-hidden="true" />
                    ) : (
                      <ChevronLeft className="icon-sm" aria-hidden="true" />
                    )}
                  </button>
                  </div>
                </div>

                {/* Focusable because a section can be all figures and no
                    controls (/calendar's month totals, /admin's platform
                    totals): a scrolling panel with nothing a keyboard can land
                    on cannot be scrolled from the keyboard at all (axe
                    scrollable-region-focusable). */}
                <div
                  role="region"
                  aria-label={bilingualAria(active.labelEn, active.labelEl)}
                  tabIndex={0}
                  // The stylesheet keys on this to collapse viewport-driven
                  // grids: `lg:grid-cols-4` still fires at 320px because `lg:`
                  // asks about the window, not this box.
                  data-rail-content=""
                  className="min-h-0 flex-1 overflow-y-auto px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  {active.content}
                </div>
              </div>
            )}
          </div>

          {/* The strip. Always visible, one icon per family. */}
          <div
            className="flex h-full flex-col items-center gap-1 border-l border-border py-3"
            data-rail-surface=""
            style={{ width: PAGE_RAIL_COLLAPSED_WIDTH }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={togglePinned}
                  className={cn(
                    'mb-1 flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-ring',
                    pinned
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-pressed={pinned}
                  aria-label={
                    pinned
                      ? bilingualAria('Unpin page tools', 'Ξεκαρφίτσωμα εργαλείων')
                      : bilingualAria('Keep page tools open', 'Διατήρηση εργαλείων ανοιχτών')
                  }
                >
                  <PanelRight className="icon-md" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              {!open && (
                <TooltipContent side="left" className="text-xs">
                  <BilingualText en="Page tools" el="Εργαλεία σελίδας" />
                </TooltipContent>
              )}
            </Tooltip>

            <div className="h-px w-6 bg-border/60" />

            {sections.map((section) => {
              const isActive = open && section.id === active.id;
              const badge = badgeText(section);
              return (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(section.id);
                        // Clicking an icon is a commitment, not a glance.
                        if (!pinned) togglePinned();
                      }}
                      onFocus={() => {
                        setActiveId(section.id);
                        openPeek();
                      }}
                      onMouseEnter={() => setActiveId(section.id)}
                      className={cn(
                        'relative flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-ring',
                        isActive
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      aria-expanded={isActive}
                      // The strip is a column of icons: the tooltip shows the
                      // section's name to a pointer, but a tooltip is not an
                      // accessible name, so without this every section button
                      // was announced as "button" (axe button-name on all 14
                      // railed pages). The badge is spoken because it is the
                      // reason to open the section at all.
                      aria-label={
                        badge != null
                          ? bilingualAria(`${section.labelEn}, ${badge.en}`, `${section.labelEl}, ${badge.el}`)
                          : bilingualAria(section.labelEn, section.labelEl)
                      }
                    >
                      <CfbGlyph name={section.glyph} className="icon-md" />
                      {badge != null && (
                        <span
                          className="absolute -right-0.5 -top-0.5 min-w-[1rem] whitespace-nowrap rounded-full bg-primary px-1 text-center text-2xs font-semibold leading-4 text-primary-foreground"
                          aria-hidden="true"
                        >
                          {badge.shown}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {!open && (
                    <TooltipContent side="left" className="text-xs">
                      <BilingualText en={section.labelEn} el={section.labelEl} />
                      {badge != null && <span className="ml-1 opacity-70">({badge.shown})</span>}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>
      </aside>

      {/*
        Full size, on demand.

        The same `content` node as the panel, in a centred dialog wide enough
        for the layout it was written for - and deliberately without
        `data-rail-content`, so the one-column rule does not apply and a
        four-up grid is four-up again. This is the answer to content that is
        legible in the rail but cramped: room when it is asked for, and a
        reading column that stays free the rest of the time.
      */}
      <Dialog open={expandedId != null} onOpenChange={(o) => !o && setExpandedId(null)}>
        <DialogContent
          className="max-h-[85dvh] w-[min(92vw,48rem)] max-w-none overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandButton.current?.focus();
          }}
        >
          {expanded && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <BilingualText en={expanded.labelEn} el={expanded.labelEl} />
                </DialogTitle>
                <DialogDescription className="sr-only"><BilingualText en="Larger view of this side panel section." el="Μεγαλύτερη προβολή αυτής της ενότητας του πλαϊνού πίνακα." /></DialogDescription>
              </DialogHeader>
              <div className="mt-2">{expanded.content}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
