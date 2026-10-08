'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Briefcase,
  Clock,
  FolderKanban,
  MessageSquare,
  Star,
  Store,
  UserCog,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, QuickLinks, SectionCard } from '@/components/dashboard/SectionCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { RelativeTime } from '@/components/common/RelativeTime';
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting';
import { useDemoData } from '@/contexts/DemoDataContext';
import { useSession } from '@/hooks/useSession';
import {
  getMeProfile,
  getProviderSummary,
  listMyMarketplaceServices,
  listServiceInquiries,
  type InquiryStatus,
  type ServiceInquiryItem,
} from '@/lib/api';
import { dashboardEl, dashboardEn } from '@/lib/i18n/strings-dashboard';
import { qk, queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, initialsOf } from '@/lib/utils';
import { WhatsNewPanel } from '@/components/dashboard/WhatsNewPanel';

/*
 * The provider's one home.
 *
 * There were two. This route - the one the navigation, the role switcher and
 * the post-login redirect all open - drew constants: 5 services, 8 projects,
 * "$12,450" this month, a 4.9 "based on 47 reviews", a 98% response rate and
 * a "Top Rated Provider" badge. /provider/dashboard beside it read the
 * provider's own book and said 3 projects, 2 inquiries and a 4.7. It now
 * reads that book - the summary, inquiries, projects, reviews and services
 * endpoints the provider pages list from - and /provider/dashboard redirects
 * here, the way /investor/dashboard and /mentor/dashboard already do.
 */

type Inquiry = {
  id: string;
  clientName: string;
  clientAvatar?: string;
  service: string;
  message: string;
  receivedAt: string;
  status: InquiryStatus;
};

type Project = {
  id: string;
  clientName: string;
  clientAvatar?: string;
  service: string;
  status: 'active' | 'completed';
  agreedPrice: number | null;
  currency: string;
};

type DashReview = { id: string; client: string; rating: number; comment: string };

const EM_DASH = '—';

/*
 * What an inquiry waits on. `open` and `in_discussion` are the two the
 * summary counts as open, so the tile above and the list below agree; the
 * rest are settled (accepted and completed ones are projects now). Declined
 * and cancelled inquiries used to read "replied", as if they still waited.
 */
const WAITING: InquiryStatus[] = ['open', 'in_discussion'];
const INQUIRY_LABEL: Record<InquiryStatus, { en: string; tone: string }> = {
  open: { en: 'New', tone: 'bg-status-info-bg text-status-info' },
  in_discussion: { en: 'In discussion', tone: 'bg-status-warning-bg text-status-warning' },
  accepted: { en: 'Accepted', tone: 'bg-status-success-bg text-status-success' },
  completed: { en: 'Completed', tone: 'bg-status-success-bg text-status-success' },
  declined: { en: 'Declined', tone: 'bg-muted text-muted-foreground' },
  cancelled: { en: 'Cancelled', tone: 'bg-muted text-muted-foreground' },
};

function toInquiry(row: ServiceInquiryItem): Inquiry {
  return {
    id: row.id,
    clientName: row.client?.displayName ?? 'Someone',
    clientAvatar: row.client?.avatarUrl ?? undefined,
    service: row.offer?.title ?? EM_DASH,
    message: row.message,
    receivedAt: row.createdAt,
    status: row.status,
  };
}

/*
 * An inquiry records what was agreed and when it was resolved, not a
 * schedule, so a project shows its agreed price rather than an invented
 * progress bar or due date.
 */
function toProject(row: ServiceInquiryItem): Project {
  return {
    id: row.id,
    clientName: row.client?.displayName ?? 'A client',
    clientAvatar: row.client?.avatarUrl ?? undefined,
    service: row.offer?.title ?? EM_DASH,
    status: row.status === 'completed' ? 'completed' : 'active',
    agreedPrice: row.agreedPrice,
    currency: row.currency || 'EUR',
  };
}

function toReview(row: ServiceInquiryItem): DashReview {
  return {
    id: row.id,
    client: row.client?.displayName ?? 'A client',
    rating: row.rating ?? 0,
    comment: row.reviewComment ?? '',
  };
}

