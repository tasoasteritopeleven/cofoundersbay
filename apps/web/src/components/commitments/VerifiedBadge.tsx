import { BadgeCheck } from 'lucide-react';
import { VERIFICATION_COPY, type VerificationMethod } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { cn } from '@/lib/utils';

/**
 * "Verified" beside a person's name, with how in the tooltip and for screen
 * readers. Methods only: never the work domain or a date. Renders nothing
 * for someone with no signal, so the absence is not shouted either.
 */
export function VerifiedBadge({
  methods,
  className,
  variant = 'pill',
}: {
  methods: readonly VerificationMethod[];
  className?: string;
  /**
   * `mark`: the check glyph alone beside a name (bylines, where a second pill
   * beside the outcome read as one more badge to rank). Same title and
   * screen-reader sentence as the pill.
   */
  variant?: 'pill' | 'mark';
}) {
  if (!methods.length) return null;
  const how = methods.map((m) => VERIFICATION_COPY[m]);
  const label = `Verified: ${how.map((h) => h.en).join(', ')} · Επαληθευμένο προφίλ: ${how.map((h) => h.el).join(', ')}`;
  if (variant === 'mark') {
    return (
      <span className={cn('inline-flex shrink-0 items-center text-status-success', className)} title={label} data-keep-icon="">
        <BadgeCheck className="icon-sm" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-1.5 py-0.5 text-2xs font-medium text-status-success', className)}
      title={label}
      data-keep-icon=""
    >
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <span aria-hidden="true"><BilingualText en="Verified" el="Επαληθευμένο" compact /></span>
    </span>
  );
}
