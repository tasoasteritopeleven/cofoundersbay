'use client';

import { Users, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { cn } from '@/lib/utils';

export type DashboardStatsData = {
  activeProfiles: number;
  matchesThisWeek: number;
  trendPercent?: number;
  chartData?: { label: string; value: number }[];
};

const defaultData: DashboardStatsData = {
  activeProfiles: 0,
  matchesThisWeek: 0,
  trendPercent: 0,
  chartData: [],
};

type DashboardStatsProps = {
  data?: DashboardStatsData | null;
  isLoading?: boolean;
  className?: string;
};

export function DashboardStats({
  data = defaultData,
  isLoading = false,
  className,
}: DashboardStatsProps) {
  const stats = data ?? defaultData;
  const chartData = stats.chartData?.length
    ? stats.chartData
    : [{ label: 'Mon', value: 0 }, { label: 'Tue', value: 0 }, { label: 'Wed', value: 0 }, { label: 'Thu', value: 0 }, { label: 'Fri', value: 0 }, { label: 'Sat', value: 0 }, { label: 'Sun', value: 0 }];

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-2">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Active profiles"
            value={stats.activeProfiles.toLocaleString('en-GB')}
            icon={<Users className="icon-md" />}
            trend={stats.trendPercent != null ? { value: stats.trendPercent, label: 'vs last week' } : undefined}
          />
          <StatCard
            label="Matches this week"
            value={String(stats.matchesThisWeek)}
            icon={<Zap className="icon-md" />}
          />
        </div>
        <div className="h-24 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number) => [v, 'Matches']}
                labelFormatter={(l) => l}
              />
              <Bar dataKey="value" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
