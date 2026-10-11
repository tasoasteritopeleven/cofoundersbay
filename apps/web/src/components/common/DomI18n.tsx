'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { useI18n } from '@/components/common/I18nProvider';
import { translateDom } from '@/lib/i18n/dom';

export function DomI18n({ children }: { children: ReactNode }) {
  const { locale, t } = useI18n();

  useLayoutEffect(() => {
    const root = document.body;
    const passthrough = locale === 'en';

    // English is the source language: a pass is still needed once, to restore any
    // text a previous locale rewrote, but after that every pass is guaranteed to be
    // a no-op. Walking the whole document on every mutation to produce no changes
    // was pure overhead on the default locale, so don't observe at all here.
    if (passthrough) {
      translateDom(root, t, true);
      return;
    }

    const OBSERVE_OPTIONS: MutationObserverInit = {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'label'],
    };

    let frame = 0;
    // translateDom rewrites text nodes and attributes — i.e. it *causes* exactly the
    // mutations this observer watches for. Left connected, each pass scheduled the
    // next one and the document got re-walked every animation frame indefinitely.
    // Detaching around the write makes the pass self-terminating.
    const apply = () => {
      obs.disconnect();
      try {
        translateDom(root, t, false, locale !== 'el');
      } finally {
        obs.observe(root, OBSERVE_OPTIONS);
      }
    };

    const obs = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    });

    apply();

    // A page that suspends hydrates after this pass, and hydration that
    // matches the server changes no DOM — so the observer never hears about
    // it and that page would stay in English. The pass skips unhydrated text
    // (see translateDom), so a few follow-up passes pick those subtrees up
    // once React has claimed them. Each is a no-op when nothing is left.
    const later = [250, 1000, 3000].map((ms) => window.setTimeout(apply, ms));

    return () => {
      obs.disconnect();
      if (frame) cancelAnimationFrame(frame);
      later.forEach((id) => window.clearTimeout(id));
    };
  }, [locale, t]);

  return children;
}
