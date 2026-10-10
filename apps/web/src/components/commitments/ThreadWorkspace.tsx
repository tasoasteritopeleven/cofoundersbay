'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Lock } from 'lucide-react';
import {
  canReviseTerms,
  contactKinds,
  revisionsLeft,
  termsChanges,
  validateTerms,
  VERIFICATION_REQUIRED_COPY,
  type TermsFields,
  type TermsProblem,
} from '@cofounderbay/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { RelativeTime } from '@/components/common/RelativeTime';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
import { qk } from '@/lib/query-keys';
import { CANCELLED, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import {
  acceptCommitmentInterest,
  acceptCommitmentTerms,
  closeCommitmentDealRoom,
  closeCommitmentThread,
  commitmentRefusal,
  confirmCommitment,
  getCommitmentThread,
  proposeCommitmentTerms,
  retractCommitmentConfirmation,
  sendCommitmentMessage,
  withdrawCommitmentInterest,
  type CommitmentThread,
  type CommitmentTermsVersion,
} from '@/lib/commitments-api';
import { CMT } from '@/lib/i18n/strings-commitments';
import { VerifiedBadge } from './VerifiedBadge';
import { cn, initialsOf } from '@/lib/utils';
import { CommitmentLadder } from './CommitmentLadder';
import { ContactWarning } from './ContactWarning';
import { NonGuaranteeNote } from './NonGuaranteeNote';
import { StepChip } from './OutcomeChip';

type Pair = { en: string; el: string };

const PROBLEM_COPY: Record<Exclude<TermsProblem, 'contact'>, Pair> = {
  role: { en: 'Name the role.', el: 'Ονομάστε τον ρόλο.' },
  scope: { en: 'Describe the scope.', el: 'Περιγράψτε το εύρος.' },
  equity_range: { en: 'Equity is a percentage from 0 to 100.', el: 'Το equity είναι ποσοστό από 0 έως 100.' },
  vesting_range: { en: 'Vesting runs from 0 to 120 months.', el: 'Η κατοχύρωση είναι από 0 έως 120 μήνες.' },
  cliff_range: { en: 'The cliff runs from 0 to 60 months.', el: 'Το cliff είναι από 0 έως 60 μήνες.' },
  cliff_after_vesting: { en: 'The cliff cannot be longer than vesting.', el: 'Το cliff δεν μπορεί να ξεπερνά την κατοχύρωση.' },
  hours_range: { en: 'Hours a week run from 1 to 80.', el: 'Οι ώρες την εβδομάδα είναι από 1 έως 80.' },
  promise: { en: 'Remove promised returns.', el: 'Αφαιρέστε τις υποσχέσεις αποδόσεων.' },
};

const FIELD_COPY: Record<keyof TermsFields, Pair> = {
  role: CMT.t_role,
  equityPct: CMT.t_equity,
  vestingMonths: CMT.t_vesting,
  cliffMonths: CMT.t_cliff,
  hoursPerWeek: CMT.t_hours,
  scope: CMT.t_scope,
};

function firstNumber(text: string | null | undefined): number | null {
  const match = text?.match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

function show(value: number | string | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}${suffix}`;
}

/** Inline, bilingual: why the last action was refused. */
function Refusal({ error }: { error: Pair | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-xs text-status-danger">
      <BilingualText en={error.en} el={error.el} wrap />
    </p>
  );
}

function refusalOf(err: unknown): Pair {
  const r = commitmentRefusal(err);
  return { en: r.en, el: r.el };
}

// ── Protected conversation ─────────────────────────────────────────────────

function ProtectedConversation({
  thread,
  onSend,
  sending,
  error,
}: {
  thread: CommitmentThread;
  onSend: (body: string) => Promise<boolean>;
  sending: boolean;
  error: Pair | null;
}) {
  const [draft, setDraft] = useState('');
  const blocked = contactKinds(draft).length > 0;
  const readOnly = thread.conversationReadOnly;
  return (
    <section aria-labelledby={`chat-${thread.id}`} className="space-y-3">
      <div className="space-y-1">
        <h3 id={`chat-${thread.id}`} className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {readOnly ? <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null}
          <BilingualText en={CMT.protected.en} el={CMT.protected.el} compact />
        </h3>
        <p className="text-xs text-muted-foreground">
          <BilingualText en={readOnly ? CMT.read_only.en : CMT.protected_hint.en} el={readOnly ? CMT.read_only.el : CMT.protected_hint.el} wrap />
        </p>
      </div>
      {thread.note ? (
        <blockquote className="card-body italic text-muted-foreground">“{thread.note}”</blockquote>
      ) : null}
      <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {thread.messages.length === 0 ? (
          <li className="card-body text-muted-foreground"><BilingualText en={CMT.no_messages.en} el={CMT.no_messages.el} wrap /></li>
        ) : (
          thread.messages.map((m) => (
            <li key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', m.mine ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground')}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.createdAt ? (
                  <p className="mt-1 text-2xs text-muted-foreground"><RelativeTime date={m.createdAt} /></p>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ol>
      {!readOnly ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.trim() || blocked) return;
            if (await onSend(draft.trim())) setDraft('');
          }}
        >
          <Label htmlFor={`compose-${thread.id}`} className="sr-only">
            {CMT.write_message.en}
          </Label>
          <Textarea
            id={`compose-${thread.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`${CMT.write_message.en} · ${CMT.write_message.el}`}
            className="min-h-20"
            maxLength={1000}
            aria-describedby={blocked ? `contact-${thread.id}` : undefined}
          />
          <ContactWarning text={draft} id={`contact-${thread.id}`} />
          <Refusal error={error} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!draft.trim() || blocked || sending}>
              <BilingualText en={CMT.send.en} el={CMT.send.el} compact />
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

// ── Terms ──────────────────────────────────────────────────────────────────

type TermsDraft = { role: string; equityPct: string; vestingMonths: string; cliffMonths: string; hoursPerWeek: string; scope: string; note: string };

function draftFrom(thread: CommitmentThread, latest?: CommitmentTermsVersion): TermsDraft {
  if (latest) {
    return {
      role: latest.role,
      equityPct: latest.equityPct === null ? '' : String(latest.equityPct),
      vestingMonths: latest.vestingMonths === null ? '' : String(latest.vestingMonths),
      cliffMonths: latest.cliffMonths === null ? '' : String(latest.cliffMonths),
      hoursPerWeek: latest.hoursPerWeek === null ? '' : String(latest.hoursPerWeek),
      scope: latest.scope,
      note: latest.note ?? '',
    };
  }
  const equity = firstNumber(thread.card.offer.equity);
  return {
    role: thread.card.offer.role,
    equityPct: equity === null ? '' : String(equity),
    vestingMonths: '48',
    cliffMonths: '12',
    hoursPerWeek: thread.card.offer.hoursPerWeek ? String(thread.card.offer.hoursPerWeek) : '',
    scope: thread.card.offer.scope,
    note: '',
  };
}

function fieldsOf(draft: TermsDraft): TermsFields {
  const n = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    role: draft.role.trim(),
    equityPct: n(draft.equityPct),
    vestingMonths: n(draft.vestingMonths),
    cliffMonths: n(draft.cliffMonths),
    hoursPerWeek: n(draft.hoursPerWeek),
    scope: draft.scope.trim(),
  };
}

