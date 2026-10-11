'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Human name of the section, e.g. "Investor pipeline". */
  section?: string;
  /** Where "Go back" should point. Defaults to the dashboard. */
  backHref?: string;
  backLabel?: string;
};

/**
 * Shared body for every route-segment error.tsx.
 *
 * A segment-level boundary keeps the app shell (sidebar, top bar, navigation)
 * mounted and confines the failure to the page body, so a failed query on one
 * screen no longer blanks the whole application.
 */
export function RouteError({
  error,
  reset,
  section,
  backHref = '/dashboard',
  backLabel = 'Back to dashboard',
}: RouteErrorProps) {
  useEffect(() => {
    // The global ErrorBoundary reports to the error service; segment errors are
    // logged here so they are not silently swallowed in development.
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${section ?? 'route'}]`, error);
    }
  }, [error, section]);

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-lg flex-col items-center rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive-emphasis">
        <AlertTriangle className="icon-md" aria-hidden="true" />
      </span>

      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
        {section ? `${section} could not load` : 'This page could not load'}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
        Something went wrong while loading this section. The rest of the app is
        unaffected — try again, or head somewhere else.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-2xs text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="icon-sm" aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href={backHref}>
            <ArrowLeft className="icon-sm" aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
