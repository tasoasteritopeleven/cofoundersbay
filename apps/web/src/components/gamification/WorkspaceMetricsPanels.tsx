'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceReadiness,
  getWorkspaceMomentum,
  getWorkspaceContributions,
  getWorkspaceMentorMetrics,
  type GamificationReadinessSummary,
  type GamificationMomentumSummary,
  type GamificationContributionSummary,
  type GamificationMentorMetrics,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { FactLine } from '@/components/common/FactLine';
import { RowHead } from '@/components/dashboard/SectionCard';
import { readinessEvidence } from '@/lib/readiness-evidence';
import { qk } from '@/lib/query-keys';
import {
  Target,
  Zap,
  Users,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Star,
  Activity,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

// ── Readiness dimension display config ───────────────────────────────────────

const DIMENSION_CONFIG: Array<{
  key: keyof GamificationReadinessSummary['dimensions'];
  label: string;
  labelEl: string;
  icon: typeof Target;
  description: string;
}> = [
  { key: 'problemClarity',       label: 'Problem Clarity',       labelEl: 'Σαφήνεια προβλήματος',       icon: Target,        description: 'Problem statement definition' },
  { key: 'solutionClarity',      label: 'Solution Clarity',      labelEl: 'Σαφήνεια λύσης',            icon: CheckCircle2,  description: 'Solution artifact completeness' },
  { key: 'marketUnderstanding',  label: 'Market Understanding',  labelEl: 'Κατανόηση αγοράς',          icon: BarChart3,     description: 'Market analysis depth' },
  { key: 'productDefinition',    label: 'Product Definition',    labelEl: 'Ορισμός προϊόντος',         icon: BookOpen,      description: 'PRD / MVP spec completeness' },
  { key: 'teamCompleteness',     label: 'Team Completeness',     labelEl: 'Πληρότητα ομάδας',          icon: Users,         description: 'Co-founders, mentors, collaborators' },
  { key: 'executionReadiness',   label: 'Execution Readiness',   labelEl: 'Ετοιμότητα εκτέλεσης',      icon: TrendingUp,    description: 'Milestones × completion rate' },
  { key: 'validationScore',      label: 'Validation Score',      labelEl: 'Βαθμός επικύρωσης',         icon: Star,          description: 'Expert reviews + feedback applied' },
  { key: 'artifactCompleteness', label: 'Artifact Completeness', labelEl: 'Πληρότητα παραδοτέων',      icon: Activity,      description: 'Avg document completion %' },
];

function scoreColor(score: number): string {
  if (score >= 75) return 'text-status-success ';
  if (score >= 50) return 'text-status-warning ';
  if (score >= 25) return 'text-status-warning ';
  return 'text-status-danger ';
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-status-success-mark';
  if (score >= 50) return 'bg-status-warning-mark';
  if (score >= 25) return 'bg-status-warning-mark';
  return 'bg-status-danger-mark';
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'outline' {
  if (score >= 75) return 'default';
  if (score >= 40) return 'secondary';
  return 'outline';
}

// ── Readiness Panel ───────────────────────────────────────────────────────────

interface ReadinessPanelProps {
  workspaceId: string;
  compact?: boolean;
}

export function WorkspaceReadinessPanel({ workspaceId, compact = false }: ReadinessPanelProps) {
  const { data, isLoading } = useQuery<GamificationReadinessSummary>({
    queryKey: qk('gamification', 'readiness', workspaceId),
    queryFn: () => getWorkspaceReadiness(workspaceId),
    staleTime: 2 * 60_000,
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: compact ? 4 : 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // `!data` is not enough of a guard. A payload can arrive without the fields
  // this panel reads -- it did, because /builder had no demo handler for this
  // endpoint and the generic fallback has none of them -- and `data.dimensions[key]`
  // then threw and took the whole page down through the error boundary.
  if (!data || !data.dimensions) return null;

  const dims = compact ? DIMENSION_CONFIG.slice(0, 4) : DIMENSION_CONFIG;
  const score = typeof data.score === 'number' ? data.score : 0;
  const bottleneck = typeof data.bottleneckFactor === 'number' ? data.bottleneckFactor : 1;
  const isGated = bottleneck < 0.95;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="icon-sm text-muted-foreground" />
            <BilingualText en="Startup Readiness" el="Ετοιμότητα startup" compact />
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <span className={cn('card-body font-semibold tabular-nums', scoreColor(score))}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <Progress value={score} className="h-2 mt-1" />
        {isGated && (
          <p className="text-2xs text-status-warning mt-1">
            <BilingualText
              en={`Bottleneck suppression active (×${bottleneck.toFixed(2)}) — strengthen critical dimensions`}
              el={`Ενεργή καταστολή στενωπού (×${bottleneck.toFixed(2)}) — ενισχύστε τις κρίσιμες διαστάσεις`}
              wrap
            />
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {dims.map(({ key, label, labelEl, icon: Icon }) => {
          const score   = data.dimensions?.[key] ?? 0;
          const detail  = data.dimensionBreakdown?.[key];
          const evidence = readinessEvidence(key, detail?.signals, detail?.detail);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon className="icon-sm shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">
                    <BilingualText en={label} el={labelEl} compact />
                  </span>
                  {detail?.weight && (
                    <span className="text-2xs text-muted-foreground hidden md:block">
                      ×{(detail.weight * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant={scoreBadgeVariant(score)}
                    className="text-2xs px-1.5 py-0 h-4 tabular-nums"
                  >
                    {score}%
                  </Badge>
                </div>
              </div>
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
                  style={{ width: `${score}%` }}
                />
              </div>
              {/* The evidence, on its own line.
                  It used to sit on the title row at `max-w-[140px] truncate`,
                  right-aligned against the badge. The sentences it carries are
                  180-240px, so a 1440px measurement found all eight clipped —
                  "Founder only — no technical cofounde…" — and the one text on
                  the panel that answers "why is my score this" was the only one
                  nobody could finish reading. The row has no room to give: the
                  badge owns the right edge. A line of its own costs eight rows
                  of height and makes the reading order what the reader expects:
                  what it is, what it scored, how far along, and then why. */}
              {evidence && (
                <p className="text-2xs leading-snug text-muted-foreground">
                  <BilingualText en={evidence.en} el={evidence.el} stacked wrap />
                </p>
              )}
            </div>
          );
        })}
        {compact && (
          <p className="text-2xs text-muted-foreground pt-1">
            <BilingualText en="Showing top 4 dimensions · Full view in Readiness tab" el="Εμφανίζονται οι 4 κορυφαίες διαστάσεις · Πλήρης προβολή στην καρτέλα Ετοιμότητα" compact wrap />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Team Momentum Panel ───────────────────────────────────────────────────────

interface MomentumPanelProps {
  workspaceId: string;
}

export function TeamMomentumPanel({ workspaceId }: MomentumPanelProps) {
  const { data, isLoading } = useQuery<GamificationMomentumSummary>({
    queryKey: qk('gamification', 'momentum', workspaceId),
    queryFn: () => getWorkspaceMomentum(workspaceId),
    staleTime: 2 * 60_000,
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-36" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Same shape of guard as the readiness panel above: `breakdown` and the
  // numeric fields can all be absent on a partial payload.
  const bd = data.breakdown ?? ({} as NonNullable<typeof data.breakdown>);
  const score = typeof data.score === 'number' ? data.score : 0;
  const velocity = typeof data.velocity === 'number' ? data.velocity : 0;
  const momentumLevel = bd.momentumLevel ?? (score >= 75 ? 'High-Velocity' : score >= 55 ? 'Strong' : score >= 35 ? 'Steady' : score >= 15 ? 'Low' : 'Stalled');
  const momentumColor = momentumLevel === 'High-Velocity' || momentumLevel === 'Strong' ? 'text-status-success ' : momentumLevel === 'Steady' ? 'text-status-warning ' : 'text-status-danger ';

  const componentBars = [
    { label: 'Velocity',           labelEl: 'Ταχύτητα',              value: bd.velocityScore             ?? 0 },
    { label: 'Recent Activity',    labelEl: 'Πρόσφατη δραστηριότητα', value: bd.recentActivityScore       ?? 0 },
    { label: 'Collaboration',      labelEl: 'Συνεργασία',            value: bd.collaborationDensityScore ?? 0 },
    { label: 'Feedback Loops',     labelEl: 'Βρόχοι ανατροφοδότησης', value: bd.feedbackLoopScore         ?? 0 },
    { label: 'Milestone Rate',     labelEl: 'Ρυθμός ορόσημων',       value: bd.milestoneRateScore        ?? 0 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="icon-sm text-status-warning" />
            <BilingualText en="Team Momentum" el="Ορμή ομάδας" compact />
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', momentumColor)}>{momentumLevel}</span>
            <span className={cn('card-body font-semibold tabular-nums', scoreColor(score))}>
              {score}
              <span className="text-xs text-muted-foreground font-normal">/100</span>
            </span>
          </div>
        </div>
        <Progress value={score} className="h-1.5 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Figures on the card's axis, not in tinted boxes inside it; the
            label comes first for a screen reader, the figure shows above it. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Actions a day (14 days)" el="Ενέργειες την ημέρα (14 ημέρες)" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{velocity.toFixed(2)}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Contributors" el="Συνεισφέροντες" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{bd.activeContributors ?? 0}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Actions (7 days)" el="Ενέργειες (7 ημέρες)" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{bd.meaningful7d ?? 0}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Feedback loops" el="Βρόχοι ανατροφοδότησης" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{bd.feedbackLoopsCompleted ?? 0}</dd>
          </div>
        </dl>
        <div className="space-y-1.5">
          {componentBars.map(({ label, labelEl, value }) => (
            <div key={label}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-muted-foreground"><BilingualText en={label} el={labelEl} compact /></span>
                <span className="font-medium tabular-nums">{value}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full', scoreBarColor(value))} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Contribution Panel ────────────────────────────────────────────────────────

interface ContributionPanelProps {
  workspaceId: string;
}

export function ContributionPanel({ workspaceId }: ContributionPanelProps) {
  const { data: contributors, isLoading } = useQuery<GamificationContributionSummary[]>({
    queryKey: qk('gamification', 'contributions', workspaceId),
    queryFn: () => getWorkspaceContributions(workspaceId),
    staleTime: 2 * 60_000,
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Array.isArray, not a length check: an object response has no `length`, so
  // `contributors.length === 0` is false and the map below then throws
  // "contributors.slice is not a function" and takes the page with it.
  if (!Array.isArray(contributors) || contributors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="icon-sm text-status-info" />
          <BilingualText en="Contributions" el="Συνεισφορές" compact />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Rows parted by hairlines, each a head: the member, their rank and
            what they did as one facts line, the score at the right; the bar
            and the explanation under it on the same axis. */}
        <div className="card-rows">
        {contributors.slice(0, 5).map((c, idx) => {
          const bd = c.breakdown ?? ({} as NonNullable<typeof c.breakdown>);
          const recentActivity = (bd.recentArtifactsCreated ?? 0) + (bd.recentArtifactsImproved ?? 0) + (bd.recentFeedbackApplied ?? 0);
          return (
            <div key={c.userId} className="space-y-2">
              {/* Was `6C·9I ·0FA ·3↑`: letters invented here and explained only
                  in a `title`, which never appears on a touch screen. The nouns
                  are written out in both languages, and a count of zero is
                  dropped rather than printed as `0FA`. */}
              <RowHead
                title={<span className="block truncate" title={c.userId} translate="no">{c.userId}</span>}
                subtitle={(
                  <FactLine
                    items={[
                      <span key="rank" className="tabular-nums">#{idx + 1}</span>,
                      ...([
                        { n: bd.artifactsCreated ?? 0, en: 'Created', el: 'Δημιουργίες' },
                        { n: bd.artifactsImproved ?? 0, en: 'Improved', el: 'Βελτιώσεις' },
                        { n: bd.feedbackApplied ?? 0, en: 'Applied', el: 'Εφαρμοσμένα' },
                        { n: recentActivity, en: 'In 14 days', el: 'Σε 14 ημέρες', tone: 'text-status-success' },
                      ] as const)
                        .filter((part) => part.n > 0)
                        .map((part) => (
                          <span key={part.en} className={'tone' in part ? part.tone : undefined}>
                            <BilingualText en={part.en} el={part.el} compact />{' '}
                            <span className="font-medium tabular-nums">{part.n}</span>
                          </span>
                        )),
                    ]}
                  />
                )}
                asideStays
                aside={(
                  <Badge variant={scoreBadgeVariant(c.score)} className="tabular-nums">
                    {c.score}
                  </Badge>
                )}
              />
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', scoreBarColor(c.score))}
                  style={{ width: `${c.score}%` }}
                />
              </div>
              {c.rawScore > 0 && idx === 0 && c.explain && (
                <p className="text-xs text-muted-foreground first-letter:uppercase">{c.explain}</p>
              )}
            </div>
          );
        })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Mentor Metrics Panel ──────────────────────────────────────────────────────

interface MentorMetricsPanelProps {
  workspaceId: string;
}

export function MentorMetricsPanel({ workspaceId }: MentorMetricsPanelProps) {
  const fmtDate = useDateFormat();
  const { data, isLoading } = useQuery<GamificationMentorMetrics>({
    queryKey: qk('gamification', 'mentor-metrics', workspaceId),
    queryFn: () => getWorkspaceMentorMetrics(workspaceId),
    staleTime: 2 * 60_000,
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-44" /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="icon-sm text-status-accent" />
            <BilingualText en="Mentor Feedback Loop" el="Βρόχος ανατροφοδότησης μέντορα" compact />
          </CardTitle>
          <Badge variant={scoreBadgeVariant(data.improvementScore)} className="tabular-nums">
            {data.improvementScore}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Figures on the card's axis, not in tinted boxes inside it; the
            label comes first for a screen reader, the figure shows above it. */}
        <dl className="grid grid-cols-3 gap-x-4">
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Received" el="Ελήφθησαν" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{data.feedbackCount ?? 0}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Applied" el="Εφαρμόστηκαν" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{data.appliedFeedbackCount ?? 0}</dd>
          </div>
          <div className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-xs text-muted-foreground"><BilingualText en="Apply rate" el="Ποσοστό εφαρμογής" compact wrap /></dt>
            <dd className="page-stat font-bold tabular-nums">{Math.round((data.appliedFeedbackRate ?? 0) * 100)}%</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          {[
            { label: 'Apply Rate',  labelEl: 'Ποσοστό εφαρμογής', value: Math.round((data.appliedFeedbackRate ?? 0) * 100) },
            { label: 'Speed',       labelEl: 'Ταχύτητα',          value: Math.round((data.speedScore ?? 0) * 100) },
            { label: 'Depth',       labelEl: 'Βάθος',             value: Math.round((data.depthScore ?? 0) * 100) },
            { label: 'Low Burden',  labelEl: 'Χαμηλός φόρτος',    value: Math.round((data.burdenScore ?? 0) * 100) },
          ].map(({ label, labelEl, value }) => (
            <div key={label}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-muted-foreground"><BilingualText en={label} el={labelEl} compact /></span>
                <span className="font-medium tabular-nums">{value}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full', scoreBarColor(value))} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>

        {(data.unresolvedFeedback ?? 0) > 0 && (
          <p className="text-2xs text-status-warning ">
            <BilingualText
              en={`${data.unresolvedFeedback} unresolved feedback item${data.unresolvedFeedback !== 1 ? 's' : ''} — consider applying`}
              el={`${data.unresolvedFeedback} ${data.unresolvedFeedback !== 1 ? 'σχόλια χωρίς απάντηση' : 'σχόλιο χωρίς απάντηση'} — εξετάστε να τα εφαρμόσετε`}
              wrap
            />
          </p>
        )}

        {data.avgResponseTimeHrs > 0 && (
          <p className="text-2xs text-muted-foreground">
            <BilingualText en="Avg. response time:" el="Μέσος χρόνος απάντησης:" compact /> <span className="font-medium tabular-nums">{data.avgResponseTimeHrs.toFixed(1)}h</span>
          </p>
        )}
        {data.lastFeedbackAt && (
          <p className="text-2xs text-muted-foreground">
            <BilingualText en="Last feedback:" el="Τελευταία ανατροφοδότηση:" compact /> {fmtDate(data.lastFeedbackAt, { day: 'numeric', month: 'short' })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Composite panel (all four in a responsive grid) ───────────────────────────

interface WorkspaceMetricsPanelsProps {
  workspaceId: string;
  compact?: boolean;
}

export function WorkspaceMetricsPanels({ workspaceId, compact = false }: WorkspaceMetricsPanelsProps) {
  if (!workspaceId) return null;

  return (
    <div className="space-y-3">
      <WorkspaceReadinessPanel workspaceId={workspaceId} compact={compact} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TeamMomentumPanel workspaceId={workspaceId} />
        <MentorMetricsPanel workspaceId={workspaceId} />
      </div>
      <ContributionPanel workspaceId={workspaceId} />
    </div>
  );
}
