'use client';

import { useEffect, useState } from 'react';
import { isPreviewDemo, PREVIEW_DEMO_USER } from '@/lib/preview-demo';

type StoredUser = {
  id?: string;
  displayName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
} | null;

function readUser(): StoredUser {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (raw) return JSON.parse(raw) as StoredUser;
  } catch {
    /* ignore */
  }
  return isPreviewDemo() ? PREVIEW_DEMO_USER : null;
}

export function useStoredUser() {
  const [user, setUser] = useState<StoredUser>(null);

  useEffect(() => {
    const sync = () => setUser(readUser());
    sync();
    window.addEventListener('cfb:login', sync);
    window.addEventListener('cfb:user', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cfb:login', sync);
      window.removeEventListener('cfb:user', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return user;
}
