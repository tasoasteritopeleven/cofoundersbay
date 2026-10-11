'use client';

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type ApplicationsDatum = { month: string; applications: number; accepted: number };
type SessionsDatum = { month: string; sessions: number };
type IndustryDatum = { name: string; value: number; color: string };

export function ApplicationsTrendChart({ data }: { data: ApplicationsDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--status-success-mark))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--status-success-mark))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="applications" stroke="hsl(var(--primary))" fill="url(#appFill)" strokeWidth={2} name="Applications" />
        <Area type="monotone" dataKey="accepted" stroke="hsl(var(--status-success-mark))" fill="url(#accFill)" strokeWidth={2} name="Accepted" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MentorSessionsChart({ data }: { data: SessionsDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sessions" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IndustryPieChart({ data }: { data: IndustryDatum[] }) {
  return (
    <ResponsiveContainer width={140} height={140}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={2} tabIndex={-1}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
