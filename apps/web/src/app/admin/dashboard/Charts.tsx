'use client';

import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useChartTheme } from '@/lib/chart-theme';

interface RoleData { name: string; value: number }

export function UserRoleChart({ data }: { data: RoleData[] }) {
  const theme = useChartTheme();

  // All zeros (no users counted yet, or the stats read failed) drew an empty
  // card with a legend under it - a chart with nothing in it reads as broken.
  if (!data.some((d) => d.value > 0)) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground">No users counted yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          The split by role appears once the platform statistics report user counts.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      {/* Side margins and a relative radius keep the outside labels inside the
          card on a phone ("Mentor 25%" was cut to "entor 25%"). */}
      <PieChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          // Direct labels: three of the light-mode slots sit below 3:1 against
          // the card surface, so identity is never carried by colour alone.
          label={({ name, percent }: { name: string; percent: number }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          outerRadius="62%"
          dataKey="value"
          // 2px surface ring between adjacent segments.
          stroke={theme.surface}
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={theme.series[index % theme.series.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={theme.tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
