import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a password reset link for your CoFounderBay account.',
  alternates: { canonical: '/forgot-password' },
  openGraph: {
    title: 'Reset your password | CoFounderBay',
    description: 'Request a password reset link for your CoFounderBay account.',
    url: '/forgot-password',
  },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
