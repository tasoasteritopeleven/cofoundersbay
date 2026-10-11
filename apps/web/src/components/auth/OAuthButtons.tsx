'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { getAbsoluteApiOrigin } from '@/lib/api-origin';
import { BilingualText } from '@/components/common/BilingualText';

interface OAuthButtonsProps {
  mode?: 'login' | 'register' | 'link';
  onSuccess?: () => void;
  disabled?: boolean;
}

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function OAuthButtons({ mode = 'login', disabled }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'linkedin' | null>(null);

  const handleOAuth = (provider: 'google' | 'linkedin') => {
    setLoadingProvider(provider);
    window.location.href = `${getAbsoluteApiOrigin()}/api/auth/${provider}`;
  };

  const buttonText = {
    login: {
      google: { en: 'Continue with Google', el: 'Συνέχεια με Google' },
      linkedin: { en: 'Continue with LinkedIn', el: 'Συνέχεια με LinkedIn' },
    },
    register: {
      google: { en: 'Sign up with Google', el: 'Εγγραφή με Google' },
      linkedin: { en: 'Sign up with LinkedIn', el: 'Εγγραφή με LinkedIn' },
    },
    link: {
      google: { en: 'Link Google account', el: 'Σύνδεση λογαριασμού Google' },
      linkedin: { en: 'Link LinkedIn account', el: 'Σύνδεση λογαριασμού LinkedIn' },
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-full gap-2 h-11"
        onClick={() => handleOAuth('google')}
        disabled={disabled || loadingProvider !== null}
      >
        {loadingProvider === 'google' ? (
          <ButtonSpinner />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        <BilingualText en={buttonText[mode].google.en} el={buttonText[mode].google.el} compact />
      </Button>

      <Button
        variant="outline"
        className="w-full gap-2 h-11"
        onClick={() => handleOAuth('linkedin')}
        disabled={disabled || loadingProvider !== null}
      >
        {loadingProvider === 'linkedin' ? (
          <ButtonSpinner />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        )}
        <BilingualText en={buttonText[mode].linkedin.en} el={buttonText[mode].linkedin.el} compact />
      </Button>
    </div>
  );
}

export function OAuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          <BilingualText en="Or continue with" el="Ή συνεχίστε με" compact />
        </span>
      </div>
    </div>
  );
}
