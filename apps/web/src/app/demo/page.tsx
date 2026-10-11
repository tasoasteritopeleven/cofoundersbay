'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { applyPreviewDemoSession } from '@/lib/preview-demo';

/**
 * Demo entry point — fallback UI.
 *
 * The handoff itself is done by middleware, which sets the demo cookies and
 * redirects to the dashboard in a single response (see `middleware.ts`). It has
 * to happen there: the auth guard reads those cookies server-side, and doing the
 * redirect from a client effect meant racing the provider tree's hydration —
 * a race this page lost, leaving it re-rendering on "Loading demo…" forever.
 *
 * This component therefore normally never renders. It stays as a safety net for
 * the case where middleware does not run (e.g. a static export), and the latch
 * keeps the redirect one-shot if it ever does.
 */
export default function DemoPage() {
  const handedOff = useRef(false);

  useEffect(() => {
    if (handedOff.current) return;
    handedOff.current = true;
    applyPreviewDemoSession();
    window.location.replace('/dashboard/founder');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Sparkles className="icon-xl text-primary-accessible animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Loading demo…</h2>
          <p className="text-sm text-muted-foreground">Opening the full product with sample data</p>
        </div>
        <Loader2 className="icon-md animate-spin text-muted-foreground mx-auto" />
      </div>
    </div>
  );
}
