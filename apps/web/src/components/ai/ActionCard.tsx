'use client';

import { AlertTriangle, Ban, Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { getActionSpec, undoAvailable } from '@/lib/action-registry';
import { STATUS } from '@/lib/semantic-colors';
import { cn } from '@/lib/utils';
import type { CopilotAction } from '@/lib/copilot-types';

type ActionCardProps = {
  action: CopilotAction;
  busyId?: string | null;
  onConfirm: (action: CopilotAction) => void;
  onDismiss: (action: CopilotAction) => void;
  /** Omitted by callers that cannot take an action back. */
  onUndo?: (action: CopilotAction) => void;
};

export function ActionCard({ action, busyId, onConfirm, onDismiss, onUndo }: ActionCardProps) {
  const busy = busyId === action.id;
  // One write at a time: while another card runs, this one waits rather than
  // offering a button that would silently do nothing.
  const otherBusy = Boolean(busyId) && !busy;
  const done = action.status === 'done';
  const dismissed = action.status === 'dismissed';
  const failed = action.status === 'error';
  const undone = action.status === 'undone';
  const cancelled = action.status === 'cancelled';

  const spec = getActionSpec(action.tool);
  const reversal = spec?.reversal;
  // Only a write is worth warning about. `navigate` changes where the user is,
  // not their data, so its "nothing to undo" line would be noise on every card.
  const showReversal = Boolean(spec?.writes && reversal);
  const irreversible = spec?.writes === true && reversal?.kind === 'none';
  const canUndo = Boolean(onUndo) && undoAvailable(action.tool, action.undoContext);

  // Where the action stands once it has left the pending state: the foot's
  // caption, beside whatever can still be done with it.
  const state = cancelled ? (
    <span className="inline-flex items-center gap-1">
      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
      <BilingualText en="Cancelled — no changes made" el="Ακυρώθηκε — δεν έγιναν αλλαγές" />
    </span>
  ) : undone ? (
    <span className="inline-flex items-center gap-1">
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      <BilingualText en="Undone" el="Αναιρέθηκε" />
    </span>
  ) : done ? (
    <span className={cn('inline-flex items-center gap-1 font-medium', STATUS.success.text)}>
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      <BilingualText en="Done" el="Έγινε" />
    </span>
  ) : dismissed ? (
    <BilingualText en="Dismissed" el="Απορρίφθηκε" />
  ) : undefined;

  const actions = cancelled || undone || dismissed ? null : done ? (action.href || canUndo ? (
    <>
      {action.href && (
        <Button asChild size="sm" variant="ghost" className="h-7 tap-target-y">
          <Link href={action.href}>
            <BilingualText en="Open" el="Άνοιγμα" />
          </Link>
        </Button>
      )}
      {canUndo && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 tap-target-y"
          disabled={busy || otherBusy}
          onClick={() => onUndo?.(action)}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <BilingualText en="Undo" el="Αναίρεση" />
        </Button>
      )}
    </>
  ) : null) : (
    <>
      <Button
        type="button"
        size="sm"
        className="h-7 gap-1.5 tap-target-y"
        disabled={busy || otherBusy}
        aria-busy={busy || undefined}
        onClick={() => onConfirm(action)}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {action.confirmLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 tap-target-y"
        disabled={busy}
        onClick={() => onDismiss(action)}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        <BilingualText en="Dismiss" el="Απόρριψη" />
      </Button>
    </>
  );

  // Set like every card: the action as the title with what it does under
  // it, the note it sends and what can be taken back on the same left edge,
  // then a foot with where it stands and what can still be done.
  return (
    <Card
      className={cn(
        'shadow-sm',
        done && `border-status-success-border/40 ${STATUS.success.bg}`,
        (dismissed || undone || cancelled) && 'surface-inactive',
        failed && 'border-destructive/40',
      )}
    >
      <div className="space-y-3 p-4">
        <CardHead
          titleAs="p"
          title={action.title}
          titleClassName="first-letter:uppercase"
          subtitle={action.description || undefined}
        />
        {action.tool === 'send_connection' && typeof action.payload.message === 'string' && (
          <p className="card-body italic text-muted-foreground">“{action.payload.message}”</p>
        )}

        {/* Stated before the user commits, not after. The registry verifies each
            of these against the API, so an intro says plainly that it cannot be
            withdrawn rather than implying it can. */}
        {showReversal && !dismissed && !cancelled && !undone && (
          // data-keep-icon: the warning glyph is content, not decoration.
          <p
            data-keep-icon=""
            className={cn(
              'flex items-start gap-1.5 text-xs',
              irreversible ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {irreversible && (
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <BilingualText
              en={reversal!.explanation.en}
              el={reversal!.explanation.el}
              stacked
              wrap
              // `stacked` mutes its second line by default, which would drop the
              // Greek half of an irreversible warning to ordinary body grey.
              secondaryClassName={irreversible ? 'text-destructive/80' : undefined}
            />
          </p>
        )}

        {action.error && (failed || done) && (
          <p role="alert" data-keep-icon="" className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <BilingualText
                en={failed ? 'Not applied: ' : 'Undo did not go through: '}
                el={failed ? 'Δεν εφαρμόστηκε: ' : 'Η αναίρεση δεν ολοκληρώθηκε: '}
                compact
              />
              {action.error}
            </span>
          </p>
        )}

        <CardFoot meta={state}>{actions}</CardFoot>
      </div>
    </Card>
  );
}
