'use client';

import { RouteError } from '@/components/common/RouteError';

export default function ThemesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <RouteError error={error} reset={reset} section="Themes" backHref="/" backLabel="Back to home" />
    </div>
  );
}
