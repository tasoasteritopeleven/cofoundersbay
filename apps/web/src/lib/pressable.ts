import type * as React from 'react';

/**
 * Accessibility props for an element that activates on click but is not a
 * native `<button>`/`<a>` (cards, rows, chips implemented as div/span).
 *
 * Adds a role, keyboard focus, and Enter/Space activation which reuses the
 * element's existing `onClick` via a programmatic `.click()`. The guard
 * `e.target === e.currentTarget` keeps inner controls working normally.
 *
 * Prefer a real `<button>`/`<a>` for new code; this exists for surfaces
 * whose markup cannot become a native element without restructuring.
 */
export function pressableProps(opts: {
  role?: 'button' | 'link' | 'checkbox' | 'option' | 'radio';
  pressed?: boolean;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  label?: string;
} = {}) {
  const { role = 'button', pressed, checked, selected, expanded, label } = opts;
  return {
    role,
    tabIndex: 0,
    ...(label !== undefined ? { 'aria-label': label } : {}),
    ...(pressed !== undefined ? { 'aria-pressed': pressed } : {}),
    ...(checked !== undefined ? { 'aria-checked': checked } : {}),
    ...(selected !== undefined ? { 'aria-selected': selected } : {}),
    ...(expanded !== undefined ? { 'aria-expanded': expanded } : {}),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
  } as const;
}
