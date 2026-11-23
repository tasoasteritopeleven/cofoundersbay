'use client';

import { AlertTriangle, Ban, Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { getActionSpec, undoAvailable } from '@/lib/action-registry';
import { useStoredUser } from '@/hooks/useStoredUser';
import { getEvent } from '@/lib/api';
import { getEventAttendance, getEventReconnect } from '@/lib/event-reconnect-api';
import { qk } from '@/lib/query-keys';
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

function EventActionSummary({ action }: { action: CopilotAction }) {
  const viewer = useStoredUser()?.id;
  const eventId = typeof action.payload.eventId === 'string' ? action.payload.eventId : '';
  const userId = typeof action.payload.userId === 'string' ? action.payload.userId : '';
  const attendance = action.tool === 'set_event_attendance';
  const direction = attendance ? action.payload.attended : action.payload.interested;
  const event = useQuery({
    queryKey: qk('events', 'detail', eventId), queryFn: () => getEvent(eventId), enabled: Boolean(eventId), retry: false,
  });
  const roster = useQuery({
    queryKey: qk('events', 'attendance', eventId, viewer), queryFn: () => getEventAttendance(eventId),
    enabled: Boolean(viewer && eventId && userId) && attendance, retry: false,
  });
  const reconnect = useQuery({
    queryKey: qk('events', 'reconnect', eventId, viewer), queryFn: () => getEventReconnect(eventId),
    enabled: Boolean(viewer && eventId && userId) && !attendance, retry: false,
  });
  if (!eventId || !userId || typeof direction !== 'boolean') {
    return <BilingualText en="The event, attendee, or requested change is missing." el="Λείπει η εκδήλωση, ο συμμετέχων ή η ζητούμενη αλλαγή." />;
  }
  const title = event.data?.event?.title || eventId;
  const person = (attendance ? roster.data?.rows : reconnect.data?.rows)?.find((row) => row.userId === userId)?.displayName || userId;
  const change = attendance
    ? direction ? { en: 'Confirm attendance', el: 'Επιβεβαίωση παρουσίας' } : { en: 'Clear attendance', el: 'Αναίρεση παρουσίας' }
    : direction ? { en: 'Select to reconnect', el: 'Επιλογή για επανασύνδεση' } : { en: 'Withdraw reconnect interest', el: 'Απόσυρση ενδιαφέροντος επανασύνδεσης' };
  return (
    <p className="card-body break-words">
      <BilingualText en={`${change.en} — ${person} · ${title}`} el={`${change.el} — ${person} · ${title}`} wrap />
    </p>
  );
}

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
        // outline: the first action of a foot that wraps under its caption on
        // a phone starts on the card's axis; a ghost's padding put it 12px in.
        <Button asChild size="sm" variant="outline" className="h-7 tap-target-y">
          <Link href={action.href}>
            <BilingualText en="Open" el="Άνοιγμα" />
          </Link>
        </Button>
      )}
      {canUndo && (
        <Button
          type="button"
          size="sm"
          variant={action.href ? 'ghost' : 'outline'}
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
      <CardContent className="space-y-3">
        <CardHead
          titleAs="p"
          title={action.title}
          titleClassName="first-letter:uppercase"
          subtitle={action.description || undefined}
        />
        {action.tool === 'send_connection' && typeof action.payload.message === 'string' && (
          <p className="card-body italic text-muted-foreground">“{action.payload.message}”</p>
        )}
        {action.tool === 'set_event_attendance' || action.tool === 'set_event_reconnect' ? <EventActionSummary action={action} /> : null}

        {/* Stated before the user commits, not after. The registry verifies each
            of these against the API, so an intro says plainly that it cannot be
            withdrawn rather than implying it can. */}
        {showReversal && !dismissed && !cancelled && !undone && (
          // data-keep-icon: the warning glyph is content, not decoration.
          <div
            data-keep-icon=""
            data-testid="action-card-reversal"
            className={cn(
              'flex items-start gap-1.5 text-xs',
              irreversible ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {irreversible && (
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <div className="flex min-w-0 flex-col items-start gap-1">
              {/* One scannable word first — the sentence below says why. */}
              <span
                data-testid="action-card-reversal-badge"
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  reversal!.kind === 'full' && STATUS.success.chip,
                  reversal!.kind === 'partial' && STATUS.warning.chip,
                  reversal!.kind === 'none' && STATUS.danger.chip,
                )}
              >
                {reversal!.kind === 'full' ? (
                  <BilingualText en="Reversible" el="Αναστρέψιμο" compact />
                ) : reversal!.kind === 'partial' ? (
                  <BilingualText en="Partly reversible" el="Μερικώς αναστρέψιμο" compact />
                ) : (
                  <BilingualText en="Not reversible" el="Μη αναστρέψιμο" compact />
                )}
              </span>
              <BilingualText
                en={reversal!.explanation.en}
                el={reversal!.explanation.el}
                stacked
                wrap
                // `stacked` mutes its second line by default, which would drop the
                // Greek half of an irreversible warning to ordinary body grey.
                secondaryClassName={irreversible ? 'text-destructive/80' : undefined}
              />
            </div>
          </div>
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
      </CardContent>
    </Card>
  );
}
