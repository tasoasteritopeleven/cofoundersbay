import * as React from 'react';

type AutoFocusHandler = (event: Event) => void;

const OVERLAY = '[role="dialog"], [role="alertdialog"]';
let lastOutside: HTMLElement | null = null;
let tracking = false;

/**
 * The last element that held focus outside every overlay. An `autoFocus`
 * field inside a dialog takes focus during React's commit, before any open
 * handler runs, so `document.activeElement` at open time is the field, not
 * the opener. This listener has already seen the opener get focus.
 */
function trackOutsideFocus() {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (el instanceof HTMLElement && el !== document.body && !el.closest(OVERLAY)) lastOutside = el;
  }, true);
}
if (typeof document !== 'undefined') trackOutsideFocus();

/** Who opened the overlay that `container` (if given) belongs to. */
export function overlayOpener(container?: Element | null): HTMLElement | null {
  trackOutsideFocus();
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && !active.closest(OVERLAY) && !container?.contains(active)) return active;
  return lastOutside?.isConnected ? lastOutside : null;
}

/**
 * Focus goes back to whatever opened an overlay.
 *
 * Radix returns focus only to a `DialogTrigger`. Almost every dialog here is
 * controlled - a button sets `open` - so there is no trigger, Radix's modal
 * content prevents its default restore, focuses a null trigger ref, and focus
 * lands on <body>: a keyboard user who pressed Escape starts again from the top
 * of the page. Measured on 40 dialog routes at 390px, 66 of 78 dialogs lost focus.
 *
 * The element that had focus when the overlay mounted is the opener (with a
 * real trigger it *is* the trigger), so it is remembered on open and focused on
 * close. A caller that handles close focus itself still can: preventing default
 * in its own `onCloseAutoFocus` leaves the decision with the caller.
 */
export function useReturnFocus(onOpenAutoFocus?: AutoFocusHandler, onCloseAutoFocus?: AutoFocusHandler) {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      opener.current = overlayOpener(event.currentTarget instanceof Element ? event.currentTarget : null);
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      // Radix skips the open event when focus is already inside the content
      // (an `autoFocus` field), so the opener may never have been recorded;
      // the outside-focus tracker still knows it.
      const target = opener.current ?? overlayOpener(event.currentTarget instanceof Element ? event.currentTarget : null);
      opener.current = null;
      if (target?.isConnected) target.focus();
    },
  };
}
