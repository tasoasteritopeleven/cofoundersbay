import { NON_GUARANTEE_COPY } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { cn } from '@/lib/utils';

/**
 * The sentence that sits wherever equity, percentages or funding appear.
 *
 * One component and one copy (`NON_GUARANTEE_COPY` in the shared package),
 * so the need card, the terms space, the public card and the fundraising
 * pages say the same thing: the platform organises the decision and promises
 * neither funding nor income. `nonGuarantee.test.ts` lists the surfaces that
 * must carry it.
 */
export function NonGuaranteeNote({ className }: { className?: string }) {
  return (
    <p data-non-guarantee="" className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      <BilingualText en={NON_GUARANTEE_COPY.en} el={NON_GUARANTEE_COPY.el} wrap />
    </p>
  );
}
