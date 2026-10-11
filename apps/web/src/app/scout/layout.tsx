import { AppShellFrame } from '@/components/layout/AppShell';

/** One chrome for the co-founder scout: the brief and what it proposes. */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
