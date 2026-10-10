'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, ArrowRight, UserPlus, ArrowUpDown, RefreshCw, BarChart3, Award, Zap, ChevronRight,
  X, LayoutGrid, List, Search, MapPin, Briefcase, GraduationCap, DollarSign, Users,
  Bookmark, BookmarkCheck, MessageCircle, Heart, RotateCcw, SlidersHorizontal, Clock,
  TrendingUp, Star, CheckCircle2, CheckSquare,
} from 'lucide-react';
import { getRecommendations, getMatchBreakdown, sendConnectionRequest, saveToShortlist, removeFromShortlist, recordMatchFeedback, getShortlistIds, type SearchHit } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { MatchCard } from '@/components/common/MatchCard';
import type { CommitmentStep } from '@cofounderbay/shared';
import { StepChip } from '@/components/commitments/OutcomeChip';
import { listCommitmentThreads } from '@/lib/commitments-api';
import { RoleBadge } from '@/components/common/RoleBadge';
import { StatusText } from '@/components/common/StatusText';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { useIsAuthenticated } from '@/hooks/useIsAuthenticated';
import { ProfileCardSkeleton } from '@/components/discover/ProfileCard';
import { BilingualText } from '@/components/common/BilingualText';
import { matchesEn, matchesEl } from '@/lib/i18n/strings-matches';
import { bilingualAria } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import type { ProfileCardData } from '@/components/discover/ProfileCard';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';

const MATCHES_TOUR: TourStep[] = [
  {
    target: 'matches-stats',
    titleEn: 'Your match summary',
    titleEl: 'Η σύνοψη των αντιστοιχίσεών σας',
    bodyEn: 'Total matches, how many score 80%+ ("excellent"), and your average and top score. These count every match, not just the ones shown after filtering.',
    bodyEl: 'Σύνολο αντιστοιχίσεων, πόσες έχουν 80%+ («εξαιρετικές») και η μέση και κορυφαία βαθμολογία σας. Μετρούν όλες τις αντιστοιχίσεις, όχι μόνο όσες φαίνονται μετά το φιλτράρισμα.',
  },
  {
    target: 'matches-tiers',
    titleEn: 'Filter by match tier',
    titleEl: 'Φίλτρο ανά επίπεδο ταιριάσματος',
    bodyEn: 'Tap a tier to see only excellent, strong, or good matches. Tap it again to clear. Role, location and availability filters live in the page tools on the right.',
    bodyEl: 'Πατήστε ένα επίπεδο για να δείτε μόνο εξαιρετικές, ισχυρές ή καλές αντιστοιχίσεις. Πατήστε ξανά για καθαρισμό. Τα φίλτρα ρόλου, τοποθεσίας και διαθεσιμότητας είναι στα εργαλεία σελίδας δεξιά.',
  },
  {
    target: 'matches-toolbar',
    titleEn: 'Select, search, and change the view',
    titleEl: 'Επιλογή, αναζήτηση και αλλαγή προβολής',
    bodyEn: 'Select mode lets you pick two profiles and compare them side by side. Search finds a name, headline or skill. The view switch toggles grid or list.',
    bodyEl: 'Η λειτουργία επιλογής σάς αφήνει να διαλέξετε δύο προφίλ και να τα συγκρίνετε δίπλα-δίπλα. Η αναζήτηση βρίσκει όνομα, τίτλο ή δεξιότητα. Ο διακόπτης προβολής αλλάζει πλέγμα ή λίστα.',
  },
  {
    target: 'matches-grid',
    titleEn: 'Read "Why you match" before reaching out',
    titleEl: 'Διαβάστε το «Γιατί ταιριάζετε» πριν επικοινωνήσετε',
    bodyEn: 'Each card shows the score and the reasons behind it. Use Connect to send a request, Save to keep the profile for later, or Pass to hide it — Pass can be undone.',
    bodyEl: 'Κάθε κάρτα δείχνει τη βαθμολογία και τους λόγους πίσω από αυτή. Με Σύνδεση στέλνετε αίτημα, με Αποθήκευση κρατάτε το προφίλ για αργότερα, με Παράλειψη το κρύβετε — η Παράλειψη αναιρείται.',
  },
];

const ConnectionRequestDialog = dynamic(() => import('@/components/common/ConnectionRequest').then((m) => ({ default: m.ConnectionRequestDialog })), { ssr: false });
const MatchCompatibilityChart = dynamic(
  () => import('@/components/charts/MatchCompatibilityChart').then((m) => ({ default: m.MatchCompatibilityChart })),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-lg" /> }
);

type MatchReason = { type: 'skills' | 'location' | 'stage' | 'industry' | 'availability' | 'values'; text: string; score: number };

/*
 * The five axes on this radar used to be one score nudged by fixed percentages
 * — +8% became "Skills", -15% became "Location" — which drew a shape that
 * looked measured and was arithmetic on a single number. The matching engine
 * already scores six real dimensions (`GET /api/recommendations/vs/:id`, the
 * same computation that ranks these very cards), so the chart reads those. If
 * the breakdown cannot be fetched the chart is absent, not invented.
 */

