import { AppShellFrame } from '@/components/layout/AppShell';

/** One chrome for the commitments section: the list, the guide and each card's board. */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
