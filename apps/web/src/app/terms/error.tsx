'use client';

import { RouteError } from '@/components/common/RouteError';

export default function TermsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <RouteError error={error} reset={reset} section="Terms of service" backHref="/" backLabel="Back to home" />
    </div>
  );
}
