'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailStats } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { UpdateCard } from '@/components/updates/UpdateCard';
import { UpdateComposer, type UpdateDraft } from '@/components/updates/UpdateComposer';
import { useStoredUser } from '@/hooks/useStoredUser';
import { useFormDraft } from '@/lib/form-draft';
import { FormDraftNotice } from '@/components/common/FormDraftNotice';
import { linkedInShareUrl } from '@/lib/commitments-links';
import { CANCELLED, ROW_GONE, choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import {
  createUpdate,
  deleteUpdate,
  getFollowStatus,
  getFollowing,
  getMyUpdates,
  getUpdatesFeed,
  publicUpdateUrl,
  setUpdateVisibility,
  type FounderUpdate,
} from '@/lib/updates-api';
import { founderUpdatePost, useSuggestedPost } from '@/lib/share-text';

const TABS = [
  { value: 'following', en: 'From people you follow', el: 'Από όσους ακολουθείτε' },
  { value: 'mine', en: 'My updates', el: 'Οι ενημερώσεις μου' },
] as const;

function UpdatesContent() {
  const me = useStoredUser();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const suggested = useSuggestedPost();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'following' | 'mine'>('following');
  const [focus, setFocus] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Partial<UpdateDraft> | null>(null);

  // ?update=<id> from a notification; ?title=…&milestone=… from a reached milestone.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('update')) setFocus(p.get('update'));
    const title = p.get('title');
    if (title) {
      setTab('mine');
      setPrefill({ title: title.slice(0, 120), milestoneId: p.get('milestone') });
    }
  }, []);

  const feed = useQuery({ queryKey: qk('founder-updates', 'feed'), queryFn: getUpdatesFeed });
  const mine = useQuery({ queryKey: qk('founder-updates', 'mine'), queryFn: getMyUpdates });
  const following = useQuery({ queryKey: qk('follows', 'list'), queryFn: getFollowing });
  const audience = useQuery({ queryKey: qk('follows', me?.id ?? ''), queryFn: () => getFollowStatus(me?.id as string), enabled: !!me?.id });

  // The assistant's draft_founder_update fills the composer; nothing is sent until the button.
  const draft = useFormDraft(
    'founder_update',
    (f) => {
      setTab('mine');
      setPrefill({
        title: typeof f.title === 'string' ? f.title : undefined,
        body: typeof f.body === 'string' ? f.body : undefined,
        visibility: f.visibility === 'public' ? 'public' : undefined,
      });
    },
    true,
  );

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`update-${focus}`);
    el?.scrollIntoView({ block: 'start' });
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk('founder-updates') });
  const send = useMutation({
    mutationFn: (d: UpdateDraft) =>
      createUpdate({ title: d.title, body: d.body, metrics: d.metrics.filter((m) => m.label.trim() && m.value.trim()), asks: d.asks.filter((a) => a.trim()), visibility: d.visibility, milestoneId: d.milestoneId }),
    onSuccess: () => {
      void refresh();
      success('Update sent');
    },
    onError: () => showError('Could not send the update'),
  });
  const visibility = useMutation({
    mutationFn: ({ id, to }: { id: string; to: 'followers' | 'public' }) => setUpdateVisibility(id, to),
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteUpdate(id), onSuccess: () => void refresh() });

  const feedRows = feed.data ?? [];
  const myRows = mine.data ?? [];

  const toggleVisibility = (u: FounderUpdate): Promise<PageControlRunResult> =>
    settle(() => visibility.mutateAsync({ id: u.id, to: u.visibility === 'public' ? 'followers' : 'public' }));
  const confirmDelete = async (u: FounderUpdate): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en="Delete this update?" el="Διαγραφή αυτής της ενημέρωσης;" compact />,
      description: <BilingualText en="It disappears for your followers, and its public link stops working." el="Χάνεται για τους ακολούθους σας και ο δημόσιος σύνδεσμός της σταματά να λειτουργεί." wrap />,
      variant: 'destructive',
    });
    if (!ok) return CANCELLED;
    return settle(() => remove.mutateAsync(u.id));
  };
  const copyLink = (u: FounderUpdate) => {
    if (!u.publicToken) return;
    void navigator.clipboard?.writeText(publicUpdateUrl(u.publicToken)).then(() => success('Link copied'), () => showError('Could not copy the link'));
  };

  const byId = (v?: string) => myRows.find((u) => u.id === v);
  const publicRows = myRows.filter((u) => u.visibility === 'public');
  const followerRows = myRows.filter((u) => u.visibility !== 'public');
  const noneEn = (what: string) => `None of your updates is ${what}.`;
  usePageControls([
    choiceControl('updates_tab', 'Show updates from people you follow, or your own', 'Ενημερώσεις από όσους ακολουθείτε ή δικές σας', TABS, tab, (v) => setTab(v === 'mine' ? 'mine' : 'following')),
    {
      id: 'make_update_public',
      labelEn: 'Make an update public (it gets a link for LinkedIn)',
      labelEl: 'Δημόσια ενημέρωση (παίρνει σύνδεσμο για το LinkedIn)',
      writes: true,
      options: rowOptions(followerRows, (u) => u.id, (u) => u.title),
      ...(followerRows.length ? {} : { unavailableEn: noneEn('followers-only'), unavailableEl: 'Καμία ενημέρωσή σας δεν είναι μόνο για ακολούθους.' }),
      // Followers-only clears the token (founder-updates.service setVisibility),
      // which is exactly the state a followers-only update was in.
      undo: (v) => (byId(v)?.visibility === 'followers' ? { control: 'make_update_followers_only', value: v } : undefined),
      run: (v) => { const u = byId(v); return u ? toggleVisibility(u) : ROW_GONE; },
    },
    {
      // No opposite: making it public again issues a new link, and the one
      // already shared stays dead.
      id: 'make_update_followers_only',
      labelEn: 'Make an update followers-only (retires its public link)',
      labelEl: 'Ενημέρωση μόνο για ακολούθους (αποσύρει τον δημόσιο σύνδεσμο)',
      writes: true,
      options: rowOptions(publicRows, (u) => u.id, (u) => u.title),
      ...(publicRows.length ? {} : { unavailableEn: noneEn('public'), unavailableEl: 'Καμία ενημέρωσή σας δεν είναι δημόσια.' }),
      run: (v) => { const u = byId(v); return u ? toggleVisibility(u) : ROW_GONE; },
    },
    {
      id: 'copy_update_link',
      labelEn: 'Copy the public link of an update',
      labelEl: 'Αντιγραφή του δημόσιου συνδέσμου μιας ενημέρωσης',
      writes: false,
      options: rowOptions(publicRows, (u) => u.id, (u) => u.title),
      ...(publicRows.length ? {} : { unavailableEn: noneEn('public'), unavailableEl: 'Καμία ενημέρωσή σας δεν είναι δημόσια.' }),
      run: (v) => { const u = byId(v); if (!u) return ROW_GONE; copyLink(u); },
    },
    {
      id: 'delete_update',
      labelEn: 'Delete an update',
      labelEl: 'Διαγραφή ενημέρωσης',
      writes: true,
      options: rowOptions(myRows, (u) => u.id, (u) => u.title),
      ...(myRows.length ? {} : { unavailableEn: 'You have not sent an update yet.', unavailableEl: 'Δεν έχετε στείλει ακόμη ενημέρωση.' }),
      run: (v) => { const u = byId(v); return u ? confirmDelete(u) : ROW_GONE; },
    },
  ]);
  usePageList([
    { id: 'followed_updates', labelEn: 'Updates from people you follow', labelEl: 'Ενημερώσεις από όσους ακολουθείτε', rows: tab === 'following' ? feedRows.map((u) => `${u.author.displayName}: ${u.title}`) : undefined },
    { id: 'my_updates', labelEn: 'My updates', labelEl: 'Οι ενημερώσεις μου', rows: tab === 'mine' ? myRows.map((u) => `${u.title} — ${u.visibility}`) : undefined },
  ]);

  const people = following.data ?? [];
  const rail: PageRailSection[] = useMemo(
    () => [
      {
        id: 'audience',
        glyph: 'people',
        labelEn: 'Audience',
        labelEl: 'Κοινό',
        content: (
          <div className="space-y-3">
            <RailStats
              items={[
                { key: 'followers', label: 'Follow you', labelEl: 'Σας ακολουθούν', value: audience.data?.followers ?? 0 },
                { key: 'following', label: 'You follow', labelEl: 'Ακολουθείτε', value: people.length },
              ]}
            />
            {people.length ? (
              <ul className="space-y-1 text-sm">
                {people.slice(0, 8).map((p) => (
                  <li key={p.id} className="truncate">
                    <Link className="text-primary-accessible underline-offset-4 hover:underline" href={`/profiles/${encodeURIComponent(p.id)}`}>{p.displayName}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground"><BilingualText en="Follow founders from their profiles to read their updates here." el="Ακολουθήστε ιδρυτές από τα προφίλ τους για να διαβάζετε εδώ τις ενημερώσεις τους." wrap /></p>
            )}
          </div>
        ),
      },
      {
        id: 'guide',
        glyph: 'book',
        labelEn: 'A useful update',
        labelEl: 'Μια χρήσιμη ενημέρωση',
        content: (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li><BilingualText en="One sentence on what moved since last time." el="Μία πρόταση για το τι άλλαξε από την προηγούμενη φορά." wrap /></li>
            <li><BilingualText en="The same few figures every time, so the trend shows." el="Τα ίδια λίγα μεγέθη κάθε φορά, για να φαίνεται η τάση." wrap /></li>
            <li><BilingualText en="One specific ask a reader can act on today." el="Ένα συγκεκριμένο αίτημα που μπορεί να κάνει κάποιος σήμερα." wrap /></li>
          </ul>
        ),
      },
    ],
    [audience.data?.followers, people],
  );

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v === 'mine' ? 'mine' : 'following')} className="space-y-4">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}><BilingualText en={t.en} el={t.el} compact /></TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="following" className="space-y-4">
            {feed.isLoading ? (
              <Skeleton className="h-40 w-full rounded-2xl" />
            ) : feedRows.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <BilingualText en="No updates yet from the people you follow. Follow founders, mentors or investors from their profiles." el="Καμία ενημέρωση ακόμη από όσους ακολουθείτε. Ακολουθήστε ιδρυτές, μέντορες ή επενδυτές από τα προφίλ τους." wrap />
                  <Button asChild size="sm" variant="outline"><Link href="/discover"><BilingualText en="Find people" el="Βρείτε ανθρώπους" compact /></Link></Button>
                </CardContent>
              </Card>
            ) : (
              feedRows.map((u) => <UpdateCard key={u.id} update={u} highlight={focus === u.id} />)
            )}
          </TabsContent>
          <TabsContent value="mine" className="space-y-4">
            <div className="empty:hidden"><FormDraftNotice filled={draft.filled} onDismiss={draft.dismiss} /></div>
            <Card>
              <CardContent>
                <UpdateComposer initial={prefill} busy={send.isPending} onSend={async (d) => !!(await send.mutateAsync(d).catch(() => null))} />
              </CardContent>
            </Card>
            {mine.isLoading ? null : myRows.map((u) => (
              <UpdateCard
                key={u.id}
                update={u}
                highlight={focus === u.id}
                actions={
                  <>
                    {u.publicToken ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => copyLink(u)}><BilingualText en="Copy link" el="Αντιγραφή συνδέσμου" compact /></Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={linkedInShareUrl(publicUpdateUrl(u.publicToken))} target="_blank" rel="noopener noreferrer" onClick={() => suggested.copy(founderUpdatePost(u, publicUpdateUrl(u.publicToken as string), suggested.lang))}><BilingualText en="Share on LinkedIn" el="Κοινοποίηση στο LinkedIn" compact /></a>
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="outline" disabled={visibility.isPending} onClick={() => void toggleVisibility(u)}>
                      <BilingualText en={u.visibility === 'public' ? 'Followers only' : 'Make public'} el={u.visibility === 'public' ? 'Μόνο ακόλουθοι' : 'Δημόσια'} compact />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive-accessible" disabled={remove.isPending} onClick={() => void confirmDelete(u)}>
                      <BilingualText en="Delete" el="Διαγραφή" compact />
                    </Button>
                  </>
                }
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={null}>
      <UpdatesContent />
    </Suspense>
  );
}
