'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { BilingualText } from '@/components/common/BilingualText';
import { useHydrated } from '@/components/common/RelativeTime';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { StatusText } from '@/components/common/StatusText';
import { useDemoData } from '@/contexts/DemoDataContext';
import { demoCohortDetail } from '@/lib/demo/org-api';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { useRouter } from 'next/navigation';
import {
  getOrgCohortDetail,
  type CohortParticipant,
  type CohortMatch,
  type CohortSession,
} from '@/lib/api';
import { useParams } from 'next/navigation';
import {
  Users,
  Calendar,
  Award,
  TrendingUp,
  GraduationCap,
  Target,
  MessageCircle,
  Link2,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Clock,
  Star,
  CheckCircle2,
  XCircle,
  Clock3,
  MoreVertical,
  Download,
  Share2,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { downloadCsv } from '@/lib/csv';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, initialsOf } from '@/lib/utils';
import Link from 'next/link';
import { qk } from '@/lib/query-keys';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

// Types
interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'founder' | 'mentor' | 'investor';
  startup?: string;
  status: 'active' | 'inactive' | 'pending';
  avatarUrl?: string;
  joinDate: string;
  location?: string;
  phone?: string;
  progress?: number;
}

interface Match {
  id: string;
  participant1: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  participant2: {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  };
  matchScore: number;
  status: 'pending' | 'accepted' | 'rejected';
  matchedDate: string;
  interactions: number;
  lastInteraction?: string;
}

interface MentoringSession {
  id: string;
  mentor: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  mentee: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  topic: string;
  scheduledDate: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  rating?: number;
  notes?: string;
}

interface CohortStats {
  totalParticipants: number;
  activeStartups: number;
  totalMentors: number;
  completedSessions: number;
  upcomingSessions: number;
  totalMatches: number;
  successfulMatches: number;
  averageMatchScore: number;
}

/** The cohort's own people, in the shape this page has always rendered. */
function toParticipant(row: CohortParticipant): Participant {
  return {
    id: row.userId,
    name: row.name ?? 'A participant',
    email: row.email,
    role: row.role,
    // No column names a startup; a founder's headline is the line they write
    // about what they are building.
    startup: row.headline ?? undefined,
    status: row.status,
    avatarUrl: row.avatarUrl ?? undefined,
    joinDate: row.joinedAt,
    location: row.location ?? undefined,
  };
}

/**
 * A match inside the cohort.
 *
 * The page speaks in pending / accepted / rejected; a suggestion has five
 * states. "Connected" is the one that actually became a relationship, and
 * "dismissed" is the one somebody turned down - the three in between are all
 * still open.
 */
const MATCH_STATE: Record<CohortMatch['status'], Match['status']> = {
  pending: 'pending',
  viewed: 'pending',
  saved: 'pending',
  connected: 'accepted',
  dismissed: 'rejected',
};

function toMatch(row: CohortMatch): Match {
  return {
    id: row.id,
    participant1: {
      id: row.a?.id ?? '',
      name: row.a?.name ?? 'A participant',
      role: row.a?.role ?? '',
      avatarUrl: row.a?.avatarUrl ?? undefined,
    },
    participant2: {
      id: row.b?.id ?? '',
      name: row.b?.name ?? 'A participant',
      role: row.b?.role ?? '',
      avatarUrl: row.b?.avatarUrl ?? undefined,
    },
    matchScore: row.score,
    status: MATCH_STATE[row.status] ?? 'pending',
    matchedDate: row.generatedAt,
    // Nothing counts interactions per pair, so the card shows none rather than
    // a number nobody measured.
    interactions: 0,
  };
}

function toSession(row: CohortSession): MentoringSession {
  return {
    id: row.id,
    mentor: {
      id: row.mentor?.id ?? '',
      name: row.mentor?.name ?? 'A mentor',
      avatarUrl: row.mentor?.avatarUrl ?? undefined,
    },
    mentee: {
      id: row.mentee?.id ?? '',
      name: row.mentee?.name ?? 'A participant',
      avatarUrl: row.mentee?.avatarUrl ?? undefined,
    },
    topic: row.title?.trim() || 'Mentoring session',
    scheduledDate: row.scheduledAt,
    duration: row.duration,
    // The page has no "no show"; it ends the appointment the same way.
    status: row.status === 'no_show' ? 'cancelled' : row.status,
    rating: row.rating ?? undefined,
  };
}

