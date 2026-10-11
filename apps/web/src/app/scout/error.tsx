'use client';

import { AppShell } from '@/components/layout/AppShell';
import { RouteError } from '@/components/common/RouteError';

export default function ScoutError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <RouteError error={error} reset={reset} section="Co-founder scout" />
    </AppShell>
  );
}
