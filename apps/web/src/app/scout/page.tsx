'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CARD_COMMITMENTS, CARD_STAGES, SCOUT_LIMITS, type ScoutBrief } from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailStats } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { bilingualAria } from '@/lib/i18n/format';
import { initialsOf } from '@/lib/utils';
import { RelativeTime } from '@/components/common/RelativeTime';
import { statusEl } from '@/components/common/StatusText';
import { FormDraftNotice } from '@/components/common/FormDraftNotice';
import { AskIntroButton } from '@/components/intros/AskIntroDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { commitmentRefusal } from '@/lib/commitments-api';
import { useFormDraft } from '@/lib/form-draft';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { ROW_GONE, choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { dismissScoutProposal, getScout, restoreScoutProposal, runScout, saveScoutProposal, setScoutBrief, type ScoutProposal } from '@/lib/scout-api';

const TABS = [
  { value: 'proposed', en: 'Proposed', el: 'Προτάσεις' },
  { value: 'saved', en: 'Saved', el: 'Αποθηκευμένες' },
] as const;

type Draft = { role: string; skills: string; place: string; remoteOk: boolean; commitment: string; stage: string; note: string };
const EMPTY: Draft = { role: '', skills: '', place: '', remoteOk: true, commitment: '', stage: '', note: '' };
const fromBrief = (b: ScoutBrief | null): Draft =>
  b ? { role: b.role, skills: b.skills.join(', '), place: b.place ?? '', remoteOk: b.remoteOk, commitment: b.commitment ?? '', stage: b.stage ?? '', note: b.note ?? '' } : EMPTY;

function ProposalCard({ p, actions }: { p: ScoutProposal; actions: React.ReactNode }) {
  const { success, error: showError } = useToast();
  // The Connections card: the person's circle, name, headline and place,
  // the fit at the right; the reasons, the suggested note and the foot (when
  // it was proposed, then the ways on) on the avatar's edge.
  return (
    <Card>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/profiles/${encodeURIComponent(p.person.id)}`} aria-label={bilingualAria(`Open ${p.person.displayName}'s profile`, `Άνοιγμα προφίλ: ${p.person.displayName}`)}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={p.person?.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(p.person.displayName)}</AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link href={`/profiles/${encodeURIComponent(p.person.id)}`} className="hover:text-primary-accessible">
              {p.person.displayName}
            </Link>
          )}
          subtitle={p.person?.headline ?? undefined}
          meta={p.person?.location ?? undefined}
          asideStays
          aside={(
            <span className="rounded-md border border-primary/15 bg-primary/[0.03] px-2 py-0.5 text-xs font-bold tabular-nums text-foreground" title="Fit with your brief · Ταίριασμα με το σημείωμα">
              {p.score}
            </span>
          )}
        />
        {p.reasons.length ? (
          <ul className="card-body list-disc space-y-0.5 pl-4 text-muted-foreground">
            {p.reasons.map((r) => (
              <li key={r.en}><BilingualText en={r.en} el={r.el} compact /></li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground"><BilingualText en="A first note you could send yourself" el="Ένα πρώτο σημείωμα που μπορείτε να στείλετε εσείς" compact /></p>
          <p className="card-body text-foreground">{p.draftNote}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void navigator.clipboard?.writeText(p.draftNote).then(() => success('Note copied'), () => showError('Could not copy the link'))}
          >
            <BilingualText en="Copy note" el="Αντιγραφή σημειώματος" compact />
          </Button>
        </div>
        <CardFoot meta={<><BilingualText en="Proposed" el="Προτάθηκε" compact /> <RelativeTime date={p.createdAt} /></>}>
          <Button asChild size="sm" variant="outline">
            <Link href={`/profiles/${encodeURIComponent(p.person.id)}`}><BilingualText en="Open profile" el="Άνοιγμα προφίλ" compact /></Link>
          </Button>
          <AskIntroButton targetId={p.person.id} targetName={p.person.displayName} />
          {actions}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

function ScoutContent() {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const { primary } = useLanguagePreference();
  const [tab, setTab] = useState<'proposed' | 'saved'>('proposed');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<{ en: string; el: string } | null>(null);
  const scout = useQuery({ queryKey: qk('scout'), queryFn: getScout });
  const brief = scout.data?.brief ?? null;
  const proposals = scout.data?.proposals ?? [];
  const proposed = proposals.filter((p) => p.status === 'proposed');
  const saved = proposals.filter((p) => p.status === 'saved');

  useEffect(() => {
    if (!editing) setDraft(fromBrief(brief));
  }, [brief, editing]);

  // The assistant's draft_scout_brief fills the form; nothing is saved until Save.
  const formDraft = useFormDraft(
    'scout_brief',
    (f) => {
      setEditing(true);
      setDraft((d) => ({
        ...d,
        role: typeof f.role === 'string' ? f.role : d.role,
        skills: typeof f.skills === 'string' ? f.skills : d.skills,
        place: typeof f.place === 'string' ? f.place : d.place,
        commitment: typeof f.commitment === 'string' ? f.commitment : d.commitment,
        stage: typeof f.stage === 'string' ? f.stage : d.stage,
        note: typeof f.note === 'string' ? f.note : d.note,
      }));
    },
    !scout.isLoading,
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('scout') });
    void queryClient.invalidateQueries({ queryKey: qk('shortlist') });
  };
  const saveBrief = useMutation({
    mutationFn: () => setScoutBrief({ ...draft, skills: draft.skills.split(',').map((s) => s.trim()).filter(Boolean), commitment: (draft.commitment || null) as ScoutBrief['commitment'], stage: (draft.stage || null) as ScoutBrief['stage'] }),
    onSuccess: () => {
      setProblem(null);
      setEditing(false);
      refresh();
      success('Brief saved');
    },
    onError: (err) => {
      const r = commitmentRefusal(err);
      setProblem({ en: r.en, el: r.el });
    },
  });
  const run = useMutation({
    mutationFn: () => runScout(primary === 'el' ? 'el' : 'en'),
    onSuccess: (res) => {
      refresh();
      setTab('proposed');
      success(res.added ? 'The scout found new people' : 'Nobody new this time');
    },
    onError: (err) => {
      const r = commitmentRefusal(err);
      setProblem({ en: r.en, el: r.el });
    },
  });
  const act = useMutation({
    mutationFn: ({ verb, id }: { verb: 'save' | 'dismiss' | 'restore'; id: string }) =>
      verb === 'save' ? saveScoutProposal(id) : verb === 'dismiss' ? dismissScoutProposal(id) : restoreScoutProposal(id),
    onSuccess: refresh,
  });
  const actOn = (verb: 'save' | 'dismiss' | 'restore', p: ScoutProposal): Promise<PageControlRunResult> => settle(() => act.mutateAsync({ verb, id: p.id }));
  const runNow = (): Promise<PageControlRunResult> => settle(() => run.mutateAsync());
  const byId = (v?: string) => proposals.find((p) => p.id === v);

  usePageControls([
    choiceControl('scout_tab', 'Show proposed or saved people', 'Προτάσεις ή αποθηκευμένοι', TABS, tab, (v) => setTab(v === 'saved' ? 'saved' : 'proposed')),
    {
      id: 'run_scout',
      labelEn: 'Run the scout now (adds proposals, contacts nobody)',
      labelEl: 'Εκτέλεση του ανιχνευτή τώρα (προσθέτει προτάσεις, δεν επικοινωνεί με κανέναν)',
      writes: true,
      ...(brief ? {} : { unavailableEn: 'Write a brief first.', unavailableEl: 'Γράψτε πρώτα ένα σημείωμα.' }),
      run: runNow,
    },
    {
      // Saving also writes the shortlist row the profile's Save button writes;
      // the shortlist may have held them already, so there is no exact opposite.
      id: 'save_scout_proposal',
      labelEn: 'Save a proposed person to the shortlist',
      labelEl: 'Αποθήκευση προτεινόμενου στη λίστα',
      writes: true,
      options: rowOptions(proposed, (p) => p.id, (p) => p.person.displayName),
      ...(proposed.length ? {} : { unavailableEn: 'Nobody is proposed right now.', unavailableEl: 'Δεν υπάρχουν προτάσεις αυτή τη στιγμή.' }),
      run: (v) => { const p = byId(v); return p ? actOn('save', p) : ROW_GONE; },
    },
    {
      id: 'dismiss_scout_proposal',
      labelEn: 'Dismiss a proposed person (never proposed again)',
      labelEl: 'Απόρριψη προτεινόμενου (δεν θα ξαναπροταθεί)',
      writes: true,
      options: rowOptions(proposed, (p) => p.id, (p) => p.person.displayName),
      ...(proposed.length ? {} : { unavailableEn: 'Nobody is proposed right now.', unavailableEl: 'Δεν υπάρχουν προτάσεις αυτή τη στιγμή.' }),
      // ScoutService.restore sets the status back to proposed: exactly what dismiss changed.
      undo: (v) => (byId(v)?.status === 'proposed' ? { control: 'restore_scout_proposal', value: v } : undefined),
      run: (v) => { const p = byId(v); return p ? actOn('dismiss', p) : ROW_GONE; },
    },
    {
      id: 'restore_scout_proposal',
      labelEn: 'Bring back a dismissed proposal',
      labelEl: 'Επαναφορά απορριφθείσας πρότασης',
      writes: true,
      run: (v) => (v ? settle(() => act.mutateAsync({ verb: 'restore', id: v })) : ROW_GONE),
    },
  ]);
  usePageList([
    { id: 'scout_proposed', labelEn: 'People the scout proposes', labelEl: 'Πρόσωπα που προτείνει ο ανιχνευτής', rows: tab === 'proposed' ? proposed.map((p) => `${p.person.displayName} (${p.score}): ${p.reasons.map((r) => r.en).join('; ')}`) : undefined },
    { id: 'scout_saved', labelEn: 'Saved from the scout', labelEl: 'Αποθηκευμένοι από τον ανιχνευτή', rows: tab === 'saved' ? saved.map((p) => `${p.person.displayName} (${p.score})`) : undefined },
  ]);

  const rail: PageRailSection[] = useMemo(
    () => [
      {
        id: 'status',
        glyph: 'target',
        labelEn: 'This brief',
        labelEl: 'Αυτό το σημείωμα',
        content: (
          <div className="space-y-3">
            <RailStats
              items={[
                { key: 'proposed', label: 'Proposed', labelEl: 'Προτάσεις', value: proposed.length },
                { key: 'saved', label: 'Saved', labelEl: 'Αποθηκευμένοι', value: saved.length },
              ]}
            />
            {scout.data?.lastRunAt ? (
              <p className="text-xs text-muted-foreground"><BilingualText en="Last run" el="Τελευταία εκτέλεση" compact /> <RelativeTime date={scout.data.lastRunAt} /></p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'how',
        glyph: 'book',
        labelEn: 'What the scout does',
        labelEl: 'Τι κάνει ο ανιχνευτής',
        content: (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li><BilingualText en="It proposes; it never sends. Nobody it proposes is contacted or told." el="Προτείνει· δεν στέλνει ποτέ. Κανείς από όσους προτείνει δεν ειδοποιείται." wrap /></li>
            <li><BilingualText en={`Up to ${SCOUT_LIMITS.proposalsPerRun} people a run, each with the reasons it chose them.`} el={`Έως ${SCOUT_LIMITS.proposalsPerRun} πρόσωπα ανά εκτέλεση, το καθένα με τους λόγους που επιλέχθηκε.`} wrap /></li>
            <li><BilingualText en="It runs once a day while the brief is active, and tells only you." el="Τρέχει μία φορά την ημέρα όσο το σημείωμα είναι ενεργό και ενημερώνει μόνο εσάς." wrap /></li>
            <li><BilingualText en="Dismissed people are not proposed again. People you are connected to are left out." el="Όσοι απορρίπτονται δεν ξαναπροτείνονται. Όσοι είναι ήδη συνδέσεις σας εξαιρούνται." wrap /></li>
          </ul>
        ),
      },
    ],
    [proposed.length, saved.length, scout.data?.lastRunAt],
  );

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditing(true);
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  };
  const busy = act.isPending;

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        <div className="empty:hidden"><FormDraftNotice filled={formDraft.filled} onDismiss={formDraft.dismiss} /></div>
        <Card>
          <CardHeader>
            <CardTitle><BilingualText en="Your brief" el="Το σημείωμά σας" compact /></CardTitle>
            <CardDescription><BilingualText en="Who you are looking for. The scout reads the member base against it." el="Ποιον ψάχνετε. Ο ανιχνευτής διαβάζει τα μέλη με βάση αυτό." wrap /></CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveBrief.mutate();
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scout-role"><BilingualText en="Role" el="Ρόλος" compact /></Label>
                <Input id="scout-role" maxLength={SCOUT_LIMITS.role} placeholder="Technical co-founder" value={draft.role} onChange={set('role')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scout-skills"><BilingualText en="Skills, separated by commas" el="Δεξιότητες, χωρισμένες με κόμμα" compact /></Label>
                <Input id="scout-skills" placeholder="TypeScript, AI" value={draft.skills} onChange={set('skills')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scout-place"><BilingualText en="Where" el="Πού" compact /></Label>
                <Input id="scout-place" maxLength={SCOUT_LIMITS.place} placeholder="Athens" value={draft.place} onChange={set('place')} />
              </div>
              <label className="flex items-center gap-2 self-end text-sm text-foreground">
                <input type="checkbox" checked={draft.remoteOk} onChange={(e) => { setEditing(true); setDraft((d) => ({ ...d, remoteOk: e.target.checked })); }} />
                <BilingualText en="Remote is fine" el="Και εξ αποστάσεως" compact />
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="scout-commitment"><BilingualText en="Commitment" el="Δέσμευση" compact /></Label>
                <select id="scout-commitment" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.commitment} onChange={set('commitment')}>
                  <option value="">—</option>
                  {CARD_COMMITMENTS.map((c) => (
                    <option key={c} value={c}>{primary === 'el' ? (statusEl(c) ?? c) : `${c.charAt(0).toUpperCase()}${c.slice(1).replace(/_/g, ' ')}`}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scout-stage"><BilingualText en="Stage" el="Στάδιο" compact /></Label>
                <select id="scout-stage" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.stage} onChange={set('stage')}>
                  <option value="">—</option>
                  {CARD_STAGES.map((s) => (
                    <option key={s} value={s}>{primary === 'el' ? (statusEl(s) ?? s) : `${s.charAt(0).toUpperCase()}${s.slice(1)}`}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scout-note"><BilingualText en="Anything else (optional)" el="Κάτι ακόμη (προαιρετικά)" compact /></Label>
                <Textarea id="scout-note" rows={2} maxLength={SCOUT_LIMITS.note} value={draft.note} onChange={set('note')} />
              </div>
              {problem ? <p role="alert" className="text-sm text-destructive-accessible sm:col-span-2"><BilingualText en={problem.en} el={problem.el} wrap /></p> : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={!draft.role.trim() || saveBrief.isPending}><BilingualText en="Save brief" el="Αποθήκευση σημειώματος" compact /></Button>
                <Button type="button" variant="outline" disabled={!brief || run.isPending} title={brief ? undefined : 'Write a brief first · Γράψτε πρώτα ένα σημείωμα'} onClick={() => void runNow()}>
                  <BilingualText en="Run now" el="Εκτέλεση τώρα" compact />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v === 'saved' ? 'saved' : 'proposed')} className="space-y-4">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}><BilingualText en={t.en} el={t.el} compact /></TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="proposed" className="space-y-4">
            {scout.isLoading ? (
              <Skeleton className="h-40 w-full rounded-2xl" />
            ) : !proposed.length ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  <BilingualText
                    en={brief ? 'Nobody new to propose. The scout looks again tomorrow, or run it after changing the brief.' : 'Write a brief and the scout proposes people for it, with its reasons.'}
                    el={brief ? 'Κανείς νέος για πρόταση. Ο ανιχνευτής ξανακοιτά αύριο, ή τρέξτε τον αφού αλλάξετε το σημείωμα.' : 'Γράψτε ένα σημείωμα και ο ανιχνευτής θα προτείνει πρόσωπα, με τους λόγους του.'}
                    wrap
                  />
                </CardContent>
              </Card>
            ) : (
              proposed.map((p) => (
                <ProposalCard
                  key={p.id}
                  p={p}
                  actions={
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void actOn('save', p)}><BilingualText en="Save to shortlist" el="Αποθήκευση στη λίστα" compact /></Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void actOn('dismiss', p)}><BilingualText en="Dismiss" el="Απόρριψη" compact /></Button>
                    </>
                  }
                />
              ))
            )}
          </TabsContent>
          <TabsContent value="saved" className="space-y-4">
            {!saved.length ? (
              <Card><CardContent className="text-sm text-muted-foreground"><BilingualText en="People you save from the scout appear here and on your shortlist." el="Όσους αποθηκεύετε από τον ανιχνευτή εμφανίζονται εδώ και στη λίστα σας." wrap /></CardContent></Card>
            ) : (
              saved.map((p) => (
                <ProposalCard key={p.id} p={p} actions={<Button asChild size="sm" variant="ghost"><Link href="/shortlist"><BilingualText en="On your shortlist" el="Στη λίστα σας" compact /></Link></Button>} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export default function ScoutPage() {
  return (
    <Suspense fallback={null}>
      <ScoutContent />
    </Suspense>
  );
}
