import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Join CoFounderBay free and start matching with co-founders, mentors and investors.',
  alternates: { canonical: '/register' },
  openGraph: {
    title: 'Create your account | CoFounderBay',
    description: 'Join CoFounderBay free and start matching with co-founders, mentors and investors.',
    url: '/register',
  },
  robots: { index: true, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
