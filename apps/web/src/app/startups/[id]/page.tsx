'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, MapPin, MessageCircle, Star, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  addInvestorDealEvent,
  getInvestorDeal,
  updateInvestorDeal,
  PIPELINE_STAGES,
  type PipelineStage,
} from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';
import { CANCELLED, usePageControls } from '@/lib/page-controls';

const STAGE_LABEL: Record<PipelineStage, { en: string; el: string }> = {
  discovered: { en: 'Discovered', el: 'Εντοπίστηκε' },
  reviewing: { en: 'Reviewing', el: 'Υπό αξιολόγηση' },
  meeting: { en: 'Meeting', el: 'Συνάντηση' },
  due_diligence: { en: 'Due diligence', el: 'Δέουσα επιμέλεια' },
  negotiating: { en: 'Negotiating', el: 'Διαπραγμάτευση' },
  invested: { en: 'Invested', el: 'Επένδυση' },
  passed: { en: 'Passed', el: 'Απορρίφθηκε' },
};

/** The stages a deal moves through, without the exit ("passed"). */
const FORWARD: PipelineStage[] = PIPELINE_STAGES.filter((s) => s !== 'passed');

/**
 * One startup on the investor's board.
 *
 * Nine links across the pipeline, watchlist, portfolio and scouting pages
 * pointed at /startups/:id, which did not exist. On an investor's board a
 * startup *is* a deal (InvestorDeal carries the name, stage, notes and event
 * trail), and GET /investor/deals/:id serves it, so this page is that deal:
 * its stage with the move forward and the pass the pipeline card's menu
 * promised, its notes, and its history.
 */
