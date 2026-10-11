'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  RefreshCw, Search, Brain, TrendingUp, Target,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  adminGetBehaviorStats,
  adminGetBehaviorNudgeLogs,
  adminClassifyUser,
  type BehaviorPlatformStats,
  type BehavioralStateResponse,
} from '@/lib/api';
import { useChartTheme } from '@/lib/chart-theme';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { FactLine } from '@/components/common/FactLine';
import { StatusText } from '@/components/common/StatusText';
import { RowHead } from '@/components/dashboard/SectionCard';

const STATE_LABELS: Record<string, { label: string; labelEl: string; color: string }> = {
  newly_onboarded:    { label: 'New Onboard', labelEl: 'Νέα εγγραφή', color: 'bg-primary' },
  profile_incomplete: { label: 'Profile Incomplete', labelEl: 'Ελλιπές προφίλ', color: 'bg-status-warning-mark' },
  exploring:          { label: 'Exploring', labelEl: 'Εξερεύνηση', color: 'bg-status-info-mark' },
  matching_focused:   { label: 'Matching', labelEl: 'Αντιστοίχιση', color: 'bg-status-accent-mark' },
  artifact_building:  { label: 'Building', labelEl: 'Κατασκευή', color: 'bg-status-success-mark' },
  stuck:              { label: 'Stuck', labelEl: 'Σε αδιέξοδο', color: 'bg-status-danger-mark' },
  feedback_processing:{ label: 'Feedback', labelEl: 'Ανατροφοδότηση', color: 'bg-status-warning-mark' },
  high_momentum:      { label: 'High Momentum', labelEl: 'Υψηλή δυναμική', color: 'bg-status-success-mark' },
  review_ready:       { label: 'Review Ready', labelEl: 'Έτοιμος για αξιολόγηση', color: 'bg-status-success-mark' },
  readiness_plateaued:{ label: 'Plateaued', labelEl: 'Σε στασιμότητα', color: 'bg-muted' },
};

