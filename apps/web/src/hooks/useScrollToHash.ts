'use client';

import { useEffect } from 'react';

/**
 * Scrolls to the element the URL hash names once that element exists.
 *
 * A section that mounts after the page has loaded (client-only content, a
 * card waiting on its data) misses the browser's own fragment scroll, so
 * `/settings#verification` - the link the commitments ladder, warm intros and
 * "What's new" all send people to - opened at the top of Settings. This
 * waits for the target, scrolls once, and settles once more if content above
 * it moved. It gives up after `timeoutMs`, and never moves a page the reader
 * has already scrolled.
 */
export function useScrollToHash(timeoutMs = 4000) {
  useEffect(() => {
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const run = () => {
      cancelAnimationFrame(frame);
      if (settle) clearTimeout(settle);
      let id = '';
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!id) return;
      const started = performance.now();
      const startY = window.scrollY;
      let landedY: number | null = null;
      const userScrolled = () => Math.abs(window.scrollY - (landedY ?? startY)) > 48;
      const tick = () => {
        if (!active) return;
        const el = document.getElementById(id);
        if (el) {
          if (landedY === null && userScrolled()) return;
          el.scrollIntoView({ block: 'start' });
          landedY = window.scrollY;
          // Cards above may still be loading; land again if they pushed it.
          settle = setTimeout(() => {
            if (!active || userScrolled()) return;
            const top = el.getBoundingClientRect().top;
            if (Math.abs(top) > 96) {
              el.scrollIntoView({ block: 'start' });
              landedY = window.scrollY;
            }
          }, 600);
          return;
        }
        if (performance.now() - started > timeoutMs || userScrolled()) return;
        frame = requestAnimationFrame(tick);
      };
      tick();
    };

    run();
    window.addEventListener('hashchange', run);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (settle) clearTimeout(settle);
      window.removeEventListener('hashchange', run);
    };
  }, [timeoutMs]);
}
