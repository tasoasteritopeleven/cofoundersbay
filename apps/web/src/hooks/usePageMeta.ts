'use client';

import { usePathname } from 'next/navigation';
import { getPageMeta } from '@/lib/page-registry';

export function usePageMeta() {
  const pathname = usePathname() ?? '/';
  return getPageMeta(pathname);
}
