'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Sparkles,
  TrendingUp,
  Target,
  RefreshCw,
  UserPlus,
  Star,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Briefcase,
  GraduationCap,
  DollarSign,
  ChevronDown,
  EyeOff,
  Clock,
  Search,
  ShieldCheck,
  BookmarkPlus,
  Filter,
  X,
  Info,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailStats } from '@/components/layout/RailParts';
import { BilingualText } from '@/components/common/BilingualText';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  getRecommendations,
  getWeeklyDigest,
  sendConnectionRequest,
  recordMatchFeedback,
  recordBehavioralSignal,
  getMatchingStats,
  getShortlistIds,
  saveToShortlist,
  removeFromShortlist,
  type SearchHit,
  type MatchSuggestion,
  type MatchFeedbackType,
  type MatchExplanationItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { StatusText } from '@/components/common/StatusText';
import { bilingualAria } from '@/lib/i18n/format';

const ROLE_ICON: Record<string, typeof Users> = {
  founder: Briefcase,
  mentor: GraduationCap,
  investor: DollarSign,
  org: Users,
};

const ROLE_COLOR: Record<string, string> = {
  founder: 'bg-status-info-bg text-status-info border-status-info-border',
  mentor: 'bg-status-info-bg text-status-info border-status-info-border',
  investor: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  org: 'bg-status-accent-bg text-status-accent border-status-accent-border',
};

function MatchScoreBadge({ score }: { score: number }) {
  // Semantic chips, not white on a mid-tone fill: white on emerald-500 is
  // 2.5:1, under the 4.5:1 small text needs (axe color-contrast on every card).
  const color =
    score >= 80 ? STATUS.success.chip : score >= 60 ? STATUS.info.chip : STATUS.neutral.chip;
  return (
    <div className={cn('flex items-center gap-1 border text-xs font-semibold px-2 py-0.5 rounded-full', color)}>
      <Star className="icon-sm fill-current" aria-hidden="true" />
      {score}%
    </div>
  );
}

