'use client';

import { createContext, useContext, useState, useEffect, useCallback, useId, ReactNode } from 'react';
import type { SidebarMode } from './nav-modes';

type SidebarCtx = {
  expanded: boolean;
  mounted: boolean;
  /**
   * True between `sm` and `lg`, i.e. the navigation-rail window.
   *
   * Tablets in portrait (744-1023px) used to get the phone chrome: SideNav was
   * `hidden lg:flex` and MobileBottomNav `lg:hidden`, so an iPad showed a
   * five-item bottom bar and no side navigation at all, with every other
   * section behind "More". Material 3 gives 600dp and up a navigation rail.
   *
   * This flag decides the rail's *contents* only — whether labels render — and
   * is false during SSR and the first client render so the markup matches. The
   * rail's width is CSS (`w-[4.25rem] lg:w-[15rem]`), so the layout is correct
   * on first paint without waiting for this.
   */
  isRail: boolean;
  toggle: () => void;
  setExpanded: (v: boolean) => void;
  mobileNavOpen: boolean;
  mobileNavId: string;
  setMobileNavOpen: (open: boolean) => void;
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
};

const SidebarContext = createContext<SidebarCtx>({
  expanded: true,
  mounted: false,
  isRail: false,
  toggle: () => {},
  setExpanded: () => {},
  mobileNavOpen: false,
  mobileNavId: 'mobile-navigation',
  setMobileNavOpen: () => {},
  mode: 'work',
  setMode: () => {},
});

const KEY = 'cfb_sidebar';
const MODE_KEY = 'cfb:sidebar-mode';

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always start with true on both server and client to prevent hydration mismatch
  const [expanded, setExpandedState] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isRail, setIsRail] = useState(false);
  const mobileNavId = useId();
  const [mode, setModeState] = useState<SidebarMode>('work');

  // Only read localStorage after mount to prevent SSR/CSR mismatch
  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(KEY);
      if (v !== null) setExpandedState(v === '1');
      const storedMode = localStorage.getItem(MODE_KEY);
      if (storedMode === 'work' || storedMode === 'explore' || storedMode === 'account') {
        setModeState(storedMode);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  // Rail window: wide enough for side navigation, too narrow for the 240px
  // drawer. Listened to rather than read once, so a rotated tablet or a resized
  // window swaps the nav's contents without a reload.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px) and (max-width: 1023.98px)');
    const apply = () => setIsRail(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const toggle = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  const setExpanded = useCallback((v: boolean) => {
    setExpandedState(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      // localStorage not available
    }
  }, []);

  const setMode = useCallback((next: SidebarMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // localStorage not available
    }
  }, []);

  return (
    <SidebarContext.Provider
      value={{ expanded, mounted, isRail, toggle, setExpanded, mobileNavOpen, mobileNavId, setMobileNavOpen, mode, setMode }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
