'use client';

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Progress } from '@/components/ui/progress';

type Dim = { subject: string; value: number; fullMark: number };

export function MatchCompatibilityChart({ dims }: { dims: Dim[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={dims}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Radar
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="space-y-2.5">
        {dims.map((d) => (
          <div key={d.subject} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-foreground">{d.subject}</span>
              <span className="text-muted-foreground tabular-nums">{d.value}%</span>
            </div>
            <Progress value={d.value} className="h-1.5" />
          </div>
        ))}
      </div>
    </>
  );
}
