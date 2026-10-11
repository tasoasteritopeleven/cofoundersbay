'use client';

import { useEffect, useRef } from 'react';
import { overlayOpener } from '@/components/ui/use-return-focus';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Gives a hand-rolled overlay the four behaviours a dialog must have.
 *
 * New overlays should use the Dialog or Sheet primitive, which get all of this
 * from Radix. This hook exists for the handful of overlays that are welded into
 * large canvas components with framer-motion exit animations, where swapping the
 * container would mean restructuring the component rather than fixing the bug.
 *
 *  1. Focus moves into the dialog on open, so a keyboard user is not left
 *     tabbing through the page behind it.
 *  2. Tab and Shift+Tab cycle within the dialog (focus trap).
 *  3. Escape closes it.
 *  4. Body scroll is locked while it is open, and focus returns to whatever
 *     opened it on close.
 *
 * Pair with role="dialog" aria-modal="true" and an aria-label/aria-labelledby
 * on the container element the returned ref is attached to.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // The latest onClose, read at key time. With `onClose` as an effect
  // dependency, every parent render (an inline arrow is a new function) re-ran
  // the effect while the dialog was open: focus jumped back to the first field
  // mid-typing, and the "opener" was re-captured from inside the dialog, so on
  // close focus went to a node that no longer existed - i.e. to <body>.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = overlayOpener(containerRef.current);

    const node = containerRef.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus({ preventScroll: true });
    }

    // Lock scroll without shifting layout when a scrollbar disappears.
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const el = containerRef.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      const opener = previouslyFocused.current;
      previouslyFocused.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return containerRef;
}