function CompatibilityModal({ hit, open, onClose }: { hit: SearchHit | null; open: boolean; onClose: () => void }) {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: qk('matching', 'breakdown', hit?.userId),
    queryFn: () => getMatchBreakdown(hit!.userId),
    enabled: open && Boolean(hit?.userId),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  if (!hit) return null;

  // The engine's own overall score when it answered; the list score otherwise.
  const score = detail?.overall.score ?? hit.matchScore ?? 50;
  const confidence = detail?.overall.confidence ?? null;
  const dims = detail?.breakdown.map((axis) => ({
    subject: axis.label,
    value: axis.score,
    fullMark: 100,
  })) ?? null;
  const reasonTexts = detail?.reasons?.length ? detail.reasons : (hit.matchReasons ?? []);
  const reasons: MatchReason[] = reasonTexts.map((t) => ({ type: 'skills' as const, text: t, score: 0 }));
  const strengths = detail?.sharedStrengths ?? [];
  const frictions = detail?.frictionPoints ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[min(90dvh,calc(100svh-2rem))] max-w-md overflow-y-auto max-md:top-[max(0.5rem,env(safe-area-inset-top))] max-md:translate-y-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="icon-md text-muted-foreground" />
            <BilingualText en={`${matchesEn('compatibility_with')} ${hit.displayName}`} el={`${matchesEl('compatibility_with')} ${hit.displayName}`} />
          </DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Compatibility score, dimensions and reasons for this match." el="Βαθμός συμβατότητας, διαστάσεις και λόγοι για αυτή την αντιστοίχιση." /></DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 rounded-xl bg-primary/8 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-primary-accessible">{score}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <BilingualText en={matchesEn('overall_match')} el={matchesEl('overall_match')} />
            </p>
            {confidence != null && (
              <p className="mt-1 text-2xs tabular-nums text-muted-foreground/80">
                {confidence}%{' '}
                <BilingualText en={matchesEn('match_confidence')} el={matchesEl('match_confidence')} compact />
              </p>
            )}
          </div>
        </div>

        {dims ? (
          <MatchCompatibilityChart dims={dims} />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            <BilingualText
              en={detailLoading ? matchesEn('breakdown_loading') : matchesEn('breakdown_unavailable')}
              el={detailLoading ? matchesEl('breakdown_loading') : matchesEl('breakdown_unavailable')}
            />
          </p>
        )}

        {strengths.length > 0 && (
          <div className="rounded-lg border border-border bg-status-success-bg/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BilingualText en={matchesEn('shared_strengths')} el={matchesEl('shared_strengths')} />
            </p>
            {strengths.map((t) => (
              <p key={t} className="text-sm text-foreground">{t}</p>
            ))}
          </div>
        )}

        {frictions.length > 0 && (
          <div className="rounded-lg border border-border bg-status-warning-bg/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BilingualText en={matchesEn('watch_outs')} el={matchesEl('watch_outs')} />
            </p>
            {frictions.map((t) => (
              <p key={t} className="text-sm text-foreground">{t}</p>
            ))}
          </div>
        )}

        {reasons.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <BilingualText en={matchesEn('why_you_match')} el={matchesEl('why_you_match')} />
            </p>
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Zap className="icon-sm text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function hitToProfile(hit: SearchHit): ProfileCardData {
  return {
    id: hit.id,
    userId: hit.userId,
    displayName: hit.displayName,
    headline: hit.headline,
    bio: hit.bio,
    avatarUrl: hit.avatarUrl,
    role: hit.role,
    location: hit.location,
    skills: hit.skillNames ?? [],
    matchScore: hit.matchScore,
    lookingFor: hit.lookingFor,
    availability: hit.availability,
  };
}

type FilterKey = 'all' | 'excellent' | 'strong' | 'good' | 'potential';
type RoleFilter = 'all' | 'founder' | 'mentor' | 'investor' | 'org';
type SortKey = 'score' | 'name' | 'recent';
type AvailFilter = 'full_time' | 'part_time' | 'advisory' | 'contract';
type ViewMode = 'grid2' | 'grid3' | 'list';

type MatchTier = 'excellent' | 'strong' | 'good' | 'potential';

const MATCH_TIER_TONE: Record<MatchTier, StatusTone> = {
  excellent: 'success',
  strong: 'info',
  good: 'warning',
  potential: 'danger',
};

const TIER_STROKE: Record<MatchTier, string> = {
  excellent: 'hsl(var(--status-success-mark))',
  strong: 'hsl(var(--status-info-mark))',
  good: 'hsl(var(--status-warning-mark))',
  potential: 'hsl(var(--status-danger-mark))',
};

const TIER_DOT: Record<MatchTier, string> = {
  excellent: 'bg-status-success-mark',
  strong: 'bg-status-info-mark',
  good: 'bg-status-warning-mark',
  potential: 'bg-status-danger-mark',
};

function tierStyle(tier: MatchTier) {
  return STATUS[MATCH_TIER_TONE[tier]];
}

function getTier(score: number): MatchTier {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'strong';
  if (score >= 45) return 'good';
  return 'potential';
}

function roleMatchesFilter(role: string, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  const r = role.toLowerCase();
  if (filter === 'founder') return r.includes('founder') || r === 'technical_talent' || r === 'operator';
  if (filter === 'mentor') return r === 'mentor' || r === 'advisor' || r === 'coach';
  if (filter === 'investor') return r.includes('investor') || r === 'vc_analyst' || r === 'vc_scout' || r === 'angel_investor';
  if (filter === 'org') return r.includes('org') || r.includes('admin') || r === 'community_manager';
  return true;
}

/* ── List-view row component ─────────────────────────────────────────────── */
function MatchListRow({
  hit,
  matchReasons,
  isSaved,
  onConnect,
  onMessage,
  onPass,
  onSave,
  onBreakdown,
  commitment,
}: {
  hit: SearchHit;
  matchReasons: MatchReason[];
  isSaved: boolean;
  commitment?: { step: CommitmentStep; href: string } | null;
  onConnect: () => void;
  onMessage: () => void;
  onPass: () => void;
  onSave: () => void;
  onBreakdown: () => void;
}) {
  const score = hit.matchScore ?? 50;
  const tier = getTier(score);
  const colors = tierStyle(tier);
  const stroke = TIER_STROKE[tier];
  const initials = hit.displayName.slice(0, 2).toUpperCase();
  const circ = 2 * Math.PI * 23;

  // The Connections card in a row: the score ring around the person's circle
  // is the mark (2.5rem, as every card's), the name and headline beside it,
  // the tier at the right; skills, reasons and the foot on the ring's edge.
  return (
    <Card className="shadow-sm border-border hover:border-primary/30 transition-all group">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div data-card-mark="" className="relative h-10 w-10 shrink-0">
              <svg viewBox="0 0 52 52" className="absolute inset-0 h-10 w-10" aria-hidden="true">
                <circle cx={26} cy={26} r={23} fill="none" stroke="hsl(var(--border))" strokeWidth={3} />
                <circle cx={26} cy={26} r={23} fill="none" stroke={stroke} strokeWidth={3}
                  strokeDasharray={`${(score / 100) * circ} ${circ}`}
                  strokeDashoffset={circ * 0.25}
                  strokeLinecap="round" />
              </svg>
              <Link href={`/profiles/${hit.userId}`} className="absolute inset-1 rounded-full" aria-label={bilingualAria(`Open ${hit.displayName}'s profile`, `Άνοιγμα προφίλ: ${hit.displayName}`)}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={hit.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </Link>
            </div>
          )}
          title={(
            <Link href={`/profiles/${hit.userId}`} className="transition-colors hover:text-primary-accessible">
              {hit.displayName}
            </Link>
          )}
          subtitle={hit.headline ? <span className="line-clamp-1">{hit.headline}</span> : undefined}
          // The place, and where a commitment stands, on the title's edge;
          // the tier is the head's one pill at the right.
          meta={(hit.location || commitment) ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {hit.location ? <span>{hit.location}</span> : null}
              {commitment ? (
                <Link href={commitment.href} className="inline-flex rounded-full"><StepChip step={commitment.step} /></Link>
              ) : null}
            </span>
          ) : undefined}
          aside={(
            <Badge variant="outline" className={cn('border text-xs tabular-nums', colors.chip)}>
              <BilingualText en={`${matchesEn(`tier_${tier}` as const)} · ${score}%`} el={`${matchesEl(`tier_${tier}` as const)} · ${score}%`} compact />
            </Badge>
          )}
        />

        {/* Skills and reasons: facts on the ring's edge. */}
        {((hit.skillNames ?? []).length > 0 || matchReasons.length > 0) && (
          <div className="space-y-1">
            <FactLine
              items={[...(hit.skillNames ?? []).slice(0, 5), (hit.skillNames ?? []).length > 5 ? `+${(hit.skillNames ?? []).length - 5}` : null]}
            />
            <FactLine
              label={bilingualAria('Why you match', 'Γιατί ταιριάζετε')}
              items={matchReasons.slice(0, 3).map((r) => r.text)}
            />
          </div>
        )}

        {/* Foot: pass and save at the left, the next steps at the right. */}
        <CardFoot
          meta={(
            <div className="flex items-center gap-1.5">
              <button onClick={onPass}
                className="flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive-accessible sm:w-auto sm:px-3"
                aria-label={`Pass on ${hit.displayName}`}>
                <X className="icon-sm" />
                <span className="hidden sm:inline text-xs"><BilingualText en="Pass" el="Παράβλεψη" compact /></span>
              </button>
              <button onClick={onSave}
                className={cn('flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-border transition-colors sm:w-auto sm:px-3', isSaved ? STATUS.warning.icon : 'text-muted-foreground hover:text-status-warning')}
                aria-pressed={isSaved}
                aria-label={isSaved ? `${hit.displayName} is on your shortlist` : `Save ${hit.displayName} to your shortlist`}>
                {isSaved ? <BookmarkCheck className="icon-sm" /> : <Bookmark className="icon-sm" />}
                <span className="hidden sm:inline text-xs"><BilingualText en={isSaved ? 'Saved' : 'Save'} el={isSaved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact /></span>
              </button>
            </div>
          )}
        >
          <Button size="sm" variant="ghost" onClick={onBreakdown} className="gap-1.5 text-muted-foreground hover:text-primary-accessible">
            <BarChart3 className="icon-sm" /> <BilingualText en="Breakdown" el="Ανάλυση" compact />
          </Button>
          <Button size="sm" variant="outline" onClick={onMessage} className="gap-1.5">
            <MessageCircle className="icon-sm" /> <BilingualText en="Message" el="Μήνυμα" compact />
          </Button>
          <Button size="sm" onClick={onConnect} className="gap-1.5">
            <Heart className="icon-sm" /> <BilingualText en="Connect" el="Σύνδεση" compact />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

/* ── Match Preview Panel ─────────────────────────────────────────────────── */
function MatchPreviewPanel({
  hit, matchReasons, savedIds, onClose, onConnect, onMessage, onSave, onPass, onBreakdown,
}: {
  hit: SearchHit;
  matchReasons: MatchReason[];
  savedIds: Set<string>;
  onClose: () => void;
  onConnect: () => void;
  onMessage: () => void;
  onSave: () => void;
  onPass: () => void;
  onBreakdown: () => void;
}) {
  const score = hit.matchScore ?? 50;
  const tier = getTier(score);
  const colors = tierStyle(tier);
  const isSaved = savedIds.has(hit.userId);

  return (
    <>
      {/* Backdrop (mobile) */}
      <div aria-hidden="true" className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />

      {/* Slide panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[360px] overflow-y-auto border-l border-border bg-card shadow-modal animate-in slide-in-from-right duration-200 max-md:max-w-none">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm">
          <p className="text-sm font-semibold"><BilingualText en="Profile Preview" el="Προεπισκόπηση προφίλ" compact /></p>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground" aria-label="Close preview">
            <X className="icon-sm" />
          </button>
        </div>

        <div className="space-y-4 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {/* The person, set as every card's head: circle, name with its
              role, headline; the score at the right. */}
          <CardHead
            mark={(
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={hit.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="bg-muted text-sm font-semibold">
                  {hit.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            title={(
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {hit.displayName}
                <RoleBadge role={hit.role} size="sm" showIcon />
              </span>
            )}
            subtitle={hit.headline ? <span className="line-clamp-3">{hit.headline}</span> : undefined}
            asideStays
            aside={(
              <span className="flex flex-col items-end">
                <span className={cn('card-body font-semibold tabular-nums', colors.icon)}>{score}%</span>
                <span className={cn('text-xs font-medium', colors.icon)}>
                  <BilingualText en={matchesEn(`tier_${tier}` as const)} el={matchesEl(`tier_${tier}` as const)} compact />
                </span>
              </span>
            )}
          />

          {/* Place and availability: facts, not pills. */}
          <FactLine items={[hit.location, hit.availability ? <StatusText key="availability" value={hit.availability} /> : null]} />

          {/* Skills */}
          {(hit.skillNames ?? []).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground"><BilingualText en="Skills" el="Δεξιότητες" compact /></p>
              <FactLine className="text-foreground" items={hit.skillNames ?? []} />
            </div>
          )}

          {/* Match reasons */}
          {matchReasons.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground"><BilingualText en="Why you match" el="Γιατί ταιριάζετε" compact /></p>
              <ul className="space-y-1">
                {matchReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TIER_DOT[tier])} aria-hidden="true" />
                    <span className="min-w-0 first-letter:uppercase">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" size="sm" onClick={onConnect}>
                <UserPlus className="icon-sm" /> <BilingualText en="Connect" el="Σύνδεση" compact />
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5" size="sm" onClick={onMessage}>
                <MessageCircle className="icon-sm" /> <BilingualText en="Message" el="Μήνυμα" compact />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onSave}>
                {isSaved ? <BookmarkCheck className={cn('icon-sm', STATUS.warning.icon)} /> : <Bookmark className="icon-sm" />}
                <BilingualText en={isSaved ? 'Saved' : 'Save'} el={isSaved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact />
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 hover:text-destructive-accessible" onClick={onPass}>
                <X className="icon-sm" /> <BilingualText en="Pass" el="Παράλειψη" compact />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={onBreakdown}>
              <BarChart3 className="icon-sm" /> <BilingualText en="View breakdown" el="Προβολή ανάλυσης" compact />
            </Button>
            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" asChild>
              <Link href={`/profiles/${hit.userId}`}>
                <ArrowRight className="icon-sm" /> <BilingualText en="Full profile" el="Πλήρες προφίλ" compact />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  /* ── UI state ── */
  const [connectionTarget, setConnectionTarget] = useState<ProfileCardData | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [viewMode, setViewMode] = useState<ViewMode>('grid2');
  const [nameSearch, setNameSearch] = useState('');
  const [breakdownTarget, setBreakdownTarget] = useState<SearchHit | null>(null);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [lastPassed, setLastPassed] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [availFilter, setAvailFilter] = useState<Set<AvailFilter>>(new Set());
  const [previewTarget, setPreviewTarget] = useState<SearchHit | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasToken = useIsAuthenticated();

  // Where a commitment with each person stands, shown beside their score:
  // the latest live thread from either side wins over a closed one.
  const { data: commitmentThreads } = useQuery({
    queryKey: qk('commitments', 'threads', 'all'),
    queryFn: () => listCommitmentThreads('all'),
    staleTime: 60_000,
  });
  const commitmentWith = useMemo(() => {
    const map = new Map<string, { step: CommitmentStep; href: string }>();
    for (const t of commitmentThreads ?? []) {
      const current = map.get(t.counterpart.id);
      if (current && current.step !== 'closed') continue;
      map.set(t.counterpart.id, { step: t.step, href: `/commitments/${encodeURIComponent(t.cardId)}?thread=${encodeURIComponent(t.id)}` });
    }
    return map;
  }, [commitmentThreads]);
  const { data: shortlistIdsData } = useQuery({
    queryKey: qk('shortlist', 'ids'),
    queryFn: getShortlistIds,
    staleTime: 5 * 60_000,
    enabled: hasToken,
  });

  useEffect(() => {
    if (shortlistIdsData?.ids) {
      setSavedIds(new Set(shortlistIdsData.ids));
    }
  }, [shortlistIdsData]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('recommendations', 'matches', { limit: 50 }),
    queryFn: () => getRecommendations({ limit: 50 }),
    staleTime: 3 * 60_000,
    enabled: hasToken,
  });

  const suggestions: SearchHit[] = data?.suggestions ?? [];
  const visible = useMemo(() => suggestions.filter(s => !passedIds.has(s.id)), [suggestions, passedIds]);

  const counts = useMemo(() => ({
    all:       visible.length,
    excellent: visible.filter(s => (s.matchScore ?? 0) >= 80).length,
    strong:    visible.filter(s => { const sc = s.matchScore ?? 0; return sc >= 65 && sc < 80; }).length,
    good:      visible.filter(s => { const sc = s.matchScore ?? 0; return sc >= 45 && sc < 65; }).length,
    potential: visible.filter(s => (s.matchScore ?? 0) < 45).length,
  }), [visible]);

  const avgScore = useMemo(() => {
    if (!visible.length) return 0;
    return Math.round(visible.reduce((sum, s) => sum + (s.matchScore ?? 0), 0) / visible.length);
  }, [visible]);

  const topScore = useMemo(() =>
    visible.reduce((max, s) => Math.max(max, s.matchScore ?? 0), 0), [visible]);

  const filtered = useMemo(() => {
    let list = [...visible];
    if (activeFilter !== 'all') {
      list = list.filter(s => getTier(s.matchScore ?? 0) === activeFilter);
    }
    if (roleFilter !== 'all') {
      list = list.filter(s => roleMatchesFilter(s.role, roleFilter));
    }
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      list = list.filter(s =>
        s.displayName.toLowerCase().includes(q) ||
        (s.headline ?? '').toLowerCase().includes(q) ||
        (s.skillNames ?? []).some(sk => sk.toLowerCase().includes(q))
      );
    }
    if (locationFilter.trim()) {
      const loc = locationFilter.toLowerCase();
      list = list.filter(s => (s.location ?? '').toLowerCase().includes(loc));
    }
    if (availFilter.size > 0) {
      list = list.filter(s => {
        const av = (s.availability ?? '').toLowerCase();
        return [...availFilter].some(f => av.includes(f.replace('_', ' ').replace('_', '-')));
      });
    }
    if (sortBy === 'score') list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    else if (sortBy === 'name') list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    // 'recent': preserve original API order — no-op
    return list;
  }, [visible, activeFilter, roleFilter, nameSearch, sortBy, locationFilter, availFilter]);

  const handleConnect = useCallback((profile: ProfileCardData) => {
    setConnectionTarget(profile);
    setShowConnectionDialog(true);
  }, []);

  const handleSendConnection = async (message: string) => {
    if (!connectionTarget) return;
    try {
      await sendConnectionRequest({ receiverId: connectionTarget.userId, message: message || undefined });
      success('Connection request sent!', `Your request to ${connectionTarget.displayName} has been sent.`);
      setShowConnectionDialog(false);
      setConnectionTarget(null);
      queryClient.invalidateQueries({ queryKey: qk('recommendations') });
      queryClient.invalidateQueries({ queryKey: qk('connections') });
    } catch (err) {
      showError('Could not send request', err instanceof Error ? err.message : 'Please try again');
    }
  };

  const handleMessage = useCallback((profile: ProfileCardData) => {
    router.push(`/messages?to=${profile.userId}`);
  }, [router]);

  const handlePass = useCallback((id: string, name: string, userId: string) => {
    setPassedIds(prev => new Set(prev).add(id));
    setLastPassed(id);
    void recordMatchFeedback({ targetUserId: userId, feedback: 'declined' }).catch(() => {});
    success('Passed', `${name} removed · Undo?`);
  }, [success]);

  const handleUndoPass = useCallback(() => {
    if (!lastPassed) return;
    setPassedIds(prev => { const next = new Set(prev); next.delete(lastPassed); return next; });
    setLastPassed(null);
  }, [lastPassed]);

  // The heart flips at once and a failed write flips it back. The request
  // used to be sent from inside the state updater, which React may run twice,
  // and nothing waited for it - so the assistant reported a save that could
  // still fail, and the reader never heard that it had.
  const handleSave = useCallback(async (userId: string, name: string): Promise<PageControlRunResult> => {
    const wasSaved = savedIds.has(userId);
    const flip = (saved: boolean) =>
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(userId);
        else next.delete(userId);
        return next;
      });
    flip(!wasSaved);
    try {
      await (wasSaved ? removeFromShortlist(userId) : saveToShortlist(userId));
      if (!wasSaved) success('Saved to shortlist', `${name} added to your saved profiles`);
    } catch (err) {
      flip(wasSaved);
      showError(wasSaved ? 'Could not remove from shortlist' : 'Could not save to shortlist', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'Your saved profiles did not change.' };
    }
  }, [savedIds, success, showError]);

  const TIER_TABS: { key: FilterKey; labelEn: string; labelEl: string; tier?: MatchTier }[] = [
    { key: 'all',       labelEn: matchesEn('tier_all'),       labelEl: matchesEl('tier_all') },
    { key: 'excellent', labelEn: matchesEn('tier_excellent'), labelEl: matchesEl('tier_excellent'), tier: 'excellent' },
    { key: 'strong',    labelEn: matchesEn('tier_strong'),    labelEl: matchesEl('tier_strong'),    tier: 'strong' },
    { key: 'good',      labelEn: matchesEn('tier_good'),      labelEl: matchesEl('tier_good'),      tier: 'good' },
    { key: 'potential', labelEn: matchesEn('tier_potential'), labelEl: matchesEl('tier_potential'), tier: 'potential' },
  ];

  const ROLE_TABS: { key: RoleFilter; labelEn: string; labelEl: string; icon: typeof Users }[] = [
    { key: 'all',      labelEn: matchesEn('all_roles'),  labelEl: matchesEl('all_roles'),  icon: Users },
    { key: 'founder',  labelEn: matchesEn('founders'),   labelEl: matchesEl('founders'),   icon: Briefcase },
    { key: 'mentor',   labelEn: matchesEn('mentors'),    labelEl: matchesEl('mentors'),    icon: GraduationCap },
    { key: 'investor', labelEn: matchesEn('investors'),  labelEl: matchesEl('investors'),  icon: DollarSign },
    { key: 'org',      labelEn: matchesEn('orgs'),       labelEl: matchesEl('orgs'),       icon: Users },
  ];

  const AVAIL_OPTIONS: { key: AvailFilter; labelEn: string; labelEl: string }[] = [
    { key: 'full_time', labelEn: matchesEn('full_time'), labelEl: matchesEl('full_time') },
    { key: 'part_time', labelEn: matchesEn('part_time'), labelEl: matchesEl('part_time') },
    { key: 'advisory',  labelEn: matchesEn('advisory'),  labelEl: matchesEl('advisory') },
    { key: 'contract',  labelEn: matchesEn('contract'),  labelEl: matchesEl('contract') },
  ];

  const hasActiveFilters = activeFilter !== 'all' || roleFilter !== 'all' || nameSearch || locationFilter || availFilter.size > 0;
  /* How many, for the rail's badge - availability is one filter however many
     values it holds, because that is how the reader thinks of it. */
  const activeFilterCount =
    (activeFilter !== 'all' ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (nameSearch ? 1 : 0) +
    (locationFilter ? 1 : 0) +
    (availFilter.size > 0 ? 1 : 0);

  const askAi = hasToken && visible.length > 0
    ? `Matches: ${counts.all} total, ${counts.excellent} excellent (≥80%), average ${avgScore}%, top ${topScore}%. ${filtered.length !== counts.all ? `${filtered.length} showing with current filters. ` : ''}Recommend who I should connect with first and draft a short intro.`
    : 'I am on Matches. Explain how compatibility scoring works and what to complete on my profile so I get better cofounder suggestions.';

  /*
   * The filter column, as a rail.
   *
   * These are the same four filters and the same sort the page has always
   * had, in the same order, with the same behaviour. What changes is that
   * they stop costing 220px of the results on every visit that is not a
   * filtering visit.
   */
  // Offered to the assistant: the rail's filters and sort and the column's
  // view switch, through the same setters. Availability is a set, so its
  // control toggles one value the way its chips do.
  const VIEWS = [
    { value: 'grid2', en: 'Two-column grid', el: 'Πλέγμα δύο στηλών' },
    { value: 'grid3', en: 'Three-column grid', el: 'Πλέγμα τριών στηλών' },
    { value: 'list', en: 'List', el: 'Λίστα' },
  ];
  usePageList([
    {
      id: 'matches',
      labelEn: 'Matches',
      labelEl: 'Αντιστοιχίσεις',
      rows: !hasToken || isLoading ? undefined : filtered.map((s) =>
        `${s.displayName} · ${s.role ?? 'member'} · match ${s.matchScore ?? '—'}%${s.headline ? ` · ${s.headline}` : ''}${s.location ? ` · ${s.location}` : ''}${savedIds.has(s.userId) ? ' · shortlisted' : ''}`,
      ),
      total: visible.length,
    },
  ]);
  // The row's own buttons as commands, over the rows on screen: the same
  // handlers the card and the list row call.
  const hitRows = (list: SearchHit[]) => rowOptions(list, (h) => h.id, (h) => h.displayName);
  const hitById = (id?: string) => filtered.find((h) => h.id === id);
  usePageControls([
    choiceControl('match_tier', 'Match strength filter', 'Φίλτρο ισχύος αντιστοίχισης', TIER_TABS, activeFilter, (v) => setActiveFilter(v as FilterKey)),
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', ROLE_TABS, roleFilter, (v) => setRoleFilter(v as RoleFilter)),
    choiceControl('sort', 'Sort matches', 'Ταξινόμηση αντιστοιχίσεων', [
      { key: 'score', labelEn: matchesEn('sort_best_match'), labelEl: matchesEl('sort_best_match') },
      { key: 'name', labelEn: matchesEn('sort_name_az'), labelEl: matchesEl('sort_name_az') },
      { key: 'recent', labelEn: matchesEn('sort_newest'), labelEl: matchesEl('sort_newest') },
    ], sortBy, (v) => setSortBy(v as SortKey)),
    choiceControl('view', 'Match layout', 'Διάταξη αντιστοιχίσεων', VIEWS, viewMode, (v) => setViewMode(v as ViewMode)),
    {
      id: 'availability',
      labelEn: 'Toggle availability filter',
      labelEl: 'Εναλλαγή φίλτρου διαθεσιμότητας',
      writes: false,
      options: AVAIL_OPTIONS.map((o) => ({ value: o.key, labelEn: o.labelEn, labelEl: o.labelEl })),
      run: (value) => {
        if (!value) return;
        setAvailFilter((prev) => {
          const next = new Set(prev);
          if (next.has(value as AvailFilter)) next.delete(value as AvailFilter);
          else next.add(value as AvailFilter);
          return next;
        });
      },
    },
    {
      id: 'connect_with',
      labelEn: 'Open a connection request to',
      labelEl: 'Άνοιγμα αιτήματος σύνδεσης προς',
      writes: false,
      options: hitRows(filtered),
      run: (v) => { const hit = hitById(v); if (hit) handleConnect(hitToProfile(hit)); },
    },
    {
      id: 'message_match',
      labelEn: 'Message match',
      labelEl: 'Μήνυμα σε αντιστοίχιση',
      writes: false,
      options: hitRows(filtered),
      run: (v) => { const hit = hitById(v); if (hit) handleMessage(hitToProfile(hit)); },
    },
    {
      id: 'shortlist_match',
      labelEn: 'Save match to shortlist',
      labelEl: 'Αποθήκευση αντιστοίχισης στη λίστα',
      writes: true,
      options: hitRows(filtered.filter((h) => !savedIds.has(h.userId))),
      // A save creates a fresh shortlist row, so removing it takes the save
      // back. Not the reverse: removing drops the row's note, which saving
      // again does not restore.
      undo: (v) => ({ control: 'unshortlist_match', value: v }),
      run: (v) => { const hit = hitById(v); return hit ? handleSave(hit.userId, hit.displayName) : ROW_GONE; },
    },
    {
      id: 'unshortlist_match',
      labelEn: 'Remove match from shortlist',
      labelEl: 'Αφαίρεση αντιστοίχισης από τη λίστα',
      writes: true,
      options: hitRows(filtered.filter((h) => savedIds.has(h.userId))),
      run: (v) => { const hit = hitById(v); return hit ? handleSave(hit.userId, hit.displayName) : ROW_GONE; },
    },
    {
      id: 'pass_match',
      labelEn: 'Pass on match',
      labelEl: 'Παράλειψη αντιστοίχισης',
      writes: true,
      options: hitRows(filtered),
      run: (v) => { const hit = hitById(v); if (hit) handlePass(hit.id, hit.displayName, hit.userId); },
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      // The count is what keeps a collapsed rail honest: a narrowed list
      // with no visible reason reads as a broken list.
      badge: activeFilterCount || null,
      content: (
        <div className="space-y-2.5">

          {/* Role filter */}
          <Card className="shadow-sm border-border">
          <CardContent className="space-y-0.5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground px-1 pb-1.5">
          <BilingualText en={matchesEn('role')} el={matchesEl('role')} compact />
          </p>
          {ROLE_TABS.map(({ key, labelEn, labelEl, icon: Icon }) => {
          const isActive = roleFilter === key;
          return (
          <button key={key} onClick={() => setRoleFilter(key)}
          className={cn(
          'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
          isActive ? 'bg-primary/10 text-primary-accessible border border-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}>
          <Icon className="icon-sm shrink-0" />
          <BilingualText en={labelEn} el={labelEl} compact />
          </button>
          );
          })}
          </CardContent>
          </Card>

          {/* Location */}
          <Card className="shadow-sm border-border">
          <CardContent className="space-y-1.5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          <BilingualText en={matchesEn('location')} el={matchesEl('location')} compact />
          </p>
          <div className="relative">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground pointer-events-none" />
          <input type="text" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          placeholder={bilingualInline("City or country…", "Πόλη ή χώρα…")}
          className="w-full h-8 rounded-lg border border-border bg-background pl-7 pr-7 text-xs outline-none focus:border-primary/60 transition-colors" />
          {locationFilter && (
          <button aria-label="Clear location filter" onClick={() => setLocationFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="icon-sm" />
          </button>
          )}
          </div>
          </CardContent>
          </Card>

          {/* Availability */}
          <Card className="shadow-sm border-border">
          <CardContent className="space-y-0.5">
          <p className="px-1 pb-1.5 text-2xs font-semibold uppercase leading-snug tracking-wide text-muted-foreground">
          <BilingualText en={matchesEn('availability')} el={matchesEl('availability')} compact wrap />
          </p>
          {AVAIL_OPTIONS.map(({ key, labelEn, labelEl }) => {
          const isOn = availFilter.has(key);
          return (
          <button key={key} onClick={() => setAvailFilter(prev => {
          const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next;
          })}
          className={cn('flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium leading-snug transition-all',
          isOn ? 'bg-primary/10 text-primary-accessible' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
          <span className={cn('mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          isOn ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
          {isOn && <span className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />}
          </span>
          <BilingualText en={labelEn} el={labelEl} compact wrap />
          </button>
          );
          })}
          </CardContent>
          </Card>

          {/* Clear all */}
          {hasActiveFilters && (
          <button
          onClick={() => { setActiveFilter('all'); setRoleFilter('all'); setNameSearch(''); setLocationFilter(''); setAvailFilter(new Set()); }}
          className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg text-xs text-muted-foreground border border-border hover:bg-secondary hover:text-foreground transition-colors">
          <X className="icon-sm" /> <BilingualText en={matchesEn('clear_all_filters')} el={matchesEl('clear_all_filters')} compact />
          </button>
          )}
        </div>
      ),
    },
    {
      id: 'sort',
      glyph: 'compare',
      labelEn: 'Sort',
      labelEl: 'Ταξινόμηση',
      content: (
        <div className="space-y-2.5">
          {/* Sort */}
          <Card className="shadow-sm border-border">
          <CardContent className="space-y-0.5">
          <p className="px-1 pb-1.5 text-2xs font-semibold uppercase leading-snug tracking-wide text-muted-foreground">
          <BilingualText en={matchesEn('sort_by')} el={matchesEl('sort_by')} compact wrap />
          </p>
          {([
          { key: 'score'  as SortKey, labelEn: matchesEn('sort_best_match'), labelEl: matchesEl('sort_best_match'), icon: Zap },
          { key: 'name'   as SortKey, labelEn: matchesEn('sort_name_az'),    labelEl: matchesEl('sort_name_az'),    icon: ArrowUpDown },
          { key: 'recent' as SortKey, labelEn: matchesEn('sort_newest'),     labelEl: matchesEl('sort_newest'),     icon: Clock },
          ]).map(({ key, labelEn, labelEl, icon: Icon }) => (
          <button key={key} onClick={() => setSortBy(key)}
          className={cn('flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium leading-snug transition-all',
          sortBy === key ? 'bg-primary/10 text-primary-accessible border border-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
          <Icon className="mt-0.5 icon-sm shrink-0" />
          <BilingualText en={labelEn} el={labelEl} compact wrap />
          </button>
          ))}
          </CardContent>
          </Card>

        </div>
      ),
    },
    {
      id: 'next',
      glyph: 'discover',
      labelEn: 'Find more people',
      labelEl: 'Βρείτε περισσότερα άτομα',
      content: (
        <div className="space-y-2">
          <Button asChild variant="outline" className="h-auto min-h-14 w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left">
            <Link href="/discover">
              <CfbGlyph name="discover" className="icon-sm shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">
                  <BilingualText en={matchesEn('explore')} el={matchesEl('explore')} wrap />
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  <BilingualText en="Search beyond this ranked list." el="Αναζήτηση πέρα από αυτή την κατάταξη." wrap />
                </span>
              </span>
              <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];
  return (
    <AppShell
      rail={rail}
      title={matchesEn('page_title')}
      titleEl={matchesEl('page_title')}
      description={matchesEn('page_description')}
      descriptionEl={matchesEl('page_description')}
      showHelp
      askAi={askAi}
      contentClassName="overflow-x-clip"
      actions={
        <Button variant="ghost" size="sm" className="min-h-10 gap-1.5" onClick={() => void refetch()}>
          <RefreshCw className="icon-sm" />
          <BilingualText en={matchesEn('refresh')} el={matchesEl('refresh')} compact />
        </Button>
      }
    >
      <div className="min-w-0 space-y-6 overflow-x-clip pb-10">
        <FirstRunTour tourId="matches" steps={MATCHES_TOUR} ready={hasToken && !isLoading && visible.length > 0} />

        {/* ── Not authenticated ── */}
        {!hasToken && (
          <EmptyState
            title={<BilingualText en={matchesEn('sign_in_to_see')} el={matchesEl('sign_in_to_see')} />}
            description={<BilingualText en={matchesEn('sign_in_desc')} el={matchesEl('sign_in_desc')} />}
            illustration="connection"
            askAiPrompt="I am not signed in. Explain how matching works on CoFounderBay and what I should complete after login."
            action={
              <Button className="gap-2" asChild>
                <Link href="/login">
                  <UserPlus className="icon-sm" />
                  <BilingualText en={matchesEn('sign_in')} el={matchesEl('sign_in')} />
                </Link>
              </Button>
            }
          />
        )}

        {/* ── Error state ── */}
        {hasToken && isError && (
          <Card className="shadow-sm border-border">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                <BilingualText en={matchesEn('failed_to_load')} el={matchesEl('failed_to_load')} />
              </p>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                <BilingualText en={matchesEn('retry')} el={matchesEl('retry')} />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Loading skeletons ── */}
        {hasToken && isLoading && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => <ProfileCardSkeleton key={i} variant="featured" />)}
          </div>
        )}

        {/* ── Stats bar ── */}
        {hasToken && !isLoading && visible.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="matches-stats">
            {[
              { labelEn: matchesEn('total_matches'), labelEl: matchesEl('total_matches'), value: counts.all, tone: 'neutral' as const, icon: Users },
              { labelEn: matchesEn('excellent_80'), labelEl: matchesEl('excellent_80'), value: counts.excellent, tone: 'success' as const, icon: Star },
              { labelEn: matchesEn('avg_score'), labelEl: matchesEl('avg_score'), value: `${avgScore}%`, tone: 'info' as const, icon: TrendingUp },
              { labelEn: matchesEn('top_score'), labelEl: matchesEl('top_score'), value: `${topScore}%`, tone: 'accent' as const, icon: Award },
            ].map(({ labelEn, labelEl, value, tone, icon: Icon }) => {
              const statColors = tone === 'neutral'
                ? { bg: 'bg-muted/40', icon: 'text-foreground' }
                : { bg: STATUS[tone].bg, icon: STATUS[tone].icon };
              return (
              <Card key={labelEn} className="min-w-0 shadow-sm border-border">
                <CardContent className="flex items-center gap-2 sm:gap-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9', statColors.bg)}>
                    <Icon className={cn('icon-sm', statColors.icon)} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-lg font-bold tabular-nums leading-none sm:text-xl', statColors.icon)}>{value}</p>
                    <p className="mt-0.5 text-2xs leading-tight text-muted-foreground">
                      <BilingualText en={labelEn} el={labelEl} compact wrap />
                    </p>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        )}

        {/* ── Insights banner (excellent matches) ── */}
        {hasToken && !isLoading && counts.excellent > 0 && (() => {
          const bannerActions = (
            <>
              {lastPassed && (
                <Button size="sm" variant="ghost" onClick={handleUndoPass} className="gap-1.5 text-muted-foreground">
                  <RotateCcw className="icon-sm" /> <BilingualText en="Undo" el="Αναίρεση" compact />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setActiveFilter('excellent')} className="gap-1.5">
                <BilingualText en="View" el="Προβολή" compact /> <ChevronRight className="icon-sm" />
              </Button>
            </>
          );
          // A card's head: the news as the title, the top score under it;
          // the way to them at the right, under the line on a phone.
          return (
            <div className={cn('space-y-3 rounded-2xl border bg-status-success-bg/40 p-4 animate-in fade-in slide-in-from-top-1 duration-300', STATUS.success.border)}>
              <CardHead
                titleAs="p"
                title={(
                  <BilingualText
                    en={`${counts.excellent} excellent ${counts.excellent === 1 ? 'match' : 'matches'} ready to connect`}
                    el={`${counts.excellent} ${counts.excellent === 1 ? 'εξαιρετική αντιστοίχιση έτοιμη' : 'εξαιρετικές αντιστοιχίσεις έτοιμες'} για σύνδεση`}
                    wrap
                  />
                )}
                subtitle={(
                  <BilingualText
                    en={`Top score ${topScore}% · These profiles are highly compatible, so reach out now`}
                    el={`Κορυφαία βαθμολογία ${topScore}% · Αυτά τα προφίλ σάς ταιριάζουν πολύ, στείλτε μήνυμα τώρα`}
                    wrap
                  />
                )}
                asideClassName="hidden sm:flex"
                aside={bannerActions}
              />
              <div className="flex flex-wrap items-center gap-2 sm:hidden">{bannerActions}</div>
            </div>
          );
        })()}

        {/* ── No data at all ── */}
        {hasToken && !isLoading && visible.length === 0 && (
          <EmptyState
            title={<BilingualText en={matchesEn('no_matches_yet')} el={matchesEl('no_matches_yet')} />}
            description={<BilingualText en={matchesEn('no_matches_desc')} el={matchesEl('no_matches_desc')} />}
            illustration="rocket"
            askAiPrompt="I have no matches yet. Tell me which profile fields to complete so I get better cofounder suggestions."
            action={
              <Button className="gap-2" asChild>
                <Link href="/profile/edit">
                  <BilingualText en={matchesEn('complete_profile')} el={matchesEl('complete_profile')} />
                  <ArrowRight className="icon-sm" />
                </Link>
              </Button>
            }
          />
        )}

        {/* ── Two-column: filter sidebar + results ── */}
        {hasToken && !isLoading && visible.length > 0 && (
          <div className="flex gap-4 items-start">

            {/* ── Sticky filter sidebar (desktop md+) ── */}

            {/* ── Results column ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Tier chips: the page's primary filter, at every width.
                  Secondary filters (role, location, availability) and sort
                  live in the page rail - the expanded panel that used to sit
                  here duplicated them, so it is gone rather than doubled. */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5" data-tour="matches-tiers">
                {TIER_TABS.map(tab => {
                  const isActive = activeFilter === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setActiveFilter(isActive && tab.key !== 'all' ? 'all' : tab.key)}
                      className={cn('flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-all',
                        isActive ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}>
                      {tab.tier && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', TIER_DOT[tab.tier])} />}
                      <BilingualText en={tab.labelEn} el={tab.labelEl} compact />
                      <span className={cn('rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                        isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {counts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Results toolbar */}
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2" data-tour="matches-toolbar">
                <p className="min-w-0 text-xs text-muted-foreground">
                  {filtered.length > 0 && (
                    <BilingualText
                      en={`${filtered.length} ${filtered.length === 1 ? 'match' : 'matches'}${passedIds.size > 0 ? ` · ${passedIds.size} passed` : ''}`}
                      el={`${filtered.length} ${filtered.length === 1 ? 'αντιστοίχιση' : 'αντιστοιχίσεις'}${passedIds.size > 0 ? ` · ${passedIds.size} απορρίφθηκαν` : ''}`}
                      compact
                      wrap
                    />
                  )}
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
                    className={cn('flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                      selectMode ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground')}
                    aria-pressed={selectMode}
                    title={bilingualAria('Select profiles to compare', 'Επιλογή προφίλ για σύγκριση')}>
                    <CheckSquare className="icon-sm" />
                    <span className="hidden sm:inline"><BilingualText en="Select" el="Επιλογή" compact /></span>
                    {selectedIds.size > 0 && <span className="rounded-full bg-primary-foreground/20 px-1 text-2xs font-bold">{selectedIds.size}</span>}
                  </button>

                  <button onClick={() => setShowSearch(s => !s)}
                    className={cn('flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      showSearch ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary')}
                    aria-pressed={showSearch}
                    aria-label={bilingualAria('Search matches', 'Αναζήτηση αντιστοιχίσεων')}>
                    <Search className="icon-sm" />
                  </button>

                  <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                    {([
                      { mode: 'grid2' as ViewMode, icon: LayoutGrid, title: '2-col', small: false, mobile: true },
                      { mode: 'grid3' as ViewMode, icon: LayoutGrid, title: '3-col', small: true, mobile: false },
                      { mode: 'list'  as ViewMode, icon: List,       title: 'List',  small: false, mobile: true },
                    ] as { mode: ViewMode; icon: typeof LayoutGrid; title: string; small: boolean; mobile: boolean }[]).map(({ mode, icon: Icon, title, small, mobile }) => (
                      <button key={mode} onClick={() => setViewMode(mode)} title={title} aria-label={`${title} view`}
                        className={cn('h-9 items-center justify-center rounded-xl px-2 transition-all',
                          mobile ? 'flex' : 'hidden sm:flex',
                          viewMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                        <Icon className={cn('icon-sm', small && 'scale-90')} />
                        {mode === 'grid3' && <span className="ml-0.5 text-2xs font-bold">3</span>}
                      </button>
                    ))}
                  </div>

                  {lastPassed && (
                    <Button size="sm" variant="ghost" onClick={handleUndoPass} aria-label="Undo the last pass" className="gap-1.5 text-xs h-8 text-muted-foreground px-2 sm:px-3">
                      <RotateCcw className="icon-sm" aria-hidden="true" />
                      <span className="hidden sm:inline"><BilingualText en="Undo" el="Αναίρεση" compact /></span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Search input (conditional) */}
              {showSearch && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                  <Input value={nameSearch} onChange={e => setNameSearch(e.target.value)}
                    placeholder={bilingualInline("Search by name, headline, or skill…", "Αναζήτηση με όνομα, τίτλο ή δεξιότητα…")} className="min-h-10 pl-9 text-sm" autoFocus />
                  {nameSearch && (
                    <button onClick={() => setNameSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
                      <BilingualText en="Clear" el="Καθαρισμός" compact />
                    </button>
                  )}
                </div>
              )}

              {/* Active filter summary */}
              {hasActiveFilters && filtered.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <BilingualText
                    en={`Showing ${filtered.length} of ${visible.length} matches`}
                    el={`Εμφανίζονται ${filtered.length} από ${visible.length} αντιστοιχίσεις`}
                    compact
                  />
                  {nameSearch && ` · "${nameSearch}"`}
                </p>
              )}

              {/* No results for filters */}
              {filtered.length === 0 && (
                <Card className="shadow-sm border-border">
                  <CardContent className="py-12 text-center">
                    <SlidersHorizontal className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" aria-hidden="true" />
                    <p className="font-medium text-foreground mb-1"><BilingualText en="No matches for these filters" el="Καμία αντιστοίχιση για αυτά τα φίλτρα" compact /></p>
                    <p className="text-sm text-muted-foreground mb-4"><BilingualText en="Try adjusting your tier, role, or location filter" el="Αλλάξτε το φίλτρο βαθμίδας, ρόλου ή τοποθεσίας" wrap /></p>
                    <Button variant="outline" size="sm" onClick={() => { setActiveFilter('all'); setRoleFilter('all'); setNameSearch(''); setLocationFilter(''); setAvailFilter(new Set()); }}>
                      <BilingualText en="Clear all filters" el="Καθαρισμός όλων των φίλτρων" compact />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Matches grid */}
              {filtered.length > 0 && viewMode !== 'list' && (
                <div className={cn('grid grid-cols-1 gap-4',
                  viewMode === 'grid3' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}
                  data-tour="matches-grid">
                  {filtered.map((hit) => {
                    const profile = hitToProfile(hit);
                    const score = hit.matchScore ?? 50;
                    const matchReasons: MatchReason[] = hit.matchReasons?.length
                      ? hit.matchReasons.map((text) => ({ type: 'skills' as const, text, score: 0 }))
                      : [];
                    return (
                      <MatchCard
                        key={hit.id}
                        id={hit.id}
                        userId={hit.userId}
                        displayName={hit.displayName}
                        headline={hit.headline}
                        avatarUrl={hit.avatarUrl}
                        role={hit.role}
                        location={hit.location}
                        skills={hit.skillNames ?? []}
                        compatibilityScore={score}
                        matchReasons={matchReasons}
                        isBookmarked={savedIds.has(hit.userId)}
                        commitment={commitmentWith.get(hit.userId) ?? null}
                        onLike={() => handleConnect(profile)}
                        onPass={() => handlePass(hit.id, hit.displayName, hit.userId)}
                        onMessage={() => handleMessage(profile)}
                        onBookmark={() => void handleSave(hit.userId, hit.displayName)}
                        onBreakdown={() => setBreakdownTarget(hit)}
                        onClick={!selectMode ? () => setPreviewTarget(hit) : undefined}
                        isSelected={selectMode ? selectedIds.has(hit.id) : undefined}
                        onSelect={selectMode ? () => setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(hit.id)) next.delete(hit.id); else next.add(hit.id);
                          return next;
                        }) : undefined}
                      />
                    );
                  })}
                </div>
              )}

              {/* Matches list */}
              {filtered.length > 0 && viewMode === 'list' && (
                <div className="space-y-3">
                  {filtered.map((hit) => {
                    const profile = hitToProfile(hit);
                    const score = hit.matchScore ?? 50;
                    const matchReasons: MatchReason[] = hit.matchReasons?.length
                      ? hit.matchReasons.map((text) => ({ type: 'skills' as const, text, score: 0 }))
                      : [];
                    return (
                      <MatchListRow
                        key={hit.id}
                        hit={hit}
                        matchReasons={matchReasons}
                        isSaved={savedIds.has(hit.userId)}
                        commitment={commitmentWith.get(hit.userId) ?? null}
                        onConnect={() => handleConnect(profile)}
                        onMessage={() => handleMessage(profile)}
                        onPass={() => handlePass(hit.id, hit.displayName, hit.userId)}
                        onSave={() => void handleSave(hit.userId, hit.displayName)}
                        onBreakdown={() => setBreakdownTarget(hit)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Results footer */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                  <span>{filtered.length} match{filtered.length !== 1 ? 'es' : ''} shown{passedIds.size > 0 ? ` · ${passedIds.size} passed` : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick-preview slide panel (b3) ── */}
      {previewTarget && (() => {
        const score = previewTarget.matchScore ?? 50;
        const previewReasons: MatchReason[] = previewTarget.matchReasons?.length
          ? previewTarget.matchReasons.map((text) => ({ type: 'skills' as const, text, score: 0 }))
          : [];
        const previewProfile = hitToProfile(previewTarget);
        return (
          <MatchPreviewPanel
            hit={previewTarget}
            matchReasons={previewReasons}
            savedIds={savedIds}
            onClose={() => setPreviewTarget(null)}
            onConnect={() => { handleConnect(previewProfile); setPreviewTarget(null); }}
            onMessage={() => { handleMessage(previewProfile); setPreviewTarget(null); }}
            onSave={() => void handleSave(previewTarget.userId, previewTarget.displayName)}
            onPass={() => { handlePass(previewTarget.id, previewTarget.displayName, previewTarget.userId); setPreviewTarget(null); }}
            onBreakdown={() => { setBreakdownTarget(previewTarget); setPreviewTarget(null); }}
          />
        );
      })()}

      {/* ── Bulk action bar (b4) ── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-modal animate-in slide-in-from-bottom duration-200 lg:bottom-6">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-border/60" />
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
            onClick={() => {
              const ids = [...selectedIds].slice(0, 4).join(',');
              router.push(`/compare?ids=${ids}`);
            }}>
            <BarChart3 className="icon-sm" /> <BilingualText en="Compare" el="Σύγκριση" compact />
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs hover:text-destructive-accessible"
            onClick={() => {
              filtered.forEach(h => {
                if (selectedIds.has(h.id)) handlePass(h.id, h.displayName, h.userId);
              });
              setSelectedIds(new Set());
              setSelectMode(false);
            }}>
            <X className="icon-sm" /> <BilingualText en="Pass All" el="Παράλειψη όλων" compact />
          </Button>
          <button aria-label="Exit selection" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
            className="text-muted-foreground hover:text-foreground transition-colors ml-1">
            <X className="icon-sm" />
          </button>
        </div>
      )}

      <CompatibilityModal
        hit={breakdownTarget}
        open={!!breakdownTarget}
        onClose={() => setBreakdownTarget(null)}
      />

      {connectionTarget && (
        <ConnectionRequestDialog
          open={showConnectionDialog}
          onOpenChange={(open) => {
            setShowConnectionDialog(open);
            if (!open) setConnectionTarget(null);
          }}
          recipient={{
            id: connectionTarget.userId,
            displayName: connectionTarget.displayName,
            avatarUrl: connectionTarget.avatarUrl,
            role: connectionTarget.role,
            headline: connectionTarget.headline,
          }}
          onSend={handleSendConnection}
        />
      )}
    </AppShell>
  );
}
