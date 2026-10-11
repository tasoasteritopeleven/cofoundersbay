import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How CoFounderBay collects, uses and protects your personal data, and the rights you have over it.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | CoFounderBay',
    description: 'How CoFounderBay collects, uses and protects your personal data, and the rights you have over it.',
    url: '/privacy',
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
