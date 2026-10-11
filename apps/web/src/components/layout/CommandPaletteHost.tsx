'use client';

import dynamic from 'next/dynamic';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCommandPalette } from '@/hooks/useCommandPalette';

const CommandPalette = dynamic(
  () => import('@/components/common/CommandPalette').then((module) => ({ default: module.CommandPalette })),
  { ssr: false },
);
const KeyboardShortcutsDialog = dynamic(
  () => import('@/components/common/KeyboardShortcutsDialog').then((module) => ({ default: module.KeyboardShortcutsDialog })),
  { ssr: false },
);

const OpenPalette = createContext<(open: boolean) => void>(() => {});

export function useOpenCommandPalette() {
  return useContext(OpenPalette);
}

/** One palette instance for the frame — sidebar, phone bar, and Ctrl+K share it. */
export function CommandPaletteHost({ children }: { children: ReactNode }) {
  const { open, setOpen, shortcutsOpen, setShortcutsOpen } = useCommandPalette();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <OpenPalette.Provider value={(next) => setOpen(next)}>
      {children}
      {ready ? (
        <>
          <CommandPalette open={open} onOpenChange={setOpen} onOpenShortcuts={() => setShortcutsOpen(true)} />
          <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </>
      ) : null}
    </OpenPalette.Provider>
  );
}
