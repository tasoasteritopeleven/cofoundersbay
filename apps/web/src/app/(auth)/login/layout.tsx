import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to CoFounderBay to reach your matches, mentors, investors and workspace.',
  alternates: { canonical: '/login' },
  openGraph: {
    title: 'Sign in | CoFounderBay',
    description: 'Sign in to CoFounderBay to reach your matches, mentors, investors and workspace.',
    url: '/login',
  },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
