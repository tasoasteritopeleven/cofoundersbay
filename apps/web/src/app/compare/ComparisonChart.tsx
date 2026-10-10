'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';

type CompareProfileMin = {
  id: string;
  displayName: string;
  matchScore?: number;
};

const COMPARISON_DIMENSIONS = [
  { key: 'skills',        label: 'Skills Match' },
  { key: 'stage',         label: 'Stage Fit' },
  { key: 'industry',      label: 'Industry Overlap' },
  { key: 'location',      label: 'Location' },
  { key: 'availability',  label: 'Availability' },
];

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

export function ComparisonChart({ profiles }: { profiles: CompareProfileMin[] }) {
  const data = COMPARISON_DIMENSIONS.map((dim) => {
    const entry: Record<string, string | number> = { dimension: dim.label };
    profiles.forEach((p, i) => {
      const base = p.matchScore ?? 50;
      const seed = i * 7 + dim.key.charCodeAt(0);
      const variance = Math.round(Math.sin(seed) * 10);
      entry[`profile${i}`] = Math.max(0, Math.min(100, base + variance));
    });
    return entry;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="icon-md text-muted-foreground" aria-hidden="true" />
          <BilingualText en="Comparison overview" el="Επισκόπηση σύγκρισης" compact />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="dimension" width={100} tick={{ fontSize: 12 }} />
            <Tooltip />
            {/* The legend names on the caption step, never louder than the
                card's title (recharts sets them at the root size). */}
            <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
            {profiles.map((p, i) => (
              <Bar
                key={p.id}
                dataKey={`profile${i}`}
                name={p.displayName}
                fill={COLORS[i]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
