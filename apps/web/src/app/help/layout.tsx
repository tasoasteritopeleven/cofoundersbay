import { AppShellFrame } from '@/components/layout/AppShell';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Centre',
  description: 'Guides, answers and support for building your venture on CoFounderBay.',
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Help Centre | CoFounderBay',
    description: 'Guides, answers and support for building your venture on CoFounderBay.',
    url: '/help',
  },
  robots: { index: true, follow: true },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellFrame>{children}</AppShellFrame>
  );
}
