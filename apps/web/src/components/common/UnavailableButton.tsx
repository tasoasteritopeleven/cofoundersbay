'use client';

import { useId } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

/**
 * A page action that exists but cannot run here yet, and says why.
 *
 * Several headers led with a filled primary button, disabled, whose reason
 * lived only in a `title` tooltip - "Create API Key", "Add Webhook", "Invite
 * Member" with no organisation. A dimmed primary at the top of a page reads as
 * broken, and a tooltip never shows on a touch screen. This is the button's
 * honest form: outline weight (it is not the page's next step), a lock, the
 * reason as its accessible description and its tooltip, and, below `sm`
 * where there is no hover, the reason printed under it.
 *
 * The same contract as `UnavailableMenuItem`, for buttons.
 */
export function UnavailableButton({
  en,
  el,
  reasonEn,
  reasonEl,
  size = 'sm',
  className,
}: {
  en: string;
  el: string;
  reasonEn: string;
  reasonEl: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const reasonId = useId();
  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled
        title={bilingualAria(reasonEn, reasonEl)}
        aria-describedby={reasonId}
        className="gap-2"
      >
        <Lock className="icon-sm" aria-hidden="true" />
        <BilingualText en={en} el={el} compact />
      </Button>
      <span id={reasonId} className="max-w-[16rem] text-2xs leading-snug text-muted-foreground sm:sr-only">
        <BilingualText en={reasonEn} el={reasonEl} compact wrap />
      </span>
    </span>
  );
}
