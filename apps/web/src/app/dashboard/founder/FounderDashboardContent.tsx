'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { ventureDimensionEl } from '@/lib/i18n/venture-dimensions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/useSession';
import { useDemoData } from '@/contexts/DemoDataContext';
import { usePopupChatOptional } from '@/contexts/PopupChatContext';
import { usePublishPageSnapshot } from '@/contexts/PageSnapshotContext';
import { isPreviewDemo } from '@/lib/preview-demo';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { queryKeys, qk } from '@/lib/query-keys';
import {
  getDashboardStats,
  getMeProfile,
  getRecommendations,
  listConnectionRequests,
  getVentureReadiness,
  type SearchHit,
  getAnalyticsMetrics,
  listMilestones,
  getDashboardActivity,
} from '@/lib/api';
import {
  fundraisingRoundView,
  fundraisingPipelineStats,
  FUNDRAISING_SEED_LEADS,
} from '@/lib/fundraising-demo';
import {
  OnboardingChecklist,
  buildOnboardingSteps,
  useOnboardingChecklistDismissed,
} from '@/components/gamification/OnboardingChecklist';
import { NextActionBanner, deriveNextAction } from '@/components/gamification/NextActionBanner';
import { VentureReadinessCard } from '@/components/gamification/VentureReadinessCard';
import { CommitmentOutcomes } from '@/components/commitments/CommitmentOutcomes';
import { WhatsNewPanel } from '@/components/dashboard/WhatsNewPanel';
import {
  FIRST_MOVE_LATER_KEY,
  FULL_DASHBOARD_KEY,
  FounderFirstMove,
  RestOfDashboardToggle,
  firstMoveLayout,
  useFirstMoveState,
  useStoredFlag,
} from '@/components/dashboard/FounderFirstMove';
import { listCommitmentThreads } from '@/lib/commitments-api';
import { nextAction as ladderNextAction, waitsOnMe } from '@/lib/commitments-next';
import { MetricTile } from '@/components/dashboard/MetricTile';
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
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
const FOUNDER_TOUR: TourStep[] = [
  {
    target: 'founder-stats',
    titleEn: 'Your live counts, not a second score',
    titleEl: 'Ζωντανά πλήθη, όχι δεύτερη βαθμολογία',
    bodyEn: 'Profile views, matches this week, unread messages, and milestone completion. A dash means the metric was not recorded — it is not zero. Each tile opens the page that owns that number.',
    bodyEl: 'Προβολές προφίλ, αντιστοιχίσεις της εβδομάδας, μη αναγνωσμένα μηνύματα και ολοκλήρωση οροσήμων. Η παύλα σημαίνει ότι η μέτρηση δεν καταγράφηκε — όχι μηδέν. Κάθε πλακίδιο ανοίγει τη σελίδα που κατέχει αυτόν τον αριθμό.',
  },
  {
    target: 'founder-checklist',
    titleEn: 'Finish the checklist before the banner',
    titleEl: 'Ολοκληρώστε τη λίστα πριν το banner',
    bodyEn: 'These steps unlock matching and the Builder. The “next action” banner stays hidden while this list is open, so you are not told the same thing twice.',
    bodyEl: 'Αυτά τα βήματα ξεκλειδώνουν την αντιστοίχιση και τον Builder. Το banner «επόμενη ενέργεια» μένει κρυφό όσο η λίστα είναι ανοιχτή, ώστε να μην ακούτε το ίδιο δύο φορές.',
  },
  {
    target: 'founder-attention',
    titleEn: 'Attention chips are the short list',
    titleEl: 'Τα chips προσοχής είναι η σύντομη λίστα',
    bodyEn: 'Each chip is one thing that needs a click this week — pending intros, unread threads, or a weak readiness dimension. They disappear when the underlying count is zero.',
    bodyEl: 'Κάθε chip είναι ένα πράγμα που θέλει κλικ αυτή την εβδομάδα — εκκρεμείς γνωριμίες, μη αναγνωσμένα νήματα ή αδύναμη διάσταση ετοιμότητας. Εξαφανίζονται όταν το πλήθος είναι μηδέν.',
  },
  {
    target: 'founder-readiness',
    titleEn: 'Readiness lives in one card',
    titleEl: 'Η ετοιμότητα ζει σε μία κάρτα',
    bodyEn: 'This is the investor-facing score across six dimensions. Completing criteria here updates the saved score. It is not the same number as “Founder progress” in the header.',
    bodyEl: 'Αυτή είναι η βαθμολογία προς επενδυτές σε έξι διαστάσεις. Το τσεκάρισμα κριτηρίων ενημερώνει την αποθηκευμένη βαθμολογία. Δεν είναι ο ίδιος αριθμός με την «Πρόοδο ιδρυτή» στην κεφαλίδα.',
  },
];

