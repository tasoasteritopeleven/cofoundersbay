'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronRight,
  CreditCard,
  Database,
  Flag,
  HardDrive,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldAlert,
  Timer,
  UserCheck,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, QuickLinks, SectionCard } from '@/components/dashboard/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { adminGetAbuseStats, getAdminHealth, getAdminStats, type AdminHealth } from '@/lib/api';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';

/*
 * The platform admin's home: what the platform holds, who is using it, what
 * is waiting on an admin, and whether the API and its database are well.
 *
 * It used to resolve two promises written into this file - 1,247 users, a
 * 0.037 conversion rate, and three security alerts ("Database connection
 * timeout in last 5 minutes") that were shown in production to people whose
 * database was fine. The period select changed the query key and nothing
 * else. Every figure below now comes from an endpoint that counts it:
 * `/admin/stats` for users and activity, `/admin/abuse/stats` for flags,
 * `/admin/health` for the process and the database. Response time, error
 * rate, cache hit rate, mentor sessions and conversion are not measured by
 * any endpoint, so they are not shown rather than shown invented.
 */

type Period = 'today' | 'week' | 'month';

const PERIODS: ReadonlyArray<{ value: Period; en: string; el: string; short: string; shortEl: string }> = [
  { value: 'today', en: 'Today', el: 'Σήμερα', short: 'Today', shortEl: 'Σήμερα' },
  { value: 'week', en: 'Last 7 days', el: 'Τελευταίες 7 ημέρες', short: '7 days', shortEl: '7 ημέρες' },
  { value: 'month', en: 'Last 30 days', el: 'Τελευταίες 30 ημέρες', short: '30 days', shortEl: '30 ημέρες' },
];

const ROLE_LABEL: Record<string, { en: string; el: string }> = {
  founder: { en: 'Founders', el: 'Ιδρυτές' },
  mentor: { en: 'Mentors', el: 'Μέντορες' },
  investor: { en: 'Investors', el: 'Επενδυτές' },
  org: { en: 'Organisations', el: 'Οργανισμοί' },
  admin: { en: 'Admins', el: 'Διαχειριστές' },
};

const HEALTH: Record<AdminHealth['status'], { en: string; el: string; variant: 'success' | 'warning' | 'destructive' }> = {
  healthy: { en: 'Healthy', el: 'Υγιής', variant: 'success' },
  degraded: { en: 'Degraded', el: 'Υποβαθμισμένη', variant: 'warning' },
  unhealthy: { en: 'Unhealthy', el: 'Εκτός λειτουργίας', variant: 'destructive' },
};

