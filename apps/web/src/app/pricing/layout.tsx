import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple plans for founders, mentors, investors and accelerators. Start free, upgrade when your venture does.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing | CoFounderBay',
    description: 'Simple plans for founders, mentors, investors and accelerators. Start free, upgrade when your venture does.',
    url: '/pricing',
  },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