function getTimeBasedGreeting(): { en: string; el: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { en: dashboardEn('good_morning'), el: dashboardEl('good_morning') };
  if (hour < 17) return { en: dashboardEn('good_afternoon'), el: dashboardEl('good_afternoon') };
  return { en: dashboardEn('good_evening'), el: dashboardEl('good_evening') };
}

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
  /** Sent to the in-page assistant, which keeps this page's context; `/ai?q=` without the popup. */
  prompt?: string;
  className?: string;
  variant?: 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'md';
}) {
  const popup = usePopupChatOptional();
  const buttonClass = cn('h-auto min-h-9 gap-1.5 py-1.5 leading-snug', className);
  const label = (
    <>
      <CfbGlyph name="spark" className="icon-sm shrink-0" aria-hidden="true" />
      <BilingualText en={labelEn ?? dashboardEn('ask_ai')} el={labelEl ?? dashboardEl('ask_ai')} compact wrap />
    </>
  );
  if (popup && prompt) {
    return (
      <Button type="button" variant={variant} size={size} className={buttonClass} onClick={() => popup.ask(prompt)}>
        {label}
      </Button>
    );
  }
  const href = prompt ? `/ai?q=${encodeURIComponent(prompt)}` : '/ai';
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

type AttentionItem = { href: string; glyph: CfbGlyphName; en: string; el: string; urgent?: boolean };

function AttentionChips({
  items,
}: {
  items: AttentionItem[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex min-w-0 flex-wrap gap-2" data-tour="founder-attention">
      {items.map((item) => (
        <li key={`${item.href}:${item.en}`} className="min-w-0">
          <Link
            href={item.href}
            className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 sm:min-h-0"
          >
            <CfbGlyph name={item.glyph} className={cn('icon-sm shrink-0', item.urgent ? STATUS.danger.icon : 'text-muted-foreground')} />
            <span className="min-w-0 truncate">
              <BilingualText en={item.en} el={item.el} compact />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * A match as a row of the Top Matches card: the person's circle, the name
 * over the headline and the score at the right - the CardHead anatomy
 * without a frame of its own (a bordered box per match drew a card inside
 * the card).
 */
function MatchPreviewRow({ match }: { match: SearchHit }) {
  const score = match.matchScore ?? 0;
  const scoreColor = score >= 85 ? STATUS.success.icon : score >= 70 ? 'text-primary-accessible' : STATUS.warning.icon;
  return (
    <Link href={`/matches/${match.userId}`} className="axis-row group block rounded-md transition-colors hover:bg-accent focus-ring">
      <RowHead
        mark={(
          <Avatar className="h-10 w-10">
            <AvatarImage src={match.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
              {match.displayName?.[0]?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
        )}
        title={<span className="block truncate">{match.displayName}</span>}
        subtitle={match.headline ? (
          <span className="line-clamp-2">
            {PREVIEW_HEADLINE_EL[match.headline]
              ? <BilingualText en={match.headline} el={PREVIEW_HEADLINE_EL[match.headline]} compact />
              : match.headline}
          </span>
        ) : undefined}
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
  const isOverdue = !!milestone.dueDate && new Date(milestone.dueDate) < new Date() && !isComplete;
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
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();
  const { primary } = useLanguagePreference();
  const { messages: unreadMessages } = useUnreadCounts();

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });

  const { data: stats } = useQuery({
    queryKey: qk('dashboard', 'stats', 'founder'),
    queryFn: getDashboardStats,
    enabled: hasSession && mounted,
  });

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
  const [fullDashboard, setFullDashboard] = useStoredFlag(FULL_DASHBOARD_KEY);
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
  const greeting = getTimeBasedGreeting();
  /*
   * The founder's own milestones, from the endpoint /milestones reads, on its
   * query keys - so the tile, the list under it and that page cannot disagree,
   * and marking one done on either surface refreshes the other.
   */
  const { data: milestoneData, isLoading: milestonesLoading } = useQuery({
    queryKey: qk('milestones', 'all', 'all'),
    queryFn: () => listMilestones({ limit: 100 }),
    enabled: hasSession && mounted,
    staleTime: 30_000,
    retry: 0,
  });

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
  const upcomingMilestones = openMilestonesByDue.slice(0, 5);
  const moreOpenMilestoneCount = openMilestones.length - upcomingMilestones.length;
  const isPastDue = (m: DemoMilestone) => !!m.dueDate && new Date(m.dueDate).getTime() < Date.now();
  const overdueMilestoneCount = openMilestones.filter(isPastDue).length;
  const nextIsOverdue = !!nextOpenMilestone && isPastDue(nextOpenMilestone);
  const messageCaption = unreadMessages === 0
    ? { en: dashboardEn('inbox_clear'), el: dashboardEl('inbox_clear') }
    : unreadMessages === 1
      ? { en: '1 waiting', el: '1 σε αναμονή' }
      : { en: `${unreadMessages} waiting`, el: `${unreadMessages} σε αναμονή` };
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
  const attentionItems: AttentionItem[] = [];
  // A person is waiting on the founder's answer on the ladder: that comes first.
  const waitingThreads = (ladderThreads ?? []).filter(waitsOnMe);
  const firstWaiting = waitingThreads[0];
  const firstWaitingStep = firstWaiting ? ladderNextAction(firstWaiting) : null;
  if (firstWaiting && firstWaitingStep) {
    const more = waitingThreads.length - 1;
    attentionItems.push({
      href: `/commitments/${encodeURIComponent(firstWaiting.cardId)}?thread=${encodeURIComponent(firstWaiting.id)}`,
      glyph: 'pact',
      en: more > 0 ? `${firstWaitingStep.en} (+${more} more)` : firstWaitingStep.en,
      el: more > 0 ? `${firstWaitingStep.el} (+${more} ακόμη)` : firstWaitingStep.el,
    });
  }
  // Unread messages have their own tile directly above these chips, linking to
  // the same inbox; a chip saying "1 unread message" under "Unread messages 1"
  // was the same fact twice. The chips carry what no tile says.
  if (pendingRequests > 0) {
    attentionItems.push({
      href: '/connections?tab=requests',
      glyph: 'people',
      en: pendingRequests === 1 ? '1 intro waiting' : `${pendingRequests} intros waiting`,
      el: pendingRequests === 1 ? '1 γνωριμία σε αναμονή' : `${pendingRequests} γνωριμίες σε αναμονή`,
    });
  }
  if (nextOpenMilestone) {
    attentionItems.push({
      href: '/milestones',
      glyph: 'flag',
      en: `${nextIsOverdue ? 'Overdue' : 'Next'}: ${nextOpenMilestone.titleEn}`,
      el: `${nextIsOverdue ? 'Εκπρόθεσμο' : 'Επόμενο'}: ${nextOpenMilestone.titleEl}`,
      urgent: nextIsOverdue,
    });
  }
  if (vrs?.lowestDimension?.href && typeof vrs.lowestDimension.score === 'number' && vrs.lowestDimension.score < 55) {
    attentionItems.push({
      href: vrs.lowestDimension.href,
      glyph: 'chart',
      // "Ανύψωση" was a literal rendering of "Lift" that means physically
      // raising something. The colon form also matches the milestone chip
      // beside it ("Επόμενο: …") and sidesteps declining the dimension name.
      en: `Lift ${vrs.lowestDimension.label} (${vrs.lowestDimension.score}%)`,
      el: `Βελτιώστε: ${ventureDimensionEl(vrs.lowestDimension.key, vrs.lowestDimension.label)} (${vrs.lowestDimension.score}%)`,
    });
  }

  /**
   * The dashboard's own figures, for the assistant.
   *
   * This is the screen a founder opens on, so it is the one where "what should
   * I do next?" is asked most — and the one where the assistant previously had
   * to answer from the route name alone.
   */
  usePublishPageSnapshot('/dashboard/founder', {
    title: 'Founder dashboard',
    state: !mounted ? 'loading' : isPreviewDemo() ? 'demo' : 'ready',
    summary: `${displayName}'s dashboard: profile, readiness, connections and the current round.`,
    figures: {
      'Profile completeness': `${profilePct}%`,
      'Founder progress': `${founderProgress}%`,
      'Pending intros': pendingRequests,
      'Unread messages': unreadMessages,
      'Recommended matches': recommendations?.suggestions?.length ?? 0,
      'Milestones complete': `${completedMilestoneCount}/${milestones.length}`,
      'Next milestone': nextOpenMilestone?.titleEn ?? 'none',
      'Round progress': `${fundingPct}%`,
      'Committed investors': fundStats.committed,
      'Need cards posted': firstMove.count ?? 'unknown',
      'Ladder steps waiting on you': waitingThreads.length,
    },
    actions: ['navigate', 'draft_need_card', 'shortlist_add', 'send_connection', 'start_or_send_message'],
  });

  const onboardingSteps = buildOnboardingSteps({
    hasProfile:      !!(profile?.profile?.displayName && profile?.profile?.headline),
    hasPreferences:  !!((profile?.profile as { lookingFor?: unknown[] } | undefined)?.lookingFor && ((profile?.profile as { lookingFor?: unknown[] }).lookingFor as unknown[])?.length > 0),
    hasConnection:   (vrs?.signals?.connectionCount ?? 0) > 0,
    hasBoard:        (vrs?.signals?.boardCount ?? 0) > 0,
    hasArtifact:     (vrs?.signals?.docCount ?? 0) > 0,
  });

  const checklistDismissed = useOnboardingChecklistDismissed();
  const checklistDone = onboardingSteps.every((s) => s.done);

  // The first move, and the fold over the rest for a founder just starting.
  const { showFirstMove, restFoldable, restFolded } = firstMoveLayout({
    state: firstMove.state,
    later: firstMoveLater,
    checklistDone,
    checklistDismissed,
    full: fullDashboard,
  });

  const nextAction = deriveNextAction({
    hasProfile:      !!(profile?.profile?.displayName && profile?.profile?.headline),
    hasPreferences:  !!((profile?.profile as { lookingFor?: unknown[] } | undefined)?.lookingFor && ((profile?.profile as { lookingFor?: unknown[] }).lookingFor as unknown[])?.length > 0),
    connectionCount: vrs?.signals?.connectionCount ?? 0,
    boardCount:      vrs?.signals?.boardCount ?? 0,
    docCount:        vrs?.signals?.docCount ?? 0,
    vrsLowestKey:    vrs?.lowestDimension?.key,
    pendingRequests,
    unreadMessages,
  });

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
  const rail: PageRailSection[] = [
    {
      id: 'snapshot',
      glyph: 'wallet',
      labelEn: 'Venture snapshot',
      labelEl: 'Στιγμιότυπο εγχειρήματος',
      content: (
        <div className="space-y-4">
          {/* Fundraising widget */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
                  <CfbGlyph name="wallet" className="icon-sm text-muted-foreground" />
                  <BilingualText en={dashboardEn('fundraising')} el={dashboardEl('fundraising')} compact />
                </CardTitle>
                <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%] gap-1" asChild>
                  <Link href="/fundraising">
                    <BilingualText en={dashboardEn('open_tracker')} el={dashboardEl('open_tracker')} compact />
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {showDemoData ? (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {fundRound.nameEl
                            ? <BilingualText en={fundRound.name} el={fundRound.nameEl} compact />
                            : fundRound.name}
                        </p>
                        {/* The amount is a value inside the card, a step under its
                            title (the card text ladder), not a display figure. */}
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
                    <Progress value={fundingPct} label={bilingualAria('Round progress', 'Πρόοδος γύρου')} className="h-2.5" />
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
                <div className="space-y-2.5">
                  {/* One column in the rail (two side by side ran past its
                      edge at 1440), two in the expanded view. */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                      <Link href="/fundraising" className="flex-1">
                        <CfbGlyph name="wallet" className="icon-sm" />
                        <BilingualText en={dashboardEn('manage_pipeline')} el={dashboardEl('manage_pipeline')} compact />
                      </Link>
                    </Button>
                    <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                      <Link href="/investors" className="flex-1">
                        <CfbGlyph name="discover" className="icon-sm" />
                        <BilingualText en={dashboardEn('find_investors')} el={dashboardEl('find_investors')} compact />
                      </Link>
                    </Button>
                  </div>
                  {/* A card's question for the assistant sits under what it asks about,
                      as on Founder progress: a header row has no room for both languages. */}
                  <AskAiButton
                    variant="ghost"
                    className="w-full"
                    prompt="Review this fundraising round against my readiness and tell me the next investor action."
                    labelEn={dashboardEn('ask_ai_fundraising')}
                    labelEl={dashboardEl('ask_ai_fundraising')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
           {/* Top Matches */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
                  <CfbGlyph name="matches" className="icon-sm text-muted-foreground" />
                  <BilingualText en={dashboardEn('top_matches')} el={dashboardEl('top_matches')} compact />
                </CardTitle>
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
                  {recommendations?.suggestions?.slice(0, 4).map((match: SearchHit) => (
                    <MatchPreviewRow key={match.userId} match={match} />
                  ))}
                </div>
              )}
              {(recommendations?.suggestions?.length ?? 0) > 0 && (
                <AskAiButton
                  variant="ghost"
                  className="w-full"
                  prompt="How can I improve these matches and who should I reach out to first?"
                  labelEn={dashboardEn('ask_ai_matches')}
                  labelEl={dashboardEl('ask_ai_matches')}
                />
              )}
              {(!recommendations?.suggestions || recommendations.suggestions.length === 0) && (
                // The empty list's line and its two ways on, on the card's
                // axis: a dashed box inside the card was a card in a card.
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
                    <AskAiButton
                      variant="ghost"
                      prompt="How can I start receiving better matches from this profile?"
                      labelEn={dashboardEn('ask_ai_matches')}
                      labelEl={dashboardEl('ask_ai_matches')}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
           {/* Milestones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2">
                  <CfbGlyph name="flag" className="icon-sm text-muted-foreground" />
                  <BilingualText en={dashboardEn('milestones')} el={dashboardEl('milestones')} compact />
                </CardTitle>
                <Button variant="ghost" size="sm" className="-mr-2 min-w-0 max-w-[50%] gap-1" asChild>
                  <Link href="/milestones">
                    <BilingualText en={dashboardEn('manage')} el={dashboardEl('manage')} compact />
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
              {milestones.length === 0 && !usingDemoMilestones && (
                <p className="text-sm text-muted-foreground">
                  <BilingualText
                    en={dashboardEn('add_first_milestone')}
                    el={dashboardEl('add_first_milestone')}
                  />
                </p>
              )}
              {openMilestones.length > 0 && (
                <AskAiButton
                  variant="ghost"
                  className="w-full"
                  prompt="How do I hit these milestone dates, and what should I sequence first?"
                  labelEn={dashboardEn('ask_ai_milestones')}
                  labelEl={dashboardEl('ask_ai_milestones')}
                />
              )}
            </CardContent>
          </Card>
          {/* Profile strength — moved here from the sidebar.
              The two columns were 1663px and 2169px, so the wider,
              more important one ended 506px early and the page had a
              void down its left side. This card is the one sidebar
              item that is a task rather than a readout, so it is the
              one that belongs in the main column; moving it leaves the
              columns within ~25px of each other and keeps XP and
              Badges together where they belong. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="shield" className="icon-sm text-muted-foreground" />
                <BilingualText en={dashboardEn('profile_strength')} el={dashboardEl('profile_strength')} />
              </CardTitle>
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
                <AskAiButton
                  variant="ghost"
                  className="w-full"
                  prompt="Review my founder profile and suggest what would make it stronger for investors and co-founders."
                  labelEn={dashboardEn('ask_ai_profile')}
                  labelEl={dashboardEl('ask_ai_profile')}
                />
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
                <CfbGlyph name="spark" className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
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
                <CfbGlyph name="calendar" className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
                <BilingualText en={dashboardEn('upcoming')} el={dashboardEl('upcoming')} compact wrap />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {showDemoData ? (
                <>
                {DEMO_EVENTS.slice(0, 3).map((event) => {
                  const tone = EVENT_CONFIG[event.type];
                  const cfg = STATUS[tone];
                  const isUrgent = event.daysLeft <= 3;
                  return (
                    <Link
                      key={event.id}
                      href="/events"
                      className="axis-row flex items-start gap-3 rounded-md py-1.5 transition-colors hover:bg-accent"
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
  ];
  return (
    <AppShell
      rail={rail}
      showHelp
      // One Ask AI in the header, not three. AppShell renders its own whenever the
      // page has a title, and this page was additionally passing an AIInsightButton
      // and an AskAiButton through `actions` — on a 360px screen that stacked into
      // three near-identical buttons. Handing AppShell the specific prompt keeps the
      // most useful of the three in the standard position; the prompt-less "open the
      // assistant" affordance is unchanged and still reachable from the chat bubble.
      askAi="Brief me on this founder dashboard: what needs attention this week, summarize the graph, and the next action among intros, matches, messages, or profile gaps."
      actions={
        <>
          <Badge variant="outline" className="gap-1.5">
            <CfbGlyph name="builder" className="icon-sm" /> <BilingualText en="Founder" el="Ιδρυτής" compact />
          </Badge>
          {/* Jumps to the founder progress card below. It opened /readiness,
              whose score is a different measure (the company's readiness for
              investors), so "Progress: 52%" led to a page that said 61. */}
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="#founder-progress">
              <CfbGlyph name="chart" className="icon-sm" />
              <BilingualText en={`Founder progress: ${founderProgress}%`} el={`Πρόοδος ιδρυτή: ${founderProgress}%`} compact />
            </a>
          </Button>
        </>
      }
    >
      {/* The tour points at the figures, checklist and readiness: it waits for
          the card list to answer and never plays over a folded dashboard. */}
      <FirstRunTour tourId="founder-dashboard" steps={FOUNDER_TOUR} ready={mounted && firstMove.settled && !restFolded} />
      <div className="min-w-0 space-y-6 overflow-x-clip">

        <p className="text-sm text-muted-foreground">
          <BilingualText
            en={`${greeting.en}, ${displayName}. ${dashboardEn('greeting_lead')}`}
            el={`${greeting.el}, ${displayName}. ${dashboardEl('greeting_lead')}`}
            stacked
            wrap
            secondaryFrom="lg"
          />
        </p>

        {showFirstMove && (
          <FounderFirstMove
            onLater={() => setFirstMoveLater(true)}
            assist={
              <AskAiButton
                prompt="Help me draft my first need card: ask me who my startup needs, then open the filled guide so I can review and publish it."
                labelEn="Draft it with the assistant"
                labelEl="Σύνταξη με τον βοηθό"
              />
            }
          />
        )}

        {restFoldable && (
          <RestOfDashboardToggle
            open={!restFolded}
            onToggle={() => setFullDashboard(restFolded)}
            controls="founder-dashboard-rest"
            stepsDone={onboardingSteps.filter((s) => s.done).length}
            stepsTotal={onboardingSteps.length}
          />
        )}

        <div id="founder-dashboard-rest" hidden={restFolded} className="min-w-0 space-y-6">
          {/* Getting-started checklist. */}
          <OnboardingChecklist steps={onboardingSteps} />

          {/* One "what to do next" prompt at a time.
              The checklist already names the next incomplete step and links to it,
              so a NextActionBanner above it was a second copy of the same advice.
              Once the checklist is finished or dismissed the banner takes over, so
              the guidance is never lost. `undefined` means localStorage has not
              been read yet — render nothing rather than flash the banner. */}
          {nextAction && (checklistDone || checklistDismissed === true) && (
            <NextActionBanner action={nextAction} />
          )}

          {/* Stats */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-tour="founder-stats">
            <MetricTile
              glyph="profile"
              label={dashboardEn('profile_views')} labelEl={dashboardEl('profile_views')}
              value={userMetrics?.profileViews ?? '—'}
              trend={trendOf(userMetrics?.profileViewsChange)}
              href="/analytics"
            />
            {/* No endpoint reports a week-over-week change for matches, so this
                tile carried a literal 3 as its arrow. It shows the count alone. */}
            <MetricTile
              glyph="matches"
              label={dashboardEn('top_matches')} labelEl={dashboardEl('top_matches')}
              value={stats?.matchesThisWeek ?? '—'}
              href="/matches"
            />
            <MetricTile
              glyph="messages"
              label={dashboardEn('unread_messages')} labelEl={dashboardEl('unread_messages')}
              value={unreadMessages}
              href="/messages"
              caption={messageCaption.en}
              captionEl={messageCaption.el}
            />
            <MetricTile
              glyph="flag"
              label={dashboardEn('milestones')} labelEl={dashboardEl('milestones')}
              value={`${completedMilestoneCount}/${milestones.length}`}
              href="/milestones"
              caption={milestoneCaption.en}
              captionEl={milestoneCaption.el}
            />
          </div>

          <AttentionChips items={attentionItems} />

          {/* Readiness — single home in the column.
              Fundraising, matches, milestones and profile strength live in
              the rail (`snapshot`) so this page stays a glance, not a stack. */}
          {vrs && (
            <div id="founder-progress" className="scroll-mt-24" data-tour="founder-readiness">
              <VentureReadinessCard
                  data={vrs}
                  footer={
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                          <Link href="/readiness" className="w-full">
                            <CfbGlyph name="chart" className="icon-sm" />
                            <BilingualText en="Startup readiness" el="Ετοιμότητα startup" compact wrap />
                          </Link>
                        </Button>
                        <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                          <Link href="/builder" className="w-full">
                            <CfbGlyph name="builder" className="icon-sm" />
                            <BilingualText en="Open Builder" el="Άνοιγμα Builder" compact wrap />
                          </Link>
                        </Button>
                        <Button variant="outline" size="md" className="w-full gap-1.5" asChild>
                          <Link href="/expert-reviews" className="w-full">
                            <CfbGlyph name="award" className="icon-sm" />
                            <BilingualText en="Get Expert Review" el="Αξιολόγηση ειδικού" compact wrap />
                          </Link>
                        </Button>
                      </div>
                      <AskAiButton
                        variant="ghost"
                        className="w-full"
                        prompt="What should I improve next on venture readiness, given the lowest dimension on this dashboard?"
                        labelEn={dashboardEn('ask_ai_readiness')}
                        labelEl={dashboardEl('ask_ai_readiness')}
                      />
                    </div>
                  }
                />
            </div>
          )}

          {/* Beside readiness: whether the people the startup needs are coming -
              each need card's outcome and the steps waiting on the founder. */}
          <CommitmentOutcomes />

          {/* What the October round added, each with the place to try it. */}
          <WhatsNewPanel audience="founder" />
        </div>
      </div>
    </AppShell>
  );
}
