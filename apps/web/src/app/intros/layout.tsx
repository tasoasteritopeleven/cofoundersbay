import { AppShellFrame } from '@/components/layout/AppShell';

/** One chrome for warm introductions: sent, to forward, and received. */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
