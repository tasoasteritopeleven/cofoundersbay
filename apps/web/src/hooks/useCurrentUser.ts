'use client';

import { useEffect, useState } from 'react';

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

function readUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; email?: string; role?: string };
    if (!parsed.id) return null;
    return { id: parsed.id, email: parsed.email ?? '', role: parsed.role ?? 'founder' };
  } catch {
    return null;
  }
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setUser(readUser());

    const onUpdate = () => setUser(readUser());
    window.addEventListener('cfb:user', onUpdate);
    window.addEventListener('cfb:login', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('cfb:user', onUpdate);
      window.removeEventListener('cfb:login', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  return user;
}
