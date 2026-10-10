'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INTRO_LIMITS, INTRO_RELATION_COPY, INTRO_STATUS_COPY, OPEN_INTRO_STATUSES, type IntroRelation } from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailStats } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { bilingualAria } from '@/lib/i18n/format';
import { initialsOf } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { commitmentRefusal } from '@/lib/commitments-api';
import { acceptIntro, declineIntro, forwardIntro, listIntros, notNowIntro, withdrawIntro, type Intro } from '@/lib/intros-api';
import { CANCELLED, ROW_GONE, choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';

type Tab = 'sent' | 'forward' | 'received';
const TABS = [
  { value: 'forward', en: 'To forward', el: 'Για προώθηση' },
  { value: 'received', en: 'For you', el: 'Για εσάς' },
  { value: 'sent', en: 'Asked by you', el: 'Δικά σας αιτήματα' },
] as const;

const relationText = (list: IntroRelation[]) => ({
  en: list.map((r) => INTRO_RELATION_COPY[r].en).join(', '),
  el: list.map((r) => INTRO_RELATION_COPY[r].el).join(', '),
});

const statusTone = (status: Intro['status']) =>
  status === 'accepted'
    ? 'border-status-success-border bg-status-success-bg text-status-success'
    : status === 'pending' || status === 'forwarded'
      ? 'border-primary/15 bg-primary/[0.03] text-foreground'
      : 'border-border bg-muted text-muted-foreground';

function IntroCard({
  intro,
  highlight,
  actions,
  editor,
}: {
  intro: Intro;
  highlight: boolean;
  actions?: React.ReactNode;
  /** A form that replaces the actions while it is open (the forward note). */
  editor?: React.ReactNode;
}) {
  // The shared copy names who it waits on; when that is the reader, say so.
  const status =
    intro.role === 'intermediary' && intro.status === 'pending'
      ? { en: 'Waiting for your decision', el: 'Περιμένει την απόφασή σας' }
      : intro.role === 'target' && intro.status === 'forwarded'
        ? { en: 'Waiting for your answer', el: 'Περιμένει την απάντησή σας' }
        : INTRO_STATUS_COPY[intro.status];
  const toReq = relationText(intro.toRequester);
  const toTgt = relationText(intro.toTarget);
  // The person the card is about, for its reader: the one asked about when
  // the reader asked, otherwise the founder who asked.
  const person = intro.role === 'requester' ? intro.target : intro.requester;
  // IntroRequestCard's anatomy (Connections): the person's circle, name and
  // headline, the state at the right; the path, the note and the foot (the
  // time, then the answers) on the avatar's edge.
  return (
    <Card id={`intro-${intro.id}`} className={highlight ? 'scroll-mt-20 border-primary/40' : 'scroll-mt-20'}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/profiles/${encodeURIComponent(person.id)}`} aria-label={bilingualAria(`Open ${person.displayName}'s profile`, `Άνοιγμα προφίλ: ${person.displayName}`)}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(person.displayName)}</AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link href={`/profiles/${encodeURIComponent(person.id)}`} className="transition-colors hover:text-primary-accessible">
              {person.displayName}
            </Link>
          )}
          subtitle={person.headline ?? undefined}
          meta={(
            // The path the introduction travels, the reader named as "you".
            <span>
              <span className="font-medium text-foreground">{intro.role === 'requester' ? <BilingualText en="You" el="Εσείς" compact /> : intro.requester.displayName}</span>
              <span aria-hidden="true"> → </span>
              <span className="font-medium text-foreground">{intro.role === 'intermediary' ? <BilingualText en="you" el="εσείς" compact /> : intro.intermediary.displayName}</span>
              <span aria-hidden="true"> → </span>
              <span className="font-medium text-foreground">{intro.role === 'target' ? <BilingualText en="you" el="εσείς" compact /> : intro.target.displayName}</span>
            </span>
          )}
          aside={(
            <Badge variant="outline" className={statusTone(intro.status)}>
              <BilingualText en={status.en} el={status.el} compact />
            </Badge>
          )}
        />
        <p className="card-body text-muted-foreground">
          <BilingualText en="For the need card" el="Για την κάρτα ανάγκης" compact />{' '}
          <Link className="text-primary-accessible underline-offset-4 hover:underline" href={`/commitments/${encodeURIComponent(intro.card?.id ?? '')}`}>
            {intro.card?.title || <BilingualText en="need card" el="κάρτα ανάγκης" compact />}
          </Link>
        </p>
        <blockquote className="card-body italic text-foreground/80">“{intro.note}”</blockquote>
        {intro.forwardNote ? (
          <p className="card-body text-muted-foreground">
            <BilingualText en={`${intro.intermediary.displayName} adds:`} el={`Ο/Η ${intro.intermediary.displayName} προσθέτει:`} compact /> {intro.forwardNote}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          <BilingualText
            en={`How it connects: ${toReq.en || '—'} to the founder, ${toTgt.en || '—'} to the person introduced.`}
            el={`Πώς συνδέονται: ${toReq.el || '—'} με τον ιδρυτή, ${toTgt.el || '—'} με το πρόσωπο που συστήνεται.`}
            wrap
          />
        </p>
        {editor}
        <CardFoot meta={<RelativeTime date={intro.createdAt} />}>{actions}</CardFoot>
      </CardContent>
    </Card>
  );
}

function IntrosContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('forward');
  const [focus, setFocus] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [forwardNote, setForwardNote] = useState('');
  const [chosen, setChosen] = useState(false);

  const intros = useQuery({ queryKey: qk('intros', 'list'), queryFn: listIntros });
  const sent = intros.data?.sent ?? [];
  const toForward = intros.data?.toForward ?? [];
  const received = intros.data?.received ?? [];

  // ?tab=forward|received and ?intro=<id> from a notification.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab');
    if (t === 'forward' || t === 'received' || t === 'sent') {
      setTab(t);
      setChosen(true);
    }
    if (p.get('intro')) setFocus(p.get('intro'));
  }, []);
  // Without an explicit tab, open where something waits on the reader.
  useEffect(() => {
    if (chosen || !intros.data) return;
    if (toForward.some((i) => i.status === 'pending')) setTab('forward');
    else if (received.some((i) => i.status === 'forwarded')) setTab('received');
    else setTab('sent');
    setChosen(true);
  }, [chosen, intros.data, toForward, received]);
  useEffect(() => {
    if (!focus || !intros.data) return;
    const row = [...sent, ...toForward, ...received].find((i) => i.id === focus);
    if (row) setTab(row.role === 'intermediary' ? 'forward' : row.role === 'target' ? 'received' : 'sent');
    document.getElementById(`intro-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus, intros.data, sent, toForward, received]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk('intros') });
    void queryClient.invalidateQueries({ queryKey: qk('commitments') });
  };
  // Why the last step was refused, when it is something the reader can fix
  // (verifying a workplace); shown in the page, not only in a toast.
  const [refusal, setRefusal] = useState<{ en: string; el: string } | null>(null);
  const failed = (err: unknown) => {
    const r = commitmentRefusal(err);
    if (r.reason === 'role_verification_required') setRefusal({ en: r.en, el: r.el });
    showError('Could not update the introduction', r.en);
  };
  const act = useMutation({
    mutationFn: async ({ kind, id, note }: { kind: 'withdraw' | 'forward' | 'decline' | 'accept' | 'not_now'; id: string; note?: string }) => {
      if (kind === 'withdraw') return { intro: await withdrawIntro(id) };
      if (kind === 'forward') return { intro: await forwardIntro(id, note) };
      if (kind === 'decline') return { intro: await declineIntro(id) };
      if (kind === 'not_now') return { intro: await notNowIntro(id) };
      return acceptIntro(id);
    },
    onSuccess: (res, vars) => {
      refresh();
      setForwarding(null);
      setForwardNote('');
      if (vars.kind === 'forward') success('Introduction forwarded');
      if (vars.kind === 'withdraw') success('Introduction withdrawn');
      if (vars.kind === 'accept' && 'cardId' in res) {
        success('Accepted: continue on the need card');
        router.push(`/commitments/${encodeURIComponent(res.cardId)}${res.threadId ? `?thread=${encodeURIComponent(res.threadId)}` : ''}`);
      }
    },
    onError: failed,
  });

  const run = (kind: 'withdraw' | 'forward' | 'decline' | 'accept' | 'not_now', i: Intro, note?: string): Promise<PageControlRunResult> =>
    settle(() => act.mutateAsync({ kind, id: i.id, note }));
  const confirmDecline = async (i: Intro): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en="Not forward this introduction?" el="Να μην προωθηθεί αυτή η σύσταση;" compact />,
      description: (
        <BilingualText
          en={`${i.requester.displayName} is told only that it was not forwarded, and ${i.target.displayName} never hears of it.`}
          el={`Ο/Η ${i.requester.displayName} μαθαίνει μόνο ότι δεν προωθήθηκε, και ο/η ${i.target.displayName} δεν το μαθαίνει ποτέ.`}
          wrap
        />
      ),
    });
    if (!ok) return CANCELLED;
    return run('decline', i);
  };

  const waitingOnMe = toForward.filter((i) => i.status === 'pending');
  const forMe = received.filter((i) => i.status === 'forwarded');
  const myOpen = sent.filter((i) => (OPEN_INTRO_STATUSES as readonly string[]).includes(i.status));
  const all = [...sent, ...toForward, ...received];
  const byId = (v?: string) => all.find((i) => i.id === v);
  const rowCommand = (
    id: string,
    en: string,
    el: string,
    rows: Intro[],
    handler: (i: Intro) => Promise<PageControlRunResult>,
    noneEn: string,
    noneEl: string,
  ) => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: rowOptions(rows, (i) => i.id, (i) => `${i.requester.displayName} → ${i.target.displayName}`),
    ...(rows.length ? {} : { unavailableEn: noneEn, unavailableEl: noneEl }),
    run: (v?: string) => {
      const i = byId(v);
      return i ? handler(i) : ROW_GONE;
    },
  });

  usePageControls([
    choiceControl('intros_tab', 'Show introductions to forward, for you, or asked by you', 'Συστάσεις για προώθηση, για εσάς ή δικά σας αιτήματα', TABS, tab, (v) => setTab(v === 'sent' || v === 'received' ? v : 'forward')),
    // None has an opposite: each one notifies someone who cannot be un-told.
    rowCommand('forward_intro', 'Forward an introduction', 'Προώθηση σύστασης', waitingOnMe, (i) => run('forward', i), 'Nothing waits for you to forward.', 'Δεν περιμένει τίποτα προώθηση από εσάς.'),
    rowCommand('decline_intro', 'Not forward an introduction', 'Μη προώθηση σύστασης', waitingOnMe, confirmDecline, 'Nothing waits for you to forward.', 'Δεν περιμένει τίποτα προώθηση από εσάς.'),
    rowCommand('accept_intro', 'Accept an introduction (answers their need card)', 'Αποδοχή σύστασης (απαντά στην κάρτα ανάγκης)', forMe, (i) => run('accept', i), 'No introduction waits for your answer.', 'Καμία σύσταση δεν περιμένει την απάντησή σας.'),
    rowCommand('not_now_intro', 'Say not now to an introduction', 'Όχι τώρα σε μια σύσταση', forMe, (i) => run('not_now', i), 'No introduction waits for your answer.', 'Καμία σύσταση δεν περιμένει την απάντησή σας.'),
    rowCommand('withdraw_intro', 'Withdraw an introduction you asked for', 'Απόσυρση αιτήματος σύστασης', sent.filter((i) => i.status === 'pending'), (i) => run('withdraw', i), 'None of your requests is still waiting on the intermediary.', 'Κανένα αίτημά σας δεν περιμένει πια τον ενδιάμεσο.'),
  ]);
  const line = (i: Intro) => `${i.requester.displayName} → ${i.intermediary.displayName} → ${i.target.displayName}: ${i.card.title} (${INTRO_STATUS_COPY[i.status].en})`;
  usePageList([
    { id: 'intros_to_forward', labelEn: 'Introductions to forward', labelEl: 'Συστάσεις για προώθηση', rows: tab === 'forward' ? toForward.map(line) : undefined },
    { id: 'intros_for_you', labelEn: 'Introductions for you', labelEl: 'Συστάσεις για εσάς', rows: tab === 'received' ? received.map(line) : undefined },
    { id: 'intros_sent', labelEn: 'Introductions you asked for', labelEl: 'Συστάσεις που ζητήσατε', rows: tab === 'sent' ? sent.map(line) : undefined },
  ]);

  const rail: PageRailSection[] = useMemo(
    () => [
      {
        id: 'summary',
        glyph: 'people',
        labelEn: 'Waiting',
        labelEl: 'Σε αναμονή',
        content: (
          <RailStats
            items={[
              { key: 'forward', label: 'To forward', labelEl: 'Για προώθηση', value: waitingOnMe.length },
              { key: 'answer', label: 'To answer', labelEl: 'Για απάντηση', value: forMe.length },
              { key: 'asked', label: `Your open requests (of ${INTRO_LIMITS.openPerRequester})`, labelEl: `Ανοιχτά αιτήματά σας (από ${INTRO_LIMITS.openPerRequester})`, value: myOpen.length },
            ]}
          />
        ),
      },
      {
        id: 'how',
        glyph: 'book',
        labelEn: 'How introductions work',
        labelEl: 'Πώς λειτουργούν οι συστάσεις',
        content: (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li><BilingualText en="Ask from someone’s profile. Only people who know you both can introduce you." el="Ζητήστε από το προφίλ κάποιου. Μόνο όσοι γνωρίζουν και τους δύο μπορούν να σας συστήσουν." wrap /></li>
            <li><BilingualText en="The intermediary decides. A decline is never explained, and the other person never hears of it." el="Ο ενδιάμεσος αποφασίζει. Η άρνηση δεν εξηγείται ποτέ και το άλλο πρόσωπο δεν το μαθαίνει." wrap /></li>
            <li><BilingualText en="Accepting answers the founder’s need card: a protected conversation, then terms." el="Η αποδοχή απαντά στην κάρτα ανάγκης του ιδρυτή: προστατευμένη συζήτηση, μετά όροι." wrap /></li>
            <li><BilingualText en={`At most ${INTRO_LIMITS.openPerRequester} requests waiting at once, so each one is considered.`} el={`Έως ${INTRO_LIMITS.openPerRequester} αιτήματα σε αναμονή ταυτόχρονα, ώστε το καθένα να εξετάζεται.`} wrap /></li>
          </ul>
        ),
      },
    ],
    [waitingOnMe.length, forMe.length, myOpen.length],
  );

  const empty = (en: string, el: string, cta?: React.ReactNode) => (
    <Card>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <BilingualText en={en} el={el} wrap />
        {cta}
      </CardContent>
    </Card>
  );
  const busy = act.isPending;

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v === 'sent' || v === 'received' ? v : 'forward')} className="space-y-4">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}><BilingualText en={t.en} el={t.el} compact /></TabsTrigger>
            ))}
          </TabsList>
          {intros.isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <TabsContent value="forward" className="space-y-4">
                {toForward.length === 0
                  ? empty('Nobody has asked you for an introduction yet.', 'Κανείς δεν σας έχει ζητήσει ακόμη σύσταση.')
                  : toForward.map((i) => (
                      <IntroCard
                        key={i.id}
                        intro={i}
                        highlight={focus === i.id}
                        editor={
                          i.status === 'pending' && forwarding === i.id ? (
                            <form
                              className="w-full space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void run('forward', i, forwardNote);
                              }}
                            >
                              <label htmlFor={`fwd-${i.id}`} className="text-sm font-medium text-foreground">
                                <BilingualText en={`A line for ${i.target.displayName} (optional)`} el={`Μια γραμμή για τον/την ${i.target.displayName} (προαιρετικά)`} compact />
                              </label>
                              <Textarea id={`fwd-${i.id}`} rows={2} maxLength={INTRO_LIMITS.forwardNote} value={forwardNote} onChange={(e) => setForwardNote(e.target.value)} />
                              <div className="flex flex-wrap gap-2">
                                <Button type="submit" size="sm" disabled={busy}><BilingualText en="Forward" el="Προώθηση" compact /></Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setForwarding(null)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                              </div>
                            </form>
                          ) : undefined
                        }
                        actions={
                          i.status === 'pending' && forwarding !== i.id ? (
                            <>
                              <Button size="sm" disabled={busy} onClick={() => { setForwarding(i.id); setForwardNote(''); }}>
                                <BilingualText en="Forward…" el="Προώθηση…" compact />
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void confirmDecline(i)}>
                                <BilingualText en="Not this one" el="Όχι αυτή" compact />
                              </Button>
                            </>
                          ) : undefined
                        }
                      />
                    ))}
              </TabsContent>
              <TabsContent value="received" className="space-y-4">
                {refusal ? (
                  <div role="alert" className="space-y-2 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-sm text-foreground">
                    <p><BilingualText en={refusal.en} el={refusal.el} wrap /></p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/settings#verification"><BilingualText en="Verify in Settings" el="Επαλήθευση στις Ρυθμίσεις" compact /></Link>
                    </Button>
                  </div>
                ) : null}
                {received.length === 0
                  ? empty('No introductions for you yet. They reach you only after someone you know forwards them.', 'Καμία σύσταση για εσάς ακόμη. Φτάνουν μόνο αφού τις προωθήσει κάποιος που γνωρίζετε.')
                  : received.map((i) => (
                      <IntroCard
                        key={i.id}
                        intro={i}
                        highlight={focus === i.id}
                        actions={
                          i.status === 'forwarded' ? (
                            <>
                              <Button size="sm" disabled={busy} onClick={() => void run('accept', i)}><BilingualText en="Accept and talk" el="Αποδοχή και συζήτηση" compact /></Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run('not_now', i)}><BilingualText en="Not now" el="Όχι τώρα" compact /></Button>
                            </>
                          ) : i.status === 'accepted' && i.threadId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/commitments/${encodeURIComponent(i.card.id)}?thread=${encodeURIComponent(i.threadId)}`}><BilingualText en="Open the conversation" el="Άνοιγμα συζήτησης" compact /></Link>
                            </Button>
                          ) : undefined
                        }
                      />
                    ))}
              </TabsContent>
              <TabsContent value="sent" className="space-y-4">
                {sent.length === 0
                  ? empty(
                      'You have not asked for an introduction yet. Open the profile of someone you want to meet and choose “Ask for an introduction”.',
                      'Δεν έχετε ζητήσει ακόμη σύσταση. Ανοίξτε το προφίλ κάποιου που θέλετε να γνωρίσετε και επιλέξτε «Ζητήστε σύσταση».',
                      <Button asChild size="sm" variant="outline"><Link href="/discover"><BilingualText en="Find people" el="Βρείτε ανθρώπους" compact /></Link></Button>,
                    )
                  : sent.map((i) => (
                      <IntroCard
                        key={i.id}
                        intro={i}
                        highlight={focus === i.id}
                        actions={
                          i.status === 'pending' ? (
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run('withdraw', i)}><BilingualText en="Withdraw" el="Απόσυρση" compact /></Button>
                          ) : i.status === 'accepted' && i.threadId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/commitments/${encodeURIComponent(i.card.id)}?thread=${encodeURIComponent(i.threadId)}`}><BilingualText en="Open the conversation" el="Άνοιγμα συζήτησης" compact /></Link>
                            </Button>
                          ) : undefined
                        }
                      />
                    ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

export default function IntrosPage() {
  return (
    <Suspense fallback={null}>
      <IntrosContent />
    </Suspense>
  );
}
