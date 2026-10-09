'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Brain, Check, Crown, Minus, Plus, Target, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RoleBadge } from '@/components/common/RoleBadge';
import { BilingualText } from '@/components/common/BilingualText';
import { ConnectButton, MessageButton } from '@/components/common/PersonActions';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { getMatchBreakdown, getRecommendations, type MatchBreakdown, type SearchHit } from '@/lib/api';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { cn, initialsOf } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';
import { matchAxisEl } from '@/lib/i18n/strings-matches';
import { bilingualAria } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';

/*
 * Matches side by side.
 *
 * This page compared three people who were written into it - Sarah Chen,
 * Mike Ross and Lisa Park, with invented work-style percentages and a
 * "previous exit" - and nobody else: the ids the shortlist sends were looked
 * up in that list, so a real shortlist opened an empty page, and the demo
 * compared strangers who were not among the reader's matches. Its summary
 * praised "technical expertise and previous startup experience" whoever was
 * first.
 *
 * The people are now the reader's own matches (the list /matches ranks), and
 * each column is that person's breakdown from the matching engine - the
 * dimensions, shared strengths and friction points /matches/:id shows. The
 * rows line the same dimension up across people and mark who leads it, and
 * the summary says what the numbers say.
 */

const MAX = 3;

export default function MatchComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: recData, isLoading: recLoading } = useQuery({
    queryKey: qk('recommendations', 'matches', { limit: 50 }),
    queryFn: () => getRecommendations({ limit: 50 }),
    staleTime: 3 * 60_000,
  });
  const matches = useMemo(() => recData?.suggestions ?? [], [recData]);

  // The ids the shortlist sends; with none, the two strongest matches.
  const requested = useMemo(() => searchParams?.get('ids')?.split(',').filter(Boolean) ?? [], [searchParams]);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const defaultIds = useMemo(() => {
    const fromUrl = requested.filter((id) => matches.some((m) => m.userId === id));
    if (fromUrl.length) return fromUrl.slice(0, MAX);
    return [...matches].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, 2).map((m) => m.userId);
  }, [requested, matches]);
  const selectedIds = chosen ?? defaultIds;
  const people = selectedIds
    .map((id) => matches.find((m) => m.userId === id))
    .filter((m): m is SearchHit => Boolean(m));
  const notMatched = requested.filter((id) => !matches.some((m) => m.userId === id));

  const breakdownQueries = useQueries({
    queries: people.map((person) => ({
      queryKey: qk('matching', 'breakdown', person.userId),
      queryFn: () => getMatchBreakdown(person.userId),
      staleTime: 5 * 60_000,
      retry: 0,
    })),
  });
  const breakdowns: (MatchBreakdown | undefined)[] = breakdownQueries.map((q) => q.data);

  const scoreOf = (i: number) => breakdowns[i]?.overall.score ?? people[i]?.matchScore ?? null;
  const axes = Array.from(
    new Map(
      breakdowns.flatMap((b) => b?.breakdown ?? []).map((axis) => [axis.key, axis.label] as const),
    ).entries(),
  );
  const axisScore = (i: number, key: string) => breakdowns[i]?.breakdown.find((a) => a.key === key)?.score ?? null;
  const leaderOf = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v != null);
    if (present.length < 2) return -1;
    const max = Math.max(...present);
    return present.filter((v) => v === max).length === 1 ? values.indexOf(max) : -1;
  };

  const remove = (id: string) => setChosen(selectedIds.filter((x) => x !== id));
  const add = (id: string) => setChosen([...selectedIds, id].slice(0, MAX));
  const addable = matches.filter((m) => !selectedIds.includes(m.userId));

  // The summary: who leads overall, and on which dimensions each leads.
  const overallLeader = leaderOf(people.map((_, i) => scoreOf(i)));
  const leads = people.map((_, i) => axes.filter(([key]) => leaderOf(people.map((__, j) => axisScore(j, key))) === i).map(([, label]) => label));
  // One sentence per language, written whole rather than stitched from parts.
  const summary = (() => {
    const listEn = (labels: string[]) => labels.join(', ').toLowerCase();
    const listEl = (labels: string[]) => labels.map((l) => matchAxisEl(l) ?? l).join(', ').toLowerCase();
    const en: string[] = [];
    const el: string[] = [];
    if (overallLeader >= 0) {
      const name = people[overallLeader].displayName;
      const lead = leads[overallLeader] ?? [];
      en.push(`${name} has the highest overall match at ${scoreOf(overallLeader)}%${lead.length ? `, leading on ${listEn(lead)}` : ''}.`);
      el.push(`${name}: η υψηλότερη συνολική αντιστοίχιση, ${scoreOf(overallLeader)}%${lead.length ? `, με προβάδισμα σε ${listEl(lead)}` : ''}.`);
    } else {
      en.push('No one leads overall: the scores are level.');
      el.push('Κανείς δεν προηγείται συνολικά: οι βαθμολογίες είναι ίσες.');
    }
    people.forEach((p, i) => {
      if (i === overallLeader || !leads[i]?.length) return;
      en.push(`${p.displayName} leads on ${listEn(leads[i])}.`);
      el.push(`${p.displayName}: προβάδισμα σε ${listEl(leads[i])}.`);
    });
    en.push('The full reasoning for each person is on their match page.');
    el.push('Η πλήρης αιτιολόγηση για κάθε πρόσωπο βρίσκεται στη σελίδα της αντιστοίχισής του.');
    return { en: en.join(' '), el: el.join(' ') };
  })();

  usePageList([
    {
      id: 'compared',
      labelEn: 'People compared',
      labelEl: 'Πρόσωπα σε σύγκριση',
      rows: recLoading ? undefined : people.map((p, i) => `${p.displayName} · ${p.headline ?? p.role} · match ${scoreOf(i) ?? '—'}%${leads[i]?.length ? ` · leads on ${leads[i].join(', ')}` : ''}`),
    },
  ]);
  usePageControls([
    {
      id: 'add_to_comparison',
      labelEn: 'Add a match to the comparison',
      labelEl: 'Προσθήκη αντιστοίχισης στη σύγκριση',
      writes: false,
      options: rowOptions(addable, (m) => m.userId, (m) => m.displayName),
      unavailableEn: people.length >= MAX ? `Up to ${MAX} people can be compared at once.` : undefined,
      unavailableEl: people.length >= MAX ? `Έως ${MAX} πρόσωπα ταυτόχρονα.` : undefined,
      run: (v) => { if (v) add(v); },
    },
    {
      id: 'remove_from_comparison',
      labelEn: 'Remove from the comparison',
      labelEl: 'Αφαίρεση από τη σύγκριση',
      writes: false,
      options: rowOptions(people, (p) => p.userId, (p) => p.displayName),
      run: (v) => { if (v) remove(v); },
    },
  ]);

  return (
    <AppShell title="Compare matches" titleEl="Σύγκριση αντιστοιχιών" description="Open two or more match profiles side by side to weigh fit." descriptionEl="Ανοίξτε δύο ή περισσότερα προφίλ δίπλα-δίπλα για να κρίνετε πόσο ταιριάζουν.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back. Πίσω">
            <ArrowLeft className="icon-md" />
          </Button>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <BilingualText en={`Compare up to ${MAX} of your matches side by side.`} el={`Συγκρίνετε έως ${MAX} αντιστοιχίσεις δίπλα-δίπλα.`} />
          </p>
          {people.length < MAX && addable.length > 0 && (
            <Select value="" onValueChange={add}>
              <SelectTrigger aria-label="Add a match to compare. Προσθήκη αντιστοίχισης για σύγκριση" className="w-[220px]">
                <Plus className="mr-1.5 icon-sm" aria-hidden="true" />
                <SelectValue placeholder={bilingualInline("Add a match", "Προσθήκη αντιστοίχισης")} />
              </SelectTrigger>
              <SelectContent>
                {addable.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}{m.matchScore != null ? ` · ${m.matchScore}%` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" asChild>
            <Link href="/matches"><BilingualText en="Back to matches" el="Πίσω στις αντιστοιχίσεις" compact /></Link>
          </Button>
        </div>

        {notMatched.length > 0 && !recLoading && (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            <BilingualText
              en={`${notMatched.length === 1 ? 'One person you picked is' : `${notMatched.length} people you picked are`} not among your current matches, so there is no breakdown to compare.`}
              el={`${notMatched.length === 1 ? 'Ένα πρόσωπο που επιλέξατε δεν είναι' : `${notMatched.length} πρόσωπα που επιλέξατε δεν είναι`} στις τρέχουσες αντιστοιχίσεις σας, οπότε δεν υπάρχει ανάλυση για σύγκριση.`}
              wrap
            />
          </p>
        )}

        {recLoading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-64" />)}
          </div>
        )}

        {!recLoading && people.length === 0 && (
          <SectionCard title="Nobody to compare yet" titleEl="Κανείς για σύγκριση ακόμα">
            <EmptyLine
              en="Pick people on /matches or your shortlist, then compare them here."
              el="Επιλέξτε πρόσωπα στις αντιστοιχίσεις ή στη λίστα σας και συγκρίνετέ τα εδώ."
            />
          </SectionCard>
        )}

        {people.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only"><BilingualText en="Your matches compared, dimension by dimension" el="Οι αντιστοιχίσεις σας συγκριτικά, διάσταση προς διάσταση" wrap /></caption>
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-4 text-left align-bottom text-xs font-medium text-muted-foreground">
                    <BilingualText en="Match" el="Αντιστοίχιση" stacked />
                  </th>
                  {people.map((person, i) => (
                    <th key={person.userId} scope="col" className="relative p-4 text-left align-top font-normal">
                      <Button aria-label={bilingualAria(`Remove ${person.displayName} from the comparison`, `Αφαίρεση του/της ${person.displayName} από τη σύγκριση`)} variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => remove(person.userId)}>
                        <X className="icon-sm" aria-hidden="true" />
                      </Button>
                      <div className="flex items-start gap-3 pr-8">
                        <Avatar className="h-11 w-11 shrink-0">
                          <AvatarImage src={person.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary-accessible">{initialsOf(person.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link href={`/profiles/${person.userId}`} className="font-semibold text-foreground hover:text-primary-accessible">
                            {person.displayName}
                          </Link>
                          <div className="mt-1"><RoleBadge role={person.role} size="sm" /></div>
                          {person.headline ? <p className="mt-1 text-xs text-muted-foreground">{person.headline}</p> : null}
                          {person.location ? <p className="text-xs text-muted-foreground">{person.location}</p> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="page-stat text-2xl font-semibold tabular-nums text-primary-accessible">{scoreOf(i) ?? '—'}%</span>
                        {overallLeader === i && (
                          <Badge variant="success" size="sm" className="gap-1"><Crown className="h-3 w-3" aria-hidden="true" /><BilingualText en="Highest" el="Υψηλότερη" compact /></Badge>
                        )}
                      </div>
                      {breakdowns[i]?.overall.confidence != null && (
                        <p className="text-xs text-muted-foreground">{breakdowns[i]?.overall.confidence}% confidence</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <MessageButton userId={person.userId} displayName={person.displayName} variant="default" className="flex-1" />
                        <ConnectButton userId={person.userId} displayName={person.displayName} variant="outline" className="flex-1" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.map(([key, label]) => {
                  const values = people.map((_, i) => axisScore(i, key));
                  const lead = leaderOf(values);
                  return (
                    <tr key={key} className="border-t border-border">
                      <th scope="row" className="p-4 text-left text-xs font-medium text-muted-foreground"><BilingualText en={label} el={matchAxisEl(label)} compact wrap /></th>
                      {values.map((value, i) => (
                        <td key={people[i].userId} className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <span className={cn('block h-full rounded-full', lead === i ? 'bg-status-success-mark' : 'bg-primary/60')} style={{ width: `${value ?? 0}%` }} />
                            </span>
                            <span className={cn('w-10 text-right tabular-nums', lead === i ? 'font-semibold text-status-success' : 'text-muted-foreground')}>
                              {value == null ? '—' : `${value}%`}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-border">
                  <th scope="row" className="p-4 text-left align-top text-xs font-medium text-muted-foreground"><BilingualText en="Skills" el="Δεξιότητες" compact /></th>
                  {people.map((person) => (
                    <td key={person.userId} className="p-4 align-top">
                      <FactLine className="text-sm text-foreground" items={(person.skillNames.length ? person.skillNames : person.skills ?? []).slice(0, 6)} />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <th scope="row" className="p-4 text-left align-top text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Check className="icon-sm text-status-success" aria-hidden="true" /><BilingualText en="Strengths" el="Δυνατά σημεία" compact /></span>
                  </th>
                  {people.map((person, i) => (
                    <td key={person.userId} className="p-4 align-top">
                      <ul className="space-y-1.5 text-muted-foreground">
                        {(breakdowns[i]?.sharedStrengths ?? []).slice(0, 4).map((s) => <li key={s}>{s}</li>)}
                        {!breakdownQueries[i]?.isLoading && !(breakdowns[i]?.sharedStrengths ?? []).length && <li>{'—'}</li>}
                      </ul>
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <th scope="row" className="p-4 text-left align-top text-xs font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Minus className="icon-sm text-status-warning" aria-hidden="true" /><BilingualText en="Considerations" el="Επιφυλάξεις" compact /></span>
                  </th>
                  {people.map((person, i) => (
                    <td key={person.userId} className="p-4 align-top">
                      <ul className="space-y-1.5 text-muted-foreground">
                        {(breakdowns[i]?.frictionPoints ?? []).slice(0, 4).map((s) => <li key={s}>{s}</li>)}
                        {!breakdownQueries[i]?.isLoading && !(breakdowns[i]?.frictionPoints ?? []).length && <li>{'—'}</li>}
                      </ul>
                    </td>
                  ))}
                </tr>
                {people.some((p) => p.availability || p.lookingFor) && (
                  <tr className="border-t border-border">
                    <th scope="row" className="p-4 text-left align-top text-xs font-medium text-muted-foreground"><BilingualText en="Availability" el="Διαθεσιμότητα" compact /></th>
                    {people.map((person) => (
                      <td key={person.userId} className="p-4 align-top text-muted-foreground">
                        {[person.availability, person.lookingFor].filter(Boolean).join(' · ') || '—'}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {people.length >= 2 && (
          <SectionCard title="What the comparison says" titleEl="Τι λέει η σύγκριση" icon={Brain}>
            <p className="text-sm text-muted-foreground">
              <BilingualText en={summary.en} el={summary.el} wrap />
            </p>
            {overallLeader >= 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                <MessageButton userId={people[overallLeader].userId} displayName={people[overallLeader].displayName} variant="default" size="md" />
                <Button asChild variant="outline" size="md">
                  <Link href={`/matches/${people[overallLeader].userId}`}>
                    <Target className="mr-2 icon-sm" aria-hidden="true" />
                    <BilingualText en="View full analysis" el="Πλήρης ανάλυση" compact />
                  </Link>
                </Button>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}
