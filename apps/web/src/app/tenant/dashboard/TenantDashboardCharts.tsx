'use client';

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/*
 * Both charts drew constants - a workspace growing from 98 to 156 members
 * between October and March, and three programmes that no other screen had -
 * whatever the workspace held. They now draw what the dashboard counts from
 * its own reads and passes in.
 */

export type MemberGrowthDatum = { month: string; members: number };
export type ProgramEngagementDatum = { name: string; applications: number; enrolled: number };

export function MemberGrowthChart({ data }: { data: MemberGrowthDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="memberFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="members" name="Members" stroke="hsl(var(--primary))" fill="url(#memberFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProgramEngagementChart({ data }: { data: ProgramEngagementDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="applications" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Applications" />
        <Bar dataKey="enrolled" fill="hsl(var(--status-success-mark))" radius={[4, 4, 0, 0]} name="Enrolled" />
      </BarChart>
    </ResponsiveContainer>
  );
}
