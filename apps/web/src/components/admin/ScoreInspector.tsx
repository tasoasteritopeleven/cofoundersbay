'use client';

import { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, AlertTriangle, Award,
  Zap, TrendingUp, Clock,
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
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { StatusText } from '@/components/common/StatusText';
import { RowHead } from '@/components/dashboard/SectionCard';

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-status-warning-bg text-status-warning',
  reviewed: 'bg-status-info-bg text-status-info',
  actioned: 'bg-status-danger-bg text-status-danger',
  dismissed:'bg-muted text-muted-foreground',
};

function Section({
  title, icon: Icon, children, defaultOpen = false,
}: {
  title: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    // A section card whose header opens and closes it: the title on the
    // card's axis, the content under it without a second surface.
    // The heading holds the button (the disclosure pattern): a heading
    // inside a button is not valid HTML.
    <Card className="overflow-hidden">
      <CardTitle>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-accent sm:px-6"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="icon-sm" />
            {title}
          </span>
          {open ? <ChevronUp className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />}
        </button>
      </CardTitle>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
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
    ? Object.entries(report.xpByEventType ?? {})
        .map(([type, v]) => ({ type: type.replace(/_/g, ' '), xp: v.totalXp, count: v.count }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10)
    : [];

  const pendingFlags = report?.anomalies?.filter((a) => a.status === 'pending') ?? [];
  const fmtDate = useDateFormat();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground"><BilingualText en="Score Inspector" el="Επιθεωρητής βαθμολογίας" compact /></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
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
          {loading ? <BilingualText en="Loading…" el="Φόρτωση…" compact /> : <BilingualText en="Inspect" el="Έλεγχος" compact />}
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
          {/* The person's card: the circle, the name over the role and the
              address, the total at the right; the callouts under it on the
              circle's edge. */}
          <Card>
            <CardContent className="space-y-3">
              <CardHead
                mark={(
                  <Avatar className="h-10 w-10">
                    {report.avatarUrl ? <AvatarImage src={report.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="bg-status-accent-bg font-semibold text-status-accent">
                      {(report.displayName ?? report.email ?? '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                title={report.displayName ?? '—'}
                subtitle={<FactLine className="text-sm" items={[report.role ? <StatusText key="role" value={report.role} /> : null, <span key="email" translate="no">{report.email}</span>]} />}
                meta={<span className="font-mono" translate="no">{report.userId}</span>}
                aside={(
                  <span className="flex flex-col sm:items-end">
                    <span className="card-body font-semibold tabular-nums text-status-accent">{report.totalXp} XP</span>
                    <BilingualText en={`Level ${report.level} · ${report.levelLabel}`} el={`Επίπεδο ${report.level} · ${report.levelLabel}`} compact wrap />
                  </span>
                )}
              />

              {/* Human summary */}
              {report.humanSummary ? (
                <div className="rounded-lg bg-status-accent-bg px-4 py-3 text-sm text-status-accent first-letter:uppercase">
                  {report.humanSummary}
                </div>
              ) : null}

              {/* Suppression warning */}
              {report.suppressedUntil && (
                <div className="flex items-center gap-2 rounded-lg border border-status-danger-border bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger">
                  <AlertTriangle className="icon-sm shrink-0" aria-hidden="true" />
                  <BilingualText
                    en={`Burst suppression active until ${fmtDate(report.suppressedUntil, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                    el={`Ενεργή αναστολή ριπής έως ${fmtDate(report.suppressedUntil, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                    wrap
                  />
                </div>
              )}

              {/* Open flags warning */}
              {pendingFlags.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-2.5 text-sm text-status-warning">
                  <AlertTriangle className="icon-sm shrink-0" aria-hidden="true" />
                  <BilingualText
                    en={`${pendingFlags.length} open abuse flag${pendingFlags.length > 1 ? 's' : ''} pending review`}
                    el={`${pendingFlags.length} ${pendingFlags.length > 1 ? 'ανοιχτές επισημάνσεις' : 'ανοιχτή επισήμανση'} κατάχρησης σε αναμονή ελέγχου`}
                    wrap
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* XP by Event Type Chart */}
          <Section title={<BilingualText en="XP by Event Type" el="XP ανά τύπο συμβάντος" compact />} icon={Zap} defaultOpen>
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
                  {Object.entries(report.xpByEventType ?? {}).map(([type, v]) => (
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
          <Section title={<BilingualText en={`Recent XP Events (last ${(report.recentEvents ?? []).length})`} el={`Πρόσφατα συμβάντα XP (τελευταία ${(report.recentEvents ?? []).length})`} compact />} icon={Clock}>
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
                  {(report.recentEvents ?? []).map((e) => (
                    <XPEventRow key={e.id} e={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Badges */}
          <Section title={<BilingualText en={`Badges (${(report.badges ?? []).length})`} el={`Διακρίσεις (${(report.badges ?? []).length})`} compact />} icon={Award}>
            {(report.badges ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="No badges earned yet." el="Δεν έχουν κερδηθεί διακρίσεις ακόμα." compact wrap /></p>
            ) : (
              <ul className="divide-y divide-border">
                {report.badges.map((b) => (
                  <li key={b.badgeId} className="py-2 first:pt-0 last:pb-0">
                    <RowHead
                      title={b.name}
                      subtitle={b.category ? <StatusText value={b.category} /> : undefined}
                      aside={!b.seen ? (
                        <span className="rounded-md bg-status-success-bg px-1.5 py-0.5 text-xs text-status-success"><BilingualText en="New" el="Νέα" compact /></span>
                      ) : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Streak */}
          <Section title={<BilingualText en="Streak" el="Σερί" compact />} icon={TrendingUp}>
            {report.streak ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 card-body">
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Current Streak" el="Τρέχον σερί" compact /></p>
                  <p className="card-body font-semibold tabular-nums text-status-accent">{report.streak.currentStreak}d</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Longest" el="Μεγαλύτερο" compact /></p>
                  <p className="card-body font-semibold tabular-nums text-foreground">{report.streak.longestStreak}d</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Last Active" el="Τελευταία δραστηριότητα" compact /></p>
                  <p className="text-foreground">
                    {report.streak.lastActiveDate
                      ? fmtDate(report.streak.lastActiveDate, { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs"><BilingualText en="Grace Used" el="Χάρη που χρησιμοποιήθηκε" compact /></p>
                  <p className="text-foreground">
                    {report.streak.graceUsedAt
                      ? fmtDate(report.streak.graceUsedAt, { day: 'numeric', month: 'short', year: 'numeric' })
                      : <BilingualText en="No" el="Όχι" compact />}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground"><BilingualText en="No streak record found." el="Δεν βρέθηκε σερί." compact wrap /></p>
            )}
          </Section>

          {/* Anomaly Flags */}
          <Section title={<BilingualText en={`Abuse Flags (${(report.anomalies ?? []).length})`} el={`Επισημάνσεις κατάχρησης (${(report.anomalies ?? []).length})`} compact />} icon={AlertTriangle}>
            {(report.anomalies ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="No abuse flags on this user." el="Καμία επισήμανση κατάχρησης για αυτόν τον χρήστη." compact wrap /></p>
            ) : (
              <ul className="divide-y divide-border">
                {report.anomalies.map((a) => (
                  <li key={a.flagId} className="space-y-1 py-2 first:pt-0 last:pb-0">
                    <RowHead
                      title={(
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: `hsl(${(1 - a.severity) * 120}, 70%, 50%)` }}
                          />
                          <code className="font-mono" translate="no">{a.type}</code>
                        </span>
                      )}
                      subtitle={(
                        <FactLine
                          items={[
                            <BilingualText key="sev" en={`Severity ${(a.severity * 100).toFixed(0)}%`} el={`Σοβαρότητα ${(a.severity * 100).toFixed(0)}%`} compact />,
                            fmtDate(a.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                          ]}
                        />
                      )}
                      aside={(
                        <span className={`rounded-md px-1.5 py-0.5 text-xs ${STATUS_COLORS[a.status] ?? ''}`}>
                          <StatusText value={a.status} />
                        </span>
                      )}
                    />
                    {a.description && (
                      <p className="text-sm text-muted-foreground first-letter:uppercase">{a.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Contribution scores */}
          {(report.contributions ?? []).length > 0 && (
            <Section title={<BilingualText en={`Workspace Contributions (${report.contributions.length})`} el={`Συνεισφορές σε χώρους εργασίας (${report.contributions.length})`} compact />} icon={TrendingUp}>
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
