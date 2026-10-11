'use client';

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, PieChart as RPieChart,
  Pie, Cell, Legend,
} from 'recharts';

type ValueDatum = { month: string; value: number };
type SectorDatum = { name: string; value: number; color: string };

export function PortfolioValueChart({ data }: { data: ValueDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}K`} />
        <RechartsTooltip formatter={(v: number) => [`€${v}K`, 'Value']} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#portGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SectorMixChart({ data }: { data: SectorDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RPieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: €${value}K`} labelLine={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Legend />
        <RechartsTooltip formatter={(v: number) => [`€${v}K`, 'Invested']} />
      </RPieChart>
    </ResponsiveContainer>
  );
}
