'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { forwardRef, useCallback, useRef, type ComponentProps } from 'react';

type OptimizedLinkProps = ComponentProps<typeof Link> & {
  prefetchOnHover?: boolean;
};

/**
 * Lightweight Link wrapper that relies on Next prefetch plus a single
 * hover/focus prefetch to keep navigation warm without aggressive observers.
 *
 * Must forward its ref: this is routinely rendered inside Radix `asChild` slots
 * (every sidebar link sits in a TooltipTrigger). Those slots compose a ref onto
 * the child and set state from the ref callback. Without a forwarded ref the
 * anchor node was never handed back stably, so each render re-ran that callback
 * with null and then the node — two state updates per render, which React ends
 * as "Maximum update depth exceeded". That crash took out the whole navigation
 * tree, leaving the dashboard on its error boundary with no links at all.
 */
export const OptimizedLink = forwardRef<HTMLAnchorElement, OptimizedLinkProps>(function OptimizedLink(
  {
    href,
    prefetchOnHover = true,
    children,
    onFocus,
    onMouseEnter,
    prefetch: linkPrefetch,
    ...props
  },
  ref,
) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const prefetch = useCallback(() => {
    if (!prefetchOnHover || typeof href !== 'string' || href.startsWith('http') || prefetchedRef.current) {
      return;
    }

    prefetchedRef.current = true;
    void router.prefetch(href);
  }, [prefetchOnHover, href, router]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={linkPrefetch}
      onFocus={(event) => {
        onFocus?.(event);
        prefetch();
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        prefetch();
      }}
      {...props}
      // After `{...props}` so a caller cannot override it. SideNav peeks and
      // bilingual titles can differ by a beat from SSR; the href and children
      // are stable. Suppressing the attribute warning keeps the tree from
      // overlaying a hydration dialog over the chrome.
      suppressHydrationWarning
    >
      {children}
    </Link>
  );
});
