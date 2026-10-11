'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isPreviewDemo } from '@/lib/preview-demo';

type DemoDataCtx = {
  showDemoData: boolean;
  toggleDemoData: () => void;
  setShowDemoData: (v: boolean) => void;
};

const DemoDataContext = createContext<DemoDataCtx>({
  showDemoData: true,
  toggleDemoData: () => {},
  setShowDemoData: () => {},
});

const STORAGE_KEY = 'cfb_demo_data';

export function DemoDataProvider({ children }: { children: ReactNode }) {
  // Default to true (show demo data) for better UX on first visit
  const [showDemoData, setShowDemoDataState] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage after mount to prevent SSR/CSR mismatch
  useEffect(() => {
    setMounted(true);
    if (isPreviewDemo()) {
      setShowDemoDataState(true);
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setShowDemoDataState(stored === '1');
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const toggleDemoData = useCallback(() => {
    setShowDemoDataState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  const setShowDemoData = useCallback((v: boolean) => {
    setShowDemoDataState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      // localStorage not available
    }
  }, []);

  // Prevent hydration mismatch by not rendering children until mounted
  // Actually, we should render children but just use the default state
  return (
    <DemoDataContext.Provider value={{ showDemoData: mounted ? showDemoData : true, toggleDemoData, setShowDemoData }}>
      {children}
    </DemoDataContext.Provider>
  );
}

export const useDemoData = () => useContext(DemoDataContext);
