'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, MoreVertical, AlertTriangle, Bookmark, Send,
  Clock, TrendingUp, CheckCircle, Info, Sparkles, MessageCircle,
  Link as LinkIcon, UserRound, ListChecks, Activity, ThumbsUp,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { settle, usePageControls, type PageControlRunResult } from '@/lib/page-controls';
import { cn, initialsOf } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/dashboard/SectionCard';
import {
  getMatchVs, recordMatchFeedback, recordBehavioralSignal, sendConnectionRequest,
  saveToShortlist, removeFromShortlist, getShortlistIds,
  type MatchVsResult, type MatchVsBreakdownItem,
} from '@/lib/api';

// ── Factor Row ────────────────────────────────────────────────────────────────

function FactorRow({ item }: { item: MatchVsBreakdownItem }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{item.label}</span>
        <span className="font-semibold tabular-nums text-foreground">{item.score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%`, background: item.color }} />
      </div>
    </div>
  );
}

// ── Friction Icon helper ───────────────────────────────────────────────────────

function FrictionIcon({ icon }: { icon: string }) {
  const cls = 'icon-sm';
  if (icon === 'schedule') return <Clock className={cls} aria-hidden="true" />;
  if (icon === 'trending_up') return <TrendingUp className={cls} aria-hidden="true" />;
  return <AlertTriangle className={cls} aria-hidden="true" />;
}

// ── Work Style — smooth SVG line chart ────────────────────────────────────────

function WorkStyleLineChart({ data }: { data: MatchVsResult['workStyle'] }) {
  const { axes, source, target } = data;
  const n = axes.length;
  const W = 300, H = 160;
  const PAD = { top: 14, bottom: 30, left: 10, right: 10 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const xAt = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const yAt = (v: number) => PAD.top + cH - (Math.min(Math.max(v, 0), 100) / 100) * cH;

  const smoothPath = (vals: number[]) => {
    if (!vals.length) return '';
    if (vals.length === 1) return `M ${xAt(0)} ${yAt(vals[0])}`;
    const pts = vals.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
      d += ` C ${cpx} ${pts[i - 1][1]}, ${cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
    }
    return d;
  };

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }} role="img" aria-label="Work style: yours against your match's">
        {[0, 25, 50, 75, 100].map((pct) => (
          <line key={pct} x1={PAD.left} y1={yAt(pct)} x2={W - PAD.right} y2={yAt(pct)} stroke="hsl(var(--border))" strokeWidth={1} />
        ))}
        <path d={smoothPath(source)} fill="none" stroke="hsl(var(--status-success-mark))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothPath(target)} fill="none" stroke="hsl(var(--status-info-mark))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {source.map((v, i) => <circle key={`s${i}`} cx={xAt(i)} cy={yAt(v)} r={3.5} fill="hsl(var(--status-success-mark))" />)}
        {target.map((v, i) => <circle key={`t${i}`} cx={xAt(i)} cy={yAt(v)} r={3.5} fill="hsl(var(--status-info-mark))" />)}
        {axes.map((axis, i) => (
          <text key={axis} x={xAt(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
            {axis}
          </text>
        ))}
      </svg>
      <figcaption className="mt-3 flex justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded-full bg-status-success-mark" aria-hidden="true" />You</span>
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded-full bg-status-info-mark" aria-hidden="true" />Match</span>
      </figcaption>
    </figure>
  );
}

// ── Donut Score ───────────────────────────────────────────────────────────────

function DonutScore({ score }: { score: number }) {
  const r = 38, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 104, height: 104 }} role="img" aria-label={`${score}% match`}>
      <svg width={104} height={104} viewBox="0 0 100 100" aria-hidden="true">
        {/* The track was a literal #333333, invisible on the dark card and
            heavy on the light one; it is the muted token now. */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold-track))" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold))" strokeWidth={3}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transformOrigin: '50px 50px', transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" aria-hidden="true">
        <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">{score}%</span>
        <span className="text-2xs font-medium text-muted-foreground">match</span>
      </div>
    </div>
  );
}

