'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  value: string | number;
  label: string;
  color?: string;
  className?: string;
}

export function StatsCard({ value, label, color, className }: StatsCardProps) {
  return (
    <Card className={cn('transition-all hover:shadow-sm', className)}>
      <CardContent className="text-center">
        <p 
          className="page-stat text-2xl font-bold tabular-nums"
          style={color ? { color } : undefined}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}
