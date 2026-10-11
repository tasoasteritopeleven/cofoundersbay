import type { CommitmentOutcome, CommitmentStep } from '@cofounderbay/shared';
import { Badge } from '@/components/ui/badge';
import { StatusText } from '@/components/common/StatusText';
import { cn } from '@/lib/utils';

const OUTCOME_VARIANT: Record<CommitmentOutcome, 'info' | 'default' | 'success' | 'secondary'> = {
  open: 'info',
  in_discussion: 'default',
  agreed: 'success',
  closed: 'secondary',
};

/**
 * Open, in discussion, agreed, closed: the outcome of a need card, shown
 * beside a project's stage, a match's score and the readiness score. A
 * closed card says why (filled, withdrawn, expired) when it knows.
 */
export function OutcomeChip({
  outcome,
  reason,
  className,
}: {
  outcome: CommitmentOutcome;
  reason?: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant={OUTCOME_VARIANT[outcome]}
      size="sm"
      data-outcome={outcome}
      className={cn('shrink-0 rounded-full', outcome === 'closed' && 'bg-muted', className)}
    >
      <StatusText value={outcome === 'closed' && reason ? reason : outcome} />
    </Badge>
  );
}

const STEP_VARIANT: Record<CommitmentStep, 'info' | 'default' | 'success' | 'secondary' | 'warning'> = {
  interest: 'info',
  conversation: 'default',
  terms: 'warning',
  agreed: 'success',
  closed: 'secondary',
};

/** Where one person's thread on a card stands. */
export function StepChip({ step, className }: { step: CommitmentStep; className?: string }) {
  return (
    <Badge variant={STEP_VARIANT[step]} size="sm" data-step={step} className={cn('shrink-0 rounded-full', step === 'closed' && 'bg-muted', className)}>
      <StatusText value={step} />
    </Badge>
  );
}
