import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of the CoFounderBay platform.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | CoFounderBay',
    description: 'The terms that govern your use of the CoFounderBay platform.',
    url: '/terms',
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