export default function StartupDealPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { success, error: showError } = useToast();
  const [note, setNote] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: qk('investor', 'deal', id),
    queryFn: () => getInvestorDeal(id),
    enabled: Boolean(id),
    retry: 0,
  });
  const deal = data?.deal ?? null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('investor') });
  };

  const moveTo = useMutation({
    mutationFn: (stage: PipelineStage) => updateInvestorDeal(id, { pipelineStage: stage }),
    onSuccess: (_d, stage) => { success('Stage updated', STAGE_LABEL[stage].en); refresh(); },
    onError: (e) => showError('Could not move the deal', e instanceof Error ? e.message : undefined),
  });

  const star = useMutation({
    mutationFn: (starred: boolean) => updateInvestorDeal(id, { starred }),
    onSuccess: refresh,
    onError: (e) => showError('Could not update the deal', e instanceof Error ? e.message : undefined),
  });

  const addNote = useMutation({
    mutationFn: () => addInvestorDealEvent(id, { type: 'note', title: note.trim().slice(0, 120), body: note.trim() }),
    onSuccess: () => { setNote(''); success('Note added'); refresh(); },
    onError: (e) => showError('Could not add the note', e instanceof Error ? e.message : undefined),
  });

  /*
   * The stage buttons and the star, offered to the assistant. Both go through
   * `updateDeal`, which writes the one field (and `lastActivityAt`); a stage
   * change also appends a history event and the first move to "invested"
   * stamps `investedAt`, which moving back does not clear - the same partial
   * undo the pipeline board and the move_deal_stage capability declare.
   */
  const unloaded = !deal ? 'The deal has not loaded.' : undefined;
  const unloadedEl = !deal ? 'Η συμφωνία δεν έχει φορτωθεί.' : undefined;
  usePageControls([
    {
      id: 'move_deal_stage',
      labelEn: 'Move this deal to a stage',
      labelEl: 'Μετακίνηση συμφωνίας σε στάδιο',
      writes: true,
      options: PIPELINE_STAGES.filter((st) => st !== deal?.pipelineStage).map((st) => ({ value: st, labelEn: STAGE_LABEL[st].en, labelEl: STAGE_LABEL[st].el })),
      current: deal?.pipelineStage,
      unavailableEn: unloaded,
      unavailableEl: unloadedEl,
      undo: () => (deal ? { control: 'move_deal_stage', value: deal.pipelineStage } : undefined),
      run: async (value) => {
        if (!deal) return { error: 'The deal has not loaded.' };
        if (!value || value === deal.pipelineStage) return;
        if (value === 'passed') {
          const ok = await confirm({
            title: <BilingualText en={`Pass on ${deal.name}?`} el={`Απόρριψη: ${deal.name};`} />,
            description: <BilingualText en="It leaves the active pipeline. You can move it back to any stage from here." el="Φεύγει από την ενεργή ροή. Μπορείτε να τη μεταφέρετε ξανά σε οποιοδήποτε στάδιο από εδώ." />,
            confirmLabel: <BilingualText en="Pass" el="Απόρριψη" compact />,
          });
          if (!ok) return CANCELLED;
        }
        await moveTo.mutateAsync(value as PipelineStage);
      },
    },
    ...([true, false] as const).map((on) => ({
      id: on ? 'star_deal' : 'unstar_deal',
      labelEn: on ? 'Star this deal' : 'Remove the star from this deal',
      labelEl: on ? 'Αστέρι στη συμφωνία' : 'Αφαίρεση αστεριού από τη συμφωνία',
      writes: true,
      unavailableEn: unloaded ?? (deal && deal.starred === on ? (on ? 'The deal is already starred.' : 'The deal is not starred.') : undefined),
      unavailableEl: unloadedEl ?? (deal && deal.starred === on ? (on ? 'Η συμφωνία έχει ήδη αστέρι.' : 'Η συμφωνία δεν έχει αστέρι.') : undefined),
      undo: () => ({ control: on ? 'unstar_deal' : 'star_deal' }),
      run: async () => { await star.mutateAsync(on); },
    })),
  ]);

  if (isLoading) {
    return (
      <AppShell title="Startup" titleEl="Startup">
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (isError || !deal) {
    return (
      <AppShell title="Not on your board" titleEl="Δεν είναι στον πίνακά σας">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              <BilingualText
                en="This startup is not on your deal board. Add it from Scouting or the watchlist, then it opens here with its stage, notes and history."
                el="Αυτή η startup δεν είναι στον πίνακα συμφωνιών σας. Προσθέστε τη από την Αναζήτηση ή τη λίστα παρακολούθησης."
                compact
                wrap
              />
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="gap-2" asChild>
                <Link href="/investor/pipeline">
                  <ArrowLeft className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Pipeline" el="Pipeline" compact />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/investor/scouting"><BilingualText en="Scouting" el="Αναζήτηση" compact /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const idx = FORWARD.indexOf(deal.pipelineStage);
  const next = idx >= 0 && idx < FORWARD.length - 1 ? FORWARD[idx + 1] : null;
  const passed = deal.pipelineStage === 'passed';

  const pass = async () => {
    const ok = await confirm({
      title: <BilingualText en={`Pass on ${deal.name}?`} el={`Απόρριψη: ${deal.name};`} />,
      description: <BilingualText en="It leaves the active pipeline. You can move it back to any stage from here." el="Φεύγει από την ενεργή ροή. Μπορείτε να τη μεταφέρετε ξανά σε οποιοδήποτε στάδιο από εδώ." />,
      confirmLabel: <BilingualText en="Pass" el="Απόρριψη" compact />,
    });
    if (ok) moveTo.mutate('passed');
  };

  return (
    <AppShell
      title={deal.name}
      description={deal.tagline ?? undefined}
      askAi={`Summarise where ${deal.name} stands in my pipeline and what I should do next.`}
      actions={
        <>
          {next && !passed && (
            <Button size="sm" className="gap-2" disabled={moveTo.isPending} onClick={() => moveTo.mutate(next)}>
              <ArrowRight className="icon-sm" aria-hidden="true" />
              <BilingualText en={`Move to ${STAGE_LABEL[next].en}`} el={`Μετακίνηση σε ${STAGE_LABEL[next].el}`} compact />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            aria-pressed={deal.starred}
            onClick={() => star.mutate(!deal.starred)}
            className="gap-2"
          >
            <Star className={deal.starred ? 'icon-sm fill-status-warning text-status-warning' : 'icon-sm'} aria-hidden="true" />
            <BilingualText en={deal.starred ? 'Starred' : 'Star'} el={deal.starred ? 'Με αστέρι' : 'Αστέρι'} compact />
          </Button>
          {deal.founder?.id && (
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link href={`/messages?to=${deal.founder.id}`}>
                <MessageCircle className="icon-sm" aria-hidden="true" />
                <BilingualText en="Message founder" el="Μήνυμα στον ιδρυτή" compact />
              </Link>
            </Button>
          )}
          {!passed && (
            <Button size="sm" variant="ghost" className="gap-2 text-destructive-accessible" onClick={() => void pass()}>
              <XCircle className="icon-sm" aria-hidden="true" />
              <BilingualText en="Pass" el="Απόρριψη" compact />
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base"><BilingualText en="Stage" el="Στάδιο" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-wrap gap-2" aria-label="Pipeline stages. Στάδια ροής">
                {PIPELINE_STAGES.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      aria-current={deal.pipelineStage === s ? 'step' : undefined}
                      onClick={() => s !== deal.pipelineStage && moveTo.mutate(s)}
                      disabled={moveTo.isPending}
                      className={
                        deal.pipelineStage === s
                          ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                          : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
                      }
                    >
                      <BilingualText en={STAGE_LABEL[s].en} el={STAGE_LABEL[s].el} compact />
                    </button>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base"><BilingualText en="Add a note" el="Προσθήκη σημείωσης" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }}>
                <Textarea
                  aria-label="Note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={bilingualInline("Call notes, a concern, the next step…", "Σημειώσεις κλήσης, μια ανησυχία, το επόμενο βήμα…")}
                />
                <Button type="submit" size="sm" disabled={!note.trim() || addNote.isPending}>
                  <BilingualText en="Save note" el="Αποθήκευση σημείωσης" compact />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base"><BilingualText en="History" el="Ιστορικό" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              {(deal.recentEvents?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground"><BilingualText en="Nothing recorded yet." el="Δεν έχει καταγραφεί τίποτα ακόμη." compact /></p>
              ) : (
                <ol className="card-rows">
                  {deal.recentEvents.map((ev) => (
                    <li key={ev.id}>
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.body && ev.body !== ev.title && <p className="whitespace-pre-line text-sm text-muted-foreground">{ev.body}</p>}
                      <p className="text-xs text-muted-foreground"><RelativeTime date={ev.createdAt} format={formatRelativeTime} /></p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-2 text-sm">
              {deal.industry && <Badge variant="secondary">{deal.industry}</Badge>}
              {deal.companyStage && <p><span className="text-muted-foreground"><BilingualText en="Stage" el="Στάδιο" compact />:</span> <StatusText value={deal.companyStage} /></p>}
              {deal.location && (
                <p className="flex items-center gap-1.5"><MapPin className="icon-sm text-muted-foreground" aria-hidden="true" />{deal.location}</p>
              )}
              {deal.teamSize != null && <p><span className="text-muted-foreground"><BilingualText en="Team" el="Ομάδα" compact />:</span> <span className="tabular-nums">{deal.teamSize}</span></p>}
              {deal.askAmountCents != null && (
                <p>
                  <span className="text-muted-foreground"><BilingualText en="Raising" el="Αναζητά" compact />:</span>{' '}
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: deal.currency, maximumFractionDigits: 0 }).format(deal.askAmountCents / 100)}
                </p>
              )}
              {deal.website && (
                <a href={deal.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary-accessible hover:underline">
                  <ExternalLink className="icon-sm" aria-hidden="true" />
                  {deal.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {deal.notes && <p className="whitespace-pre-line border-t border-border pt-2 text-muted-foreground">{deal.notes}</p>}
            </CardContent>
          </Card>
          {deal.founder && (
            <Card>
              <CardContent className="text-sm">
                <p className="text-xs text-muted-foreground"><BilingualText en="Founder" el="Ιδρυτής" compact /></p>
                <Link href={`/profiles/${deal.founder.id}`} className="font-medium hover:text-primary-accessible">
                  {deal.founder?.displayName ?? '—'}
                </Link>
                {deal.founder.headline && <p className="text-muted-foreground">{deal.founder.headline}</p>}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