function VersionCard({ version, highlight }: { version: CommitmentTermsVersion; highlight: boolean }) {
  const rows: Array<[keyof TermsFields, string]> = [
    ['role', show(version.role)],
    ['equityPct', show(version.equityPct, '%')],
    ['vestingMonths', show(version.vestingMonths)],
    ['cliffMonths', show(version.cliffMonths)],
    ['hoursPerWeek', show(version.hoursPerWeek)],
    ['scope', show(version.scope)],
  ];
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map(([field, value]) => {
          const changed = highlight && version.changed.includes(field);
          return (
            // A changed field says so in words ("· changed") and in weight; a
            // tinted, padded cell around every field moved them off the axis.
            <div key={field} className={cn('min-w-0 py-1', field === 'scope' && 'sm:col-span-2')}>
              <dt className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <BilingualText en={FIELD_COPY[field].en} el={FIELD_COPY[field].el} compact />
                {changed ? (
                  <span className="font-medium text-foreground">· <BilingualText en={CMT.changed.en} el={CMT.changed.el} compact /></span>
                ) : null}
              </dt>
              <dd className={cn('card-body tabular-nums text-foreground', changed && 'font-semibold')}>{value}</dd>
            </div>
          );
        })}
      </dl>
      {version.note ? <p className="card-body text-muted-foreground">{version.note}</p> : null}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
        <span className={version.acceptedByMe ? 'text-status-success' : undefined}>
          <BilingualText en={version.acceptedByMe ? CMT.accepted_by_you.en : CMT.not_accepted_by_you.en} el={version.acceptedByMe ? CMT.accepted_by_you.el : CMT.not_accepted_by_you.el} compact />
        </span>
        <span className={version.acceptedByThem ? 'text-status-success' : undefined}>
          <BilingualText en={version.acceptedByThem ? CMT.accepted_by_them.en : CMT.awaiting_them.en} el={version.acceptedByThem ? CMT.accepted_by_them.el : CMT.awaiting_them.el} compact />
        </span>
      </p>
    </div>
  );
}

