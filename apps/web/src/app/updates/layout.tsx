import { AppShellFrame } from '@/components/layout/AppShell';

/** One chrome for founder updates: the feed, one's own, and the composer. */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
