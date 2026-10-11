'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type PopupChatTab = 'messages' | 'ai';

interface PopupChatContextValue {
  isOpen: boolean;
  isMinimized: boolean;
  /** userId to open a DM with when popup opens */
  initialUserId: string | null;
  /** Tab to show on the next open; null keeps the last used tab. */
  preferredTab: PopupChatTab | null;
  open: (targetUserId?: string, tab?: PopupChatTab) => void;
  /**
   * Ask the assistant something from anywhere on a page, and send it.
   *
   * The header's Ask AI bar navigated to /ai?q=, which left the page - and
   * with it the page context the assistant reads (its controls, its rail,
   * its snapshot) - and only pre-filled the question, so it took a second
   * send. This opens the in-page assistant on the AI tab and sends there.
   */
  ask: (prompt: string) => void;
  /** The question `ask` is waiting to send, until the assistant takes it. */
  pendingPrompt: string | null;
  consumePrompt: () => void;
  close: () => void;
  toggle: () => void;
  minimize: () => void;
  restore: () => void;
}

const PopupChatContext = createContext<PopupChatContextValue | null>(null);

export function PopupChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [initialUserId, setInitialUserId] = useState<string | null>(null);
  const [preferredTab, setPreferredTab] = useState<PopupChatTab | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const ask = useCallback((prompt: string) => {
    setInitialUserId(null);
    setPreferredTab('ai');
    setPendingPrompt(prompt);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);
  const consumePrompt = useCallback(() => setPendingPrompt(null), []);

  const open = useCallback((targetUserId?: string, tab?: PopupChatTab) => {
    setInitialUserId(targetUserId ?? null);
    setPreferredTab(tab ?? (targetUserId ? 'messages' : null));
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setInitialUserId(null);
    setPreferredTab(null);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setIsMinimized(false);
      return !prev;
    });
  }, []);

  const minimize = useCallback(() => setIsMinimized(true), []);
  const restore  = useCallback(() => setIsMinimized(false), []);

  return (
    <PopupChatContext.Provider value={{ isOpen, isMinimized, initialUserId, preferredTab, open, ask, pendingPrompt, consumePrompt, close, toggle, minimize, restore }}>
      {children}
    </PopupChatContext.Provider>
  );
}

/** The same, or null outside the provider (a component that can fall back). */
export function usePopupChatOptional() {
  return useContext(PopupChatContext);
}

export function usePopupChat() {
  const ctx = useContext(PopupChatContext);
  if (!ctx) throw new Error('usePopupChat must be used within PopupChatProvider');
  return ctx;
}
