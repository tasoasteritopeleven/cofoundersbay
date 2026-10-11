'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { MainLandmark } from '@/components/layout/AppShell';
import { isPreviewDemo } from '@/lib/preview-demo';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = () => {
      try {
        if (isPreviewDemo()) {
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }

        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const user = JSON.parse(userStr);
        const isDemo = user.email === 'demo@cofounderbay.com';
        setIsAdmin(user.role === 'admin' || user.role === 'platform_admin' || isDemo);
        setIsLoading(false);
      } catch {
        setIsAdmin(false);
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, []);

  // Both states render before the admin frame mounts, so each is its own
  // page: the skip link needs a main landmark here too.
  if (isLoading) {
    return (
      <MainLandmark className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en="Verifying access…" el="Έλεγχος πρόσβασης…" compact />
          </p>
        </div>
      </MainLandmark>
    );
  }

  if (!isAdmin) {
    return (
      <MainLandmark className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="icon-xl text-destructive-accessible" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          <BilingualText en="Administrators only" el="Μόνο για διαχειριστές" wrap />
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          <BilingualText
            en="This account is not an administrator. Sign in with one that is, or go back home."
            el="Αυτός δεν είναι λογαριασμός διαχειριστή. Συνδεθείτε με λογαριασμό διαχειριστή ή επιστρέψτε στην αρχική."
            wrap
          />
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => router.push('/')}>
            <BilingualText en="Go home" el="Αρχική" compact />
          </Button>
          <Button onClick={() => router.push('/login')}>
            <BilingualText en="Sign in" el="Σύνδεση" compact />
          </Button>
        </div>
      </MainLandmark>
    );
  }

  return <>{children}</>;
}
