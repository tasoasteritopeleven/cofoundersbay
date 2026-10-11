'use client';

import { AppShell } from '@/components/layout/AppShell';
import { RouteError } from '@/components/common/RouteError';

export default function InviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Rendered inside the shell so the sidebar and top bar survive the failure
  // and the user can navigate away without a reload.
  return (
    <AppShell>
      <RouteError error={error} reset={reset} section="Invites" />
    </AppShell>
  );
}
