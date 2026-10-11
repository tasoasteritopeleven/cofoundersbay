import { Suspense, ReactNode } from 'react';
import { AppShellFrame } from '@/components/layout/AppShell';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellFrame>
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Loading settings"
            className="flex min-h-[60vh] items-center justify-center"
          >
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="sr-only">Loading settings…</span>
          </div>
        }
      >
        {children}
      </Suspense>
    </AppShellFrame>
  );
}