function eur(amount: number | null, currency = 'EUR'): string {
  if (amount == null) return EM_DASH;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/*
 * Shown when the showcase switch is on and the book is empty (a real account
 * with no inquiries yet). The same founders the showcase's API answers with.
 */
const DEMO_INQUIRIES: Inquiry[] = [
  { id: 'd1', clientName: 'Katerina Nikolaou', service: 'Seed-round financial model', message: 'Raising a €1.2M seed in Q1 and need a model investors will trust.', receivedAt: '2026-09-22T10:00:00.000Z', status: 'open' },
  { id: 'd2', clientName: 'Giorgos Vlachos', service: 'Incorporation & shareholder agreement', message: 'Two founders, one angel committed - we need the company set up.', receivedAt: '2026-09-20T10:00:00.000Z', status: 'in_discussion' },
];
const DEMO_PROJECTS: Project[] = [
  { id: 'd3', clientName: 'Sofia Alexiou', service: 'Fractional CFO', status: 'active', agreedPrice: 3800, currency: 'EUR' },
  { id: 'd4', clientName: 'Yannis Petrou', service: 'Seed-round financial model', status: 'completed', agreedPrice: 1800, currency: 'EUR' },
];
const DEMO_REVIEWS: DashReview[] = [
  { id: 'd5', client: 'Yannis Petrou', rating: 5, comment: 'The model answered every question our lead asked before they asked it.' },
  { id: 'd6', client: 'Maria Georgiou', rating: 4, comment: 'Clear, fast, and the agreement held up in due diligence.' },
];

export default function ProviderDashboard() {
  const { hasSession, mounted } = useSession();
  const { showDemoData } = useDemoData();

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasSession && mounted,
  });
  const { data: summary } = useQuery({
    queryKey: qk('provider', 'summary'),
    queryFn: getProviderSummary,
    staleTime: 60_000,
    retry: 0,
  });
  const { data: inquiryPage, isLoading: inquiriesLoading } = useQuery({
    queryKey: qk('provider', 'inquiries', 'dashboard'),
    queryFn: () => listServiceInquiries({ side: 'provider', limit: 20 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: projectPage, isLoading: projectsLoading } = useQuery({
    queryKey: qk('provider', 'projects', 'dashboard'),
    queryFn: () => listServiceInquiries({ side: 'provider', kind: 'projects', limit: 50 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: reviewPage, isLoading: reviewsLoading } = useQuery({
    queryKey: qk('provider', 'reviews', 'dashboard'),
    queryFn: () => listServiceInquiries({ side: 'provider', kind: 'reviews', limit: 3 }),
    staleTime: 60_000,
    retry: 0,
  });
  const { data: servicePage, isLoading: servicesLoading } = useQuery({
    queryKey: qk('provider', 'services'),
    queryFn: () => listMyMarketplaceServices({ limit: 50 }),
    staleTime: 60_000,
    retry: 0,
  });

  const displayName = profile?.profile?.displayName || 'Provider';
  const liveInquiries = useMemo(() => (inquiryPage?.inquiries ?? []).map(toInquiry), [inquiryPage]);
  const liveProjects = useMemo(() => (projectPage?.inquiries ?? []).map(toProject), [projectPage]);
  const liveReviews = useMemo(() => (reviewPage?.inquiries ?? []).map(toReview), [reviewPage]);
  const fallback = <T,>(live: T[], loading: boolean, demo: T[]) => (live.length ? live : loading ? [] : showDemoData ? demo : []);
  const inquiries = fallback(liveInquiries, inquiriesLoading, DEMO_INQUIRIES);
  const projects = fallback(liveProjects, projectsLoading, DEMO_PROJECTS);
  const reviews = fallback(liveReviews, reviewsLoading, DEMO_REVIEWS);
  const services = servicePage?.services ?? [];
  const activeProjects = projects.filter((p) => p.status === 'active');
  const waiting = inquiries.filter((i) => WAITING.includes(i.status));

  // Counted from the book, never written in: the summary when it answers,
  // otherwise the rows on screen.
  const counts = summary?.inquiryCounts;
  const totalInquiries = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : inquiries.length;
  const answered = counts ? totalInquiries - counts.open : inquiries.filter((i) => i.status !== 'open').length;
  const converted = summary?.projects ?? projects.length;
  const responseRate = totalInquiries ? Math.round((answered / totalInquiries) * 100) : null;
  const conversionRate = totalInquiries ? Math.round((converted / totalInquiries) * 100) : null;
  const agreedValue = projects.reduce((sum, p) => sum + (p.agreedPrice ?? 0), 0);
  const avgRating = summary?.avgRating ?? (reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : null);
  const reviewCount = summary?.reviewCount ?? reviews.length;

  if (!mounted) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      description="Inquiries, active projects, services and reviews - in one view."
      descriptionEl="Αιτήματα, ενεργά έργα, υπηρεσίες και αξιολογήσεις — σε μία προβολή."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Briefcase className="icon-sm" aria-hidden="true" />
            Service Provider
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/provider/services">
              <Store className="mr-2 icon-sm" aria-hidden="true" />
              Manage services
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <DashboardGreeting name={displayName} lead={{ en: dashboardEn('provider_lead'), el: dashboardEl('provider_lead') }} />
        <WhatsNewPanel audience="provider" />

        {/* Four figures, each linking to the page that lists what it counts. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <MetricTile
            icon={MessageSquare}
            label="Open inquiries"
            labelEl="Ανοιχτά αιτήματα"
            value={summary?.openInquiries ?? waiting.length}
            caption={`${totalInquiries} in all`}
            captionEl={`${totalInquiries} συνολικά`}
            href="/provider/inquiries"
          />
          <MetricTile
            icon={FolderKanban}
            label="Active projects"
            labelEl="Ενεργά έργα"
            value={activeProjects.length}
            caption={agreedValue ? `${eur(agreedValue)} agreed in all` : 'Accepted inquiries'}
            captionEl={agreedValue ? `${eur(agreedValue)} συμφωνημένα συνολικά` : 'Αποδεκτά αιτήματα'}
            href="/provider/projects"
          />
          <MetricTile
            icon={Store}
            label="Live services"
            labelEl="Ενεργές υπηρεσίες"
            value={summary?.offers.active ?? services.filter((s) => s.isActive !== false).length}
            caption={`${summary?.offers.total ?? services.length} listed`}
            captionEl={`${summary?.offers.total ?? services.length} καταχωρημένες`}
            href="/provider/services"
          />
          <MetricTile
            icon={Star}
            label="Rating"
            labelEl="Βαθμολογία"
            value={avgRating == null ? EM_DASH : avgRating.toFixed(1)}
            caption={reviewCount ? `From ${reviewCount} reviews` : 'No reviews yet'}
            captionEl={reviewCount ? `Από ${reviewCount} αξιολογήσεις` : 'Καμία αξιολόγηση ακόμα'}
            href="/provider/reviews"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Only what waits on the provider: settled inquiries are projects
                below, or closed, and a Reply beside them offered nothing. */}
            <SectionCard title="Waiting on you" titleEl="Σας περιμένουν" icon={MessageSquare} action={{ href: '/provider/inquiries', label: 'All inquiries', labelEl: 'Όλα τα αιτήματα' }} contentClassName="card-rows">
              {inquiriesLoading && [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
              {waiting.slice(0, 5).map((inquiry) => (
                <div key={inquiry.id} className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={inquiry.clientAvatar} />
                    <AvatarFallback>{initialsOf(inquiry.clientName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{inquiry.clientName}</span>
                      <Badge size="sm" className={INQUIRY_LABEL[inquiry.status].tone}>{INQUIRY_LABEL[inquiry.status].en}</Badge>
                      <span className="text-xs text-muted-foreground">
                        <RelativeTime date={inquiry.receivedAt} format={formatRelativeTime} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{inquiry.service}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{inquiry.message}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link href="/provider/inquiries">Reply</Link>
                  </Button>
                </div>
              ))}
              {!inquiriesLoading && waiting.length === 0 && (
                <EmptyLine
                  en={inquiries.length ? 'Every inquiry has an answer.' : 'Founders who ask about a service appear here.'}
                  el={inquiries.length ? 'Όλα τα αιτήματα έχουν απάντηση.' : 'Οι ιδρυτές που ρωτούν για μια υπηρεσία εμφανίζονται εδώ.'}
                />
              )}
            </SectionCard>

            <SectionCard title="Projects" titleEl="Έργα" icon={FolderKanban} action={{ href: '/provider/projects', label: 'All projects', labelEl: 'Όλα τα έργα' }} contentClassName="card-rows">
              {projects.slice(0, 5).map((project) => (
                <div key={project.id} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={project.clientAvatar} />
                    <AvatarFallback>{initialsOf(project.clientName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{project.clientName}</span>
                      <Badge size="sm" variant={project.status === 'active' ? 'success' : 'secondary'}>
                        {project.status === 'active' ? 'Active' : 'Completed'}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{project.service}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{eur(project.agreedPrice, project.currency)}</p>
                </div>
              ))}
              {!projectsLoading && projects.length === 0 && (
                <EmptyLine en="An accepted inquiry becomes a project." el="Ένα αποδεκτό αίτημα γίνεται έργο." />
              )}
            </SectionCard>

            <SectionCard
              title="Your services"
              titleEl="Οι υπηρεσίες σας"
              icon={Store}
              action={{ href: '/provider/services', label: 'Manage', labelEl: 'Διαχείριση' }}
              contentClassName="card-rows"
            >
              {servicesLoading && [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
              {services.map((svc) => (
                <Link key={svc.id} href="/provider/services" className="axis-row block rounded-md transition-colors hover:bg-accent focus-ring">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium">{svc.title}</p>
                    <Badge size="sm" variant={svc.isActive === false ? 'secondary' : 'success'} className="shrink-0">
                      {svc.isActive === false ? 'Hidden' : 'Live'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">{svc.pricing ?? EM_DASH}</p>
                </Link>
              ))}
              {!servicesLoading && services.length === 0 && (
                <div>
                  <EmptyLine en="List a service so founders can find and ask about it." el="Καταχωρήστε μια υπηρεσία ώστε οι ιδρυτές να τη βρίσκουν." />
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-6">
            <QuickLinks
              label="Provider pages"
              links={[
                { href: '/provider/services', icon: Store, label: 'Services', labelEl: 'Υπηρεσίες' },
                { href: '/provider/inquiries', icon: MessageSquare, label: 'Inquiries', labelEl: 'Αιτήματα' },
                { href: '/provider/projects', icon: FolderKanban, label: 'Projects', labelEl: 'Έργα' },
                { href: '/provider/reviews', icon: Star, label: 'Reviews', labelEl: 'Αξιολογήσεις' },
                { href: '/provider/analytics', icon: BarChart3, label: 'Analytics', labelEl: 'Αναλυτικά' },
                { href: '/provider/profile', icon: UserCog, label: 'Provider profile', labelEl: 'Προφίλ παρόχου' },
              ]}
            />

            <SectionCard title="Performance" titleEl="Απόδοση" contentClassName="space-y-4">
              {[
                { en: 'Answered', el: 'Απαντημένα', value: responseRate, aria: 'Share of inquiries answered' },
                { en: 'Became projects', el: 'Έγιναν έργα', value: conversionRate, aria: 'Share of inquiries that became projects' },
              ].map((row) => (
                <div key={row.en} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      <BilingualText en={row.en} el={row.el} />
                    </span>
                    <span className="font-semibold tabular-nums">{row.value == null ? EM_DASH : `${row.value}%`}</span>
                  </div>
                  <Progress value={row.value ?? 0} className="h-1.5" aria-label={row.aria} />
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="icon-sm" aria-hidden="true" />
                Counted over {totalInquiries} {totalInquiries === 1 ? 'inquiry' : 'inquiries'}.
              </p>
            </SectionCard>

            <SectionCard title="Recent reviews" titleEl="Πρόσφατες αξιολογήσεις" icon={Star} action={{ href: '/provider/reviews', label: 'All', labelEl: 'Όλες' }} contentClassName="card-rows">
              {reviews.map((review) => (
                <figure key={review.id}>
                  <figcaption className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{review.client}</span>
                    <span className="flex items-center gap-0.5" role="img" aria-label={`${review.rating} out of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn('h-3.5 w-3.5', i < review.rating ? 'fill-status-warning text-status-warning' : 'text-muted-foreground/40')} aria-hidden="true" />
                      ))}
                    </span>
                  </figcaption>
                  <blockquote className="text-sm text-muted-foreground">{review.comment}</blockquote>
                </figure>
              ))}
              {!reviewsLoading && reviews.length === 0 && (
                <EmptyLine en="Clients rate the work when a project completes." el="Οι πελάτες αξιολογούν τη δουλειά όταν ολοκληρώνεται ένα έργο." />
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
