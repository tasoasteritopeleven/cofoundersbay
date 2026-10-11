'use client';

import { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, AlertTriangle, Award,
  Zap, TrendingUp, Shield, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  adminInspectUserScore,
  AdminScoreInspectReport,
  AdminXPBreakdownItem,
} from '@/lib/api';
import { useChartTheme } from '@/lib/chart-theme';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-status-warning-bg text-status-warning',
  reviewed: 'bg-status-info-bg text-status-info',
  actioned: 'bg-status-danger-bg text-status-danger',
  dismissed:'bg-muted text-muted-foreground',
};

function Section({
  title, icon: Icon, children, defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-muted hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <Icon className="icon-sm" />
          {title}
        </div>
        {open ? <ChevronUp className="icon-sm text-muted-foreground" /> : <ChevronDown className="icon-sm text-muted-foreground" />}
      </button>
      {open && <div className="p-5 bg-white">{children}</div>}
    </div>
  );
}

function XPEventRow({ e }: { e: AdminXPBreakdownItem }) {
  return (
    <tr className="border-b border-border hover:bg-muted text-sm">
      <td className="py-2 pr-3">
        <span className="font-mono text-xs bg-status-accent-bg text-status-accent px-1.5 py-0.5 rounded">
          {e.eventType}
        </span>
      </td>
      <td className="py-2 pr-3 tabular-nums text-muted-foreground">{e.baseXp}</td>
      <td className="py-2 pr-3 tabular-nums font-medium text-foreground">{e.finalXp}</td>
      <td className="py-2 pr-3 tabular-nums text-muted-foreground">×{e.weightMultiplier.toFixed(2)}</td>
      <td className="py-2 pr-3">
        {e.isDiminished && (
          <span className="text-xs bg-status-warning-bg text-status-warning px-1.5 py-0.5 rounded">DR</span>
        )}
      </td>
      <td className="py-2 text-xs text-muted-foreground">{e.explain}</td>
    </tr>
  );
}

