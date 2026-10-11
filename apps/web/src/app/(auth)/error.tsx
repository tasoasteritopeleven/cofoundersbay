'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AuthError]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
          <Logo size="sm" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="icon-md text-destructive-accessible" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-semibold text-foreground">Authentication error</h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong while loading this page. This is usually transient — try again.
            </p>
          </div>
          {process.env.NODE_ENV !== 'production' && error?.message && (
            <pre className="rounded-lg bg-muted p-3 text-left text-2xs text-muted-foreground overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => reset()} className="gap-2">
              <RefreshCw className="icon-sm" />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
