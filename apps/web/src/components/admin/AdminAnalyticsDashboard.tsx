'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, TrendingUp, Award, Zap, Shield, RefreshCw,
} from 'lucide-react';
import {
  adminGetXPDistribution,
  adminGetBadgeUnlockRates,
  XPDistributionBucket,
  BadgeUnlockRate,
} from '@/lib/api';
import { useChartTheme } from '@/lib/chart-theme';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Badge rarity is an ordinal domain ramp, not a chart series: the tiers carry
 * fixed meaning across the gamification surface, so they stay pinned rather
 * than drawing from the categorical palette in lib/chart-theme.
 */
const RARITY_COLORS: Record<string, string> = {
  common: '--status-neutral',
  uncommon: '--status-success',
  rare: '--status-info',
  epic: '--status-accent',
  legendary: '--status-warning',
};

const rarityText = (rarity: string) =>
  `hsl(var(${RARITY_COLORS[rarity] ?? '--status-neutral'}-fg))`;
const rarityTint = (rarity: string) =>
  `hsl(var(${RARITY_COLORS[rarity] ?? '--status-neutral'}-mark) / 0.13)`;
const rarityMark = (rarity: string) =>
  RARITY_COLORS[rarity] ? `hsl(var(${RARITY_COLORS[rarity]}-mark))` : undefined;

