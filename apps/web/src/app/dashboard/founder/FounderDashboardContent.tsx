'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { usePageControls, usePageList } from '@/lib/page-controls';
import { ventureDimensionEl } from '@/lib/i18n/venture-dimensions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useAskAssistant } from '@/hooks/useAskAssistant';
import { ASK, type AskPrompt } from '@/lib/page-questions';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { usePublishPageSnapshot } from '@/contexts/PageSnapshotContext';
import { isPreviewDemo } from '@/lib/preview-demo';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { queryKeys, qk } from '@/lib/query-keys';
import {
  getMeProfile,
  getRecommendations,
  listConnectionRequests,
  getVentureReadiness,
  type SearchHit,
  listMilestones,
  listResearchBoards,
  getAnalyticsMetrics,
  getAnalyticsProfileViews,
  getDashboardActivity,
} from '@/lib/api';
import {
  fundraisingRoundView,
  fundraisingPipelineStats,
  FUNDRAISING_SEED_LEADS,
} from '@/lib/fundraising-demo';
import {
  buildOnboardingSteps,
  useOnboardingChecklistDismissed,
} from '@/components/gamification/OnboardingChecklist';
import { CommitmentOutcomes } from '@/components/commitments/CommitmentOutcomes';
import { WhatsNewRail } from '@/components/dashboard/WhatsNewPanel';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { ProgressSegments } from '@/components/dashboard/ProgressSegments';
import { Sparkline } from '@/components/charts/Sparkline';
import { FounderProgressCard } from '@/components/gamification/FounderProgressCard';
import { YourPagesRow } from '@/components/dashboard/YourPages';
import { HomeContinue } from '@/components/home/HomeContinue';
import { homeContinuation, matchesContinuation } from '@/lib/home-continuation';
import {
  FIRST_MOVE_LATER_KEY,
  FounderFirstMove,
  firstMoveLayout,
  useFirstMoveState,
  useStoredFlag,
} from '@/components/dashboard/FounderFirstMove';
import { listCommitmentThreads } from '@/lib/commitments-api';
import { waitsOnMe } from '@/lib/commitments-next';
import { RowHead } from '@/components/dashboard/SectionCard';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';
import { BehavioralNudge } from '@/components/behavioral/BehavioralNudge';
import { XPProgressWidget } from '@/components/gamification/XPProgressWidget';
import { BadgesWidget } from '@/components/gamification/BadgesWidget';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { dashboardEn, dashboardEl } from '@/lib/i18n/strings-dashboard';
import { PREVIEW_MILESTONE_EL } from '@/lib/i18n/strings-milestones';
import { activityTimeAgoPair, activityTitleEl } from '@/lib/i18n/activity-titles';
import { bilingualAria, formatShortDate } from '@/lib/i18n/format';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { SectionSticker } from '@/components/dashboard/SectionSticker';
import { explainMatch, saysLookingFor, viewerFacts, type ViewerFacts } from '@/lib/match-explain';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { isMilestoneOverdue } from '@/lib/milestone-order';
import { HomeToday, useTodayRows } from '@/components/dashboard/HomeToday';
import { HomeAskHero } from '@/components/dashboard/HomeAskHero';
import { useInvestorFollowUps } from '@/lib/follow-ups';

/** Remembered only under 1024px. Wide screens always show this block. */

const FOUNDER_TOUR: TourStep[] = [
  {
    target: 'founder-today',
    titleEn: 'What is waiting on you',
    titleEl: 'Ό,τι σας περιμένει',
    bodyEn: 'Everything that needs an answer from you, in one list, with the person first. Each row opens where to answer it.',
    bodyEl: 'Ό,τι χρειάζεται απάντηση από εσάς, σε μία λίστα, με το άτομο πρώτο. Κάθε γραμμή ανοίγει εκεί όπου απαντάτε.',
  },
  {
    target: 'founder-stats',
    titleEn: 'What is due next, and how your profile is doing',
    titleEl: 'Τι λήγει στη συνέχεια και πώς πάει το προφίλ σας',
    bodyEn: 'Your next milestones with what is late, beside your profile views. A dash means the figure could not be read; it is not zero.',
    bodyEl: 'Τα επόμενα ορόσημά σας με ό,τι έχει καθυστερήσει, δίπλα στις προβολές του προφίλ σας. Παύλα σημαίνει ότι ο αριθμός δεν διαβάστηκε, όχι ότι είναι μηδέν.',
  },
  {
    target: 'founder-readiness',
    titleEn: 'Your progress on the platform',
    titleEl: 'Η πρόοδός σας στην πλατφόρμα',
    bodyEn: 'How far you have come on the platform and what would move it. It is a different number from the investor readiness score on the Readiness page.',
    bodyEl: 'Πόσο έχετε προχωρήσει στην πλατφόρμα και τι θα το ανεβάσει. Είναι διαφορετικός αριθμός από την ετοιμότητα για επενδυτές στη σελίδα Ετοιμότητα.',
  },
];

function AskAiButton({
  labelEn,
  labelEl,
  prompt,
  className,
  variant = 'outline',
  size = 'sm',
}: {
  labelEn?: string;
  labelEl?: string;
  /** Sent to the in-page assistant, which keeps this page's context; `/ai?q=` without the popup. A pair from `lib/page-questions`. */
  prompt?: AskPrompt;
  className?: string;
  variant?: 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'md';
}) {
  const { ask, hrefFor, inPlace } = useAskAssistant();
  const buttonClass = cn('h-auto min-h-9 gap-1.5 py-1.5 leading-snug', className);
  const label = (
    <>
      <CfbGlyph name="spark" className="icon-sm shrink-0" aria-hidden="true" />
      <BilingualText en={labelEn ?? dashboardEn('ask_ai')} el={labelEl ?? dashboardEl('ask_ai')} compact wrap />
    </>
  );
  if (inPlace && prompt) {
    return (
      <Button type="button" variant={variant} size={size} className={buttonClass} onClick={() => ask(prompt)}>
        {label}
      </Button>
    );
  }
  const href = hrefFor(prompt);
  return (
    <Button asChild variant={variant} size={size} className={buttonClass}>
      <Link href={href}>
        {label}
      </Link>
    </Button>
  );
}

const PREVIEW_HEADLINE_EL: Record<string, string> = {
  'Founder & CEO at Harbor': 'Ιδρύτρια και CEO στο Harbor',
  'Technical cofounder · Full-stack': 'Τεχνικός συνιδρυτής · Full-stack',
  'Startup mentor · Former product lead · 3x founder': 'Μέντορας startups · πρώην επικεφαλής προϊόντος · 3× ιδρύτρια',
  'Angel investor · Seed': 'Angel επενδυτής · Seed',
};

// ── Demo data ─────────────────────────────────────────────────────────────────
//
// Dates are derived from "today", not hardcoded. Fixed dates silently rot: the
// previous literals had all passed, so every demo milestone rendered with the
// overdue alert icon and every "upcoming" event claimed to be days away while
// showing a date months in the past.

