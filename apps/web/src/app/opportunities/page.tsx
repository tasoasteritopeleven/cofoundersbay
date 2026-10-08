'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BilingualText } from '@/components/common/BilingualText';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Handshake,
  FileText,
  MapPin,
  Users,
  Plus,
  Search,
  ArrowRight,
  Coins,
  Building2,
  Check,
  X,
  Loader2,
  Bookmark,
  Clock,
  Rocket,
  TrendingUp,
  Globe,
  AlertCircle,
  Store,
  GraduationCap,
} from 'lucide-react';
import {
  listJobs, createJobPosting, type JobPostingView,
  listOpportunities, type OpportunityItem, type OpportunityType,
} from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { NeedCardsSection, kindsForOpportunityType } from '@/components/commitments/NeedCardsSection';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { useDemoData } from '@/contexts/DemoDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, initialsOf } from '@/lib/utils';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { opportunitiesEn, opportunitiesEl } from '@/lib/i18n/strings-opportunities';
import { bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { SaveItemButton, useSavedItems, useSaveToggle } from '@/components/common/SaveItemButton';
import { MessageButton } from '@/components/common/PersonActions';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

// ── Types ──────────────────────────────────────────────────────────────────────

type OppType = 'cofounder' | 'job' | 'freelance';
// Map OpportunityType → OppType for display
const OPP_TYPE_MAP: Record<OpportunityType, OppType> = {
  job: 'job',
  cofounder: 'cofounder',
  investment: 'freelance',
  partnership: 'cofounder',
  mentorship: 'cofounder',
  other: 'freelance',
};

interface Proposal {
  id: string;
  fromName: string;
  fromInitials: string;
  fromRole: string;
  scope: string;
  timeframe: string;
  compensation: string;
  status: 'pending' | 'accepted' | 'declined';
  date: string;
}



const DEMO_PROPOSALS: Proposal[] = [
  {
    id: 'p1',
    fromName: 'Alex Chen',
    fromInitials: 'AC',
    fromRole: 'Founder',
    scope: 'Co-develop an AI validation tool. You handle product & UX, I handle engineering.',
    timeframe: '6 months',
    compensation: '50/50 equity split',
    status: 'pending',
    date: '1d ago',
  },
  {
    id: 'p2',
    fromName: 'Maria Santos',
    fromInitials: 'MS',
    fromRole: 'Angel Investor',
    scope: '€50k angel investment in exchange for advisory role and board observer seat.',
    timeframe: 'Ongoing',
    compensation: '5% equity',
    status: 'pending',
    date: '3d ago',
  },
];

// ── Config maps ───────────────────────────────────────────────────────────────


// ── Sub-components ─────────────────────────────────────────────────────────────

const OPP_TYPE_DISPLAY: Record<OpportunityType, { labelKey: `type_${OpportunityType}`; className: string; icon: typeof Briefcase }> = {
  cofounder: { labelKey: 'type_cofounder', className: 'bg-status-accent-bg text-status-accent border-status-accent-border ', icon: Handshake },
  job: { labelKey: 'type_job', className: 'bg-primary/10 text-primary-accessible border-primary/20', icon: Building2 },
  investment: { labelKey: 'type_investment', className: 'bg-status-success-bg text-status-success border-status-success-border ', icon: Coins },
  partnership: { labelKey: 'type_partnership', className: 'bg-status-accent-bg text-status-accent border-status-accent-border ', icon: Users },
  mentorship: { labelKey: 'type_mentorship', className: 'bg-status-warning-bg text-status-warning border-status-warning-border ', icon: Rocket },
  other: { labelKey: 'type_other', className: 'bg-muted text-muted-foreground border-border', icon: FileText },
};

function OpportunityCard({ opportunity }: { opportunity: OpportunityItem }) {
  const fmtDate = useDateFormat();
  const { ask } = usePopupChat();
  const cfg = OPP_TYPE_DISPLAY[opportunity.type] ?? OPP_TYPE_DISPLAY.other;
  const initials = (opportunity.company ?? opportunity.title).slice(0, 2).toUpperCase();
  const postedAgo = fmtDate(opportunity.createdAt, { day: 'numeric', month: 'short' });
  const deadline = opportunity.deadline
    ? fmtDate(opportunity.deadline, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    // The id is the assistant's citation target (`/opportunities#opportunity-…`).
    <Card id={`opportunity-${opportunity.id}`} className="card-interactive hover-lift group scroll-mt-24 transition-all duration-300 hover:border-primary/30">
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0 rounded-xl ring-2 ring-border/60">
              <AvatarFallback className="rounded-xl bg-primary/15 text-foreground font-bold text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">{opportunity.title}</h3>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {opportunity.company && (
                  <span className="text-sm text-muted-foreground">{opportunity.company}</span>
                )}
                <Badge variant="outline" className={cn('text-2xs px-1.5', cfg.className)}>
                  <cfg.icon className="mr-1 icon-sm" />
                  <BilingualText en={opportunitiesEn(cfg.labelKey)} el={opportunitiesEl(cfg.labelKey)} compact />
                </Badge>
                {opportunity.isRemote && (
                  <Badge variant="secondary" className="text-2xs bg-status-success-bg text-status-success ">
                    <BilingualText en={opportunitiesEn('remote')} el={opportunitiesEl('remote')} compact />
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
            <Clock className="icon-sm" />
            {postedAgo}
          </span>
        </div>

        {opportunity.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{opportunity.description}</p>
        )}

        {opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opportunity.tags.map((tag: string) => (
              <span key={tag} className="chip rounded-md bg-secondary/60 px-2 py-0.5 text-2xs text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {opportunity.location && (
            <span className="flex items-center gap-1">
              <MapPin className="icon-sm" />
              {opportunity.location}
            </span>
          )}
          {deadline && opportunity.deadline && (
            <span className={cn(
              'flex items-center gap-1',
              (() => {
                const daysLeft = Math.ceil((new Date(opportunity.deadline as string).getTime() - Date.now()) / 86400000);
                return daysLeft <= 3 ? 'text-status-danger font-medium' : 'text-status-warning ';
              })()
            )}>
              <AlertCircle className="icon-sm" />
              {(() => {
                const daysLeft = Math.ceil((new Date(opportunity.deadline as string).getTime() - Date.now()) / 86400000);
                return daysLeft <= 0
                  ? opportunitiesEn('expired')
                  : daysLeft <= 3
                    ? opportunitiesEn('days_left').replace('{n}', String(daysLeft))
                    : opportunitiesEn('deadline').replace('{date}', deadline);
              })()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="icon-sm" />
            {opportunity.createdBy.displayName}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          {opportunity.url ? (
            <Button size="sm" className="gap-1.5 text-xs" asChild>
              <a href={opportunity.url} target="_blank" rel="noopener noreferrer">
                <BilingualText en={opportunitiesEn('apply_now')} el={opportunitiesEl('apply_now')} compact /> <ArrowRight className="icon-sm" />
              </a>
            </Button>
          ) : (
            /* No link was posted, and there is no apply endpoint to call — so
               the button said "Apply Now" and did nothing. The assistant can
               actually draft the approach from what this listing says, and the
               label now names that rather than promising a form. */
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => ask(
                `Draft my approach for this opportunity: "${opportunity.title}"` +
                  `${opportunity.company ? ` at ${opportunity.company}` : ''}. ` +
                  `Type: ${opportunitiesEn(cfg.labelKey)}. ${opportunity.description ?? ''}`,
              )}
            >
              <BilingualText en="Draft an approach" el="Σύνταξη προσέγγισης" compact />
              <ArrowRight className="icon-sm" />
            </Button>
          )}
          {/* Stored for the reader (/api/saved-items). It used to toast
              "saved on this device" and store nothing. */}
          <SaveItemButton kind="opportunity" itemId={opportunity.id} title={opportunity.title} />
        </div>
      </CardContent>
    </Card>
  );
}

function JobCard({ job }: { job: JobPostingView }) {
  const { ask } = usePopupChat();
  return (
    <Card className="card-interactive hover-lift group transition-all duration-300 hover:border-primary/30">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0 rounded-xl ring-2 ring-border/60">
              <AvatarFallback className="rounded-xl bg-primary/15 text-foreground font-bold text-sm">
                {initialsOf(job.creator.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">{job.title}</h3>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{job.creator.displayName}</span>
                <Badge variant="outline" className="text-2xs px-1.5 bg-primary/10 text-primary-accessible border-primary/20">
                  <Building2 className="mr-1 icon-sm" />
                  <BilingualText en={opportunitiesEn('job')} el={opportunitiesEl('job')} compact />
                </Badge>
                {job.isRemote && (
                  <Badge variant="secondary" className="text-2xs">
                    <BilingualText en={opportunitiesEn('remote')} el={opportunitiesEl('remote')} compact />
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="icon-sm" />
              {job.location}
            </span>
          )}
          {job.role && (
            <span className="flex items-center gap-1">
              <Briefcase className="icon-sm" />
              {job.role}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {/* The job feed has no apply route, so the useful actions are the
              draft the assistant writes and a message to the poster (the
              posting now carries the poster's id). */}
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => ask(
              `Draft an application for the role "${job.title}" posted by ${job.creator.displayName}. ` +
                'Use my profile and tell me what is missing before I send it.',
            )}
          >
            <BilingualText en="Draft application" el="Σύνταξη αίτησης" compact />
            <ArrowRight className="icon-sm" />
          </Button>
          <SaveItemButton kind="job" itemId={job.id} title={job.title} />
          <MessageButton userId={job.creator?.id} displayName={job.creator.displayName} />
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalCard({
  proposal,
  onAccept,
  onDecline,
}: {
  proposal: Proposal;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const isPending = proposal.status === 'pending';
  const PROPOSAL_STATUS: Record<string, { labelKey: 'status_pending' | 'status_accepted' | 'status_declined'; className: string }> = {
    pending: { labelKey: 'status_pending', className: 'bg-muted text-muted-foreground' },
    accepted: { labelKey: 'status_accepted', className: 'bg-status-success-bg text-status-success ' },
    declined: { labelKey: 'status_declined', className: 'bg-destructive/20 text-status-danger dark:text-destructive-accessible' },
  };
  const statusCfg = PROPOSAL_STATUS[proposal.status] ?? PROPOSAL_STATUS.pending;

  return (
    <Card className={cn('transition-all', !isPending && 'surface-inactive')}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/15 text-foreground text-xs font-bold">
                {proposal.fromInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{proposal.fromName}</p>
              <p className="text-xs text-muted-foreground">{proposal.fromRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-xs', statusCfg.className)}>
              <BilingualText en={opportunitiesEn(statusCfg.labelKey)} el={opportunitiesEl(statusCfg.labelKey)} compact />
            </Badge>
            <span className="text-xs text-muted-foreground">{proposal.date}</span>
          </div>
        </div>

        <div className="rounded-xl bg-secondary/40 p-4 space-y-2">
          <p className="text-sm text-foreground leading-relaxed">{proposal.scope}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Clock className="icon-sm" />
              {proposal.timeframe}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="icon-sm" />
              {proposal.compensation}
            </span>
          </div>
        </div>

        {isPending && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-2"
              onClick={() => onAccept(proposal.id)}
            >
              <Check className="icon-sm" />
              <BilingualText en={opportunitiesEn('accept')} el={opportunitiesEl('accept')} compact />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => onDecline(proposal.id)}
            >
              <X className="icon-sm" />
              <BilingualText en={opportunitiesEn('decline')} el={opportunitiesEl('decline')} compact />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostOpportunityForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState({
    title: '',
    role: '',
    location: '',
    isRemote: false,
    type: 'cofounder' as OpportunityType,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createJobPosting({
        title: form.title.trim(),
        role: form.role.trim() || undefined,
        location: form.location.trim() || undefined,
        isRemote: form.isRemote,
      }),
    onSuccess: () => {
      success('Posted!', 'Your opportunity is now live.');
      onCreated();
      onClose();
    },
    onError: (err) =>
      showError('Failed', err instanceof Error ? err.message : 'Please try again'),
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={opportunitiesEn('post')} el={opportunitiesEl('post')} compact />
          </DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Post an opportunity so community members can respond." el="Δημοσιεύστε μια ευκαιρία για να ανταποκριθούν τα μέλη της κοινότητας." /></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p id="opp-type" className="text-sm font-medium">Type</p>
            <div className="flex gap-2 flex-wrap" role="group" aria-labelledby="opp-type">
              {(Object.entries(OPP_TYPE_DISPLAY) as [OpportunityType, typeof OPP_TYPE_DISPLAY['job']][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={form.type === key}
                  onClick={() => set('type', key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    form.type === key
                      ? 'border-primary bg-primary/20 text-primary-accessible'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <cfg.icon className="icon-sm" />
                  <BilingualText en={opportunitiesEn(cfg.labelKey)} el={opportunitiesEl(cfg.labelKey)} compact />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="opp-f1" className="text-sm font-medium">Title *</label>
            <Input id="opp-f1"
              placeholder="e.g. CTO Co-founder, Growth Lead"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="opp-f2" className="text-sm font-medium">Role / function</label>
            <Input id="opp-f2"
              placeholder="e.g. Engineering, Marketing"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="opp-f3" className="text-sm font-medium">Location</label>
            <Input id="opp-f3"
              placeholder="e.g. Athens, GR"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              disabled={form.isRemote}
              maxLength={120}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRemote}
              onChange={(e) => set('isRemote', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Remote
          </label>
        <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              className="gap-2"
              onClick={() => mutation.mutate()}
              disabled={!form.title.trim() || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Rocket className="icon-sm" />}
              Post
            </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  // The assistant cites a listing as /opportunities#opportunity-<id>; its card mounts after the data.
  useScrollToHash();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { ask } = usePopupChat();
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<'listings' | 'jobs' | 'applications' | 'proposals'>('listings');
  const [search, setSearch] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  // Saved only: listings and jobs the reader saved (LinkedIn's "Save").
  const [savedOnly, setSavedOnly] = useState(false);
  const savedListings = useSavedItems('opportunity');
  const savedJobs = useSavedItems('job');
  const toggleListing = useSaveToggle('opportunity');
  const toggleJob = useSaveToggle('job');
  const [oppTypeFilter, setOppTypeFilter] = useState<OpportunityType | 'all'>('all');
  const [cardAlertOpen, setCardAlertOpen] = useState(false);
  // A need-card search opened from /saved-searches arrives as ?type=&q=&remote=1.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const type = p.get('type');
    if (type && (['all', 'job', 'cofounder', 'investment', 'partnership', 'mentorship', 'other'] as const).includes(type as OpportunityType | 'all')) setOppTypeFilter(type as OpportunityType | 'all');
    const q = p.get('q');
    if (q) setSearch(q.slice(0, 200));
    if (p.get('remote') === '1') setRemoteOnly(true);
  }, []);
  const [sampleProposals, setProposals] = useState<Proposal[]>(DEMO_PROPOSALS);
  const [showPostForm, setShowPostForm] = useState(false);
  const { openRailSection } = usePageRail();
  // Incoming proposals have no API yet. The two sample cards appear only when
  // sample data is on, so a real account never counts invented proposals.
  const { showDemoData } = useDemoData();
  const proposals = showDemoData ? sampleProposals : [];

  const { data: opportunitiesData, isLoading: oppLoading, isError: oppError, refetch: refetchOpp } = useQuery({
    queryKey: qk('opportunities', { search, type: oppTypeFilter, isRemote: remoteOnly || undefined }),
    queryFn: () => listOpportunities({
      search: search.trim() || undefined,
      type: oppTypeFilter !== 'all' ? oppTypeFilter : undefined,
      isRemote: remoteOnly || undefined,
      limit: 50,
    }),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useQuery({
    queryKey: qk('jobs', { limit: 50 }),
    queryFn: () => listJobs({ limit: 50 }),
    staleTime: 60_000,
    retry: 1,
  });

  const opportunities = (opportunitiesData?.opportunities ?? []).filter((o) => !savedOnly || savedListings.ids.has(o.id));
  const listingJobs = (jobsData?.jobs ?? []).filter((j) => !savedOnly || savedJobs.ids.has(j.id));
  const pendingProposals = proposals.filter((p) => p.status === 'pending').length;

  const handleAcceptProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'accepted' as const } : p)),
    );
    success(opportunitiesEn('proposal_accepted'), opportunitiesEn('proposal_accepted_body'));
  };

  const handleDeclineProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'declined' as const } : p)),
    );
  };

  // Offered to the assistant: tab, type, remote only and Post; the sample
  // proposals' Accept / Decline change this screen only, and say so.
  const oppTypes = ['all', 'cofounder', 'job', 'investment', 'partnership', 'mentorship'] as const;
  const pendingList = proposals.filter((p) => p.status === 'pending');
  usePageList([
    {
      id: 'opportunities',
      labelEn: 'Opportunities',
      labelEl: 'Ευκαιρίες',
      rows: oppLoading ? undefined : opportunities.map((o) => `${o.title}${o.company ? ` · ${o.company}` : ''} · ${o.type} · ${o.isRemote ? 'remote' : (o.location ?? 'on-site')}${o.deadline ? ` · closes ${o.deadline.slice(0, 10)}` : ''}`),
    },
    {
      id: 'proposals',
      labelEn: 'Proposals',
      labelEl: 'Προτάσεις',
      rows: proposals.map((p) => `${p.fromName} (${p.fromRole}) · ${p.scope} · ${p.timeframe} · ${p.compensation} · ${p.status}`),
      sample: true,
    },
  ]);
  usePageControls([
    choiceControl('opportunity_tab', 'Opportunities section', 'Ενότητα ευκαιριών', (['listings', 'jobs', 'applications', 'proposals'] as const).map((k) => ({ value: k, en: opportunitiesEn(`tab_${k}`), el: opportunitiesEl(`tab_${k}`) })), activeTab, (v) => setActiveTab(v as typeof activeTab)),
    choiceControl('opportunity_type', 'Opportunity type', 'Τύπος ευκαιρίας', oppTypes.map((t) => ({ value: t, en: t === 'all' ? opportunitiesEn('all_types') : opportunitiesEn(OPP_TYPE_DISPLAY[t].labelKey), el: t === 'all' ? opportunitiesEl('all_types') : opportunitiesEl(OPP_TYPE_DISPLAY[t].labelKey) })), oppTypeFilter, (v) => setOppTypeFilter(v as typeof oppTypeFilter)),
    choiceControl('remote_only', 'Remote only', 'Μόνο εξ αποστάσεως', [
      { value: 'off', en: 'Any location', el: 'Οποιαδήποτε τοποθεσία' },
      { value: 'on', en: 'Remote only', el: 'Μόνο εξ αποστάσεως' },
    ], remoteOnly ? 'on' : 'off', (v) => setRemoteOnly(v === 'on')),
    choiceControl('saved_only', 'Saved only', 'Μόνο αποθηκευμένα', [
      { value: 'all', en: 'Everything', el: 'Όλα' },
      { value: 'saved', en: 'Saved only', el: 'Μόνο αποθηκευμένα' },
    ], savedOnly ? 'saved' : 'all', (v) => setSavedOnly(v === 'saved')),
    {
      // The same write as each card's Save; Undo removes exactly the row it added.
      id: 'save_listing',
      labelEn: 'Save a listing',
      labelEl: 'Αποθήκευση καταχώρισης',
      writes: true,
      options: rowOptions(opportunities.filter((o) => !savedListings.ids.has(o.id)), (o) => o.id, (o) => o.title),
      unavailableEn: opportunities.some((o) => !savedListings.ids.has(o.id)) ? undefined : 'Every listing shown is already saved.',
      unavailableEl: opportunities.some((o) => !savedListings.ids.has(o.id)) ? undefined : 'Κάθε καταχώριση που εμφανίζεται είναι ήδη αποθηκευμένη.',
      run: async (v) => {
        if (!v || !opportunities.some((o) => o.id === v)) return ROW_GONE;
        await toggleListing.mutateAsync({ itemId: v, save: true });
      },
      undo: (v) => (v && !savedListings.ids.has(v) ? { control: 'unsave_listing', value: v } : undefined),
    },
    {
      id: 'unsave_listing',
      labelEn: 'Remove a listing from saved',
      labelEl: 'Αφαίρεση καταχώρισης από τα αποθηκευμένα',
      writes: true,
      options: rowOptions(opportunities.filter((o) => savedListings.ids.has(o.id)), (o) => o.id, (o) => o.title),
      unavailableEn: opportunities.some((o) => savedListings.ids.has(o.id)) ? undefined : 'No saved listing is shown.',
      unavailableEl: opportunities.some((o) => savedListings.ids.has(o.id)) ? undefined : 'Δεν εμφανίζεται αποθηκευμένη καταχώριση.',
      run: async (v) => {
        if (!v) return ROW_GONE;
        await toggleListing.mutateAsync({ itemId: v, save: false });
      },
      undo: (v) => (v && savedListings.ids.has(v) ? { control: 'save_listing', value: v } : undefined),
    },
    {
      id: 'save_job',
      labelEn: 'Save a job',
      labelEl: 'Αποθήκευση θέσης',
      writes: true,
      options: rowOptions(listingJobs.filter((j) => !savedJobs.ids.has(j.id)), (j) => j.id, (j) => j.title),
      unavailableEn: listingJobs.some((j) => !savedJobs.ids.has(j.id)) ? undefined : 'Every job shown is already saved.',
      unavailableEl: listingJobs.some((j) => !savedJobs.ids.has(j.id)) ? undefined : 'Κάθε θέση που εμφανίζεται είναι ήδη αποθηκευμένη.',
      run: async (v) => {
        if (!v || !listingJobs.some((j) => j.id === v)) return ROW_GONE;
        await toggleJob.mutateAsync({ itemId: v, save: true });
      },
      undo: (v) => (v && !savedJobs.ids.has(v) ? { control: 'unsave_job', value: v } : undefined),
    },
    {
      id: 'unsave_job',
      labelEn: 'Remove a job from saved',
      labelEl: 'Αφαίρεση θέσης από τα αποθηκευμένα',
      writes: true,
      options: rowOptions(listingJobs.filter((j) => savedJobs.ids.has(j.id)), (j) => j.id, (j) => j.title),
      unavailableEn: listingJobs.some((j) => savedJobs.ids.has(j.id)) ? undefined : 'No saved job is shown.',
      unavailableEl: listingJobs.some((j) => savedJobs.ids.has(j.id)) ? undefined : 'Δεν εμφανίζεται αποθηκευμένη θέση.',
      run: async (v) => {
        if (!v) return ROW_GONE;
        await toggleJob.mutateAsync({ itemId: v, save: false });
      },
      undo: (v) => (v && savedJobs.ids.has(v) ? { control: 'save_job', value: v } : undefined),
    },
    { id: 'post_opportunity', labelEn: 'Open the post form', labelEl: 'Άνοιγμα φόρμας δημοσίευσης', writes: false, run: () => setShowPostForm(true) },
    {
      id: 'alert_new_need_cards',
      labelEn: 'Set up an alert for new need cards with these filters',
      labelEl: 'Ρύθμιση ειδοποίησης για νέες κάρτες ανάγκης με αυτά τα φίλτρα',
      writes: false,
      ...(kindsForOpportunityType(oppTypeFilter) ? {} : { unavailableEn: 'This opportunity type has no need cards.', unavailableEl: 'Αυτός ο τύπος ευκαιρίας δεν έχει κάρτες ανάγκης.' }),
      run: () => { setActiveTab('listings'); setCardAlertOpen(true); },
    },
    { id: 'accept_proposal', labelEn: 'Accept sample proposal (this screen only)', labelEl: 'Αποδοχή δείγματος πρότασης (μόνο σε αυτή την οθόνη)', writes: false, options: rowOptions(pendingList, (p) => p.id, (p) => p.fromName), run: (v) => { if (v) handleAcceptProposal(v); } },
    { id: 'decline_proposal', labelEn: 'Decline sample proposal (this screen only)', labelEl: 'Απόρριψη δείγματος πρότασης (μόνο σε αυτή την οθόνη)', writes: false, options: rowOptions(pendingList, (p) => p.id, (p) => p.fromName), run: (v) => { if (v) handleDeclineProposal(v); } },
    {
      id: 'draft_approach',
      labelEn: 'Draft an approach for',
      labelEl: 'Σύνταξη προσέγγισης για',
      writes: false,
      options: rowOptions(opportunities.filter((o) => !o.url), (o) => o.id, (o) => o.title),
      unavailableEn: opportunities.filter((o) => !o.url).length === 0 ? 'Every listing here already has an apply link.' : undefined,
      unavailableEl: opportunities.filter((o) => !o.url).length === 0 ? 'Κάθε καταχώριση εδώ έχει ήδη σύνδεσμο αίτησης.' : undefined,
      run: (v) => {
        const opportunity = opportunities.find((o) => o.id === v);
        if (!opportunity) return;
        const cfg = OPP_TYPE_DISPLAY[opportunity.type] ?? OPP_TYPE_DISPLAY.other;
        ask(
          `Draft my approach for this opportunity: "${opportunity.title}"` +
            `${opportunity.company ? ` at ${opportunity.company}` : ''}. ` +
            `Type: ${opportunitiesEn(cfg.labelKey)}. ${opportunity.description ?? ''}`,
        );
      },
    },
    {
      id: 'draft_application',
      labelEn: 'Draft an application for',
      labelEl: 'Σύνταξη αίτησης για',
      writes: false,
      options: rowOptions(listingJobs, (j) => j.id, (j) => j.title),
      unavailableEn: listingJobs.length === 0 ? 'No jobs are shown on this screen.' : undefined,
      unavailableEl: listingJobs.length === 0 ? 'Δεν εμφανίζονται θέσεις σε αυτή την οθόνη.' : undefined,
      run: (v) => {
        const job = listingJobs.find((j) => j.id === v);
        if (!job) return;
        ask(
          `Draft an application for the role "${job.title}" posted by ${job.creator.displayName}. ` +
            'Use my profile and tell me what is missing before I send it.',
        );
      },
    },
  ]);

  /*
   * The column leads with the section tabs, the search and the listings. The
   * counts describe the list, and the type and remote filters narrow it, so
   * both live in the rail. The filters apply to the Listings section only.
   */
  const listingFilters = (oppTypeFilter !== 'all' ? 1 : 0) + (remoteOnly ? 1 : 0) + (savedOnly ? 1 : 0);
  const listCount = (n: number) => (oppLoading || oppError ? '—' : n);
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'briefcase',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'listings', label: 'Listings shown', labelEl: 'Καταχωρίσεις που εμφανίζονται', value: listCount(opportunities.length), icon: Briefcase, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'remote', label: opportunitiesEn('stat_remote'), labelEl: opportunitiesEl('stat_remote'), value: listCount(opportunities.filter((o) => o.isRemote).length), icon: Globe, tone: 'bg-status-success-bg text-status-success' },
            { key: 'cofounder', label: 'Co-founder roles', labelEl: 'Ρόλοι συνιδρυτή', value: listCount(opportunities.filter((o) => o.type === 'cofounder').length), icon: Handshake, tone: 'bg-status-info-bg text-status-info' },
            ...(showDemoData ? [{ key: 'proposals', label: 'Sample proposals pending', labelEl: 'Δείγματα προτάσεων σε αναμονή', value: pendingProposals, icon: TrendingUp, tone: 'bg-status-warning-bg text-status-warning' }] : []),
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: listingFilters || null,
      content: (
        <div className="space-y-4">
          {activeTab !== 'listings' && (
            <p className="px-2.5 text-xs leading-relaxed text-muted-foreground">
              <BilingualText en="Type and location narrow the Listings section; Saved narrows Listings and Jobs." el="Ο τύπος και η τοποθεσία περιορίζουν τις Καταχωρίσεις· τα Αποθηκευμένα περιορίζουν Καταχωρίσεις και Θέσεις." wrap />
            </p>
          )}
          <RailOptions
            title="Type"
            titleEl="Τύπος"
            options={oppTypes.map((t) => ({
              value: t,
              en: t === 'all' ? opportunitiesEn('all_types') : opportunitiesEn(OPP_TYPE_DISPLAY[t].labelKey),
              el: t === 'all' ? opportunitiesEl('all_types') : opportunitiesEl(OPP_TYPE_DISPLAY[t].labelKey),
              icon: t === 'all' ? Briefcase : OPP_TYPE_DISPLAY[t].icon,
            }))}
            value={oppTypeFilter}
            onChange={(v) => { setOppTypeFilter(v); setActiveTab('listings'); }}
          />
          <RailOptions
            title="Location"
            titleEl="Τοποθεσία"
            options={[
              { value: 'off', en: 'Any location', el: 'Οποιαδήποτε τοποθεσία', icon: MapPin },
              { value: 'on', en: opportunitiesEn('remote_only'), el: opportunitiesEl('remote_only'), icon: Globe },
            ]}
            value={remoteOnly ? 'on' : 'off'}
            onChange={(v) => { setRemoteOnly(v === 'on'); setActiveTab('listings'); }}
          />
          <RailOptions
            title="Saved"
            titleEl="Αποθηκευμένα"
            options={[
              { value: 'all', en: 'Everything', el: 'Όλα', icon: Briefcase },
              { value: 'saved', en: 'Saved only', el: 'Μόνο αποθηκευμένα', icon: Bookmark, count: savedListings.ids.size + savedJobs.ids.size },
            ]}
            value={savedOnly ? 'saved' : 'all'}
            onChange={(v) => setSavedOnly(v === 'saved')}
          />
          {listingFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => { setOppTypeFilter('all'); setRemoteOnly(false); setSavedOnly(false); }} />
          )}
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Briefcase} en="Open jobs" el="Άνοιγμα θέσεων" onClick={() => router.push('/jobs')} />
          <RailAction icon={Store} en="Open marketplace" el="Άνοιγμα αγοράς" onClick={() => router.push('/marketplace')} />
          <RailAction icon={GraduationCap} en="Open programs" el="Άνοιγμα προγραμμάτων" onClick={() => router.push('/programs')} />
        </div>
      ),
    },
  ];

  const tabs = [
    { key: 'listings' as const, labelKey: 'tab_listings' as const, icon: Handshake },
    { key: 'jobs' as const, labelKey: 'tab_jobs' as const, icon: Briefcase },
    { key: 'applications' as const, labelKey: 'tab_applications' as const, icon: FileText },
    { key: 'proposals' as const, labelKey: 'tab_proposals' as const, icon: Check, badge: pendingProposals },
  ];

  return (
    <>
      {showPostForm && (
        <PostOpportunityForm
          onClose={() => setShowPostForm(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: qk('jobs') })}
        />
      )}
      <AppShell
        showHelp
        rail={rail}
        actions={
          <Button className="gap-2" onClick={() => setShowPostForm(true)}>
            <Plus className="icon-sm" />
            <BilingualText en={opportunitiesEn('post')} el={opportunitiesEl('post')} compact />
          </Button>
        }
      >
        <div className="space-y-6 pb-10">
        {/* Tabs */}
        {/* Wraps rather than scrolls: four bilingual labels are wider than the
            column, and a scrolled strip hid the fourth (Proposals). */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-secondary/50 p-1" role="group" aria-label={bilingualInline('Opportunities section', 'Ενότητα ευκαιριών')}>
          {tabs.map(({ key, labelKey, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                activeTab === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="icon-sm" aria-hidden="true" />
              <BilingualText en={opportunitiesEn(labelKey)} el={opportunitiesEl(labelKey)} compact />
              {badge !== undefined && badge > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-2xs font-bold text-primary-accessible">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Listings tab */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            <NeedCardsSection type={oppTypeFilter} remoteOnly={remoteOnly} search={search} alertOpen={cardAlertOpen} onAlertOpenChange={setCardAlertOpen} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder={bilingualInline(opportunitiesEn('search_roles'), opportunitiesEl('search_roles'))}
                aria-label={bilingualInline(opportunitiesEn('search_roles'), opportunitiesEl('search_roles'))}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {oppError ? (
              <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  <BilingualText en={opportunitiesEn('load_failed')} el={opportunitiesEl('load_failed')} compact />
                </p>
                <Button variant="secondary" size="sm" onClick={() => refetchOpp()}>
                  <BilingualText en={opportunitiesEn('try_again')} el={opportunitiesEl('try_again')} compact />
                </Button>
              </CardContent></Card>
            ) : oppLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </CardContent></Card>
              ))
            ) : opportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Handshake className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">
                  <BilingualText en={opportunitiesEn('none_found')} el={opportunitiesEl('none_found')} compact />
                </p>
                <p className="text-sm mt-1">
                  <BilingualText en={opportunitiesEn('none_found_hint')} el={opportunitiesEl('none_found_hint')} compact />
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {listingFilters > 0 && (
                    <Button variant="secondary" onClick={() => openRailSection('filters')}>
                      <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                    </Button>
                  )}
                  <Button className="gap-2" onClick={() => setShowPostForm(true)}>
                    <Plus className="icon-sm" />
                    <BilingualText en={opportunitiesEn('post')} el={opportunitiesEl('post')} compact />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  <BilingualText
                    en={opportunities.length === 1 ? opportunitiesEn('count_one') : opportunitiesEn('count_many').replace('{n}', String(opportunities.length))}
                    el={opportunities.length === 1 ? opportunitiesEl('count_one') : opportunitiesEl('count_many').replace('{n}', String(opportunities.length))}
                    compact
                  />
                </p>
                {opportunities.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Jobs tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder={bilingualInline(opportunitiesEn('search_jobs'), opportunitiesEl('search_jobs'))}
                aria-label={bilingualInline(opportunitiesEn('search_jobs'), opportunitiesEl('search_jobs'))}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {jobsError ? (
              <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  <BilingualText en={opportunitiesEn('jobs_failed')} el={opportunitiesEl('jobs_failed')} compact />
                </p>
                <Button variant="secondary" size="sm" onClick={() => refetchJobs()}>
                  <BilingualText en={opportunitiesEn('try_again')} el={opportunitiesEl('try_again')} compact />
                </Button>
              </CardContent></Card>
            ) : jobsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : savedOnly && !listingJobs.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Bookmark className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium"><BilingualText en="No saved jobs yet" el="Καμία αποθηκευμένη θέση ακόμη" compact /></p>
                <p className="text-sm mt-1"><BilingualText en="Press Save on a job to keep it here." el="Πατήστε «Αποθήκευση» σε μια θέση για να μείνει εδώ." wrap /></p>
                <Button variant="secondary" className="mt-4" onClick={() => openRailSection('filters')}>
                  <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                </Button>
              </div>
            ) : !jobsData?.jobs?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Briefcase className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">
                  <BilingualText en={opportunitiesEn('none_jobs')} el={opportunitiesEl('none_jobs')} compact />
                </p>
                <p className="text-sm mt-1">
                  <BilingualText en={opportunitiesEn('none_jobs_hint')} el={opportunitiesEl('none_jobs_hint')} compact />
                </p>
                <Button className="mt-4 gap-2" onClick={() => setShowPostForm(true)}>
                  <Plus className="icon-sm" />
                  <BilingualText en={opportunitiesEn('post_job')} el={opportunitiesEl('post_job')} compact />
                </Button>
              </div>
            ) : (
              (listingJobs as JobPostingView[])
                .filter(
                  (j) =>
                    !search.trim() ||
                    j.title.toLowerCase().includes(search.toLowerCase()) ||
                    j.creator.displayName.toLowerCase().includes(search.toLowerCase()),
                )
                .map((job) => <JobCard key={job.id} job={job} />)
            )}
          </div>
        )}

        {/* Applications tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">
                <BilingualText en={opportunitiesEn('applications_title')} el={opportunitiesEl('applications_title')} compact />
              </p>
              <p className="text-sm mt-1">
                <BilingualText en={opportunitiesEn('applications_hint')} el={opportunitiesEl('applications_hint')} compact />
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('listings')}>
                  <BilingualText en={opportunitiesEn('browse_opportunities')} el={opportunitiesEl('browse_opportunities')} compact />
                </Button>
                <Button size="sm" onClick={() => setActiveTab('jobs')}>
                  <BilingualText en={opportunitiesEn('browse_jobs')} el={opportunitiesEl('browse_jobs')} compact />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Proposals tab */}
        {activeTab === 'proposals' && (
          <div className="space-y-4">
            {showDemoData && <SampleDataNotice
              surface="Proposals"
              detail="Incoming collaboration proposals are not a live API yet. These two cards show the layout so you can learn Accept and Decline."
              askAiPrompt="These collaboration proposals are samples. How should I evaluate a real co-founder or investment proposal when one arrives?"
            />}
            {proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">
                  <BilingualText en={opportunitiesEn('none_proposals')} el={opportunitiesEl('none_proposals')} compact />
                </p>
                <p className="text-sm mt-1">
                  <BilingualText en={opportunitiesEn('none_proposals_hint')} el={opportunitiesEl('none_proposals_hint')} compact />
                </p>
              </div>
            ) : (
              proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAccept={handleAcceptProposal}
                  onDecline={handleDeclineProposal}
                />
              ))
            )}
          </div>
        )}
        {/* Equity roles, investments and proposals appear on this page. */}
        <NonGuaranteeNote />
        </div>
      </AppShell>
    </>
  );
}
