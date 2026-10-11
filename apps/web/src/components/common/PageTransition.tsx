'use client';

import { ReactNode } from 'react';

/**
 * Lightweight route wrapper.
 * The previous implementation forced a layout reflow on every navigation to
 * replay an animation, which added measurable jank to heavy page transitions.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
