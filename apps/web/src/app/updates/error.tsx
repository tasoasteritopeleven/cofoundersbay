'use client';

import { AppShell } from '@/components/layout/AppShell';
import { RouteError } from '@/components/common/RouteError';

export default function UpdatesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <RouteError error={error} reset={reset} section="Updates" />
    </AppShell>
  );
}
