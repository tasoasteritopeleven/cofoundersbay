'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * The right-hand page rail's open/closed state.
 *
 * Separate from `SidebarContext` on purpose. The left sidebar answers "where am
 * I in the product"; this rail answers "what else can I do on this page". They
 * are pinned independently because a reader who wants the navigation collapsed
 * is not thereby saying anything about page tools - and one preference
 * overwriting the other is how a layout starts feeling arbitrary.
 *
 * Two kinds of open, deliberately:
 *
 * - **Pinned** is a preference. It persists, and it reflows the main column, so
 *   the page is laid out around a rail that is going to stay.
 * - **Peeked** is a glance. It overlays, reflows nothing, and ends when the
 *   pointer leaves. Reflowing the page on hover would make the content jump
 *   under the reader's eyes every time they crossed the right edge.
 */
/**
 * What a mounted rail offers, without its content.
 *
 * The content is React nodes and stays with the page; this is the table of
 * contents - enough for the assistant to know the page has a "Narrow the
 * list" section with two filters on, and to open it by id.
 */
export type RailSectionSummary = {
  id: string;
  labelEn: string;
  labelEl: string;
  badge: number | string | null;
};

/*
 * The same two things for code that runs outside React - an assistant
 * action's executor is a plain async function, like the canvas command bus's.
 * The provider keeps this current; it is empty whenever no rail is mounted.
 */
const railBus: { sections: RailSectionSummary[]; open: (id: string) => void } = {
  sections: [],
  open: () => {},
};

/** The sections of the rail on screen now, or none. */
export function currentRailSections(): readonly RailSectionSummary[] {
  return railBus.sections;
}

/**
 * Open a section of the rail on screen now. Returns false, and does nothing,
 * when there is no rail or it has no section by that id - a caller told
 * "opened" for a section that does not exist would say so to the user.
 */
export function openCurrentRailSection(id: string): boolean {
  if (!railBus.sections.some((section) => section.id === id)) return false;
  railBus.open(id);
  return true;
}

type PageRailCtx = {
  /** Kept open by choice; the main column is offset for it. */
  pinned: boolean;
  /** Open under the pointer or keyboard focus; overlays, offsets nothing. */
  peeked: boolean;
  /** Either kind of open. */
  open: boolean;
  /** False until localStorage has been read, so SSR and hydration agree. */
  mounted: boolean;
  setPinned: (value: boolean) => void;
  togglePinned: () => void;
  setPeeked: (value: boolean) => void;
  /** True while a page has actually registered a rail. */
  hasRail: boolean;
  /**
   * The mounted rail registers its presence; internal to PageRail. Counted,
   * not a boolean: two rails sharing a page (a tab component's own rail on
   * top of the page's) cannot leave hasRail false when one of them unmounts.
   */
  registerRailPresence: (id: object) => () => void;
  /**
   * Open the rail on a named section: a peek on the desktop, the sheet below
   * `lg`. This is how a keyboard shortcut, a canvas command or an assistant
   * action can take the reader straight to a tool instead of leaving them to
   * find it. No-op while no rail is mounted.
   */
  openRailSection: (id: string) => void;
  /** The mounted rail registers its opener; internal to PageRail. */
  registerRailOpener: (open: (id: string) => void) => void;
  /** The mounted rail's sections, for the assistant's view of the page. */
  sections: readonly RailSectionSummary[];
  /** The mounted rail registers its sections; internal to PageRail. */
  registerRailSections: (sections: RailSectionSummary[]) => void;
};

const PageRailContext = createContext<PageRailCtx>({
  pinned: false,
  peeked: false,
  open: false,
  mounted: false,
  setPinned: () => {},
  togglePinned: () => {},
  setPeeked: () => {},
  hasRail: false,
  registerRailPresence: () => () => {},
  openRailSection: () => {},
  registerRailOpener: () => {},
  sections: [],
  registerRailSections: () => {},
});

const KEY = 'cfb:page-rail';

export function PageRailProvider({ children }: { children: ReactNode }) {
  /*
   * Collapsed on both the server and the first client render.
   *
   * The left sidebar defaults to expanded because navigation is the frame you
   * read the product through. Page tools are not: a reader arriving at a page
   * should meet the page, and reach for its tools second.
   */
  const [pinned, setPinnedState] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasRail, setHasRail] = useState(false);
  /* Every mounted PageRail puts its identity in this set. hasRail stays true
     while any entry remains, so one rail unmounting (a tab switching away)
     cannot strip the margin a surviving rail still needs. */
  const railIds = useRef(new Set<object>());
  const registerRailPresence = useCallback((id: object) => {
    railIds.current.add(id);
    setHasRail(true);
    return () => {
      railIds.current.delete(id);
      setHasRail(railIds.current.size > 0);
    };
  }, []);
  /* The opener belongs to whichever PageRail is mounted, so it lives in a ref
     rather than state: registering it must not re-render the provider's whole
     subtree. A no-op until a rail registers. */
  const railOpener = useRef<(id: string) => void>(() => {});
  const openRailSection = useCallback((id: string) => railOpener.current(id), []);
  const registerRailOpener = useCallback((open: (id: string) => void) => {
    railOpener.current = open;
    railBus.open = open;
  }, []);

  /* Compared by value: the page rebuilds its section array on every render,
     and storing each new identity would re-render the whole subtree each
     time for a table of contents that did not change. */
  const [sections, setSections] = useState<RailSectionSummary[]>([]);
  const sectionsKey = useRef('');
  const registerRailSections = useCallback((next: RailSectionSummary[]) => {
    const key = JSON.stringify(next);
    railBus.sections = next;
    if (key === sectionsKey.current) return;
    sectionsKey.current = key;
    setSections(next);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) setPinnedState(stored === '1');
    } catch {
      // Private mode, or storage blocked. Collapsed is a fine answer.
    }
  }, []);

  const persist = useCallback((value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? '1' : '0');
    } catch {
      // As above: the preference is a convenience, not state the app needs.
    }
  }, []);

  const setPinned = useCallback(
    (value: boolean) => {
      setPinnedState(value);
      persist(value);
      // Pinning subsumes the peek; leaving the pointer should not now close it.
      if (value) setPeeked(false);
    },
    [persist],
  );

  const togglePinned = useCallback(() => {
    setPinnedState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
    setPeeked(false);
  }, [persist]);

  return (
    <PageRailContext.Provider
      value={{
        pinned,
        peeked,
        open: pinned || peeked,
        mounted,
        setPinned,
        togglePinned,
        setPeeked,
        hasRail,
        registerRailPresence,
        openRailSection,
        registerRailOpener,
        sections,
        registerRailSections,
      }}
    >
      {children}
    </PageRailContext.Provider>
  );
}

export const usePageRail = () => useContext(PageRailContext);

/**
 * Width of the open rail. The value lives in globals.css (`--page-rail-width`,
 * stepped by breakpoint) so the main column's reserved margin in AppShell
 * reads the same number without a second literal to keep in step.
 */
export const PAGE_RAIL_WIDTH = 'var(--page-rail-width)';
/** Width of the collapsed icon strip. */
export const PAGE_RAIL_COLLAPSED_WIDTH = '3.25rem';
