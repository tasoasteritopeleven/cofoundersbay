'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { getMe } from '@/lib/api';

export default function SSOCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // searchParams identity can change between renders; depend on the primitive values instead.
  const redirect = searchParams?.get('redirect') || '/dashboard';
  const isNewUser = searchParams?.get('newUser') === '1';
  const errorParam = searchParams?.get('error');
  const message = searchParams?.get('message');

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setError(message || 'SSO authentication failed');
      return;
    }

    const completeLogin = async () => {
      try {
        // Auth cookies were set by the API callback — fetch user profile to populate localStorage
        const { user } = await getMe();
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user));
        }

        setStatus('success');

        // New SSO users go through onboarding; existing users go to their redirect target
        setTimeout(() => {
          router.push(isNewUser ? '/onboarding' : redirect);
        }, 800);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to complete SSO login');
      }
    };

    completeLogin();
  }, [redirect, isNewUser, errorParam, message, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="sm" className="mx-auto" />

        {status === 'loading' && (
          <div className="space-y-4">
            <div
              aria-hidden="true"
              className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
            />
            <div>
              <h1 className="text-xl sm:text-2xl xl:text-3xl font-semibold">Completing sign in...</h1>
              <p className="text-muted-foreground mt-1">
                Please wait while we verify your credentials
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg text-xs font-semibold uppercase tracking-wide text-status-success">
              OK
            </div>
            <div>
              <h1 className="text-xl font-semibold text-status-success">Sign in successful!</h1>
              <p className="text-muted-foreground mt-1">
                Redirecting you now...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-sm font-semibold text-destructive-accessible">
              !
            </div>
            <div>
              <h1 className="text-xl font-semibold text-destructive-accessible">Sign in failed</h1>
              <p className="text-muted-foreground mt-1">
                {error || 'An unexpected error occurred'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push('/login')} className="w-full">
                Try again
              </Button>
              <Button variant="outline" onClick={() => router.push('/')} className="w-full">
                Go to homepage
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
