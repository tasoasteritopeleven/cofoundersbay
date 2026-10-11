import { Check } from 'lucide-react';
import { ladderRung, type CommitmentStep } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { CMT } from '@/lib/i18n/strings-commitments';
import { cn } from '@/lib/utils';

const RUNGS = [CMT.rung_interest, CMT.rung_conversation, CMT.rung_confirmation, CMT.rung_terms, CMT.rung_agreed] as const;

/**
 * The five rungs from interest to agreement, with the current one marked.
 *
 * Confirmation is drawn as its own rung because waiting on the other side's
 * separate yes is a real place to be; a closed thread draws every rung muted.
 */
export function CommitmentLadder({ step, myConfirmed, className }: { step: CommitmentStep; myConfirmed: boolean; className?: string }) {
  const current = ladderRung(step, myConfirmed);
  return (
    <ol aria-label={`${CMT.ladder.en} · ${CMT.ladder.el}`} className={cn('relative grid grid-cols-5 gap-1', className)}>
      {RUNGS.map((rung, index) => {
        const done = current > index || step === 'agreed';
        const here = current === index && step !== 'agreed';
        return (
          <li key={rung.en} aria-current={here ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <span
              data-keep-icon=""
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-2xs font-semibold tabular-nums',
                done && 'border-transparent bg-primary text-primary-foreground',
                here && 'border-primary bg-primary/10 text-foreground',
                !done && !here && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
            </span>
            {/* Five bilingual labels do not fit a phone's width: there only the
                current rung is named, and the others stay for screen readers. */}
            <span className={cn('w-full text-2xs leading-tight', here ? 'font-medium text-foreground' : 'sr-only text-muted-foreground sm:not-sr-only')}>
              <BilingualText en={rung.en} el={rung.el} compact wrap />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
