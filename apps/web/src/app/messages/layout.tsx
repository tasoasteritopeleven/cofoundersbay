import { Suspense, ReactNode } from 'react';
import { AppShellFrame } from '@/components/layout/AppShell';
import MessagesLoading from './loading';

/**
 * Messages is the one full-height section: the thread list and pane fill the
 * viewport and scroll independently, so the frame is mounted here with
 * fullHeight rather than by the page.
 *
 * The Suspense boundary is required for useSearchParams() in the client page
 * under Next.js 15.
 */
export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellFrame fullHeight contentClassName="min-h-0">
      <Suspense fallback={<MessagesLoading />}>{children}</Suspense>
    </AppShellFrame>
  );
}