// Dimension score bar for explanation
function ExplanationBar({ items, maxItems = 3 }: { items: MatchExplanationItem[]; maxItems?: number }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {items.slice(0, maxItems).map((item) => (
        <div key={item.dimension} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-28 shrink-0">{item.label}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                item.score >= 0.8 ? 'bg-status-success-mark' : item.score >= 0.6 ? 'bg-status-info-mark' : 'bg-status-warning-mark'
              )}
              style={{ width: `${Math.round(item.score * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{Math.round(item.score * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// Full match score breakdown modal
function BreakdownModal({
  open, onClose, displayName, score, explanation, reasons,
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  score: number;
  explanation: MatchExplanationItem[];
  reasons: string[];
}) {
  const color = score >= 80 ? 'text-status-success' : score >= 60 ? 'text-status-info' : 'text-status-warning';
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="icon-sm text-muted-foreground" />
            Match Score Breakdown
          </DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="How the overall score breaks down by dimension." el="Πώς αναλύεται ο συνολικός βαθμός ανά διάσταση." /></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Overall Match Score</span>
            <span className={cn('page-stat text-2xl font-bold', color)}>{score}%</span>
          </div>
          {explanation.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Score by Dimension</p>
              <ExplanationBar items={explanation} maxItems={explanation.length} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Dimension breakdown not available for this match.</p>
          )}
          {reasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Why We Matched You</p>
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((r, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary-accessible px-2 py-0.5 rounded-full border border-primary/15">{r}</span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Scores are based on skills, industry, goals, experience, and availability alignment with <strong>{displayName}</strong>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Rich feedback dropdown
const FEEDBACK_OPTIONS: { label: string; value: MatchFeedbackType; icon: any; color?: string }[] = [
  { label: 'Great match!', value: 'accepted', icon: ThumbsUp, color: 'text-status-success' },
  { label: 'Not relevant', value: 'not_relevant', icon: EyeOff },
  { label: 'Not now', value: 'not_now', icon: Clock },
  { label: 'Better fit wanted', value: 'better_fit_wanted', icon: Search },
  { label: 'Decline', value: 'declined', icon: ThumbsDown, color: 'text-status-danger' },
];

function FeedbackMenu({ onFeedback }: { onFeedback: (fb: MatchFeedbackType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button aria-label="Feedback"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground"
        onClick={() => setOpen(p => !p)}
        title="Feedback"
      >
        <ChevronDown className="icon-sm" />
      </Button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
            {FEEDBACK_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors',
                  opt.color ?? 'text-foreground'
                )}
                onClick={() => { onFeedback(opt.value); setOpen(false); }}
              >
                <opt.icon className="h-3 w-3" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Either payload the recommendations endpoint can return. */
type RecommendationHit = (SearchHit & { matchScore?: number; matchReasons?: string[] }) | MatchSuggestion;

/** The MatchSuggestion branch is the one that carries a nested `profile`. */
function isMatchSuggestion(hit: RecommendationHit): hit is MatchSuggestion {
  return 'profile' in hit;
}

/**
 * Flattens the two shapes into one view model. Previously each field was read
 * through a separate `as any`, so a rename on either side of the API would have
 * silently produced `undefined` at runtime rather than failing the build.
 */
function normaliseHit(hit: RecommendationHit) {
  if (isMatchSuggestion(hit)) {
    return {
      userId: hit.userId,
      displayName: hit.profile?.displayName ?? 'Unknown',
      headline: hit.profile?.headline ?? null,
      avatarUrl: hit.profile?.avatarUrl ?? null,
      location: hit.profile?.location ?? null,
      role: null as string | null,
      skills: (hit.profile?.skills ?? []).map((s) => s.skill?.name ?? s.skillId),
      score: hit.score,
      confidence: hit.confidence as number | null,
      reasons: hit.reasons ?? [],
      explanation: hit.explanation ?? [],
    };
  }
  return {
    userId: hit.userId,
    displayName: hit.displayName ?? 'Unknown',
    headline: hit.headline ?? null,
    avatarUrl: hit.avatarUrl ?? null,
    location: hit.location ?? null,
    role: hit.role ?? null,
    skills: hit.skills ?? hit.skillNames ?? [],
    score: hit.matchScore ?? 0,
    confidence: null as number | null,
    reasons: hit.matchReasons ?? [],
    explanation: [] as MatchExplanationItem[],
  };
}

function RecommendationCard({ hit, onConnect, onFeedback, onSave }: {
  hit: RecommendationHit;
  onConnect: (userId: string) => void;
  onFeedback: (userId: string, fb: MatchFeedbackType) => void;
  onSave?: (userId: string) => void;
}) {
  const {
    userId,
    displayName,
    headline,
    avatarUrl,
    location,
    role,
    skills,
    score,
    confidence,
    reasons,
    explanation,
  } = normaliseHit(hit);

  const RoleIcon = ROLE_ICON[role ?? 'founder'] ?? Users;
  const [showExplanation, setShowExplanation] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <>
    <BreakdownModal
      open={breakdownOpen}
      onClose={() => setBreakdownOpen(false)}
      displayName={displayName}
      score={score}
      explanation={explanation}
      reasons={reasons}
    />
    {/* The Connections card: circle, name, headline and place; the score
        and role at the right; reasons, skills and the foot on the avatar's
        edge, never indented under the name. */}
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link
              href={`/profiles/${userId}`}
              aria-label={bilingualAria(`Open ${displayName}'s profile`, `Άνοιγμα προφίλ: ${displayName}`)}
              onClick={() => recordBehavioralSignal({ signalType: 'profile_view', targetId: userId, targetType: 'user' })}
            >
              <Avatar className="h-10 w-10 ring-2 ring-border group-hover:ring-primary/20 transition-all">
                <AvatarImage src={avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary-accessible">
                  {displayName?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link
              href={`/profiles/${userId}`}
              className="person-name transition-colors hover:text-primary-accessible"
              onClick={() => recordBehavioralSignal({ signalType: 'profile_view', targetId: userId, targetType: 'user' })}
            >
              {displayName}
            </Link>
          )}
          subtitle={headline ? <span className="line-clamp-1">{headline}</span> : undefined}
          meta={location ?? undefined}
          aside={(score > 0 || confidence !== null || role) ? (
            <>
              {score > 0 && <MatchScoreBadge score={score} />}
              {confidence !== null && (
                <span title={`Confidence: ${confidence}%`} className="flex items-center gap-0.5 text-xs tabular-nums text-muted-foreground">
                  <ShieldCheck className="icon-sm" />
                  {confidence}%
                </span>
              )}
              {role && (
                <Badge variant="outline" className={cn('text-xs hidden sm:flex', ROLE_COLOR[role ?? 'founder'])}>
                  <RoleIcon className="icon-sm mr-1" />
                  <StatusText value={role} />
                </Badge>
              )}
            </>
          ) : undefined}
        />

        {/* Reasons, then the dimension bars when asked for. */}
        {reasons.length > 0 && (
          <div className="space-y-1">
            <FactLine items={reasons.slice(0, 3)} />
            <button
              type="button"
              aria-expanded={showExplanation}
              onClick={() => setShowExplanation(p => !p)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline flex items-center gap-0.5"
            >
              <Info className="icon-sm" aria-hidden="true" />
              {showExplanation
                ? <BilingualText en="Hide the reasons" el="Απόκρυψη αιτιών" compact />
                : <BilingualText en="Why this match?" el="Γιατί αυτή η αντιστοίχιση;" compact />}
            </button>
          </div>
        )}

        {showExplanation && <ExplanationBar items={explanation} />}

        {/* Skills: facts, not chips. */}
        {skills.length > 0 && (
          <FactLine items={[...skills.slice(0, 4), skills.length > 4 ? `+${skills.length - 4}` : null]} />
        )}

        <CardFoot
          meta={(
            <div className="flex items-center gap-1">
              {onSave && (
                <Button aria-label="Save match"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-primary-accessible"
                  title="Save match"
                  onClick={() => onSave(userId)}
                >
                  <BookmarkPlus className="icon-sm" />
                </Button>
              )}
              <Button aria-label="Good match"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-status-success"
                title="Good match"
                onClick={() => onFeedback(userId, 'accepted')}
              >
                <ThumbsUp className="icon-sm" />
              </Button>
              <FeedbackMenu onFeedback={(fb) => onFeedback(userId, fb)} />
            </div>
          )}
        >
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBreakdownOpen(true)}>
            <TrendingUp className="icon-sm" />
            <BilingualText en="Score breakdown" el="Ανάλυση βαθμολογίας" compact />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => onConnect(userId)}>
            <UserPlus className="icon-sm" />
            <BilingualText en="Connect" el="Σύνδεση" compact />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
    </>
  );
}

function Skeleton3() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent>
            <div className="flex gap-4">
              <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-24" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'founders' | 'mentors' | 'investors' | 'saved'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [showFilter, setShowFilter] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const role = (activeTab === 'all' || activeTab === 'saved') ? undefined : activeTab.replace(/s$/, '');

  const { data: recsData, isLoading: recsLoading, isError: recsError, refetch: refetchRecs } = useQuery({
    queryKey: qk('recommendations', role, refreshKey),
    queryFn: () => getRecommendations({ role, limit: 20 }),
    staleTime: 5 * 60_000,
  });

  const { data: digestData, isLoading: digestLoading } = useQuery({
    queryKey: qk('weekly-digest'),
    queryFn: getWeeklyDigest,
    staleTime: 10 * 60_000,
  });

  const { data: statsData } = useQuery({
    queryKey: qk('matching', 'stats'),
    queryFn: getMatchingStats,
    staleTime: 5 * 60_000,
  });

  const connectMutation = useMutation({
    mutationFn: (userId: string) => sendConnectionRequest({ receiverId: userId }),
    onSuccess: () => toastSuccess('Connection request sent!'),
    onError: () => toastError('Could not send request', 'Please try again'),
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ userId, fb }: { userId: string; fb: MatchFeedbackType }) =>
      recordMatchFeedback({ targetUserId: userId, feedback: fb }),
    onSuccess: (_, { fb }) => {
      const msg = fb === 'accepted' ? 'Thanks! Improving your matches.' :
        fb === 'not_relevant' ? 'Got it — fewer like this.' :
        fb === 'not_now' ? 'Noted — we\'ll revisit later.' :
        fb === 'better_fit_wanted' ? 'Understood — refining suggestions.' :
        'Feedback recorded.';
      toastSuccess(msg);
      queryClient.invalidateQueries({ queryKey: qk('recommendations') });
    },
  });

  const allRecommendations = recsData?.suggestions ?? [];
  const recommendations = activeTab === 'saved'
    ? allRecommendations.filter((h) => savedIds.has(h.userId))
    : allRecommendations.filter((h) => normaliseHit(h).score >= minScore);
  const weeklyRecs = digestData?.recommendations ?? [];
  const stats = digestData?.stats ?? statsData;

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    queryClient.invalidateQueries({ queryKey: qk('weekly-digest') });
  };

  /*
   * Save was a set in component state: "Saved to your list" over a list that
   * lived until the tab closed, beside a /shortlist that never heard of it.
   * It is the shortlist now - the same ids /matches reads and the same write
   * its bookmark makes - so the Saved tab and /shortlist agree.
   */
  const { data: shortlistIds } = useQuery({
    queryKey: qk('shortlist', 'ids'),
    queryFn: getShortlistIds,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  useEffect(() => {
    if (shortlistIds?.ids) setSavedIds(new Set(shortlistIds.ids));
  }, [shortlistIds]);

  // Optimistic, and settled: the promise ends when the server has the save,
  // so the assistant reports it only then; a failure flips the card back.
  const handleSave = async (userId: string): Promise<PageControlRunResult> => {
    const wasSaved = savedIds.has(userId);
    setSavedIds((prev) => { const next = new Set(prev); if (wasSaved) next.delete(userId); else next.add(userId); return next; });
    try {
      await (wasSaved ? removeFromShortlist(userId) : saveToShortlist(userId));
      toastSuccess(wasSaved ? 'Removed from your shortlist' : 'Saved to your shortlist');
      void queryClient.invalidateQueries({ queryKey: qk('shortlist') });
    } catch (err) {
      setSavedIds((prev) => { const next = new Set(prev); if (wasSaved) next.add(userId); else next.delete(userId); return next; });
      toastError('Could not update your shortlist', 'Please try again');
      return { error: err instanceof Error && err.message ? err.message : 'Your saved profiles did not change.' };
    }
  };

  // Offered to the assistant: the tab, the minimum score, Refresh, and each
  // card's Connect, Save and "not relevant" - the same handlers.
  const people = recommendations.map(normaliseHit);
  const byName = (list: typeof people) => rowOptions(list, (p) => p.userId, (p) => p.displayName);
  usePageList([
    {
      id: 'recommendations',
      labelEn: 'Recommended people',
      labelEl: 'Προτεινόμενα άτομα',
      rows: recsLoading ? undefined : people.map((p) => `${p.displayName}${p.role ? ` · ${p.role}` : ''}${p.headline ? ` · ${p.headline}` : ''} · match ${Math.round(p.score)}%${savedIds.has(p.userId) ? ' · saved' : ''}`),
      total: allRecommendations.length,
    },
  ]);
  usePageControls([
    choiceControl('recommendation_tab', 'Recommendation filter', 'Φίλτρο προτάσεων', [
      { value: 'all', en: 'All', el: 'Όλοι' },
      { value: 'founders', en: 'Founders', el: 'Ιδρυτές' },
      { value: 'mentors', en: 'Mentors', el: 'Μέντορες' },
      { value: 'investors', en: 'Investors', el: 'Επενδυτές' },
      { value: 'saved', en: 'Saved', el: 'Αποθηκευμένοι' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    choiceControl('min_score', 'Minimum match score', 'Ελάχιστη βαθμολογία', [0, 50, 65, 80].map((n) => ({ value: String(n), en: n ? `${n}% or more` : 'Any score', el: n ? `${n}% και πάνω` : 'Οποιαδήποτε' })), String(minScore), (v) => setMinScore(Number(v))),
    { id: 'refresh', labelEn: 'Refresh recommendations', labelEl: 'Ανανέωση προτάσεων', writes: false, run: handleRefresh },
    { id: 'connect_with', labelEn: 'Send a connection request to', labelEl: 'Αίτημα σύνδεσης προς', writes: true, options: byName(people), run: async (v) => { if (v) await connectMutation.mutateAsync(v); } },
    // Saving creates a fresh shortlist row, so removing it is the undo; not
    // the reverse, since removing drops the row's note.
    { id: 'save_person', labelEn: 'Save to shortlist', labelEl: 'Αποθήκευση προφίλ', writes: true, options: byName(people.filter((p) => !savedIds.has(p.userId))), undo: (v) => ({ control: 'unsave_person', value: v }), run: (v) => (v ? handleSave(v) : undefined) },
    { id: 'unsave_person', labelEn: 'Remove from shortlist', labelEl: 'Αφαίρεση από τα αποθηκευμένα', writes: true, options: byName(people.filter((p) => savedIds.has(p.userId))), run: (v) => (v ? handleSave(v) : undefined) },
    { id: 'not_relevant', labelEn: 'Mark recommendation not relevant', labelEl: 'Σήμανση πρότασης ως μη σχετικής', writes: true, options: byName(people), run: async (v) => { if (v) await feedbackMutation.mutateAsync({ userId: v, fb: 'not_relevant' }); } },
  ]);

  /*
   * The four counts describe the list rather than being the list, so they
   * live in the rail. Linked pages sit beside this feed in Discover. Refresh
   * stays in the header: it is this page's recalculation, not another surface.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'spark',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'new', label: 'New matches', labelEl: 'Νέες αντιστοιχίσεις', value: recommendations.length, icon: Target, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'week', label: 'This week', labelEl: 'Αυτή την εβδομάδα', value: weeklyRecs.length, icon: Sparkles, tone: 'bg-status-info-bg text-status-info' },
            { key: 'connections', label: 'Connections', labelEl: 'Συνδέσεις', value: stats?.totalConnections ?? 0, icon: Users, tone: 'bg-status-success-bg text-status-success' },
            { key: 'acceptance', label: 'Acceptance rate', labelEl: 'Ποσοστό αποδοχής', value: typeof stats?.acceptanceRate === 'number' ? `${Math.round(stats.acceptanceRate)}%` : '—', icon: TrendingUp, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Target} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
          <RailAction icon={Search} en="Open discover" el="Άνοιγμα ανακάλυψης" onClick={() => router.push('/discover')} />
          <RailAction icon={BookmarkPlus} en="Open shortlist" el="Άνοιγμα λίστας" onClick={() => router.push('/shortlist')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      title="For you"
      description="Picks ranked from your profile, skills, and recent activity, recalculated at least hourly."
      descriptionEl="Επιλογές ταξινομημένες βάσει του προφίλ, των δεξιοτήτων και της πρόσφατης δραστηριότητάς σας, με επανυπολογισμό τουλάχιστον κάθε ώρα."
      rail={rail}
      actions={
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="icon-sm mr-2" />
          <BilingualText en="Refresh" el="Ανανέωση" compact />
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Weekly digest section */}
        {!digestLoading && weeklyRecs.length > 0 && (
          // A section card: the title and its date in the head, the people
          // under it on the title's edge.
          <Card className="border-primary/15 bg-primary/[0.03]">
            <CardContent className="space-y-3">
              <CardHead
                titleAs="h2"
                title={<BilingualText en="This week's top picks" el="Κορυφαίες επιλογές εβδομάδας" compact />}
                asideStays
                aside={(
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {digestData?.generatedAt ? new Date(digestData.generatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : <BilingualText en="Today" el="Σήμερα" compact />}
                  </Badge>
                )}
              />
              {/* The people as rows on the card's axis, each circle with
                  the first name and the score beside it, not names centred
                  under floating avatars. The strip scrolls on a phone. */}
              <div className="-mx-1 flex gap-x-6 gap-y-3 overflow-x-auto px-1 pb-1 scrollbar-hide sm:flex-wrap">
                {weeklyRecs.slice(0, 5).map((m) => (
                  <Link key={m.userId} href={`/profiles/${m.userId}`} className="group flex shrink-0 items-center gap-3 rounded-md">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={m.profile?.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary-accessible">
                        {m.profile?.displayName?.[0] ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="whitespace-nowrap text-sm font-medium text-foreground transition-colors group-hover:text-primary-accessible">
                        {m.profile?.displayName?.split(' ')[0] ?? 'User'}
                      </p>
                      <p className="text-xs font-medium tabular-nums text-muted-foreground">{m.score}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score filter bar */}
        <div className="flex items-center gap-2">
          <Button
            variant={showFilter ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilter(p => !p)}
          >
            <Filter className="icon-sm" />
            <BilingualText en="Filter" el="Φίλτρο" compact />
            {minScore > 0 && <span className="ml-1 text-xs text-primary-accessible font-semibold">≥{minScore}%</span>}
          </Button>
          {showFilter && (
            <div className="flex items-center gap-3 flex-1 bg-secondary/40 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground shrink-0"><BilingualText en="Min score:" el="Ελάχιστος βαθμός:" compact /></span>
              <input
                type="range"
                min={0}
                max={90}
                step={10}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-semibold w-8 text-right">{minScore}%</span>
              {minScore > 0 && (
                <button aria-label="Clear minimum score" onClick={() => setMinScore(0)} className="text-muted-foreground hover:text-foreground">
                  <X className="icon-sm" />
                </button>
              )}
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            <BilingualText
              en={`${recommendations.length} match${recommendations.length !== 1 ? 'es' : ''}${savedIds.size > 0 ? ` · ${savedIds.size} saved` : ''}`}
              el={`${recommendations.length} ${recommendations.length !== 1 ? 'αντιστοιχίσεις' : 'αντιστοίχιση'}${savedIds.size > 0 ? ` · ${savedIds.size} ${savedIds.size !== 1 ? 'αποθηκευμένες' : 'αποθηκευμένη'}` : ''}`}
              compact
            />
          </span>
        </div>

        {/* Tab list */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Target className="icon-sm" />
              <BilingualText en="All" el="Όλοι" compact />
            </TabsTrigger>
            <TabsTrigger value="founders" className="gap-1.5">
              <Briefcase className="icon-sm" />
              <BilingualText en="Founders" el="Ιδρυτές" compact />
            </TabsTrigger>
            <TabsTrigger value="mentors" className="gap-1.5">
              <GraduationCap className="icon-sm" />
              <BilingualText en="Mentors" el="Μέντορες" compact />
            </TabsTrigger>
            <TabsTrigger value="investors" className="gap-1.5">
              <DollarSign className="icon-sm" />
              <BilingualText en="Investors" el="Επενδυτές" compact />
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5">
              <BookmarkPlus className="icon-sm" />
              <BilingualText en="Saved" el="Αποθηκευμένα" compact />
              {savedIds.size > 0 && (
                <span className="ml-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
                  {savedIds.size}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {recsLoading ? (
              <Skeleton3 />
            ) : recsError ? (
              <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground"><BilingualText en="Failed to load recommendations." el="Δεν ήταν δυνατή η φόρτωση των προτάσεων." /></p>
                <Button variant="secondary" size="sm" onClick={() => void refetchRecs()}><BilingualText en="Retry" el="Επανάληψη" compact /></Button>
              </CardContent></Card>
            ) : activeTab === 'saved' && savedIds.size === 0 ? (
              <Card><CardContent className="py-14 text-center">
                <BookmarkPlus className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold mb-1"><BilingualText en="No saved matches yet" el="Δεν υπάρχουν αποθηκευμένες αντιστοιχίσεις" /></h3>
                <p className="text-sm text-muted-foreground"><BilingualText en="Bookmark matches you want to revisit later." el="Αποθηκεύστε αντιστοιχίσεις που θέλετε να επαναξεταστούν αργότερα." /></p>
              </CardContent></Card>
            ) : recommendations.length > 0 ? (
              recommendations.map((hit) => (
                <RecommendationCard
                  key={hit.userId}
                  hit={hit}
                  onConnect={(uid) => connectMutation.mutate(uid)}
                  onFeedback={(uid, fb) => feedbackMutation.mutate({ userId: uid, fb })}
                  onSave={handleSave}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-14 text-center">
                  <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <h3 className="font-semibold mb-1"><BilingualText en="No recommendations yet" el="Δεν υπάρχουν ακόμη προτάσεις" /></h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {minScore > 0 ? `No matches with score ≥${minScore}%. Try lowering the filter.` : 'Complete your profile to unlock personalized matches.'}
                  </p>
                  {minScore > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setMinScore(0)}><BilingualText en="Clear Filter" el="Εκκαθάριση φίλτρου" compact /></Button>
                  ) : (
                    <Button size="sm" asChild>
                      <Link href="/profile/edit"><BilingualText en="Complete Profile" el="Ολοκλήρωση προφίλ" compact /></Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
