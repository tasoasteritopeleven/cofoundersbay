import { Suspense, ReactNode } from 'react';
import { AppShellFrame } from '@/components/layout/AppShell';
import SearchLoading from './loading';

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellFrame>
      <Suspense fallback={<SearchLoading />}>{children}</Suspense>
    </AppShellFrame>
  );
}
