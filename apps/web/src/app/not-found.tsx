import Link from 'next/link';
import { Home, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { MainLandmark } from '@/components/layout/AppShell';

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MainLandmark className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Logo size="sm" />
      <p className="mt-8 text-6xl font-bold tracking-tight text-foreground">404</p>
      <h1 className="mt-3 text-xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist, was moved, or is temporarily unavailable.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/" className="gap-2">
            <Home className="icon-sm" />
            Back to home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/discover" className="gap-2">
            <Compass className="icon-sm" />
            Discover people
          </Link>
        </Button>
      </div>
    </MainLandmark>
  );
}