export default function CohortDetailPage() {
  const fmtDate = useDateFormat();
  const params = useParams();
  const cohortId = params?.id as string;
  const [activeTab, setActiveTab] = useState('overview');

  const { slug } = useCurrentOrg();

  /*
   * One request for the whole dashboard. The id in the URL used to be read and
   * then ignored, so every cohort an organiser opened was the same one.
   */
  const { data, isLoading } = useQuery({
    queryKey: qk('org', slug, 'cohort', cohortId),
    queryFn: () => getOrgCohortDetail(slug!, cohortId),
    enabled: Boolean(slug && cohortId),
    staleTime: 60_000,
    retry: 0,
  });

  /*
   * Samples only with sample data on, and from the demo organisation the
   * preview API serves - this page used to show a San Francisco cohort with
   * four invented people to any organiser whose request failed, and showed
   * it while the real one was still loading.
   */
  const { showDemoData } = useDemoData();
  const hydrated = useHydrated();
  const sample = useMemo(
    () => (!data && !isLoading && showDemoData && hydrated ? demoCohortDetail(cohortId, Date.now()) : null),
    [data, isLoading, showDemoData, hydrated, cohortId],
  );
  const live = data ?? sample;
  const isSample = !data && sample != null;

  const cohort = live
    ? {
        id: live.cohort.id,
        name: live.cohort.name,
        // The organiser is the programme; the cohort is one run of it.
        program: live.cohort?.tags?.[0] ?? '',
        status: live.cohort.isActive ? 'active' : 'completed',
        startDate: live.cohort?.startDate ?? '',
        endDate: live.cohort?.endDate ?? '',
        description: live.cohort?.description ?? '',
        // No column records where a cohort meets.
        location: '',
      }
    : null;

  const participants = useMemo(
    () => (live?.participants ?? []).map(toParticipant),
    [live, isLoading],
  );
  const matches = useMemo(
    () => (live?.matches ?? []).map(toMatch),
    [live, isLoading],
  );
  const sessions = useMemo(
    () => (live?.sessions ?? []).map(toSession),
    [live, isLoading],
  );

  const stats: CohortStats = live
    ? {
        totalParticipants: live.stats.participants,
        activeStartups: live.stats.founders,
        totalMentors: live.stats.mentors,
        completedSessions: live.stats.completedSessions,
        upcomingSessions: live.stats.upcomingSessions,
        totalMatches: live.stats.matches,
        successfulMatches: live.stats.connectedMatches,
        averageMatchScore: live.stats?.avgMatchScore ?? 0,
      }
    : { totalParticipants: 0, activeStartups: 0, totalMentors: 0, completedSessions: 0, upcomingSessions: 0, totalMatches: 0, successfulMatches: 0, averageMatchScore: 0 };

  /*
   * How far through the programme this cohort is.
   *
   * The tile used to read 67% for every cohort on every day. `useHydrated`
   * keeps the clock out of the server pass - the server and the browser would
   * otherwise disagree on "now" and React would discard the tree - and a
   * cohort with no dates has no progress to report rather than a default one.
   */
  const programProgress = useMemo(() => {
    if (!hydrated || !cohort?.startDate || !cohort?.endDate) return null;
    const start = new Date(cohort.startDate).getTime();
    const end = new Date(cohort.endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const ratio = (Date.now() - start) / (end - start);
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, [hydrated, cohort?.startDate, cohort?.endDate]);

  const formatDate = (dateString: string) => {
    return fmtDate(dateString, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; className: string }> = {
      active: { variant: 'default', className: 'bg-status-success-bg text-status-success border-status-success-border' },
      inactive: { variant: 'secondary', className: 'bg-muted text-foreground' },
      pending: { variant: 'outline', className: 'bg-status-warning-bg text-status-warning border-status-warning-border' },
      scheduled: { variant: 'outline', className: 'bg-status-info-bg text-status-info border-status-info-border' },
      completed: { variant: 'default', className: 'bg-status-success-bg text-status-success border-status-success-border' },
      cancelled: { variant: 'destructive', className: '' },
    };

    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        <StatusText value={status} />
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      founder: 'bg-status-info-bg text-status-info border-status-info-border',
      mentor: 'bg-status-accent-bg text-status-accent border-status-accent-border',
      investor: 'bg-status-warning-bg text-status-warning border-status-warning-border',
    };

    return (
      <Badge variant="outline" className={colors[role] || colors.founder}>
        <StatusText value={role} />
      </Badge>
    );
  };

  // Tabs, export, share and opening a participant, offered to the assistant;
  // the rows each tab shows are published with them.
  const router = useRouter();
  const sampleEn = isSample ? 'These are sample people - there is no profile to open.' : undefined;
  const sampleEl = isSample ? 'Είναι δείγματα - δεν υπάρχει προφίλ για άνοιγμα.' : undefined;
  const exportParticipants = () =>
    downloadCsv(
      `cohort-${cohort?.name ?? cohortId}`,
      ['name', 'email', 'role', 'startup', 'status', 'joined', 'location', 'progress'],
      participants.map((pt) => [pt.name, pt.email, pt.role, pt.startup, pt.status, pt.joinDate, pt.location, pt.progress]),
    );
  const copyLink = () => void navigator.clipboard?.writeText(window.location.href);
  usePageControls([
    choiceControl('cohort_tab', 'Cohort tab', 'Καρτέλα κύκλου', [
      { value: 'overview', en: 'Overview', el: 'Επισκόπηση' },
      { value: 'participants', en: 'Participants', el: 'Συμμετέχοντες' },
      { value: 'matches', en: 'Matches', el: 'Αντιστοιχίσεις' },
      { value: 'mentoring', en: 'Mentoring', el: 'Καθοδήγηση' },
    ], activeTab, setActiveTab),
    {
      id: 'export_participants',
      labelEn: 'Export the participants (CSV)',
      labelEl: 'Εξαγωγή συμμετεχόντων (CSV)',
      writes: false,
      unavailableEn: participants.length === 0 ? 'Nobody to export.' : undefined,
      unavailableEl: participants.length === 0 ? 'Δεν υπάρχει κανείς για εξαγωγή.' : undefined,
      run: exportParticipants,
    },
    { id: 'copy_cohort_link', labelEn: 'Copy the cohort link', labelEl: 'Αντιγραφή συνδέσμου κύκλου', writes: false, run: copyLink },
    {
      id: 'open_participant',
      labelEn: 'Open a participant\'s profile',
      labelEl: 'Άνοιγμα προφίλ συμμετέχοντα',
      writes: false,
      options: rowOptions(participants, (pt) => pt.id, (pt) => pt.name),
      unavailableEn: sampleEn ?? (participants.length === 0 ? 'No participants yet.' : undefined),
      unavailableEl: sampleEl ?? (participants.length === 0 ? 'Δεν υπάρχουν συμμετέχοντες.' : undefined),
      run: (value) => { if (value) router.push(`/profiles/${value}`); },
    },
  ]);
  usePageList([
    {
      id: 'cohort_participants',
      labelEn: 'Cohort participants',
      labelEl: 'Συμμετέχοντες κύκλου',
      rows: live ? participants.map((pt) => `${pt.name} · ${pt.role}${pt.startup ? ` · ${pt.startup}` : ''} · ${pt.status}`) : undefined,
      total: participants.length,
      sample: isSample,
    },
    {
      id: 'cohort_matches',
      labelEn: 'Matches in the cohort',
      labelEl: 'Αντιστοιχίσεις στον κύκλο',
      rows: live ? matches.map((m) => `${m.participant1.name} ↔ ${m.participant2.name} · ${m.matchScore}% · ${m.status}`) : undefined,
      total: matches.length,
      sample: isSample,
    },
    {
      id: 'cohort_sessions',
      labelEn: 'Mentoring sessions',
      labelEl: 'Συνεδρίες καθοδήγησης',
      rows: live ? sessions.map((x) => `${x.mentor.name} → ${x.mentee.name} · ${x.topic} · ${x.status}`) : undefined,
      total: sessions.length,
      sample: isSample,
    },
  ]);

  if (!cohort) {
    return (
      <AppShell title="Cohort" titleEl="Κύκλος">
        {isLoading || !hydrated ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                <BilingualText
                  en="This cohort could not be loaded. It may belong to another organisation, or you may not be a member of its organisation."
                  el="Ο κύκλος δεν φορτώθηκε. Μπορεί να ανήκει σε άλλον οργανισμό ή να μην είστε μέλος του οργανισμού του."
                  wrap
                />
              </p>
              <Button variant="outline" className="mt-4 gap-2" asChild>
                <Link href="/org/cohorts"><ArrowLeft className="icon-sm" aria-hidden="true" /><BilingualText en="All cohorts" el="Όλοι οι κύκλοι" compact /></Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell
      title={cohort.name}
      description={`${cohort.program} • ${formatDate(cohort.startDate)} - ${formatDate(cohort.endDate)}`}
      showHelp
      askAi={`Summarise the "${cohort.name}" cohort — which startups are behind on progress, which have no mentor sessions yet, and what should the program team do this week?`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* All three had no handler. Share copies this page; Export is
              the participant list; a message to everyone has no group
              thread to go to yet. */}
          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
          >
            <Share2 className="icon-sm mr-2" aria-hidden="true" />
            <BilingualText en="Share" el="Κοινοποίηση" compact />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={participants.length === 0}
            onClick={exportParticipants}
          >
            <Download className="icon-sm mr-2" aria-hidden="true" />
            <BilingualText en="Export" el="Εξαγωγή" compact />
          </Button>
          {/* There is no group thread for a cohort, but every participant row
              carries an address: one email with the cohort in Bcc reaches
              everyone without exposing their addresses to each other. */}
          {!isSample && participants.some((pt) => pt.email) ? (
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:?bcc=${encodeURIComponent(participants.map((pt) => pt.email).filter(Boolean).join(','))}&subject=${encodeURIComponent(cohort.name)}`}>
                <Mail className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Email all" el="Email σε όλους" compact />
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title={isSample ? 'Sample people have no real address to write to' : 'Nobody in this cohort has an email address on file'}>
              <Mail className="icon-sm mr-2" aria-hidden="true" />
              <BilingualText en="Email all" el="Email σε όλους" compact />
            </Button>
          )}
        </div>
      }
    >
      {isSample && (
        <SampleDataNotice
          surface="Cohort"
          detail="This is a sample cohort from the demo organisation, shown because sample data is on and your organisation's cohort did not load."
          askAiPrompt="Why am I seeing a sample cohort?"
        />
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <BilingualText en="Overview" el="Επισκόπηση" compact />
          </TabsTrigger>
          <TabsTrigger value="participants">
            <BilingualText
              en={`Participants (${participants.length})`}
              el={`Συμμετέχοντες (${participants.length})`}
              compact
            />
          </TabsTrigger>
          <TabsTrigger value="matches">
            <BilingualText
              en={`Matches (${matches.length})`}
              el={`Αντιστοιχίσεις (${matches.length})`}
              compact
            />
          </TabsTrigger>
          <TabsTrigger value="mentoring">
            <BilingualText
              en={`Mentoring (${sessions.length})`}
              el={`Καθοδήγηση (${sessions.length})`}
              compact
            />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 kpi-odd-span-md md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <BilingualText en="Total Participants" el="Σύνολο συμμετεχόντων" compact wrap />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{stats.totalParticipants}</div>
                  <Users className="icon-sm text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <BilingualText
                    en={`${stats.activeStartups} active startups • ${stats.totalMentors} mentors`}
                    el={`${stats.activeStartups} ενεργές startups • ${stats.totalMentors} μέντορες`}
                    compact
                    wrap
                  />
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <BilingualText en="Mentoring Sessions" el="Συνεδρίες καθοδήγησης" compact wrap />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{stats.completedSessions}</div>
                  <GraduationCap className="icon-sm text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <BilingualText
                    en={`${stats.upcomingSessions} upcoming sessions`}
                    el={`${stats.upcomingSessions} επερχόμενες συνεδρίες`}
                    compact
                    wrap
                  />
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <BilingualText en="Successful Matches" el="Επιτυχείς αντιστοιχίσεις" compact wrap />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">
                    {stats.successfulMatches}/{stats.totalMatches}
                  </div>
                  <Target className="icon-sm text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <BilingualText
                    en={`Avg. score: ${stats.averageMatchScore}%`}
                    el={`Μέση βαθμολογία: ${stats.averageMatchScore}%`}
                    compact
                    wrap
                  />
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <BilingualText en="Program Progress" el="Πρόοδος προγράμματος" compact wrap />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">
                    {programProgress == null ? '\u2014' : `${programProgress}%`}
                  </div>
                  <TrendingUp className="icon-sm text-status-success" />
                </div>
                <Progress value={programProgress ?? 0} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Cohort Info */}
          <Card>
            <CardHeader>
              <CardTitle>
                <BilingualText en="About This Cohort" el="Σχετικά με τον κύκλο" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{cohort.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="icon-sm text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">
                    {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                  </span>
                </div>
                {cohort.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="icon-sm text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">{cohort.location}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Award className="icon-sm text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm">{cohort.program}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>
                  <BilingualText en="Recent Matches" el="Πρόσφατες αντιστοιχίσεις" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="card-rows">
                  {matches.slice(0, 3).map((match) => (
                    <div key={match.id} className="flex items-center gap-3">
                      <div className="flex shrink-0 -space-x-1">
                        <Avatar className="h-8 w-8 border-2 border-card">
                          <AvatarFallback className="bg-muted text-2xs font-semibold">
                            {initialsOf(match.participant1.name)}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="h-8 w-8 border-2 border-card">
                          <AvatarFallback className="bg-primary/15 text-2xs font-semibold text-primary-accessible">
                            {initialsOf(match.participant2.name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {match.participant1.name} ↔ {match.participant2.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Match score: {match.matchScore}%
                          {match.interactions > 0 && ` • ${match.interactions} interactions`}
                        </p>
                      </div>
                      {getStatusBadge(match.status)}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className="mt-auto flex items-center justify-center gap-1.5 border-t pt-3 text-sm font-medium text-primary-accessible hover:underline focus-ring rounded-b-lg"
                >
                  <BilingualText en="All matches" el="Όλες οι αντιστοιχίσεις" compact />
                  <ChevronRight className="icon-xs" aria-hidden="true" />
                </button>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>
                  <BilingualText en="Upcoming Sessions" el="Επερχόμενες συνεδρίες" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="card-rows">
                  {sessions
                    .filter((s) => s.status === 'scheduled')
                    .slice(0, 3)
                    .map((session) => (
                      <div key={session.id} className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {initialsOf(session.mentor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{session.topic}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.mentor.name} → {session.mentee.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(session.scheduledDate)} • {session.duration} min
                          </p>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('mentoring')}
                  className="mt-auto flex items-center justify-center gap-1.5 border-t pt-3 text-sm font-medium text-primary-accessible hover:underline focus-ring rounded-b-lg"
                >
                  <BilingualText en="All sessions" el="Όλες οι συνεδρίες" compact />
                  <ChevronRight className="icon-xs" aria-hidden="true" />
                </button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="participants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><BilingualText en="All Participants" el="Όλοι οι συμμετέχοντες" compact /></CardTitle>
              <Button size="sm" disabled title="Cohort membership is managed by platform administrators for now">
                <Users className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Add Participant" el="Προσθήκη συμμετέχοντα" compact />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><BilingualText en="Name" el="Όνομα" compact /></TableHead>
                    <TableHead><BilingualText en="Role" el="Ρόλος" compact /></TableHead>
                    <TableHead><BilingualText en="Status" el="Κατάσταση" compact /></TableHead>
                    <TableHead><BilingualText en="Location" el="Τοποθεσία" compact /></TableHead>
                    <TableHead><BilingualText en="Join Date" el="Ημερομηνία ένταξης" compact /></TableHead>
                    <TableHead><BilingualText en="Progress" el="Πρόοδος" compact /></TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {initialsOf(participant.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-xs text-muted-foreground">{participant.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(participant.role)}</TableCell>
                      <TableCell>{getStatusBadge(participant.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="icon-sm" aria-hidden="true" />
                          {participant.location}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(participant.joinDate)}</TableCell>
                      <TableCell>
                        {participant.progress !== undefined ? (
                          <div className="flex items-center gap-2">
                            <Progress value={participant.progress} className="w-20" />
                            <span className="text-xs">{participant.progress}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground"><BilingualText en="N/A" el="—" compact /></span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`More options for ${participant.name}. Περισσότερες επιλογές`} variant="ghost" size="icon">
                              <MoreVertical className="icon-sm" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* None had a handler. A participant's id is their
                                user id (toParticipant), so profile and thread
                                are addressable; progress is the row itself. */}
                            {isSample ? (
                              <>
                                <UnavailableMenuItem en="View Profile" el="Προβολή προφίλ" reasonEn="A sample person has no profile." reasonEl="Ένα δείγμα δεν έχει προφίλ." />
                                <UnavailableMenuItem en="Send Message" el="Αποστολή μηνύματος" reasonEn="A sample person cannot receive messages." reasonEl="Ένα δείγμα δεν λαμβάνει μηνύματα." />
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/profiles/${participant.id}`}><BilingualText en="View Profile" el="Προβολή προφίλ" compact /></Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/messages?to=${participant.id}`}><BilingualText en="Send Message" el="Αποστολή μηνύματος" compact /></Link>
                                </DropdownMenuItem>
                              </>
                            )}
                            <UnavailableMenuItem
                              en="View Progress"
                              el="Πρόοδος"
                              reasonEn={participant.progress !== undefined ? `${participant.progress}% - no milestone breakdown yet.` : 'No progress is tracked for this participant yet.'}
                              reasonEl={participant.progress !== undefined ? `${participant.progress}% - δεν υπάρχει ακόμη ανάλυση ορόσημων.` : 'Δεν καταγράφεται ακόμη πρόοδος για αυτό το μέλος.'}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><BilingualText en="Matches" el="Αντιστοιχίσεις" compact /></CardTitle>
              <Button size="sm" asChild>
                <Link href="/matches">
                  <Target className="icon-sm mr-2" aria-hidden="true" />
                  <BilingualText en="Generate Matches" el="Δημιουργία αντιστοιχίσεων" compact />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="card-rows">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center gap-4">
                    <div className="flex shrink-0 -space-x-2">
                      <Avatar className="h-12 w-12 border-2 border-card">
                        <AvatarFallback className="bg-muted text-sm font-semibold">
                          {initialsOf(match.participant1.name)}
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-12 w-12 border-2 border-card">
                        <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary-accessible">
                          {initialsOf(match.participant2.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {match.participant1.name} ↔ {match.participant2.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <StatusText value={match.participant1.role} /> • <StatusText value={match.participant2.role} />
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Matched: {formatDate(match.matchedDate)}</span>
                        <span>•</span>
                        {match.interactions > 0 && <span>{match.interactions} interactions</span>}
                        {match.lastInteraction && (
                          <>
                            <span>•</span>
                            <span>Last: {formatDate(match.lastInteraction)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-accessible">{match.matchScore}%</div>
                        <div className="text-xs text-muted-foreground"><BilingualText en="Match Score" el="Βαθμός ταιριάσματος" compact /></div>
                      </div>
                      {getStatusBadge(match.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentoring">
          <div className="space-y-6">
            {/* Mentoring Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <BilingualText en="Total Sessions" el="Συνολικές συνεδρίες" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedSessions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <BilingualText en="Upcoming" el="Επερχόμενες" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.upcomingSessions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <BilingualText en="Completion Rate" el="Ποσοστό ολοκλήρωσης" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">92%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <BilingualText en="Avg. Rating" el="Μέση βαθμολογία" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    <div className="text-2xl font-bold">4.8</div>
                    <Star className="icon-sm text-status-warning fill-status-warning" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle><BilingualText en="All Sessions" el="Όλες οι συνεδρίες" compact /></CardTitle>
                <Button size="sm" asChild>
                  <Link href="/mentor/sessions?new=1">
                    <Calendar className="icon-sm mr-2" aria-hidden="true" />
                    <BilingualText en="Schedule Session" el="Προγραμματισμός συνεδρίας" compact />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><BilingualText en="Mentor" el="Μέντορας" compact /></TableHead>
                      <TableHead><BilingualText en="Mentee" el="Μαθητευόμενος" compact /></TableHead>
                      <TableHead><BilingualText en="Topic" el="Θέμα" compact /></TableHead>
                      <TableHead><BilingualText en="Date" el="Ημερομηνία" compact /></TableHead>
                      <TableHead><BilingualText en="Duration" el="Διάρκεια" compact /></TableHead>
                      <TableHead><BilingualText en="Status" el="Κατάσταση" compact /></TableHead>
                      <TableHead><BilingualText en="Rating" el="Βαθμολογία" compact /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {initialsOf(session.mentor.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{session.mentor.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {initialsOf(session.mentee.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{session.mentee.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{session.topic}</TableCell>
                        <TableCell>{formatDate(session.scheduledDate)}</TableCell>
                        <TableCell>{session.duration} min</TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {session.rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="icon-sm text-status-warning fill-status-warning" />
                              <span>{session.rating}/5</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
