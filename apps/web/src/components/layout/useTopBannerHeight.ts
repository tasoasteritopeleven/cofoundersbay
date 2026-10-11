'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes a fixed top banner's measured height as a CSS variable on <html>
 * so the sticky header and content column can offset by the live stack height.
 *
 * Adopted from origin/claude/project-audit-upgrade-y2ebnr (977a87d). Their
 * line still had a second `fixed` demo bar; ours uses a TopBar badge instead,
 * so `--banner-demo` stays 0 unless a future surface publishes it.
 *
 * Heights are measured rather than hard-coded because the network banner wraps
 * to two lines on a narrow viewport.
 */
export function useTopBannerHeight<T extends HTMLElement>(
  varName: string,
  active: boolean,
) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.style.removeProperty(varName);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const apply = () =>
      root.style.setProperty(varName, `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(varName);
    };
  }, [varName, active]);

  return ref;
}

/** Total height of the fixed banner stack, for padding and sticky offsets. */
export const TOP_BANNER_STACK = 'calc(var(--banner-network, 0px) + var(--banner-demo, 0px))';
