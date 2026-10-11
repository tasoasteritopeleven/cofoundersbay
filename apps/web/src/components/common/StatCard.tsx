import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TREND } from '@/lib/semantic-colors';

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
};

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  const trendColor = trend
    ? trend.value >= 0
      ? TREND.up
      : TREND.down
    : '';

  return (
    <Card className={cn('p-4 card-interactive group', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="page-stat-label text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <p className="page-stat text-2xl font-bold text-foreground font-display">
            {value}
          </p>
          {trend && (
            <p className={cn('text-xs font-medium flex items-center gap-1', trendColor)}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary-accessible transition-transform group-hover:scale-110 group-hover:bg-primary/20">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
