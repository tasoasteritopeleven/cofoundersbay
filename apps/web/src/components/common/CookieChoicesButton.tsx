'use client';

import { BilingualText } from '@/components/common/BilingualText';
import { openCookieChoices } from '@/lib/cookie-consent';
import { cn } from '@/lib/utils';

/** Reopens the cookie banner on its choices, from a server-rendered footer. */
export function CookieChoicesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieChoices} className={cn('text-left text-muted-foreground transition-colors hover:text-foreground', className)}>
      <BilingualText en="Cookie choices" el="Επιλογές cookies" compact />
    </button>
  );
}