export function ScoreInspector() {
  const theme = useChartTheme();
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<AdminScoreInspectReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runInspection = async () => {
    const id = userId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await adminInspectUserScore(id);
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // XP by event type chart data
  const xpChartData = report
    ? Object.entries(report.xpByEventType)
        .map(([type, v]) => ({ type: type.replace(/_/g, ' '), xp: v.totalXp, count: v.count }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10)
    : [];

  const pendingFlags = report?.anomalies?.filter((a) => a.status === 'pending') ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground"><BilingualText en="Score Inspector" el="Επιθεωρητής βαθμολογίας" compact /></h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          <BilingualText en="Full per-user scoring audit: XP breakdown, badges, streak, contributions, anomaly flags." el="Πλήρης έλεγχος βαθμολογίας ανά χρήστη: ανάλυση XP, διακρίσεις, σερί, συνεισφορές, επισημάνσεις ανωμαλιών." wrap />
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runInspection()}
            placeholder={bilingualInline("Enter user ID…", "Συμπληρώστε αναγνωριστικό χρήστη…")}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none"
          />
        </div>
        <button
          onClick={() => void runInspection()}
          disabled={loading || !userId.trim()}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading…' : 'Inspect'}
        </button>
      </div>

      {error && (
        <div className="bg-status-danger-bg border border-status-danger-border rounded-lg px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {report.avatarUrl ? (
                  <img src={report.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={48} height={48} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-status-accent-bg flex items-center justify-center text-status-accent font-bold text-lg">
                    {(report.displayName ?? report.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-foreground">
                    {report.displayName ?? '—'}{' '}
                    <span className="text-muted-foreground font-normal text-sm">({report.role})</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{report.email}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">{report.userId}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="page-stat text-2xl font-bold text-status-accent">{report.totalXp} XP</div>
                <div className="text-sm text-muted-foreground">
                  Level {report.level} · {report.levelLabel}
                </div>
              </div>
            </div>

            {/* Human summary */}
            <div className="mt-4 bg-status-accent-bg rounded-lg px-4 py-3 text-sm text-status-accent">
              <Shield className="inline icon-sm mr-1 opacity-70" />
              {report.humanSummary}
            </div>

            {/* Suppression warning */}
            {report.suppressedUntil && (
              <div className="mt-3 bg-status-danger-bg border border-status-danger-border rounded-lg px-4 py-2.5 text-sm text-status-danger flex items-center gap-2">
                <AlertTriangle className="icon-sm shrink-0" />
                Burst suppression active until{' '}
                <span className="font-mono">{new Date(report.suppressedUntil).toLocaleString('en-GB', { timeZone: 'UTC' })}</span>
              </div>
            )}

            {/* Open flags warning */}
            {pendingFlags.length > 0 && (
              <div className="mt-3 bg-status-warning-bg border border-status-warning-border rounded-lg px-4 py-2.5 text-sm text-status-warning flex items-center gap-2">
                <AlertTriangle className="icon-sm shrink-0" />
                {pendingFlags.length} open abuse flag{pendingFlags.length > 1 ? 's' : ''} pending review
              </div>
            )}
          </div>

          {/* XP by Event Type Chart */}
          <Section title="XP by Event Type" icon={Zap} defaultOpen>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={xpChartData} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={130} />
                <Tooltip
                  formatter={(v: number, _: string, props: { payload?: { count: number } }) =>
                    [`${v} XP (${props.payload?.count ?? 0} events)`, 'Total XP']
                  }
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="xp" fill={theme.series[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-auto max-h-40">
              <table className="w-full text-xs text-muted-foreground">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="pb-1.5 font-medium"><BilingualText en="Event" el="Συμβάν" compact /></th>
                    <th className="pb-1.5 font-medium text-right"><BilingualText en="Events" el="Συμβάντα" compact /></th>
                    <th className="pb-1.5 font-medium text-right"><BilingualText en="Total XP" el="Σύνολο XP" compact /></th>
                    <th className="pb-1.5 font-medium text-right"><BilingualText en="Avg XP" el="Μέσο XP" compact /></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.xpByEventType).map(([type, v]) => (
                    <tr key={type} className="border-b border-border">
                      <td className="py-1 font-mono text-xs">{type}</td>
                      <td className="py-1 text-right tabular-nums">{v.count}</td>
                      <td className="py-1 text-right tabular-nums font-medium">{v.totalXp}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">{v.avgXp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Recent Events */}
          <Section title={`Recent XP Events (last ${report.recentEvents.length})`} icon={Clock}>
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium"><BilingualText en="Type" el="Τύπος" compact /></th>
                    <th className="pb-2 font-medium"><BilingualText en="Base" el="Βάση" compact /></th>
                    <th className="pb-2 font-medium"><BilingualText en="Final" el="Τελικό" compact /></th>
                    <th className="pb-2 font-medium"><BilingualText en="Mult" el="Πολλ." compact /></th>
                    <th className="pb-2 font-medium"><BilingualText en="Flag" el="Σήμανση" compact /></th>
                    <th className="pb-2 font-medium"><BilingualText en="Explain" el="Εξήγηση" compact /></th>
                  </tr>
                </thead>
                <tbody>
                  {report.recentEvents.map((e) => (
                    <XPEventRow key={e.id} e={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Badges */}
          <Section title={`Badges (${report.badges.length})`} icon={Award}>
            {report.badges.length === 0 ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="No badges earned yet." el="Δεν έχουν κερδηθεί διακρίσεις ακόμα." compact wrap /></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.badges.map((b) => (
                  <div
                    key={b.badgeId}
                    className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <Award className="icon-sm text-status-warning" />
                    <span className="font-medium text-foreground">{b.name}</span>
                    <span className="text-xs text-muted-foreground">· {b.category}</span>
                    {!b.seen && (
                      <span className="text-xs bg-status-success-bg text-status-success px-1 rounded">new</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Streak */}
          <Section title="Streak" icon={TrendingUp}>
            {report.streak ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Current Streak" el="Τρέχον σερί" compact /></p>
                  <p className="font-bold text-2xl text-status-accent">{report.streak.currentStreak}d</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Longest" el="Μεγαλύτερο" compact /></p>
                  <p className="font-semibold text-foreground">{report.streak.longestStreak}d</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Last Active" el="Τελευταία δραστηριότητα" compact /></p>
                  <p className="text-foreground">
                    {report.streak.lastActiveDate
                      ? new Date(report.streak.lastActiveDate).toLocaleDateString('en-GB', { timeZone: 'UTC' })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Grace Used" el="Χάρη που χρησιμοποιήθηκε" compact /></p>
                  <p className="text-foreground">
                    {report.streak.graceUsedAt
                      ? new Date(report.streak.graceUsedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })
                      : 'No'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground"><BilingualText en="No streak record found." el="Δεν βρέθηκε σερί." compact wrap /></p>
            )}
          </Section>

          {/* Anomaly Flags */}
          <Section title={`Abuse Flags (${report.anomalies.length})`} icon={AlertTriangle}>
            {report.anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="No abuse flags on this user." el="Καμία επισήμανση κατάχρησης για αυτόν τον χρήστη." compact wrap /></p>
            ) : (
              <div className="space-y-2">
                {report.anomalies.map((a) => (
                  <div key={a.flagId} className="flex items-start gap-3 border border-border rounded-lg p-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: `hsl(${(1 - a.severity) * 120}, 70%, 50%)` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {a.type}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[a.status] ?? ''}`}
                        >
                          {a.status}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          severity {(a.severity * 100).toFixed(0)}%
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(a.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Contribution scores */}
          {report.contributions.length > 0 && (
            <Section title={`Workspace Contributions (${report.contributions.length})`} icon={TrendingUp}>
              <div className="space-y-2">
                {report.contributions.map((c) => (
                  <div key={c.workspaceId} className="flex items-center justify-between text-sm border-b border-border py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{c.workspaceId}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-28 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, c.score)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-foreground w-8 text-right">{c.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Search className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm"><BilingualText en="Enter a user ID above to inspect their scoring profile." el="Εισάγετε αναγνωριστικό χρήστη παραπάνω για να δείτε τη βαθμολογία του." wrap /></p>
        </div>
      )}
    </div>
  );
}
