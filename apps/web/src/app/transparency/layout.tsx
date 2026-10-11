import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transparency report',
  description: 'What CoFounderBay’s safety rules refused and what members reported, counted per half year.',
  alternates: { canonical: '/transparency' },
  openGraph: {
    title: 'Transparency report | CoFounderBay',
    description: 'What CoFounderBay’s safety rules refused and what members reported, counted per half year.',
    url: '/transparency',
  },
  robots: { index: true, follow: true },
};

export default function TransparencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
