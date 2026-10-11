'use client';

import { useSidebar } from '@/components/layout/SidebarContext';

export function useSidebarMode() {
  const { mode, setMode } = useSidebar();
  return [mode, setMode] as const;
}
