'use client';

import { useEffect } from 'react';
import { applyPreviewDemoSession, isPreviewDemo, restorePreviewDemoSessionIfNeeded } from '@/lib/preview-demo';

/** Keeps the Cloudflare preview demo signed in across client navigations. */
export function PreviewSessionGuard() {
  useEffect(() => {
    if (isPreviewDemo()) {
      applyPreviewDemoSession();
    } else {
      restorePreviewDemoSessionIfNeeded();
    }

    const onLogout = () => {
      // API failures used to wipe the demo cookie; put it back if demo mode is still on.
      window.setTimeout(() => {
        restorePreviewDemoSessionIfNeeded();
      }, 0);
    };

    window.addEventListener('cfb:logout', onLogout);
    window.addEventListener('focus', restorePreviewDemoSessionIfNeeded);
    return () => {
      window.removeEventListener('cfb:logout', onLogout);
      window.removeEventListener('focus', restorePreviewDemoSessionIfNeeded);
    };
  }, []);

  return null;
}
