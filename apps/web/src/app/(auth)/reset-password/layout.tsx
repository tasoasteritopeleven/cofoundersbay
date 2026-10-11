import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Set a new password for your CoFounderBay account.',
  alternates: { canonical: '/reset-password' },
  openGraph: {
    title: 'Choose a new password | CoFounderBay',
    description: 'Set a new password for your CoFounderBay account.',
    url: '/reset-password',
  },
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
