'use client';

import type { ReactNode } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BilingualText } from '@/components/common/BilingualText';
import { cn } from '@/lib/utils';

/**
 * A menu action the product shows but cannot perform yet - and says so.
 *
 * A static sweep found 104 menu items with no handler at all: "Resend Last" on
 * a webhook, "Regenerate" on an API key, "Edit Access" in the data room. Each
 * looked like every working item beside it, closed the menu when chosen, and
 * did nothing - the worst of both, because the reader cannot tell a broken
 * action from a slow one. Where a backend route exists the item is wired;
 * where none does, it renders through this: disabled (skipped by the arrow
 * keys, announced as unavailable) with the reason on a second line, so the
 * menu still shows what the surface is meant to do without pretending it
 * already does it.
 */
export function UnavailableMenuItem({
  icon,
  en,
  el,
  reasonEn,
  reasonEl,
  className,
}: {
  icon?: ReactNode;
  en: string;
  el: string;
  reasonEn: string;
  reasonEl: string;
  className?: string;
}) {
  return (
    <DropdownMenuItem disabled className={cn('items-start', className)}>
      {icon}
      <span className="flex min-w-0 flex-col">
        <BilingualText en={en} el={el} compact />
        <span className="text-2xs leading-snug text-muted-foreground">
          <BilingualText en={reasonEn} el={reasonEl} compact wrap />
        </span>
      </span>
    </DropdownMenuItem>
  );
}