function StatCard({
  icon: Icon,
  label,
  labelEl,
  value,
  sub,
  color = 'indigo',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  labelEl: string;
  value: string | number;
  sub?: React.ReactNode;
  color?: 'indigo' | 'green' | 'amber' | 'rose';
}) {
  const colorMap = {
    indigo: 'bg-status-accent-bg text-status-accent',
    green: 'bg-status-success-bg text-status-success',
    amber: 'bg-status-warning-bg text-status-warning',
    rose: 'bg-status-danger-bg text-status-danger',
  };
  return (
    // A stat card: the figure under its label, the tone's mark in front.
    <Card>
      <CardContent className="flex items-start gap-3">
        <div data-card-mark="" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colorMap[color])}>
          <Icon className="icon-md" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
          <p className="page-stat text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminAnalyticsDashboard() {
  const theme = useChartTheme();
  const [xpDist, setXpDist] = useState<XPDistributionBucket[]>([]);
  const [badgeRates, setBadgeRates] = useState<BadgeUnlockRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [xp, badges] = await Promise.all([
        adminGetXPDistribution(),
        adminGetBadgeUnlockRates(),
      ]);
      // A partial payload (the demo answers with an object) threw on
      // `.reduce` and blanked the whole console behind its error boundary.
      setXpDist(Array.isArray(xp) ? xp : []);
      setBadgeRates(Array.isArray(badges) ? badges : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totalUsers = xpDist.reduce((s, b) => s + b.count, 0);
  const usersWithXP = xpDist.filter((b) => b.bucket !== '0–99').reduce((s, b) => s + b.count, 0);
  const totalBadgeUnlocks = badgeRates.reduce((s, b) => s + b.unlockCount, 0);
  const avgBadgeRate =
    badgeRates.length > 0
      ? (badgeRates.reduce((s, b) => s + b.unlockRate, 0) / badgeRates.length).toFixed(1)
      : '0';

  // Gini coefficient for XP distribution (contribution inequality measure)
  const gini = (() => {
    if (xpDist.length === 0) return 0;
    const counts = xpDist.map((b) => b.count);
    const n = counts.reduce((s, c) => s + c, 0);
    if (n === 0) return 0;
    // Approximate with bucket midpoints
    const midpoints = [50, 200, 450, 800, 1500, 3500, 6000];
    let sumNumer = 0;
    for (let i = 0; i < counts.length; i++) {
      for (let j = 0; j < counts.length; j++) {
        sumNumer += counts[i] * counts[j] * Math.abs((midpoints[i] ?? 0) - (midpoints[j] ?? 0));
      }
    }
    const meanXp = midpoints.reduce((s, m, i) => s + m * counts[i], 0) / n;
    return meanXp > 0 ? parseFloat((sumNumer / (2 * n * n * meanXp)).toFixed(3)) : 0;
  })();

  const sharePct = totalUsers > 0 ? ((usersWithXP / totalUsers) * 100).toFixed(1) : 0;

  // Badge pie chart — top 6 by unlock rate
  const topBadges = [...badgeRates]
    .sort((a, b) => b.unlockCount - a.unlockCount)
    .slice(0, 6);

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center h-64">
        <RefreshCw aria-hidden="true" className="icon-lg text-status-accent animate-spin" />
        <span className="ml-2 text-muted-foreground"><BilingualText en="Loading analytics…" el="Φόρτωση αναλυτικών…" compact /></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-6 text-status-danger">
        <p role="alert"><BilingualText en="Failed to load analytics:" el="Αποτυχία φόρτωσης αναλυτικών:" compact /> {error}</p>
        <button type="button" onClick={load} className="mt-3 underline text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><BilingualText en="Retry" el="Δοκιμάστε ξανά" compact /></button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground"><BilingualText en="Gamification Analytics" el="Αναλυτικά gamification" compact /></h2>
          <p className="mt-0.5 text-xs text-muted-foreground"><BilingualText en="Platform-wide scoring health and engagement metrics" el="Υγεία βαθμολόγησης και μετρήσεις συμμετοχής σε όλη την πλατφόρμα" wrap /></p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-status-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RefreshCw aria-hidden="true" className="icon-sm" />
          <BilingualText en="Refresh" el="Ανανέωση" compact />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" labelEl="Σύνολο χρηστών" value={totalUsers} color="indigo" />
        <StatCard
          icon={TrendingUp}
          label="Users with XP"
          labelEl="Χρήστες με XP"
          value={usersWithXP}
          sub={<BilingualText en={`${sharePct}% of total`} el={`${sharePct}% του συνόλου`} compact wrap />}
          color="green"
        />
        <StatCard
          icon={Award}
          label="Total Badge Unlocks"
          labelEl="Αποκτήσεις διακρίσεων"
          value={totalBadgeUnlocks}
          sub={<BilingualText en={`Avg rate ${avgBadgeRate}%`} el={`Μέσο ποσοστό ${avgBadgeRate}%`} compact wrap />}
          color="amber"
        />
        <StatCard
          icon={Zap}
          label="XP Gini Coefficient"
          labelEl="Συντελεστής Gini (XP)"
          value={gini}
          sub={gini < 0.4
            ? <BilingualText en="Healthy distribution" el="Υγιής κατανομή" compact wrap />
            : gini < 0.6
              ? <BilingualText en="Moderate inequality" el="Μέτρια ανισότητα" compact wrap />
              : <BilingualText en="High inequality" el="Υψηλή ανισότητα" compact wrap />}
          color={gini < 0.4 ? 'green' : gini < 0.6 ? 'amber' : 'rose'}
        />
      </div>

      {/* XP Distribution Histogram */}
      <Card>
        <CardHeader>
          <CardTitle><BilingualText en="XP Distribution Histogram" el="Κατανομή XP" compact /></CardTitle>
          <CardDescription>
            <BilingualText
              en="Each bar shows how many users fall within that XP range. A healthy platform shows a gradual right-tail, not a spike at 0."
              el="Κάθε στήλη δείχνει πόσοι χρήστες βρίσκονται σε αυτό το εύρος XP. Μια υγιής πλατφόρμα δείχνει σταδιακή ουρά προς τα δεξιά, όχι αιχμή στο 0."
              wrap
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={xpDist} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(v: number) => [`${v} users`, 'Count']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="count" fill={theme.series[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badge Unlock Rates */}
        <Card>
          <CardHeader>
            <CardTitle><BilingualText en="Badge Unlock Rates (Top 6)" el="Ποσοστά απόκτησης διακρίσεων (κορυφαίες 6)" compact /></CardTitle>
          </CardHeader>
          <CardContent>
          {topBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground"><BilingualText en="No badges defined yet." el="Δεν έχουν οριστεί διακρίσεις ακόμα." compact wrap /></p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={topBadges}
                  dataKey="unlockCount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, unlockRate }: { name: string; unlockRate: number }) =>
                    `${name} (${unlockRate}%)`
                  }
                  labelLine={false}
                >
                  {topBadges.map((b, i) => (
                    <Cell
                      key={b.badgeId}
                      fill={rarityMark(b.rarity) ?? theme.series[i % theme.series.length]}
                    />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v} unlocks`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          </CardContent>
        </Card>

        {/* Badge Rate Table */}
        <Card>
          <CardHeader>
            <CardTitle><BilingualText en="All Badge Rates" el="Όλα τα ποσοστά διακρίσεων" compact /></CardTitle>
          </CardHeader>
          <CardContent>
          <div className="relative overflow-auto max-h-[220px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium"><BilingualText en="Badge" el="Διάκριση" compact /></th>
                  <th className="pb-2 font-medium"><BilingualText en="Rarity" el="Σπανιότητα" compact /></th>
                  <th className="pb-2 font-medium text-right"><BilingualText en="Unlocks" el="Αποκτήσεις" compact /></th>
                  <th className="pb-2 font-medium text-right"><BilingualText en="Rate" el="Ποσοστό" compact /></th>
                </tr>
              </thead>
              <tbody>
                {badgeRates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground"><BilingualText en="No badges yet" el="Δεν υπάρχουν διακρίσεις ακόμα" compact /></td>
                  </tr>
                ) : (
                  badgeRates.map((b) => (
                    <tr key={b.badgeId} className="border-b border-border hover:bg-muted">
                      <td className="py-1.5 font-medium text-foreground">{b.name}</td>
                      <td className="py-1.5">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: rarityTint(b.rarity),
                            color: rarityText(b.rarity),
                          }}
                        >
                          <StatusText value={b.rarity} />
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{b.unlockCount}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                        {b.unlockRate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Shield indicator */}
      <div className="flex items-start gap-3 bg-status-accent-bg border border-status-accent-border rounded-xl p-4 text-sm text-status-accent">
        <Shield className="icon-sm mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <BilingualText
            en="Explainability note: all scores are computed from real user actions, with no synthetic inflation. A Gini coefficient under 0.4 indicates a healthy distribution; the XP histogram should show a gradual right-tail for a healthy active community."
            el="Σημείωση επεξηγησιμότητας: όλες οι βαθμολογίες υπολογίζονται από πραγματικές ενέργειες χρηστών, χωρίς τεχνητή διόγκωση. Συντελεστής Gini κάτω από 0,4 δείχνει υγιή κατανομή· το ιστόγραμμα XP πρέπει να δείχνει σταδιακή ουρά προς τα δεξιά σε μια υγιή, ενεργή κοινότητα."
            wrap
          />
        </div>
      </div>
    </div>
  );
}