/** ISO date `offsetDays` from now. */
function isoInDays(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

type DemoMilestone = {
  id: string;
  titleEn: string;
  titleEl: string;
  status: 'in_progress' | 'pending' | 'completed';
  progress: number;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
};

/** Shown only under the demo overlay, for a founder with no milestones. */
const DEMO_MILESTONES: DemoMilestone[] = [
  { id: '1', titleEn: 'Complete MVP v1', titleEl: 'Ολοκλήρωση MVP v1', status: 'in_progress', progress: 65, dueDate: isoInDays(24), priority: 'high' },
  { id: '2', titleEn: 'First 100 active users', titleEl: 'Πρώτοι 100 ενεργοί χρήστες', status: 'in_progress', progress: 23, dueDate: isoInDays(40), priority: 'high' },
  { id: '3', titleEn: 'Seed funding round', titleEl: 'Γύρος Seed χρηματοδότησης', status: 'pending', progress: 10, dueDate: isoInDays(100), priority: 'medium' },
  { id: '4', titleEn: 'Build founding team', titleEl: 'Συγκρότηση ιδρυτικής ομάδας', status: 'pending', progress: 0, dueDate: isoInDays(39), priority: 'high' },
];

/**
 * Shown only under the demo overlay.
 *
 * Every name and figure here has to exist in the lists this card sits beside:
 * the first row used to announce an 87% match with Nikos Papadakis while Top
 * Matches showed 92, 88, 81 and 76 and no such person.
 */
/** The icon each activity type carries, mirroring EVENT_CONFIG's job. */
const ACTIVITY_GLYPH: Record<string, 'spark' | 'people' | 'messages' | 'profile' | 'flag' | 'award' | 'briefcase'> = {
  match: 'spark',
  connection: 'people',
  invite: 'people',
  message: 'messages',
  milestone: 'flag',
  achievement: 'award',
  endorsement: 'award',
  job: 'briefcase',
  event: 'flag',
  system: 'profile',
};

const DEMO_ACTIVITY = [
  { id: '1', href: '/matches', glyph: 'spark' as const, textEn: 'New 92% match — Elena Papadopoulos, Founder', textEl: 'Νέα αντιστοίχιση 92% — Elena Papadopoulos, ιδρύτρια', timeEn: '2h ago', timeEl: 'πριν 2 ώρες' },
  { id: '2', href: '/connections', glyph: 'people' as const, textEn: 'Elena Papadopoulos accepted your request', textEl: 'Η Έλενα Παπαδοπούλου αποδέχτηκε το αίτημά σας', timeEn: '5h ago', timeEl: 'πριν 5 ώρες' },
  { id: '3', href: '/messages', glyph: 'messages' as const, textEn: 'New message from Marcus Chen', textEl: 'Νέο μήνυμα από τον Marcus Chen', timeEn: '8h ago', timeEl: 'πριν 8 ώρες' },
  { id: '4', href: '/analytics', glyph: 'profile' as const, textEn: 'Your profile was viewed 12 times today', textEl: 'Το προφίλ σας προβλήθηκε 12 φορές σήμερα', timeEn: '1d ago', timeEl: 'πριν 1 ημέρα' },
];

type EventType = 'mentorship' | 'deadline' | 'event' | 'pitch';
const EVENT_CONFIG: Record<EventType, StatusTone> = {
  mentorship: 'accent',
  deadline: 'danger',
  event: 'info',
  pitch: 'success',
};

// daysLeft is derived from the date so the two can never disagree.
const DEMO_EVENTS = (
  [
    // Dr. Sarah Kim is the demo's mentor on every other surface.
    { id: '1', titleEn: 'Mentor Session — Dr. Sarah Kim', titleEl: 'Συνεδρία μέντορα — Dr. Sarah Kim', type: 'mentorship' as EventType, time: '14:00', daysLeft: 2 },
    { id: '2', titleEn: 'Pitch Deck Deadline', titleEl: 'Προθεσμία pitch deck', type: 'deadline' as EventType, time: '23:59', daysLeft: 4 },
    { id: '3', titleEn: 'Startup Networking Mixer', titleEl: 'Networking mixer για startups', type: 'event' as EventType, time: '18:00', daysLeft: 9 },
    { id: '4', titleEn: 'Investor Demo Day', titleEl: 'Demo Day επενδυτών', type: 'pitch' as EventType, time: '10:00', daysLeft: 17 },
  ]
).map((e) => ({ ...e, date: isoInDays(e.daysLeft) }));

const QUICK_ACTIONS: { href: string; glyph: CfbGlyphName; labelEn: string; labelEl: string }[] = [
  { href: '/ai', glyph: 'spark', labelEn: 'Ask AI', labelEl: 'Ρωτήστε το AI' },
  { href: '/discover', glyph: 'discover', labelEn: 'Find co-founders', labelEl: 'Εύρεση συνιδρυτών' },
  { href: '/mentoring', glyph: 'mentor', labelEn: 'Find mentors', labelEl: 'Εύρεση μεντόρων' },
  { href: '/coaching', glyph: 'mentor', labelEn: 'Coaching', labelEl: 'Καθοδήγηση' },
  { href: '/expert-reviews', glyph: 'award', labelEn: 'Expert review', labelEl: 'Αξιολόγηση ειδικού' },
  { href: '/opportunities', glyph: 'target', labelEn: 'Opportunities', labelEl: 'Ευκαιρίες' },
  { href: '/programs', glyph: 'award', labelEn: 'Programs', labelEl: 'Προγράμματα' },
  { href: '/marketplace', glyph: 'briefcase', labelEn: 'Services', labelEl: 'Υπηρεσίες' },
  { href: '/analytics', glyph: 'chart', labelEn: 'Analytics', labelEl: 'Αναλυτικά' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

/** "Open …" under a list in the page-tools rail, where the pair has to be free to wrap. */
function RailListLink({ href, en, el }: { href: string; en: string; el: string }) {
  return (
    <Button variant="ghost" size="sm" className="mt-1 h-auto min-h-8 w-full gap-1 whitespace-normal py-1.5 text-xs" asChild>
      <Link href={href}>
        <BilingualText en={en} el={el} compact wrap className="justify-center text-center" />
        <ArrowRight className="icon-sm shrink-0" aria-hidden="true" />
      </Link>
    </Button>
  );
}

/**
 * A match as a row of the Top Matches card: the person's circle, the name
 * over the headline and the score at the right - the CardHead anatomy
 * without a frame of its own (a bordered box per match drew a card inside
 * the card).
 */
function MatchPreviewRow({ match, viewer }: { match: SearchHit; viewer: ViewerFacts | null }) {
  // Stamped once at mount, like /discover: an impure read inside the render
  // body is flagged, and this card only exists after mount anyway.
  const [nowMs] = useState(() => Date.now());
  const score = match.matchScore ?? 0;
  const scoreColor = score >= 85 ? STATUS.success.icon : score >= 70 ? 'text-primary-accessible' : STATUS.warning.icon;
  // The most telling reason, as the person's card on /matches puts it first.
  const reason = explainMatch(match, viewer, { nowMs })[0] ?? null;
  return (
    <Link href={`/matches/${match.userId}`} className="axis-row group block rounded-md transition-colors hover:bg-accent focus-ring">
      <RowHead
        mark={(
          <Avatar className="h-10 w-10">
            <AvatarImage src={match.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
              {initialsOf(match.displayName)}
            </AvatarFallback>
          </Avatar>
        )}
        title={<span className="block truncate">{match.displayName}</span>}
        // Both lines wrap inside two lines. A compact (one-line) BilingualText
        // inside line-clamp ran past the rail's edge and was cut mid-word,
        // with no ellipsis ("Full-stc", "a co-four"; docs §69).
        subtitle={match.headline ? (
          <span className="line-clamp-2">
            {PREVIEW_HEADLINE_EL[match.headline]
              ? <BilingualText en={match.headline} el={PREVIEW_HEADLINE_EL[match.headline]} compact wrap />
              : match.headline}
          </span>
        ) : undefined}
        meta={reason ? <span className="line-clamp-2"><BilingualText en={reason.en} el={reason.el} compact wrap /></span> : undefined}
        asideStays
        aside={(
          <span className={cn('flex items-center gap-0.5 text-sm font-semibold tabular-nums', scoreColor)}>
            <CfbGlyph name="spark" className="icon-sm" />{score}%
          </span>
        )}
      />
    </Link>
  );
}

function MilestoneRow({ milestone }: { milestone: DemoMilestone }) {
  const isComplete = milestone.status === 'completed';
  const isOverdue = isMilestoneOverdue({ status: milestone.status, dueDate: milestone.dueDate || null });
  const stateLabel = isComplete
    ? bilingualAria('Completed', 'Ολοκληρωμένο')
    : isOverdue
    ? bilingualAria('Overdue', 'Εκπρόθεσμο')
    : bilingualAria('In progress', 'Σε εξέλιξη');
  return (
    <Link
      href="/milestones"
      className="axis-row flex items-start gap-3 rounded-md py-1.5 transition-colors hover:bg-accent"
    >
      <div
        className="mt-0.5 shrink-0 text-muted-foreground"
        role="img"
        aria-label={stateLabel}
        title={stateLabel}
      >
        {isComplete
          ? <CheckCircle2 className={cn('icon-sm', STATUS.success.icon)} aria-hidden="true" />
          : isOverdue
          ? <AlertCircle className={cn('icon-sm', STATUS.danger.icon)} aria-hidden="true" />
          : <Circle className="icon-sm text-muted-foreground" aria-hidden="true" />}
      </div>
      <div className="flex-1 min-w-0">
        {/* The priority wraps under the title when both do not fit: in
            the rail it squeezed the title to one letter. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 text-sm font-medium">
            <BilingualText en={milestone.titleEn} el={milestone.titleEl} compact wrap />
          </p>
          {/* 'warning', not 'destructive': high priority is not an error state, and
              reserving red for overdue/failure keeps the colour meaningful.
              The word 'priority' is spelled out — a bare 'High' next to a
              percentage was ambiguous. */}
          {milestone.priority === 'high' && (
            <Badge variant="warning" size="sm" className="shrink-0">
              <BilingualText en="High priority" el="Υψηλή προτεραιότητα" compact />
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={milestone.progress} label={bilingualAria(milestone.titleEn, milestone.titleEl)} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0 w-9 text-right tabular-nums">{milestone.progress}%</span>
        </div>
        {/* Undated milestones carry no date line, as on /milestones. */}
        {milestone.dueDate && (
          <p className={cn('text-xs mt-1', isOverdue ? STATUS.danger.text : 'text-muted-foreground')}>
            <BilingualText
              en={isOverdue
                ? `Overdue since ${formatShortDate(milestone.dueDate, 'en')}`
                : `Due ${formatShortDate(milestone.dueDate, 'en')}`}
              el={isOverdue
                ? `Εκπρόθεσμο από τις ${formatShortDate(milestone.dueDate, 'el')}`
                : `Λήξη ${formatShortDate(milestone.dueDate, 'el')}`}
              compact
            />
          </p>
        )}
      </div>
    </Link>
  );
}

export default function FounderDashboardContent() {
  const router = useRouter();
  const { openRailSection } = usePageRail();
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const { primary } = useLanguagePreference();
  const { messages: unreadMessages } = useUnreadCounts();

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });
  // The reader's side of each match's reasons (lib/match-explain).
  const viewer = useMemo(() => viewerFacts(profile?.profile ?? null), [profile]);
  /*
   * The Top Matches tile counts what /matches lists, on that page's own query
   * key, so the two cannot disagree. It read `matchesThisWeek` from the
   * platform stats: accepted connection requests across the whole platform
   * this week (12 in the demo), under "Suggestions this week", beside a
   * Matches page listing four people.
   */
  const { data: matchList } = useQuery({
    queryKey: qk('recommendations', 'matches', { limit: 50 }),
    queryFn: () => getRecommendations({ limit: 50 }),
    staleTime: 3 * 60_000,
    enabled: hasSession && mounted,
  });
  const matchCount = matchList?.suggestions?.length;

  /*
   * The same metrics /analytics charts, on the same 7-day period.
   *
   * The profile-views tile used to read `activeProfiles` off the platform
   * stats - how many profiles are active across CoFounderBay, not how often
   * this one was viewed - so it read 1,840 while the page behind its own link
   * read 248. Sharing the query key with /analytics also means the two cannot
   * drift apart in the cache.
   */
  const { data: userMetrics } = useQuery({
    queryKey: qk('analytics', 'metrics', '7d'),
    queryFn: () => getAnalyticsMetrics('7d'),
    enabled: hasSession && mounted,
    staleTime: 60_000,
    retry: 0,
  });

  /** A change of exactly zero is a measurement; a missing one is not an arrow. */
  const trendOf = (change: number | null | undefined) =>
    typeof change === 'number'
      ? { value: Math.abs(change), positive: change >= 0, en: dashboardEn('this_week'), el: dashboardEl('this_week') }
      : undefined;
  /*
   * The days behind "Profile views": the same series the Analytics page
   * charts on its Growth tab, drawn small beside the change (docs §107).
   * Only a real series is drawn; a missing or one-day answer draws nothing.
   */
  const { data: profileViewSeries } = useQuery({
    queryKey: qk('analytics', 'profile-views', '7d'),
    queryFn: () => getAnalyticsProfileViews('7d'),
    enabled: hasSession && mounted,
    staleTime: 60_000,
    retry: 0,
  });
  const profileViewPoints = (Array.isArray(profileViewSeries) ? profileViewSeries : [])
    .filter((day) => typeof day?.date === 'string' && typeof day?.views === 'number')
    .map((day) => ({ label: formatShortDate(day.date, primary === 'el' ? 'el' : 'en'), value: day.views }));

  const profileViewsTrend = (() => {
    const trend = trendOf(userMetrics?.profileViewsChange);
    if (!trend) return undefined;
    return {
      ...trend,
      en: `${trend.en}. Opens analytics`,
      el: `${trend.el}. Ανοίγει τα αναλυτικά`,
    };
  })();

  const { data: recommendations } = useQuery({
    queryKey: queryKeys.recommendations,
    queryFn: () => getRecommendations({ limit: 5 }),
    enabled: hasSession && mounted,
  });

  const { data: connectionRequests } = useQuery({
    queryKey: queryKeys.connections.pendingReceived(),
    queryFn: () => listConnectionRequests({ type: 'received', limit: 50 }),
    enabled: hasSession && mounted,
  });

  /*
   * Need cards and their threads, on the keys CommitmentOutcomes reads. A
   * founder who has never posted one meets the first move instead of the
   * whole dashboard; one who has, and is waited on, gets that step as the
   * first attention chip.
   */
  const firstMove = useFirstMoveState(hasSession && mounted);
  const [firstMoveLater, setFirstMoveLater] = useStoredFlag(FIRST_MOVE_LATER_KEY);
  const { data: ladderThreads } = useQuery({
    queryKey: qk('commitments', 'threads', 'all'),
    queryFn: () => listCommitmentThreads('all'),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });

  const { data: vrs } = useQuery({
    queryKey: qk('readiness', 'venture'),
    queryFn: getVentureReadiness,
    enabled: hasSession && mounted,
    staleTime: 5 * 60 * 1000,
  });

  const own = profile?.profile;
  const displayName = own?.displayName || 'Founder';
  const profileChecks = {
    photoHeadline: !!(own?.avatarUrl && own?.headline),
    skills: (own?.skills?.length ?? 0) >= 5,
    experience: !!(own?.bio && own.bio.trim().length >= 40),
    ideaLinked: (vrs?.signals?.docCount ?? 0) > 0 || (vrs?.signals?.boardCount ?? 0) > 0,
  };
  const pendingRequests = connectionRequests?.connections?.filter((r: { status?: string }) => r.status === 'pending')?.length ?? 0;
  // The card lists these four checks under the figure, so the figure is their share.
  const profileCheckList = Object.values(profileChecks);
  const profilePct = Math.round((profileCheckList.filter(Boolean).length / profileCheckList.length) * 100);
  const founderProgress = vrs?.overall ?? 0;
  const fundRound = fundraisingRoundView(FUNDRAISING_SEED_LEADS);
  const fundStats = fundraisingPipelineStats(FUNDRAISING_SEED_LEADS);
  const fundingPct = Math.round((fundRound.raised / fundRound.target) * 100);
  /*
   * The founder's own milestones, from the endpoint /milestones reads, on its
   * query keys - so the tile, the list under it and that page cannot disagree,
   * and marking one done on either surface refreshes the other.
   */
  const milestoneQuery = useQuery({
    queryKey: qk('milestones', 'all', 'all'),
    queryFn: () => listMilestones({ limit: 100 }),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });
  const { data: milestoneData, isLoading: milestonesLoading, isError: milestonesFailed } = milestoneQuery;

  /*
   * What actually happened, from the endpoint /activity pages through. The
   * card rendered DEMO_ACTIVITY unconditionally, so a real founder's dashboard
   * reported four events that were not theirs.
   */
  const { data: activityPage, isLoading: activityLoading } = useQuery({
    queryKey: qk('dashboard', 'activity', 4),
    queryFn: () => getDashboardActivity({ limit: 4 }),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });

  const liveActivity = useMemo(
    () =>
      (activityPage?.items ?? []).map((item) => {
        const time = activityTimeAgoPair(item.timeAgo);
        return {
          id: item.id,
          href: item.href,
          glyph: ACTIVITY_GLYPH[item.type] ?? ('spark' as const),
          textEn: item.title,
          textEl: activityTitleEl(item.title),
          timeEn: time.en,
          timeEl: time.el,
        };
      }),
    [activityPage],
  );

  const activityItems =
    liveActivity.length > 0 ? liveActivity : activityLoading ? [] : showDemoData ? DEMO_ACTIVITY : [];

  const liveMilestones: DemoMilestone[] = useMemo(
    () =>
      (milestoneData?.milestones ?? []).map((m) => ({
        id: m.id,
        titleEn: m.title,
        // The API stores one title. Showing it in both languages is honest -
        // inventing a Greek rendering of a founder's own words would not be.
        // Only the preview milestones, which are ours, carry a Greek title.
        titleEl: PREVIEW_MILESTONE_EL[m.title]?.title ?? m.title,
        status:
          m.status === 'completed' ? 'completed' : m.status === 'in_progress' ? 'in_progress' : 'pending',
        progress: m.progress,
        dueDate: m.dueDate ?? '',
        priority: m.priority === 'high' || m.priority === 'low' ? m.priority : 'medium',
      })),
    [milestoneData],
  );

  const usingDemoMilestones = liveMilestones.length === 0 && !milestonesLoading && showDemoData;
  const milestones =
    liveMilestones.length > 0 ? liveMilestones : milestonesLoading ? [] : usingDemoMilestones ? DEMO_MILESTONES : [];

  const completedMilestoneCount = milestones.filter((m) => m.status === 'completed' || m.progress >= 100).length;
  const openMilestones = milestones.filter((m) => m.status !== 'completed' && m.progress < 100);
  // Undated milestones sort last: '' orders before every ISO date.
  const openMilestonesByDue = [...openMilestones].sort((a, b) => {
    if (!a.dueDate !== !b.dueDate) return a.dueDate ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const nextOpenMilestone = openMilestonesByDue[0];
  // The card answers "what is due next"; the full list, done ones included, is /milestones.
  const { due: dueFollowUps } = useInvestorFollowUps();
  const upcomingMilestones = openMilestonesByDue.slice(0, 3);
  const moreOpenMilestoneCount = openMilestones.length - upcomingMilestones.length;
  // The same calendar-day rule as /milestones (lib/milestone-order), so the
  // home and the page agree on "Overdue" on the due day itself.
  const isPastDue = (m: DemoMilestone) => isMilestoneOverdue({ status: m.status, dueDate: m.dueDate || null });
  const overdueMilestoneCount = openMilestones.filter(isPastDue).length;
  // Under way and on time: started (in progress, or some progress) and not past its date.
  const activeMilestoneCount = openMilestones.filter((m) => !isPastDue(m) && (m.status === 'in_progress' || m.progress > 0)).length;
  const milestoneCaption = milestones.length === 0
    ? { en: dashboardEn('add_first_milestone'), el: dashboardEl('add_first_milestone') }
    : completedMilestoneCount === milestones.length
      ? { en: dashboardEn('milestones_all_complete'), el: dashboardEl('milestones_all_complete') }
      : // A date on its own reads as the next deadline, even one that has passed.
        overdueMilestoneCount > 0
        ? {
            en: `${openMilestones.length} open · ${overdueMilestoneCount} overdue`,
            el: `${openMilestones.length} ανοιχτά · ${overdueMilestoneCount} ${overdueMilestoneCount === 1 ? 'εκπρόθεσμο' : 'εκπρόθεσμα'}`,
          }
        : // A real milestone may carry no due date, and the separator was printed
        // before the date was: the caption read "6 ανοιχτά ·" and stopped.
        nextOpenMilestone?.dueDate
        ? {
            en: `${openMilestones.length} open · next ${formatShortDate(nextOpenMilestone.dueDate, 'en')}`,
            el: `${openMilestones.length} ανοιχτά · επόμενο ${formatShortDate(nextOpenMilestone.dueDate, 'el')}`,
          }
        : {
            en: `${openMilestones.length} open`,
            el: `${openMilestones.length} ανοιχτά`,
          };
  const waitingThreads = (ladderThreads ?? []).filter(waitsOnMe);
  /**
   * The dashboard's own figures, for the assistant.
   *
   * This is the screen a founder opens on, so it is the one where "what should
   * I do next?" is asked most — and the one where the assistant previously had
   * to answer from the route name alone.
   */
  const onboardingSteps = buildOnboardingSteps({
    hasProfile:      !!(profile?.profile?.displayName && profile?.profile?.headline),
    hasPreferences:  saysLookingFor(profile?.profile),
    hasConnection:   (vrs?.signals?.connectionCount ?? 0) > 0,
    hasBoard:        (vrs?.signals?.boardCount ?? 0) > 0,
    hasArtifact:     (vrs?.signals?.docCount ?? 0) > 0,
  });

  const checklistDismissed = useOnboardingChecklistDismissed();
  const checklistDone = onboardingSteps.every((s) => s.done);

  const { showFirstMove } = firstMoveLayout({
    state: firstMove.state,
    later: firstMoveLater,
    checklistDone,
    checklistDismissed,
    full: false,
  });

  const boardsQuery = useQuery({
    queryKey: qk('research-boards', false),
    queryFn: () => listResearchBoards({ archived: false }),
    enabled: mounted && hasSession && !showFirstMove,
    staleTime: 60_000,
    retry: 0,
  });
  const showContinuation = mounted && hasSession && !showFirstMove;
  const continuation = homeContinuation(
    { rows: boardsQuery.data?.boards, failed: boardsQuery.isError, busy: boardsQuery.isPending },
    { rows: milestoneData?.milestones, failed: milestonesFailed, busy: milestoneQuery.isPending },
  );
  const continuationTarget = showContinuation ? continuation.target : undefined;
  const { rows: todayRows } = useTodayRows();
  const duplicateContinuation = todayRows.some((row) => matchesContinuation(continuationTarget, row));
  const continuationUnavailable = !showContinuation || continuation.pending
    ? { en: 'The continuation step is not available yet.', el: 'Το επόμενο βήμα δεν είναι ακόμη διαθέσιμο.' }
    : continuation.boardsFailed || continuation.milestonesFailed
      ? { en: 'Some continuation work could not be read.', el: 'Δεν ήταν δυνατή η ανάγνωση ορισμένων εκκρεμοτήτων.' }
      : { en: 'There is no open board or milestone to continue.', el: 'Δεν υπάρχει ανοιχτός πίνακας ή ορόσημο για συνέχεια.' };
  usePublishPageSnapshot('/dashboard/founder', {
    title: 'Founder dashboard',
    state: !mounted ? 'loading' : isPreviewDemo() ? 'demo' : 'ready',
    summary: `${displayName}'s dashboard: profile, readiness, connections and the current round.`,
    figures: {
      'Profile completeness': `${profilePct}%`,
      'Founder progress': `${founderProgress}%`,
      'Pending intros': pendingRequests,
      'Unread messages': unreadMessages,
      'Recommended matches': matchCount ?? recommendations?.suggestions?.length ?? 0,
      'Milestones complete': `${completedMilestoneCount}/${milestones.length}`,
      'Next milestone': nextOpenMilestone?.titleEn ?? (milestonesFailed || !milestoneData?.milestones ? 'unknown' : 'none'),
      ...(showDemoData
        ? { 'Round progress': `${fundingPct}%`, 'Committed investors': fundStats.committed }
        : {}),
      'Need cards posted': firstMove.count ?? 'unknown',
      'Ladder steps waiting on you': waitingThreads.length,
      ...(showContinuation ? {
        'Continue': continuationTarget?.en ?? continuationUnavailable.en,
        ...(continuationTarget ? { 'Continue data': continuation.boardsFailed || continuation.milestonesFailed ? 'partial' : 'available' } : {}),
      } : {}),
    },
    actions: ['navigate', 'draft_need_card', 'shortlist_add', 'send_connection', 'start_or_send_message'],
  });

  usePageList([
    {
      id: 'open_milestones',
      labelEn: 'Open milestones',
      labelEl: 'Ανοιχτά ορόσημα',
      rows: !mounted || milestonesLoading || !milestoneData?.milestones
        ? undefined
        : openMilestonesByDue.map((m) => `${m.titleEn} · ${m.progress}%${isPastDue(m) ? ' · overdue' : m.dueDate ? ` · due ${formatShortDate(m.dueDate, 'en')}` : ''}`),
      rowsEl: !mounted || milestonesLoading || !milestoneData?.milestones
        ? undefined
        : openMilestonesByDue.map((m) => `${m.titleEl} · ${m.progress}%${isPastDue(m) ? ' · εκπρόθεσμο' : m.dueDate ? ` · λήξη ${formatShortDate(m.dueDate, 'el')}` : ''}`),
      total: milestoneData?.milestones ? milestones.length : undefined,
      sample: usingDemoMilestones,
    },
    {
      id: 'founder_progress_dimensions',
      labelEn: 'Founder progress dimensions',
      labelEl: 'Διαστάσεις προόδου ιδρυτή',
      rows: !mounted || !vrs?.dimensions ? undefined : vrs.dimensions.map((d) => `${d.label} · ${d.score}%`),
      rowsEl: !mounted || !vrs?.dimensions ? undefined : vrs.dimensions.map((d) => `${ventureDimensionEl(d.key, d.label)} · ${d.score}%`),
    },
    {
      id: 'top_matches',
      labelEn: 'Top matches',
      labelEl: 'Κορυφαίες αντιστοιχίσεις',
      rows: !mounted || !recommendations?.suggestions ? undefined : recommendations.suggestions.slice(0, 3).map((m) => `${m.displayName}${m.matchScore != null ? ` · ${m.matchScore}%` : ''}${m.headline ? ` · ${m.headline}` : ''}`),
      rowsEl: !mounted || !recommendations?.suggestions ? undefined : recommendations.suggestions.slice(0, 3).map((m) => `${m.displayName}${m.matchScore != null ? ` · ${m.matchScore}%` : ''}${m.headline ? ` · ${m.headline}` : ''}`),
      total: matchCount ?? recommendations?.suggestions?.length,
    },
  ]);

  usePageControls([
    {
      id: 'open_continuation',
      labelEn: 'Open next step to continue',
      labelEl: 'Άνοιγμα επόμενου βήματος για συνέχεια',
      writes: false,
      unavailableEn: continuationTarget ? undefined : continuationUnavailable.en,
      unavailableEl: continuationTarget ? undefined : continuationUnavailable.el,
      run: () => { if (continuationTarget) router.push(continuationTarget.href); },
    },
    {
      id: 'open_lowest_progress',
      labelEn: 'Open lowest founder progress dimension',
      labelEl: 'Άνοιγμα χαμηλότερης διάστασης προόδου',
      writes: false,
      unavailableEn: vrs?.lowestDimension?.href ? undefined : 'Founder progress has not loaded yet.',
      unavailableEl: vrs?.lowestDimension?.href ? undefined : 'Ο βαθμός προόδου δεν έχει φορτώσει ακόμη.',
      run: () => { if (vrs?.lowestDimension?.href) router.push(vrs.lowestDimension.href); },
    },
    {
      id: 'open_milestones_page',
      labelEn: 'Manage milestones',
      labelEl: 'Διαχείριση ορόσημων',
      writes: false,
      run: () => router.push('/milestones'),
    },
    {
      id: 'open_snapshot_panel',
      labelEn: 'Open venture snapshot panel',
      labelEl: 'Άνοιγμα στιγμιοτύπου εγχειρήματος',
      writes: false,
      run: () => openRailSection('snapshot'),
    },
    {
      id: 'open_commitments_panel',
      labelEn: 'Open commitments panel',
      labelEl: 'Άνοιγμα δεσμεύσεων',
      writes: false,
      run: () => openRailSection('commitments'),
    },
  ]);

  if (!mounted) {
    return (
      <AppShell>
        <div className="py-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="min-w-0 h-24" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  /*
   * Milestones, in the column: what is due next, how many are done and how many
   * are late. It was a card in the page's tools and a "5/12" tile in the column;
   * the tile said the count and the card, one gesture away, said which.
   */
  const milestonesCard = (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
                  <SectionSticker glyph="flag" tint="success" />
                  <BilingualText en={dashboardEn('milestones')} el={dashboardEl('milestones')} compact />
                  {milestones.length > 0 ? <span className="font-normal tabular-nums text-muted-foreground">{completedMilestoneCount}/{milestones.length}</span> : null}
                </CardTitle>
                {openMilestones.length > 0 ? (
                  <AIInsightButton
                    variant="card"
                    prompt={ASK.dashMilestones}
                    label={dashboardEn('ask_ai_milestones')}
                    labelEl={dashboardEl('ask_ai_milestones')}
                  />
                ) : null}
                <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%] gap-1" asChild>
                  <Link href="/milestones">
                    <BilingualText en={dashboardEn('manage')} el={dashboardEl('manage')} compact />
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            {/* The done/late bar and its caption are on the Milestones tile a
                row above; the card holds what the tile cannot, the rows. */}
            <CardContent className="space-y-4">
              {milestonesFailed && milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <BilingualText en="Not read: the server is unavailable." el="Δεν διαβάστηκαν: ο διακομιστής δεν είναι διαθέσιμος." wrap />
                </p>
              ) : null}
              {usingDemoMilestones && (
                <p className="text-xs text-muted-foreground">
                  <BilingualText
                    en="Sample timeline — manage live items on Milestones."
                    el="Δείγμα χρονοδιαγράμματος — διαχειριστείτε τα πραγματικά στα Ορόσημα."
                    compact
                    wrap
                  />
                </p>
              )}
              {upcomingMilestones.map((m) => <MilestoneRow key={m.id} milestone={m} />)}
              {milestones.length > 0 && (moreOpenMilestoneCount > 0 || completedMilestoneCount > 0) && (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  {/* Stacked: each language already joins its parts with "·". */}
                  <BilingualText
                    en={openMilestones.length === 0
                      ? dashboardEn('milestones_all_complete')
                      : [
                          moreOpenMilestoneCount > 0 ? `${moreOpenMilestoneCount} more open` : null,
                          completedMilestoneCount > 0 ? `${completedMilestoneCount} completed` : null,
                        ].filter(Boolean).join(' · ')}
                    el={openMilestones.length === 0
                      ? dashboardEl('milestones_all_complete')
                      : [
                          moreOpenMilestoneCount > 0
                            ? `${moreOpenMilestoneCount} ακόμη ${moreOpenMilestoneCount === 1 ? 'ανοιχτό' : 'ανοιχτά'}`
                            : null,
                          completedMilestoneCount > 0
                            ? `${completedMilestoneCount} ${completedMilestoneCount === 1 ? 'ολοκληρωμένο' : 'ολοκληρωμένα'}`
                            : null,
                        ].filter(Boolean).join(' · ')}
                    stacked
                    wrap
                  />
                </p>
              )}
              {milestones.length === 0 && !usingDemoMilestones && !milestonesFailed && (
                <p className="text-sm text-muted-foreground">
                  <BilingualText
                    en={dashboardEn('add_first_milestone')}
                    el={dashboardEl('add_first_milestone')}
                  />
                </p>
              )}
            </CardContent>
          </Card>
  );

  /*
   * Families that are not the dashboard's reason for existing.
   *
   * The column is the glance: greeting, next action, four figures,
   * attention, readiness. Fundraising, matches, milestones and profile
   * strength are readouts of other pages — they stay one gesture away
   * in the rail, never deleted.
   * Quick actions is nine destinations. XP and badges answer how the
   * product is rewarding you. Activity and events are a readout of
   * elsewhere, not the pulse.
   */
  const fundraisingCard = (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
            <SectionSticker glyph="wallet" tint="success" />
            <BilingualText en={dashboardEn('fundraising')} el={dashboardEl('fundraising')} compact />
          </CardTitle>
          <AIInsightButton
            variant="card"
            prompt={ASK.dashFundraising}
            label={dashboardEn('ask_ai_fundraising')}
            labelEl={dashboardEl('ask_ai_fundraising')}
          />
          <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%] gap-1" asChild>
            <Link href="/fundraising">
              <BilingualText en={dashboardEn('open_tracker')} el={dashboardEl('open_tracker')} compact />
              <ArrowRight className="icon-sm" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showDemoData ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {fundRound.nameEl
                    ? <BilingualText en={fundRound.name} el={fundRound.nameEl} compact />
                    : fundRound.name}
                </p>
                <p className="card-body font-semibold tabular-nums text-foreground">
                  {fundRound.currency}{(fundRound.raised / 1000).toFixed(0)}K
                  <span className="ml-1 font-normal text-muted-foreground">
                    / {fundRound.currency}{(fundRound.target / 1000).toFixed(0)}K
                  </span>
                </p>
              </div>
              <span className={cn(
                'shrink-0 card-body font-semibold tabular-nums',
                fundingPct >= 75 ? STATUS.success.icon : fundingPct >= 40 ? STATUS.warning.icon : 'text-muted-foreground'
              )}>
                {fundingPct}%
              </span>
            </div>
            <Progress value={fundingPct} label={bilingualAria('Round progress', 'Πρόοδος γύρου')} className="h-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CfbGlyph name="people" className="icon-sm" />
                {fundStats.total}{' '}
                <BilingualText
                  en={dashboardEn(fundStats.total === 1 ? 'lead_tracked' : 'leads_tracked')}
                  el={dashboardEl(fundStats.total === 1 ? 'lead_tracked' : 'leads_tracked')}
                  compact
                />
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className={cn('icon-sm', STATUS.success.icon)} />
                {fundStats.committed}{' '}
                <BilingualText
                  en={dashboardEn(fundStats.committed === 1 ? 'committed_one' : 'committed_count')}
                  el={dashboardEl(fundStats.committed === 1 ? 'committed_one' : 'committed_count')}
                  compact
                />
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <BilingualText
              en={dashboardEn('fundraising_empty')}
              el={dashboardEl('fundraising_empty')}
              wrap
            />
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/investors">
              <CfbGlyph name="discover" className="icon-sm" />
              <BilingualText en={dashboardEn('find_investors')} el={dashboardEl('find_investors')} compact />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const topMatchesCard = (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
            <SectionSticker glyph="matches" tint="accent" />
            <BilingualText en={dashboardEn('top_matches')} el={dashboardEl('top_matches')} compact />
          </CardTitle>
          <AIInsightButton
            variant="card"
            prompt={(recommendations?.suggestions?.length ?? 0) > 0 ? ASK.dashMatches : ASK.dashBetterMatches}
            label={dashboardEn('ask_ai_matches')}
            labelEl={dashboardEl('ask_ai_matches')}
          />
          <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%] gap-1" asChild>
            <Link href="/matches">
              <BilingualText en={dashboardEn('view_all')} el={dashboardEl('view_all')} compact />
              <ArrowRight className="icon-sm" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(recommendations?.suggestions?.length ?? 0) > 0 && (
          <div className="card-rows">
            {recommendations?.suggestions?.slice(0, 3).map((match: SearchHit) => (
              <MatchPreviewRow key={match.userId} match={match} viewer={viewer} />
            ))}
          </div>
        )}
        {(!recommendations?.suggestions || recommendations.suggestions.length === 0) && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <BilingualText
                en={dashboardEn('complete_profile_for_matches')}
                el={dashboardEl('complete_profile_for_matches')}
                wrap
              />
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link href="/profile/edit">
                  <CfbGlyph name="profile" className="icon-sm" />
                  <BilingualText en={dashboardEn('complete_profile')} el={dashboardEl('complete_profile')} compact />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const rail: PageRailSection[] = [
    {
      id: 'snapshot',
      glyph: 'shield',
      labelEn: 'Profile strength',
      labelEl: 'Ισχύς προφίλ',
      content: (
        <div className="space-y-4">
          {/* Profile strength */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
                  <SectionSticker glyph="shield" tint="neutral" />
                  <BilingualText en={dashboardEn('profile_strength')} el={dashboardEl('profile_strength')} />
                </CardTitle>
                <AIInsightButton
                  variant="card"
                  prompt={ASK.dashProfile}
                  label={dashboardEn('ask_ai_profile')}
                  labelEl={dashboardEl('ask_ai_profile')}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <BilingualText en={dashboardEn('completion')} el={dashboardEl('completion')} compact />
                </span>
                <span className={cn('font-semibold tabular-nums', profilePct >= 80 ? STATUS.success.icon : STATUS.warning.icon)}>{profilePct}%</span>
              </div>
              <Progress value={profilePct} label={bilingualAria('Profile completeness', 'Πληρότητα προφίλ')} className="h-2" />
              {/* Two columns from `sm`: this card moved out of the 381px
                  sidebar into the 786px main column, where four checklist
                  rows stacked single-file would be four short lines with
                  half the card empty beside them. */}
              <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 sm:space-y-0">
                {[
                  { labelEn: 'Photo & headline', labelEl: 'Φωτογραφία & τίτλος', done: profileChecks.photoHeadline },
                  { labelEn: 'Skills (5+)', labelEl: 'Δεξιότητες (5+)', done: profileChecks.skills },
                  { labelEn: 'Work experience', labelEl: 'Εργασιακή εμπειρία', done: profileChecks.experience },
                  { labelEn: 'Startup idea linked', labelEl: 'Σύνδεση ιδέας startup', done: profileChecks.ideaLinked },
                ].map((item) => (
                  <div key={item.labelEn} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className={cn('icon-sm shrink-0', item.done ? STATUS.success.icon : 'text-muted-foreground/30')} />
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                      <BilingualText en={item.labelEn} el={item.labelEl} compact />
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {profilePct < 100 ? (
                  <Button variant="secondary" size="md" className="w-full gap-1.5" asChild>
                    <Link href="/profile/edit">
                      <CfbGlyph name="profile" className="icon-sm" />
                      <BilingualText en={dashboardEn('fill_remaining_profile')} el={dashboardEl('fill_remaining_profile')} compact />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                    <Link href="/profile">
                      <CfbGlyph name="profile" className="icon-sm" />
                      <BilingualText en={dashboardEn('keep_current')} el={dashboardEl('keep_current')} compact />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      glyph: 'spark',
      labelEn: 'Quick actions',
      labelEl: 'Γρήγορες ενέργειες',
      content: (
        <div className="space-y-3">
          <YourPagesRow />
          {/* No card title: the rail section above it is already called "Quick actions". */}
          <Card>
            <CardContent>
              {/* List, not a 3×3 app-icon grid: the nine destinations stay,
                  the bordered tiles were the noisiest block on the rail.
                  Ask AI is visually first so the control surface is obvious. */}
              <div className="flex flex-col">
                {QUICK_ACTIONS.map(({ href, glyph, labelEn, labelEl }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'axis-row flex min-h-9 min-w-0 items-center gap-2.5 rounded-md py-1.5 text-sm text-foreground transition-colors hover:bg-accent',
                      href === '/ai' && 'bg-primary/[0.04] font-medium',
                    )}
                  >
                    <CfbGlyph
                      name={glyph}
                      className={cn('icon-sm shrink-0', href === '/ai' ? 'text-primary-accessible' : 'text-muted-foreground')}
                    />
                    {/* Stacked, like the sidebar: inline pairs wrapped or not by length, so rows alternated between one and two lines. */}
                    <span className="min-w-0">
                      <BilingualText en={labelEn} el={labelEl} stacked wrap />
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'progress',
      glyph: 'award',
      labelEn: 'Progress and badges',
      labelEl: 'Πρόοδος και εμβλήματα',
      content: (
        <div className="space-y-4">
          {/* XP Progress Widget */}
          <XPProgressWidget />

          {/* Badges Widget */}
          <BadgesWidget />
        </div>
      ),
    },
    {
      id: 'now',
      glyph: 'calendar',
      labelEn: 'Activity and events',
      labelEl: 'Δραστηριότητα και εκδηλώσεις',
      badge: showDemoData ? DEMO_EVENTS.slice(0, 3).length : null,
      content: (
        <div className="space-y-4">
          <BehavioralNudge surface="dashboard" />

          {/* The "Open …" links sit under each list, not beside its title: at rail
              width a header row held neither, and the link ran past the card edge. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start gap-2">
                <SectionSticker glyph="spark" tint="info" />
                <BilingualText en={dashboardEn('recent_activity')} el={dashboardEl('recent_activity')} compact wrap />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {activityItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="axis-row flex items-start gap-3 rounded-md py-2 transition-colors hover:bg-accent"
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    <CfbGlyph name={item.glyph} className="icon-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <BilingualText en={item.textEn} el={item.textEl} stacked wrap />
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <BilingualText en={item.timeEn} el={item.timeEl} compact />
                    </p>
                  </div>
                </Link>
              ))}
              <RailListLink href="/activity" en="Open activity" el="Άνοιγμα δραστηριότητας" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start gap-2">
                <SectionSticker glyph="calendar" tint="warning" />
                <BilingualText en={dashboardEn('upcoming')} el={dashboardEl('upcoming')} compact wrap />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {showDemoData ? (
                <>
                {DEMO_EVENTS.slice(0, 3).map((event, index) => {
                  const tone = EVENT_CONFIG[event.type];
                  const cfg = STATUS[tone];
                  const isUrgent = event.daysLeft <= 3;
                  return (
                    <Link
                      key={event.id}
                      href="/events"
                      className={cn('axis-row flex items-start gap-3 rounded-md py-1.5 transition-colors hover:bg-accent', index >= 2 && 'max-sm:hidden')}
                    >
                      <div className="mt-0.5 shrink-0 text-muted-foreground">
                        <CfbGlyph name="calendar" className={cn('icon-sm', isUrgent ? cfg.icon : 'text-muted-foreground')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          <BilingualText en={event.titleEn} el={event.titleEl} compact wrap />
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          {/* One language, as /milestones prints dates: the pair was the same date and time twice. */}
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatShortDate(event.date, primary)} · {event.time}
                          </span>
                          <span className={cn(
                            'text-xs font-medium',
                            isUrgent ? STATUS.danger.icon : event.daysLeft <= 7 ? STATUS.warning.icon : 'text-muted-foreground'
                          )}>
                            {event.daysLeft === 0
                              ? <BilingualText en={dashboardEn('today')} el={dashboardEl('today')} compact />
                              : event.daysLeft === 1
                              ? <BilingualText en={dashboardEn('tomorrow')} el={dashboardEl('tomorrow')} compact />
                              : <BilingualText en={`In ${event.daysLeft}d`} el={`Σε ${event.daysLeft} ημ.`} compact />}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <RailListLink href="/events" en="Open events" el="Άνοιγμα εκδηλώσεων" />
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="No events this week" el="Δεν υπάρχουν εκδηλώσεις αυτή την εβδομάδα" wrap />
                  </p>
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <Link href="/events">
                      <BilingualText en="Browse events" el="Περιήγηση εκδηλώσεων" /> <ArrowRight className="icon-sm" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      // Where the need cards stand. It left the column (docs §116); what
      // waits on the founder is in Today.
      id: 'commitments',
      glyph: 'people',
      labelEn: 'Commitments',
      labelEl: 'Δεσμεύσεις',
      content: <CommitmentOutcomes waitingShownAbove={waitingThreads.length > 0} />,
    },
    {
      // GitHub keeps its changelog in the dashboard's right column.
      id: 'whats-new',
      glyph: 'spark',
      labelEn: 'What’s new',
      labelEl: 'Τι νέο',
      content: <WhatsNewRail audience="founder" />,
    },
  ];
  return (
    <AppShell
      rail={rail}
      showHelp
      // One question box on this page: the home's own (HomeAskHero, below the
      // title). The header's one-line field would be a second one; its weekly
      // brief prompt is the hero's "My week" chip. The chat bubble still opens
      // the assistant without a prompt.
      askAi={false}
      // No "Founder" badge beside "Founder dashboard": the title says it
      // (docs §70).
    >
      {/* The tour points at the figures, checklist and readiness: it waits for
          the card list to answer and never plays over a folded dashboard. */}
      <FirstRunTour tourId="founder-dashboard" steps={FOUNDER_TOUR} ready={mounted && firstMove.settled} />
      <div className="min-w-0 space-y-6 overflow-x-clip">

        {/* GitHub's home: a greeting over one question box and the jobs to
            start from. The weekly brief the header's field used to send is
            the "My week" chip. */}
        <HomeAskHero role="founder" followUpsDue={dueFollowUps.length} showWaiting={false} plain name={own?.displayName} lead={{ en: dashboardEn('greeting_lead'), el: dashboardEl('greeting_lead') }} />

        {showFirstMove && (
          <FounderFirstMove
            onLater={() => setFirstMoveLater(true)}
            assist={
              <AskAiButton
                prompt={ASK.dashNeedCard}
                labelEn="Draft it with the assistant"
                labelEl="Σύνταξη με τον βοηθό"
              />
            }
          />
        )}

        {/* How the startup is doing (docs §120): what waits on the founder, the
            live counts, the people, the one thing in progress, the progress
            score. The first steps and the three doors are on Help, and the
            shortcuts in the page's tools. */}
        <div data-tour="founder-today"><HomeToday continuation={continuationTarget} rows={todayRows} /></div>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-tour="founder-stats">
          <MetricTile
            align="center"
            glyph="profile"
            label={dashboardEn('profile_views')} labelEl={dashboardEl('profile_views')}
            value={userMetrics?.profileViews ?? '—'}
            trend={profileViewsTrend}
            trendVisual={profileViewPoints.length > 1 ? <Sparkline points={profileViewPoints} /> : undefined}
            caption={profileViewsTrend ? undefined : 'People who opened your profile. Opens analytics'}
            captionEl={profileViewsTrend ? undefined : 'Άτομα που άνοιξαν το προφίλ σας. Ανοίγει τα αναλυτικά'}
            href="/analytics"
          />
          <MetricTile
            align="center"
            glyph="matches"
            label="Recommended matches" labelEl="Προτεινόμενες αντιστοιχίσεις"
            value={matchCount ?? recommendations?.suggestions?.length ?? '—'}
            caption="People who fit your criteria"
            captionEl="Άτομα που ταιριάζουν στα κριτήριά σας"
            href="/matches"
          />
          <MetricTile
            align="center"
            glyph="messages"
            label={dashboardEn('unread_messages')} labelEl={dashboardEl('unread_messages')}
            value={unreadMessages}
            href="/messages"
            caption={unreadMessages > 0 ? `${unreadMessages} waiting in Messages` : 'Inbox caught up'}
            captionEl={unreadMessages > 0 ? `${unreadMessages} σε αναμονή στα Μηνύματα` : 'Όλα διαβασμένα'}
          />
          <MetricTile
            align="center"
            glyph="flag"
            label={dashboardEn('milestones')} labelEl={dashboardEl('milestones')}
            value={milestonesFailed && milestones.length === 0 ? '—' : `${completedMilestoneCount}/${milestones.length}`}
            href="/milestones"
            edge={milestones.length > 0 ? (
              <ProgressSegments
                total={milestones.length}
                segments={[
                  { key: 'done', value: completedMilestoneCount, tone: 'done' },
                  { key: 'active', value: activeMilestoneCount, tone: 'active' },
                  { key: 'late', value: overdueMilestoneCount, tone: 'late' },
                ]}
              />
            ) : undefined}
            caption={milestonesFailed && milestones.length === 0 ? 'Not read: the server is unavailable. Opens milestones' : milestoneCaption.en}
            captionEl={milestonesFailed && milestones.length === 0 ? 'Δεν διαβάστηκαν: ο διακομιστής δεν είναι διαθέσιμος. Ανοίγει τα ορόσημα' : milestoneCaption.el}
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            {milestonesCard}
            {showContinuation ? (
              <HomeContinue
                continuation={duplicateContinuation ? { ...continuation, target: undefined } : continuation}
                busy={boardsQuery.isFetching || milestoneQuery.isFetching}
                retry={() => {
                  if (continuation.boardsFailed) void boardsQuery.refetch();
                  if (continuation.milestonesFailed) void milestoneQuery.refetch();
                }}
              />
            ) : null}
          </div>
          <div className="min-w-0 space-y-5">
            {topMatchesCard}
            {fundraisingCard}
          </div>
        </div>

        <div data-tour="founder-readiness"><FounderProgressCard /></div>
      </div>
    </AppShell>
  );
}