/** When the API process started, from the health check's own clock. */
function runningSince(health: AdminHealth): string | null {
  const at = Date.parse(health.timestamp) - health.uptime * 1000;
  if (Number.isNaN(at)) return null;
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  // Numeric on purpose: the same string reads correctly in either language.
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Attention = {
  id: string;
  tone: 'warning' | 'danger';
  en: string;
  el: string;
  detailEn?: string;
  detailEl?: string;
  href: string;
};

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const { apiAvailable, pollInterval } = usePollingGuards();

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: qk('admin', 'stats'),
    queryFn: getAdminStats,
    staleTime: 30_000,
    retry: 0,
  });
  const { data: abuse, refetch: refetchAbuse } = useQuery({
    queryKey: qk('admin', 'abuse', 'stats'),
    queryFn: adminGetAbuseStats,
    staleTime: 30_000,
    retry: 0,
  });
  // The one figure here that changes minute to minute, so the one that polls.
  const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useQuery({
    queryKey: qk('admin', 'health'),
    queryFn: getAdminHealth,
    enabled: apiAvailable,
    refetchInterval: pollInterval(30_000),
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const refreshAll = () => {
    void refetchStats();
    void refetchAbuse();
    void refetchHealth();
  };

  const stats = statsData?.stats;
  const byRole = stats?.usersByRole ?? {};
  const total = stats?.totalUsers ?? 0;
  const newUsers = period === 'today' ? stats?.newUsersToday : period === 'week' ? stats?.newUsersThisWeek : stats?.newUsersThisMonth;
  const activeUsers = period === 'today' ? stats?.activeUsersToday : period === 'week' ? stats?.activeUsersThisWeek : stats?.activeUsersThisMonth;
  const activeShare = total && activeUsers != null ? Math.round((activeUsers / total) * 100) : null;
  const periodLabel = PERIODS.find((p) => p.value === period) ?? PERIODS[1];
  const pendingReports = stats?.pendingReports ?? 0;
  const pendingFlags = abuse?.pendingFlags ?? 0;
  const topOffender = abuse?.topOffenders?.[0];

  // A share per role, largest first: five slices of a pie drew their labels
  // off the card, and a row per role reads its count and share exactly.
  const roleRows = Object.entries(byRole)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([role, n]) => ({ role, n, share: total ? Math.round((n / total) * 100) : 0 }));
  // Totals of unlike things (messages, groups, jobs) are figures, not bars on
  // one axis.
  const activity = [
    { id: 'messages', en: 'Messages', el: 'Μηνύματα', value: stats?.totalMessages, href: '/messages' },
    { id: 'connections', en: 'Connections', el: 'Συνδέσεις', value: stats?.totalConnections, href: '/connections' },
    { id: 'events', en: 'Events', el: 'Εκδηλώσεις', value: stats?.totalEvents, href: '/events' },
    { id: 'groups', en: 'Groups', el: 'Κοινότητες', value: stats?.totalGroups, href: '/admin/communities' },
    { id: 'jobs', en: 'Jobs', el: 'Αγγελίες', value: stats?.totalJobs, href: '/jobs' },
  ];

  // What is waiting on an admin, from the same counts the tiles show.
  const attention: Attention[] = [];
  if (health && health.status !== 'healthy') {
    attention.push({
      id: 'health',
      tone: health.status === 'unhealthy' ? 'danger' : 'warning',
      en: health.services?.database?.status === 'down' ? 'The database is not answering' : 'The API is running short of memory',
      el: health.services?.database?.status === 'down' ? 'Η βάση δεδομένων δεν αποκρίνεται' : 'Η μνήμη του API εξαντλείται',
      href: '/admin/security-monitoring',
    });
  }
  if (pendingReports > 0) {
    attention.push({
      id: 'reports',
      tone: 'warning',
      en: `${pendingReports} ${pendingReports === 1 ? 'report waits' : 'reports wait'} for review`,
      el: `${pendingReports} ${pendingReports === 1 ? 'αναφορά περιμένει' : 'αναφορές περιμένουν'} έλεγχο`,
      detailEn: 'Moderation queue',
      detailEl: 'Ουρά ελέγχου',
      href: '/admin',
    });
  }
  if (pendingFlags > 0) {
    attention.push({
      id: 'flags',
      tone: (topOffender?.maxSeverity ?? 0) >= 0.7 ? 'danger' : 'warning',
      en: `${pendingFlags} abuse ${pendingFlags === 1 ? 'flag' : 'flags'} not yet resolved`,
      el: `${pendingFlags} ${pendingFlags === 1 ? 'σήμανση κατάχρησης' : 'σημάνσεις κατάχρησης'} χωρίς απόφαση`,
      detailEn: topOffender ? `Most flagged: ${topOffender.displayName ?? topOffender.email} (${topOffender.flagCount})` : undefined,
      detailEl: topOffender ? `Περισσότερες σημάνσεις: ${topOffender.displayName ?? topOffender.email} (${topOffender.flagCount})` : undefined,
      href: '/admin/security-monitoring',
    });
  }

  usePageControls([
    choiceControl('period', 'Period', 'Περίοδος', PERIODS, period, (v) => setPeriod(v as Period)),
    { id: 'refresh', labelEn: 'Refresh figures', labelEl: 'Ανανέωση στοιχείων', writes: false, run: refreshAll },
  ]);
  usePageList([
    {
      id: 'attention',
      labelEn: 'Needs attention',
      labelEl: 'Χρειάζεται προσοχή',
      rows: statsLoading ? undefined : attention.map((a) => (a.detailEn ? `${a.en} · ${a.detailEn}` : a.en)),
    },
  ]);

  const dash = '—';
  const since = health ? runningSince(health) : null;
  const memory = health?.services?.memory;
  const database = health?.services?.database;

  return (
    <AppShell
      title="Platform overview"
      titleEl="Επισκόπηση πλατφόρμας"
      description="Who uses the platform, what waits on an admin, and how the API is running."
      descriptionEl="Ποιοι χρησιμοποιούν την πλατφόρμα, τι περιμένει διαχειριστή και πώς λειτουργεί το API."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted/40 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'min-h-9 rounded-lg px-3 text-sm font-medium transition-colors focus-ring',
                  period === p.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <BilingualText en={p.short} el={p.shortEl} compact />
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshAll}>
            <RefreshCw className="icon-sm" aria-hidden="true" />
            <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Four figures; the two that ask for work link to where it is done. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricTile
            icon={Users}
            label="Users"
            labelEl="Χρήστες"
            value={statsLoading ? dash : total.toLocaleString('en-GB')}
            caption={newUsers != null ? `${newUsers} new · ${periodLabel.en.toLowerCase()}` : undefined}
            captionEl={newUsers != null ? `${newUsers} νέοι · ${periodLabel.el.toLowerCase()}` : undefined}
            href="/admin/users"
          />
          <MetricTile
            icon={UserCheck}
            label="Active users"
            labelEl="Ενεργοί χρήστες"
            value={statsLoading || activeUsers == null ? dash : activeUsers.toLocaleString('en-GB')}
            caption={activeShare != null ? `${activeShare}% of all users · ${periodLabel.en.toLowerCase()}` : undefined}
            captionEl={activeShare != null ? `${activeShare}% του συνόλου · ${periodLabel.el.toLowerCase()}` : undefined}
          />
          <MetricTile
            icon={Flag}
            label="Reports to review"
            labelEl="Αναφορές προς έλεγχο"
            value={statsLoading ? dash : pendingReports}
            caption={pendingReports ? 'Open the moderation queue' : 'The queue is clear'}
            captionEl={pendingReports ? 'Άνοιγμα ουράς ελέγχου' : 'Η ουρά είναι άδεια'}
            href="/admin"
          />
          <MetricTile
            icon={ShieldAlert}
            label="Abuse flags"
            labelEl="Σημάνσεις κατάχρησης"
            value={abuse ? pendingFlags : dash}
            caption={abuse ? `${abuse.totalFlags} raised · ${abuse.dismissedFlags} dismissed` : undefined}
            captionEl={abuse ? `${abuse.totalFlags} συνολικά · ${abuse.dismissedFlags} απορρίφθηκαν` : undefined}
            href="/admin/security-monitoring"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <SectionCard title="Needs attention" titleEl="Χρειάζεται προσοχή" icon={AlertTriangle}>
              {statsLoading && <Skeleton className="h-14" />}
              {attention.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border p-3 transition-colors focus-ring',
                    a.tone === 'danger'
                      ? 'border-status-danger-border hover:bg-status-danger-bg'
                      : 'border-status-warning-border hover:bg-status-warning-bg',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      a.tone === 'danger' ? 'bg-status-danger-bg text-status-danger' : 'bg-status-warning-bg text-status-warning',
                    )}
                    aria-hidden="true"
                    // A severity mark (its colour and glyph say how urgent), not decoration.
                    data-keep-icon=""
                  >
                    {a.id === 'reports' ? <Flag className="icon-sm" /> : a.id === 'flags' ? <ShieldAlert className="icon-sm" /> : <Database className="icon-sm" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <BilingualText en={a.en} el={a.el} wrap />
                    </span>
                    {a.detailEn ? (
                      <span className="block text-xs text-muted-foreground">
                        <BilingualText en={a.detailEn} el={a.detailEl} wrap />
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="icon-sm shrink-0 text-muted-foreground/60 group-hover:text-foreground" aria-hidden="true" />
                </Link>
              ))}
              {!statsLoading && attention.length === 0 && (
                <EmptyLine en="Nothing waits on an admin: no open reports, no unresolved flags." el="Τίποτα δεν περιμένει διαχειριστή: καμία ανοιχτή αναφορά ή σήμανση." />
              )}
            </SectionCard>

            <SectionCard title="Activity to date" titleEl="Δραστηριότητα έως σήμερα" icon={Activity}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {activity.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/30 focus-ring"
                  >
                    <p className="page-stat text-xl font-semibold tabular-nums tracking-tight">
                      {statsLoading || a.value == null ? dash : a.value.toLocaleString('en-GB')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <BilingualText en={a.en} el={a.el} stacked wrap />
                    </p>
                  </Link>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Users by role"
              titleEl="Χρήστες ανά ρόλο"
              icon={Users}
              action={{ href: '/admin/analytics', label: 'Analytics', labelEl: 'Αναλυτικά' }}
            >
              {statsLoading && <Skeleton className="h-32" />}
              {!statsLoading && roleRows.length === 0 && (
                <EmptyLine en="No users counted yet." el="Δεν έχουν καταμετρηθεί χρήστες ακόμα." />
              )}
              {roleRows.length > 0 && (
                <ul className="space-y-3">
                  {roleRows.map(({ role, n, share }) => (
                    <li key={role} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <span className="min-w-0">
                        <BilingualText en={ROLE_LABEL[role]?.en ?? role} el={ROLE_LABEL[role]?.el} stacked wrap />
                      </span>
                      <Progress value={share} className="h-1.5" aria-label={`${ROLE_LABEL[role]?.en ?? role}: ${share}% of users`} />
                      <span className="w-20 text-right tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">{n}</span> · {share}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="min-w-0 space-y-6">
            <SectionCard title="System health" titleEl="Υγεία συστήματος" icon={Shield}>
              {healthLoading && apiAvailable && <Skeleton className="h-40" />}
              {(healthError || (!apiAvailable && !health)) && (
                <EmptyLine en="The health check did not answer. The API may be down." el="Ο έλεγχος υγείας δεν απάντησε. Το API ίσως είναι εκτός λειτουργίας." />
              )}
              {health && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={HEALTH[health.status]?.variant ?? 'warning'}>
                      <BilingualText en={HEALTH[health.status]?.en ?? health.status} el={HEALTH[health.status]?.el} compact />
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      <BilingualText en="Checked" el="Έλεγχος" compact />{' '}
                      <RelativeTime date={health.timestamp} format={formatRelativeTime} />
                    </span>
                  </div>
                  <div className="space-y-3">
                    <dl className="text-sm">
                      <div className="flex items-center gap-3">
                        <Database className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                        <dt className="min-w-0 flex-1 text-muted-foreground">
                          <BilingualText en="Database round trip" el="Απόκριση βάσης δεδομένων" stacked wrap />
                        </dt>
                        <dd className="shrink-0 font-medium tabular-nums">
                          {database?.status === 'down' ? (
                            <BilingualText en="Down" el="Εκτός" compact />
                          ) : database?.latency != null ? (
                            `${database.latency} ms`
                          ) : (
                            dash
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="space-y-2">
                      <dl className="text-sm">
                        <div className="flex items-center gap-3">
                          <HardDrive className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                          <dt className="min-w-0 flex-1 text-muted-foreground">
                            <BilingualText en="API heap in use" el="Μνήμη API σε χρήση" stacked wrap />
                          </dt>
                          <dd className="shrink-0 font-medium tabular-nums">
                            {memory ? `${memory.used} / ${memory.total} MB` : dash}
                          </dd>
                        </div>
                      </dl>
                      {memory ? (
                        <Progress
                          value={memory.percentage}
                          className="ml-7 h-1.5 w-[calc(100%-1.75rem)]"
                          aria-label={`API heap ${memory.percentage}% in use`}
                        />
                      ) : null}
                    </div>
                    <dl className="text-sm">
                      <div className="flex items-center gap-3">
                        <Timer className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                        <dt className="min-w-0 flex-1 text-muted-foreground">
                          <BilingualText en="API running since" el="Το API λειτουργεί από" stacked wrap />
                        </dt>
                        <dd className="shrink-0 font-medium tabular-nums">{since ?? dash}</dd>
                      </div>
                    </dl>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <BilingualText
                      en={`Version ${health.version} · checked every 30 seconds while this tab is open.`}
                      el={`Έκδοση ${health.version} · έλεγχος κάθε 30 δευτερόλεπτα με ανοιχτή καρτέλα.`}
                      stacked
                      wrap
                    />
                  </p>
                </div>
              )}
            </SectionCard>

            <QuickLinks
              label="Admin sections"
              links={[
                { href: '/admin', icon: Flag, label: 'Moderation console', labelEl: 'Κονσόλα ελέγχου' },
                { href: '/admin/user-management', icon: Users, label: 'User management', labelEl: 'Διαχείριση χρηστών' },
                { href: '/admin/tenants', icon: Building2, label: 'Organisations', labelEl: 'Οργανισμοί' },
                { href: '/admin/security-monitoring', icon: Shield, label: 'Security', labelEl: 'Ασφάλεια' },
                { href: '/admin/analytics', icon: BarChart3, label: 'Analytics', labelEl: 'Αναλυτικά' },
                { href: '/admin/audit-log', icon: ScrollText, label: 'Audit log', labelEl: 'Αρχείο ελέγχου' },
                { href: '/admin/billing', icon: CreditCard, label: 'Billing', labelEl: 'Χρεώσεις' },
              ]}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