function TermsSpace({
  thread,
  onPropose,
  onAccept,
  busy,
  error,
}: {
  thread: CommitmentThread;
  onPropose: (fields: TermsFields, note: string) => Promise<boolean>;
  onAccept: (version: number) => void;
  busy: boolean;
  error: Pair | null;
}) {
  const latest = thread.terms.find((t) => t.isLatest) ?? thread.terms[thread.terms.length - 1];
  const earlier = thread.terms.filter((t) => t !== latest).reverse();
  const gate = canReviseTerms({ revisions: thread.revisions, dealRoomActive: thread.dealRoomActive, step: thread.step, versions: thread.terms.length });
  const left = revisionsLeft({ revisions: thread.revisions, versions: thread.terms.length });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TermsDraft>(() => draftFrom(thread, latest));
  useEffect(() => {
    setDraft(draftFrom(thread, latest));
    // A new version from either side resets the form to it.
  }, [latest?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = fieldsOf(draft);
  const problems = validateTerms(fields, draft.note).filter((p): p is Exclude<TermsProblem, 'contact'> => p !== 'contact');
  const substantive = latest ? termsChanges(latest, fields).length > 0 : true;
  const contactText = [draft.role, draft.scope, draft.note].join('\n');
  const formOpen = gate.ok && (editing || thread.terms.length === 0);
  const canSubmit = !busy && thread.verification.meVerified && problems.length === 0 && contactKinds(contactText).length === 0 && (substantive || (latest ? (latest.note ?? '') !== draft.note.trim() : true));

  const set = (key: keyof TermsDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <section aria-labelledby={`terms-${thread.id}`} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`terms-${thread.id}`} className="text-sm font-semibold text-foreground">
          <BilingualText en={CMT.terms.en} el={CMT.terms.el} compact />
          {latest ? <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">v{latest.version}</span> : null}
        </h3>
        {thread.dealRoomActive ? (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            <BilingualText en={CMT.frozen.en} el={CMT.frozen.el} compact />
          </span>
        ) : (
          <span className="text-2xs tabular-nums text-muted-foreground">
            <BilingualText en={`${left} ${CMT.revisions_left.en}`} el={`${left} ${CMT.revisions_left.el}`} compact />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground"><BilingualText en={CMT.terms_hint.en} el={CMT.terms_hint.el} wrap /></p>
      {!thread.verification.meVerified && thread.step === 'terms' ? (
        <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3 text-sm" role="note">
          <p className="text-foreground"><BilingualText en={VERIFICATION_REQUIRED_COPY.en} el={VERIFICATION_REQUIRED_COPY.el} wrap /></p>
          <Button asChild size="sm" variant="outline" className="mt-2">
            <Link href="/settings#verification"><BilingualText en="Verify in Settings" el="Επαλήθευση στις Ρυθμίσεις" compact /></Link>
          </Button>
        </div>
      ) : null}

      {latest ? (
        <div>
          <VersionCard version={latest} highlight />
          {thread.step === 'terms' && !latest.acceptedByMe ? (
            <div className="pt-3">
              <Button
                size="sm"
                onClick={() => onAccept(latest.version)}
                disabled={busy || !thread.verification.meVerified}
                title={thread.verification.meVerified ? undefined : `${VERIFICATION_REQUIRED_COPY.en} · ${VERIFICATION_REQUIRED_COPY.el}`}
              >
                <BilingualText en={`${CMT.accept_version.en} ${latest.version}`} el={`${CMT.accept_version.el} ${latest.version}`} compact />
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="card-body text-muted-foreground"><BilingualText en={CMT.no_terms.en} el={CMT.no_terms.el} wrap /></p>
      )}

      {earlier.length ? (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            <BilingualText en={CMT.earlier_versions.en} el={CMT.earlier_versions.el} compact />
          </summary>
          <ol className="mt-3 space-y-4">
            {earlier.map((v) => (
              <li key={v.version} className="space-y-1">
                <p className="text-2xs font-medium tabular-nums text-muted-foreground">v{v.version}</p>
                <VersionCard version={v} highlight />
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {thread.step === 'terms' && !gate.ok && gate.reason === 'limit' ? (
        <p className="text-xs text-status-warning"><BilingualText en={CMT.limit_reached.en} el={CMT.limit_reached.el} wrap /></p>
      ) : null}

      {gate.ok && thread.terms.length > 0 && !editing ? (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <BilingualText en={CMT.propose_new.en} el={CMT.propose_new.el} compact />
        </Button>
      ) : null}

      {formOpen ? (
        <form
          className="space-y-3 border-t border-border pt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canSubmit) return;
            if (await onPropose(fields, draft.note.trim())) setEditing(false);
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`t-role-${thread.id}`}><BilingualText en={CMT.t_role.en} el={CMT.t_role.el} compact /></Label>
              <Input id={`t-role-${thread.id}`} value={draft.role} onChange={set('role')} maxLength={80} />
            </div>
            {(
              [
                ['equityPct', CMT.t_equity, '0.1'],
                ['hoursPerWeek', CMT.t_hours, '1'],
                ['vestingMonths', CMT.t_vesting, '1'],
                ['cliffMonths', CMT.t_cliff, '1'],
              ] as const
            ).map(([key, copy, step]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`t-${key}-${thread.id}`}><BilingualText en={copy.en} el={copy.el} compact /></Label>
                <Input id={`t-${key}-${thread.id}`} type="number" inputMode="decimal" step={step} min={0} value={draft[key]} onChange={set(key)} />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`t-scope-${thread.id}`}><BilingualText en={CMT.t_scope.en} el={CMT.t_scope.el} compact /></Label>
              <Textarea id={`t-scope-${thread.id}`} value={draft.scope} onChange={set('scope')} maxLength={200} className="min-h-16" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`t-note-${thread.id}`}><BilingualText en={CMT.t_note.en} el={CMT.t_note.el} compact /></Label>
              <Textarea id={`t-note-${thread.id}`} value={draft.note} onChange={set('note')} maxLength={500} className="min-h-16" />
            </div>
          </div>
          <ContactWarning text={contactText} promises />
          {problems.length ? (
            <ul className="space-y-0.5 text-xs text-status-warning">
              {problems.map((p) => (
                <li key={p}><BilingualText en={PROBLEM_COPY[p].en} el={PROBLEM_COPY[p].el} wrap /></li>
              ))}
            </ul>
          ) : null}
          {latest ? (
            <p className="text-xs text-muted-foreground">
              <BilingualText en={substantive ? CMT.uses_revision.en : CMT.note_only.en} el={substantive ? CMT.uses_revision.el : CMT.note_only.el} wrap />
            </p>
          ) : null}
          <Refusal error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            {thread.terms.length > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(draftFrom(thread, latest)); }}>
                <BilingualText en="Cancel" el="Ακύρωση" compact />
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={!canSubmit}>
              <BilingualText
                en={latest && substantive ? `${CMT.propose_version.en} ${latest.version + 1}` : latest ? CMT.save_changes.en : CMT.propose.en}
                el={latest && substantive ? `${CMT.propose_version.el} ${latest.version + 1}` : latest ? CMT.save_changes.el : CMT.propose.el}
                compact
              />
            </Button>
          </div>
        </form>
      ) : null}
      <NonGuaranteeNote />
    </section>
  );
}

// ── The workspace ──────────────────────────────────────────────────────────

/**
 * One commitment between two people: where it stands and what each of them
 * can do next. (Withdrawing interest is the board page's control, next to
 * sending it, so its Undo names a command on the same page.) The author accepts or declines interest; both talk in the
 * protected conversation; each confirms separately; terms are versioned; an
 * agreement opens the deal room. Every action is also offered to the
 * assistant through the page's controls, with the same handlers.
 */
export function ThreadWorkspace({ threadId }: { threadId: string }) {
  const qc = useQueryClient();
  const { success } = useToast();
  const confirm = useConfirm();
  const [error, setError] = useState<Pair | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const query = useQuery({
    queryKey: qk('commitments', 'thread', threadId),
    queryFn: () => getCommitmentThread(threadId),
    enabled: Boolean(threadId),
  });
  const thread = query.data;
  const refresh = () => qc.invalidateQueries({ queryKey: qk('commitments') });

  const act = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: () => setError(null),
    onError: (err) => setError(refusalOf(err)),
    onSettled: () => refresh(),
  });
  const busy = act.isPending;

  const latest = thread?.terms.find((t) => t.isLatest);
  const isOwner = thread?.role === 'owner';
  const step = thread?.step;
  const name = thread?.counterpart.displayName ?? '';

  async function run(write: () => Promise<unknown>, toast?: string, description?: string): Promise<PageControlRunResult> {
    const result = await settle(() => act.mutateAsync(write));
    if (!result && toast) success(toast, description);
    return result;
  }

  async function decline(): Promise<PageControlRunResult> {
    const ok = await confirm({
      title: <BilingualText en={`Decline ${name}’s interest?`} el={`Απόρριψη του ενδιαφέροντος από ${name};`} />,
      description: <BilingualText en="They are told the card’s author stepped back." el="Ενημερώνονται ότι ο συντάκτης αποχώρησε." />,
    });
    if (!ok) return CANCELLED;
    return run(() => closeCommitmentThread(threadId), 'Interest declined');
  }

  async function stepBack(): Promise<PageControlRunResult> {
    const ok = await confirm({
      title: <BilingualText en={`Step back from this commitment with ${name}?`} el={`Αποχώρηση από αυτή τη δέσμευση με ${name};`} />,
      description: <BilingualText en="The conversation closes for both of you and they are told. It cannot be reopened." el="Η συζήτηση κλείνει και για τους δύο και ενημερώνονται. Δεν ανοίγει ξανά." />,
    });
    if (!ok) return CANCELLED;
    return run(() => closeCommitmentThread(threadId), 'You stepped back');
  }

  async function closeDealRoom(): Promise<PageControlRunResult> {
    const ok = await confirm({
      title: <BilingualText en="Close the deal room?" el="Κλείσιμο της αίθουσας συμφωνίας;" />,
      description: (
        <BilingualText
          en="The agreement is set aside and the terms open for revision again. Both of you will need to accept a version anew."
          el="Η συμφωνία αναστέλλεται και οι όροι ανοίγουν ξανά για αναθεώρηση. Θα χρειαστεί να αποδεχτείτε ξανά μια έκδοση και οι δύο."
        />
      ),
    });
    if (!ok) return CANCELLED;
    return run(() => closeCommitmentDealRoom(threadId), 'Deal room closed');
  }

  const missing = thread ? undefined : 'The conversation is still loading.';
  const missingEl = thread ? undefined : 'Η συζήτηση φορτώνει ακόμη.';
  usePageControls([
    {
      id: 'accept_interest',
      labelEn: 'Accept this interest and open the protected conversation',
      labelEl: 'Αποδοχή του ενδιαφέροντος και άνοιγμα προστατευμένης συζήτησης',
      writes: true,
      unavailableEn: missing ?? (!isOwner ? 'Only the card’s author accepts interest.' : step !== 'interest' ? 'This interest was already answered.' : undefined),
      unavailableEl: missingEl ?? (!isOwner ? 'Μόνο ο συντάκτης αποδέχεται ενδιαφέρον.' : step !== 'interest' ? 'Το ενδιαφέρον έχει ήδη απαντηθεί.' : undefined),
      run: () => run(() => acceptCommitmentInterest(threadId), 'Interest accepted'),
    },
    {
      id: 'decline_interest',
      labelEn: 'Decline this interest',
      labelEl: 'Απόρριψη του ενδιαφέροντος',
      writes: true,
      unavailableEn: missing ?? (!isOwner ? 'Only the card’s author declines interest.' : step !== 'interest' ? 'This interest was already answered.' : undefined),
      unavailableEl: missingEl ?? (!isOwner ? 'Μόνο ο συντάκτης απορρίπτει ενδιαφέρον.' : step !== 'interest' ? 'Το ενδιαφέρον έχει ήδη απαντηθεί.' : undefined),
      run: decline,
    },
    {
      id: 'confirm_terms_talk',
      labelEn: 'Confirm I want to discuss terms',
      labelEl: 'Επιβεβαίωση ότι θέλω να συζητήσουμε όρους',
      writes: true,
      unavailableEn: missing ?? (step !== 'conversation' ? 'Confirmation belongs to the conversation step.' : thread?.myConfirmed ? 'You have already confirmed.' : undefined),
      unavailableEl: missingEl ?? (step !== 'conversation' ? 'Η επιβεβαίωση ανήκει στο στάδιο της συζήτησης.' : thread?.myConfirmed ? 'Έχετε ήδη επιβεβαιώσει.' : undefined),
      undo: () => ({ control: 'retract_confirmation' }),
      run: () => run(() => confirmCommitment(threadId), 'Confirmed'),
    },
    {
      id: 'retract_confirmation',
      labelEn: 'Take back my confirmation',
      labelEl: 'Ανάκληση της επιβεβαίωσής μου',
      writes: true,
      unavailableEn: missing ?? (step !== 'conversation' ? 'You have both confirmed; terms are open.' : !thread?.myConfirmed ? 'You have not confirmed.' : undefined),
      unavailableEl: missingEl ?? (step !== 'conversation' ? 'Έχετε επιβεβαιώσει και οι δύο· οι όροι είναι ανοιχτοί.' : !thread?.myConfirmed ? 'Δεν έχετε επιβεβαιώσει.' : undefined),
      run: () => run(() => retractCommitmentConfirmation(threadId), 'Confirmation taken back'),
    },
    {
      id: 'accept_latest_terms',
      labelEn: 'Accept the latest terms',
      labelEl: 'Αποδοχή των τελευταίων όρων',
      writes: true,
      unavailableEn: missing ?? (step !== 'terms' ? 'There are no open terms.' : !latest ? 'No terms have been proposed yet.' : latest.acceptedByMe ? 'You already accepted this version.' : thread && !thread.verification.meVerified ? VERIFICATION_REQUIRED_COPY.en : undefined),
      unavailableEl: missingEl ?? (step !== 'terms' ? 'Δεν υπάρχουν ανοιχτοί όροι.' : !latest ? 'Δεν έχουν προταθεί όροι ακόμη.' : latest.acceptedByMe ? 'Έχετε ήδη αποδεχτεί αυτή την έκδοση.' : thread && !thread.verification.meVerified ? VERIFICATION_REQUIRED_COPY.el : undefined),
      run: () => run(() => acceptCommitmentTerms(threadId, latest?.version ?? 0), 'Terms accepted'),
    },
    {
      id: 'close_deal_room',
      labelEn: 'Close the deal room and reopen the terms',
      labelEl: 'Κλείσιμο της αίθουσας συμφωνίας και άνοιγμα των όρων',
      writes: true,
      unavailableEn: missing ?? (!thread?.dealRoomActive ? 'The deal room is not open.' : undefined),
      unavailableEl: missingEl ?? (!thread?.dealRoomActive ? 'Η αίθουσα συμφωνίας δεν είναι ανοιχτή.' : undefined),
      run: closeDealRoom,
    },
    {
      id: 'step_back',
      labelEn: 'Step back from this commitment',
      labelEl: 'Αποχώρηση από αυτή τη δέσμευση',
      writes: true,
      unavailableEn: missing ?? (step === 'closed' ? 'It is already closed.' : step === 'agreed' ? 'Close the deal room first.' : step === 'interest' ? (isOwner ? 'Decline the interest instead.' : 'Withdraw the interest instead.') : undefined),
      unavailableEl: missingEl ?? (step === 'closed' ? 'Έχει ήδη κλείσει.' : step === 'agreed' ? 'Κλείστε πρώτα την αίθουσα συμφωνίας.' : step === 'interest' ? (isOwner ? 'Απορρίψτε το ενδιαφέρον.' : 'Ανακαλέστε το ενδιαφέρον.') : undefined),
      run: stepBack,
    },
  ]);
  usePageList([
    {
      id: 'commitment_messages',
      labelEn: 'Protected conversation',
      labelEl: 'Προστατευμένη συζήτηση',
      rows: thread?.messages.map((m) => `${m.mine ? 'You' : name}: ${m.body}`),
    },
    {
      id: 'commitment_terms',
      labelEn: 'Terms versions',
      labelEl: 'Εκδόσεις όρων',
      rows: thread?.terms.map(
        (t) =>
          `v${t.version}${t.isLatest ? ' (latest)' : ''}: ${t.role}, ${show(t.equityPct, '%')} equity, ${show(t.vestingMonths)} months vesting, ${show(t.cliffMonths)} cliff, ${show(t.hoursPerWeek)} h/week — ${t.acceptedByMe ? 'you accepted' : 'you have not accepted'}, ${t.acceptedByThem ? 'they accepted' : 'they have not accepted'}`,
      ),
    },
  ]);

  const answeredOld = useMemo(() => Boolean(thread && thread.answeredVersion < thread.card.version), [thread]);

  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!thread) {
    return (
      <p className="card-body text-muted-foreground">
        <BilingualText en="This conversation could not be opened." el="Η συζήτηση δεν άνοιξε." wrap />
      </p>
    );
  }

  return (
    <div className="space-y-5" data-thread={thread.id}>
      <header>
        <CardHead
          titleAs="h2"
          mark={(
            <Avatar className="h-10 w-10" data-keep-icon="">
              <AvatarFallback className="bg-primary/15 text-xs text-foreground">{initialsOf(thread.counterpart.displayName)}</AvatarFallback>
            </Avatar>
          )}
          title={(
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span>{thread.counterpart.displayName}</span>
              <VerifiedBadge methods={thread.verification.counterpartMethods} />
            </span>
          )}
          subtitle={thread.counterpart.headline ?? undefined}
          aside={(
            <>
              <StepChip step={thread.step} />
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setReportOpen(true)}>
                <Flag className="icon-sm" aria-hidden />
                <BilingualText en={CMT.report_block.en} el={CMT.report_block.el} compact />
              </Button>
            </>
          )}
        />
      </header>

      <CommitmentLadder step={thread.step} myConfirmed={thread.myConfirmed} />

      {answeredOld ? (
        <p className="rounded-lg bg-status-info-bg px-3 py-2 text-xs text-status-info">
          <BilingualText
            en={`${CMT.offer_changed.en} (v${thread.answeredVersion} → v${thread.card.version}).`}
            el={`${CMT.offer_changed.el} (v${thread.answeredVersion} → v${thread.card.version}).`}
            wrap
          />
        </p>
      ) : null}

      {thread.step === 'interest' ? (
        <section className="space-y-3">
          {thread.note ? <blockquote className="card-body italic text-muted-foreground">“{thread.note}”</blockquote> : null}
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void run(() => acceptCommitmentInterest(threadId), 'Interest accepted')}>
                <BilingualText en={CMT.interest_accept.en} el={CMT.interest_accept.el} compact />
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void decline()}>
                <BilingualText en={CMT.interest_decline.en} el={CMT.interest_decline.el} compact />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="card-body text-muted-foreground"><BilingualText en={CMT.interest_waiting.en} el={CMT.interest_waiting.el} wrap /></p>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => withdrawCommitmentInterest(threadId), 'Interest withdrawn')}>
                <BilingualText en={CMT.interest_withdraw.en} el={CMT.interest_withdraw.el} compact />
              </Button>
            </div>
          )}
          <Refusal error={error} />
        </section>
      ) : null}

      {thread.step === 'conversation' ? (
        <>
          <ProtectedConversation
            thread={thread}
            sending={busy}
            error={error}
            onSend={async (body) => !(await run(() => sendCommitmentMessage(threadId, body)))}
          />
          <section aria-labelledby={`confirm-${thread.id}`} className="space-y-2 border-t border-border pt-3">
            <h3 id={`confirm-${thread.id}`} className="text-sm font-semibold text-foreground">
              <BilingualText en={CMT.confirm_title.en} el={CMT.confirm_title.el} compact />
            </h3>
            <p className="text-xs text-muted-foreground">
              <BilingualText en={thread.myConfirmed ? CMT.confirmed_waiting.en : CMT.confirm_hint.en} el={thread.myConfirmed ? CMT.confirmed_waiting.el : CMT.confirm_hint.el} wrap />
            </p>
            {thread.myConfirmed ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => retractCommitmentConfirmation(threadId), 'Confirmation taken back')}>
                <BilingualText en={CMT.confirm_retract.en} el={CMT.confirm_retract.el} compact />
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void run(() => confirmCommitment(threadId), 'Confirmed')}>
                <BilingualText en={CMT.confirm.en} el={CMT.confirm.el} compact />
              </Button>
            )}
          </section>
        </>
      ) : null}

      {thread.step === 'agreed' && thread.dealRoomActive ? (
        <section aria-labelledby={`deal-${thread.id}`} className="space-y-2 rounded-xl border border-status-success-border bg-status-success-bg p-3">
          <h3 id={`deal-${thread.id}`} className="text-sm font-semibold text-status-success">
            <BilingualText en={CMT.deal_room.en} el={CMT.deal_room.el} compact />
          </h3>
          <p className="card-body text-foreground"><BilingualText en={CMT.deal_room_open.en} el={CMT.deal_room_open.el} wrap /></p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href={`/data-room/${encodeURIComponent(thread.cardId)}`}>
                <BilingualText en={CMT.deal_room_data.en} el={CMT.deal_room_data.el} compact />
              </Link>
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void closeDealRoom()}>
              <BilingualText en={CMT.deal_room_close.en} el={CMT.deal_room_close.el} compact />
            </Button>
          </div>
        </section>
      ) : null}

      {thread.step === 'terms' || thread.step === 'agreed' ? (
        <TermsSpace
          thread={thread}
          busy={busy}
          error={error}
          onAccept={(version) => void run(() => acceptCommitmentTerms(threadId, version), 'Terms accepted')}
          onPropose={async (fields, note) => {
            const result = await run(async () => {
              const outcome = await proposeCommitmentTerms(threadId, { ...fields, note });
              success(outcome.substantive ? 'Terms proposed' : 'Note updated');
            });
            return !result;
          }}
        />
      ) : null}

      {thread.step === 'terms' || thread.step === 'agreed' || (thread.step === 'closed' && thread.messages.length > 0) ? (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            <BilingualText en={`${CMT.protected.en} · ${thread.messages.length}`} el={`${CMT.protected.el} · ${thread.messages.length}`} compact />
          </summary>
          <div className="mt-3">
            <ProtectedConversation thread={thread} sending={false} error={null} onSend={async () => false} />
          </div>
        </details>
      ) : null}

      {thread.step === 'closed' ? (
        <p className="card-body text-muted-foreground">
          <BilingualText en={CMT.closed_thread.en} el={CMT.closed_thread.el} wrap />
          {thread.closedReason ? <span className="mt-1 block italic">“{thread.closedReason}”</span> : null}
        </p>
      ) : null}

      {thread.step === 'conversation' || thread.step === 'terms' ? (
        <div className="border-t border-border pt-3">
          <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => void stepBack()}>
            <BilingualText en={CMT.step_back.en} el={CMT.step_back.el} compact />
          </Button>
        </div>
      ) : null}

      <ReportBlockModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        userId={thread.counterpart.id}
        userName={thread.counterpart.displayName}
        mode="both"
        context={{ surface: 'commitment_thread', threadId: thread.id, cardId: thread.cardId }}
        onBlocked={() => void run(() => closeCommitmentThread(threadId))}
      />
    </div>
  );
}