function PersonBlock({ name, role, avatarUrl, href, accent }: { name: string; role: string; avatarUrl?: string | null; href?: string; accent?: boolean }) {
  const avatar = (
    <Avatar className={cn('h-16 w-16 rounded-2xl ring-2', accent ? 'ring-primary/60' : 'ring-border')}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback className={cn('rounded-2xl text-base font-semibold', accent ? 'bg-primary/10 text-primary-accessible' : 'bg-muted')}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {href ? <Link href={href} className="rounded-2xl focus-ring">{avatar}</Link> : avatar}
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="text-sm font-semibold text-foreground hover:text-primary-accessible">{name}</Link>
        ) : (
          <p className="text-sm font-semibold text-foreground">{name}</p>
        )}
        <p className="text-xs capitalize text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 py-8 space-y-6">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const targetUserId = params?.userId as string;
  // Whether this person is already shortlisted. It was set from an
  // `onSuccess` option, which TanStack Query v5 no longer calls, so the page
  // said "Shortlist" for people already on the list. The server answer is
  // the default; a click overrides it until the next read.
  const { data: shortlistData } = useQuery({
    queryKey: qk('shortlist', 'ids'),
    queryFn: getShortlistIds,
    staleTime: 60_000,
  });
  const [shortlistOverride, setShortlistOverride] = useState<boolean | null>(null);
  const shortlisted = shortlistOverride ?? Boolean(shortlistData?.ids?.includes(targetUserId));
  const setShortlisted = (value: boolean) => setShortlistOverride(value);

  const { data, isLoading, isError } = useQuery({
    queryKey: qk('matching', 'vs', targetUserId),
    queryFn: () => getMatchVs(targetUserId),
    enabled: !!targetUserId,
  });

  const connectMutation = useMutation({
    mutationFn: (msg: string) => sendConnectionRequest({ receiverId: targetUserId, message: msg }),
    onSuccess: () => {
      addToast({ title: 'Collaboration request sent', type: 'success' });
      recordBehavioralSignal({ signalType: 'connection_request', targetId: targetUserId, targetType: 'user', value: 2 }).catch(() => {});
    },
    onError: () => addToast({ title: 'Could not send request', type: 'error' }),
  });

  const handleShortlist = async (): Promise<PageControlRunResult> => {
    const nextState = !shortlisted;
    setShortlisted(nextState);
    try {
      if (nextState) {
        await saveToShortlist(targetUserId);
        recordBehavioralSignal({ signalType: 'shortlist', targetId: targetUserId, targetType: 'user', value: 1 }).catch(() => {});
      } else {
        await removeFromShortlist(targetUserId);
      }
      addToast({ title: nextState ? 'Saved to shortlist' : 'Removed from shortlist', type: 'info' });
    } catch (err) {
      setShortlisted(!nextState);
      addToast({ title: 'Could not update shortlist', type: 'error' });
      return { error: err instanceof Error && err.message ? err.message : 'Your shortlist did not change.' };
    }
  };

  // The match feedback says a connection started, so it is filed only once
  // the request has actually been sent.
  const handlePropose = async (): Promise<PageControlRunResult> => {
    const result = await settle(() =>
      connectMutation.mutateAsync('Hi, I came across your profile and I think we could be a strong match. I would love to connect and explore potential collaboration.'),
    );
    if (!result) recordMatchFeedback({ targetUserId, feedback: 'accepted', connectionStarted: true }).catch(() => {});
    return result;
  };

  /*
   * Shortlist, propose and copy, offered to the assistant. Saving is undone
   * by removing (the shortlist_add declaration: `deleteMany`, nobody told);
   * removing names no undo because it drops the entry's private note.
   */
  usePageControls([
    {
      id: 'save_to_shortlist',
      labelEn: 'Save this person to my shortlist',
      labelEl: 'Αποθήκευση στα αποθηκευμένα προφίλ',
      writes: true,
      unavailableEn: shortlisted ? 'Already on your shortlist.' : undefined,
      unavailableEl: shortlisted ? 'Είναι ήδη στα αποθηκευμένα προφίλ σας.' : undefined,
      undo: () => ({ control: 'remove_from_shortlist' }),
      run: () => (shortlisted ? undefined : handleShortlist()),
    },
    {
      id: 'remove_from_shortlist',
      labelEn: 'Remove this person from my shortlist',
      labelEl: 'Αφαίρεση από τα αποθηκευμένα προφίλ',
      writes: true,
      unavailableEn: !shortlisted ? 'Not on your shortlist.' : undefined,
      unavailableEl: !shortlisted ? 'Δεν είναι στα αποθηκευμένα προφίλ σας.' : undefined,
      run: () => (shortlisted ? handleShortlist() : undefined),
    },
    {
      id: 'propose_collaboration',
      labelEn: 'Send a collaboration request',
      labelEl: 'Αποστολή αιτήματος συνεργασίας',
      writes: true,
      unavailableEn: connectMutation.isSuccess ? 'The request was sent.' : undefined,
      unavailableEl: connectMutation.isSuccess ? 'Το αίτημα στάλθηκε.' : undefined,
      run: handlePropose,
    },
    {
      id: 'copy_match_link',
      labelEn: 'Copy the link to this comparison',
      labelEl: 'Αντιγραφή συνδέσμου σύγκρισης',
      writes: false,
      run: async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          addToast({ type: 'success', title: bilingualInline('Link copied', 'Ο σύνδεσμος αντιγράφηκε') });
        } catch {
          addToast({ type: 'error', title: bilingualInline('Could not copy the link', 'Δεν αντιγράφηκε ο σύνδεσμος') });
        }
      },
    },
  ]);

  if (isLoading) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  // The whole render below dereferences these unconditionally, so a 200 with a
  // partial body has to take the same path as an outright failure.
  //
  // Guard `overall.score`, not `overall`. `overall` is { score, confidence }
  // (see MatchCompatibility in lib/api.ts), so an earlier `typeof data?.overall
  // !== 'number'` was true for every well-formed response — it sent the page to
  // "Could not load compatibility data." always, and narrowed `overall` to
  // `never`, which is where the three type errors came from.
  if (
    isError ||
    typeof data?.overall?.score !== 'number' ||
    !data.sourceProfile ||
    !data.targetProfile
  ) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Info className="icon-xl text-muted-foreground" />
          <p className="text-muted-foreground"><BilingualText en="Could not load compatibility data." el="Τα στοιχεία συμβατότητας δεν φορτώθηκαν." compact wrap /></p>
          <Button variant="outline" onClick={() => router.back()}><BilingualText en="Go Back" el="Επιστροφή" compact /></Button>
        </div>
      </AppShell>
    );
  }

  const { overall, breakdown, badges, sharedStrengths, frictionPoints, workStyle, targetProfile, sourceProfile } = data;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast({ type: 'success', title: bilingualInline('Link copied', 'Ο σύνδεσμος αντιγράφηκε') });
    } catch {
      addToast({ type: 'error', title: bilingualInline('Could not copy the link', 'Δεν αντιγράφηκε ο σύνδεσμος') });
    }
  };

  /*
   * The product's layout, not a page of its own. This screen had a second
   * header bar in monospace, section labels in spaced monospace capitals
   * ("01. CORE COMPATIBILITY"), a 42rem column in the middle of the page, and
   * an action bar fixed to the bottom of the window across the sidebar -
   * over the phone's bottom navigation, too. The actions now sit in the
   * header row, the sections use the shared header, and the evidence reads
   * in two columns beside the summary.
   */
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="icon-md" aria-hidden="true" />
          </Button>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <BilingualText en={`You and ${targetProfile.displayName}`} el={`Εσείς και ${targetProfile.displayName}`} />
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleShortlist()} aria-pressed={shortlisted}>
            <Bookmark className={cn('icon-sm', shortlisted && 'fill-current text-status-warning')} aria-hidden="true" />
            {shortlisted ? <BilingualText en="Saved" el="Αποθηκεύτηκε" compact /> : <BilingualText en="Shortlist" el="Λίστα" compact />}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href={`/messages?to=${targetUserId}`}>
              <MessageCircle className="icon-sm" aria-hidden="true" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => void handlePropose()} disabled={connectMutation.isPending}>
            <Send className="icon-sm" aria-hidden="true" />
            <BilingualText en="Collaborate" el="Συνεργασία" compact />
          </Button>
          {/* Hand someone the link, or open the full profile. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={bilingualAria('More options', 'Περισσότερες επιλογές')}>
                <MoreVertical className="icon-md" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void copyLink()}>
                <LinkIcon className="mr-2 icon-sm" />
                <BilingualText en="Copy link" el="Αντιγραφή συνδέσμου" compact />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/profiles/${targetUserId}`}>
                  <UserRound className="mr-2 icon-sm" />
                  <BilingualText en="Open full profile" el="Άνοιγμα πλήρους προφίλ" compact />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Summary: the two of you, the score between you, how sure it is. A
            chart card (two marks and a donut), so it stays centred. */}
        <div data-card-chart="" className="rounded-2xl border border-border bg-card px-4 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <PersonBlock name={sourceProfile.displayName} role={sourceProfile.role} avatarUrl={sourceProfile.avatarUrl} />
            <DonutScore score={overall.score} />
            <PersonBlock name={targetProfile.displayName} role={targetProfile.role} avatarUrl={targetProfile.avatarUrl} href={`/profiles/${targetProfile.id}`} accent />
          </div>
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <p className="text-xs text-muted-foreground">
              <BilingualText en={`${overall.confidence}% confidence`} el={`${overall.confidence}% βεβαιότητα`} />
            </p>
            <div className="h-1 w-32 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-muted-foreground/60" style={{ width: `${overall.confidence}%` }} />
            </div>
          </div>
          {badges.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {badges.map((b) => (
                <Badge key={b} variant="info" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" />{b}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="Core compatibility" titleEl="Βασική συμβατότητα" icon={ListChecks} contentClassName="space-y-4">
              {breakdown.map((item) => <FactorRow key={item.key} item={item} />)}
            </SectionCard>
            <SectionCard title="Work style overlap" titleEl="Στυλ εργασίας" icon={Activity}>
              <WorkStyleLineChart data={workStyle} />
            </SectionCard>
          </div>
          <div className="space-y-6">
            {data.reasons.length > 0 && (
              <SectionCard title="Why this match" titleEl="Γιατί ταιριάζετε" icon={ThumbsUp} contentClassName="space-y-3">
                {data.reasons.map((r) => (
                  <p key={r} className="card-body flex items-start gap-2.5 text-muted-foreground">
                    <CheckCircle className="mt-0.5 icon-sm shrink-0 text-status-success" aria-hidden="true" />
                    <span>{r}</span>
                  </p>
                ))}
              </SectionCard>
            )}
            {sharedStrengths.length > 0 && (
              <SectionCard title="Shared strengths" titleEl="Κοινά δυνατά σημεία">
                <div className="flex flex-wrap gap-2">
                  {sharedStrengths.map((st) => (
                    <Badge key={st.label} variant="success" className="gap-1">
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      {st.label}
                    </Badge>
                  ))}
                </div>
              </SectionCard>
            )}
            {frictionPoints.length > 0 && (
              <SectionCard title="Potential friction" titleEl="Πιθανές τριβές" icon={AlertTriangle} contentClassName="space-y-3">
                {frictionPoints.map((point) => (
                  <div key={point.title} className="flex gap-3 rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
                    <span className="mt-0.5 shrink-0 text-status-warning"><FrictionIcon icon={point.icon} /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-status-warning">{point.title}</p>
                      <p className="card-body text-foreground">{point.description}</p>
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
