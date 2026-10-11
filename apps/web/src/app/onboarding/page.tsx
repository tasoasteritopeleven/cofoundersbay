'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMeProfile } from '@/lib/api';
import { ConversationalOnboarding } from './ConversationalOnboarding';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    getMeProfile()
      .then(({ profile, hasCompletedOnboarding }) => {
        if (!mounted) return;
        if (hasCompletedOnboarding && profile) {
          router.replace('/profile');
        }
      })
      .catch(() => {/* no token yet, show onboarding */});
    return () => { mounted = false; };
  }, [router]);

  return <ConversationalOnboarding />;
}