function KPICard({ title, titleEl, value, sub, icon: Icon, color }: {
  title: string; titleEl: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', color)}>
          <Icon className="icon-md text-ink" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground"><BilingualText en={title} el={titleEl} compact wrap /></p>
          <p className="page-stat text-xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function NudgeStatsTab({ stats, isLoading }: { stats?: BehaviorPlatformStats; isLoading: boolean }) {
  const theme = useChartTheme();
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!stats) return <div className="py-8 text-sm text-muted-foreground"><BilingualText en="No stats yet." el="Δεν υπάρχουν στατιστικά ακόμα." compact /></div>;

  // A partial payload (the demo answers without `byKey` or the totals) blanked
  // the whole console behind its error boundary.
  const chartData = (stats?.byKey ?? []).map(k => ({
    name: (k?.key ?? '').replace(/_/g, ' '),
    shown: k.shown,
    converted: k.converted,
    dismissed: k.dismissed,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard title="Total Shown" titleEl="Εμφανίσεις" value={stats.totalShown ?? 0} icon={Target} color="bg-primary" />
        <KPICard title="Dismissed" titleEl="Απορρίφθηκαν" value={stats.totalDismissed ?? 0} sub={`${stats.dismissalRate ?? 0}%`} icon={XCircle} color="bg-status-danger-mark" />
        <KPICard title="Converted" titleEl="Μετατράπηκαν" value={stats.totalConverted ?? 0} sub={`${stats.conversionRate ?? 0}%`} icon={CheckCircle} color="bg-status-success-mark" />
        <KPICard title="Conv. Rate" titleEl="Ποσοστό μετατροπής" value={`${stats.conversionRate ?? 0}%`} icon={TrendingUp} color="bg-status-accent-mark" />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle><BilingualText en="Nudge Performance by Key" el="Απόδοση υπενθυμίσεων ανά κλειδί" compact /></CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="shown" name="Shown" fill={theme.series[0]} radius={[0, 2, 2, 0]} />
                <Bar dataKey="converted" name="Converted" fill={theme.series[2]} radius={[0, 2, 2, 0]} />
                <Bar dataKey="dismissed" name="Dismissed" fill={theme.status.critical} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserClassifyTab() {
  const [userId, setUserId] = useState('');
  const [queried, setQueried] = useState('');

  const { data, isLoading, refetch } = useQuery<BehavioralStateResponse>({
    queryKey: qk('admin', 'classify', queried),
    queryFn: () => adminClassifyUser(queried),
    enabled: !!queried,
    retry: 0,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: qk('admin', 'nudge-logs', queried),
    queryFn: () => adminGetBehaviorNudgeLogs(queried, 15),
    enabled: !!queried,
    retry: 0,
  });

  const stateInfo = data ? STATE_LABELS[data.state] : null;
  const fmtDate = useDateFormat();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={bilingualInline("User ID", "Αναγνωριστικό χρήστη")}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => setQueried(userId)} disabled={!userId.trim()}>
          <Search className="mr-2 icon-sm" /> <BilingualText en="Classify" el="Κατάταξη" compact />
        </Button>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {data && stateInfo && (
        <Card>
          {/* The state over its reason, the confidence at the right; the
              signals are figures under it on the title's axis, not boxed. */}
          <CardHeader>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CardTitle className="inline-flex items-center gap-2">
                <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-full', stateInfo.color)} />
                <BilingualText en={stateInfo.label} el={stateInfo.labelEl} compact />
              </CardTitle>
              <Badge variant="outline" className="ml-auto">
                <BilingualText en={`${Math.round((data.confidence ?? 0) * 100)}% confidence`} el={`Βεβαιότητα ${Math.round((data.confidence ?? 0) * 100)}%`} compact />
              </Badge>
            </div>
            {data.reason ? <CardDescription className="first-letter:uppercase">{data.reason}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              {Object.entries(data.signals ?? {}).filter(([k]) => k !== 'userId').map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground first-letter:uppercase">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                  <dd className="card-body font-medium tabular-nums text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {logsLoading && <Skeleton className="h-32 w-full" />}
      {Array.isArray(logs) && logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle><BilingualText en="Recent Nudge Logs" el="Πρόσφατες υπενθυμίσεις" compact /></CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 sm:px-6">
                  <RowHead
                    title={<span className="font-mono" translate="no">{log.nudgeKey}</span>}
                    subtitle={<FactLine items={[log.surface ? <StatusText key="surface" value={log.surface} /> : null, fmtDate(log.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })]} />}
                    aside={log.converted || log.dismissed ? (
                      <>
                        {log.converted && <Badge className="bg-status-success-mark text-xs text-ink"><BilingualText en="Converted" el="Μετατράπηκε" compact /></Badge>}
                        {log.dismissed && <Badge className="bg-status-danger-mark text-xs text-ink"><BilingualText en="Dismissed" el="Απορρίφθηκε" compact /></Badge>}
                      </>
                    ) : undefined}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BehaviorAdminPanel() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery<BehaviorPlatformStats>({
    queryKey: qk('admin', 'behavior-stats'),
    queryFn: adminGetBehaviorStats,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Brain className="icon-md text-muted-foreground" /> <BilingualText en="Behavioral AI Optimizer" el="Βελτιστοποιητής συμπεριφοράς AI" compact />
          </h2>
          <p className="text-sm text-muted-foreground">
            <BilingualText en="Platform-wide nudge performance, user state classification, and fatigue signals." el="Απόδοση υπενθυμίσεων, κατάταξη κατάστασης χρηστών και σήματα κόπωσης σε όλη την πλατφόρμα." wrap />
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn('mr-2 icon-sm', isFetching && 'animate-spin')} />
          <BilingualText en="Refresh" el="Ανανέωση" compact />
        </Button>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats" className="gap-2">
            <TrendingUp className="icon-sm" /> <BilingualText en="Nudge Stats" el="Στατιστικά υπενθυμίσεων" compact />
          </TabsTrigger>
          <TabsTrigger value="classify" className="gap-2">
            <Search className="icon-sm" /> <BilingualText en="Classify User" el="Κατάταξη χρήστη" compact />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <NudgeStatsTab stats={stats} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="classify" className="mt-4">
          <UserClassifyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
