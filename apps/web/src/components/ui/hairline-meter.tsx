import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Quiet usage track — Cursor Spending’s 2–3px bar, not a stat poster. */
export function HairlineMeter({
  label,
  caption,
  percent = 0,
  trailing,
  className,
}: {
  label: ReactNode;
  caption?: string;
  percent?: number;
  trailing?: ReactNode;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {trailing && <p className="text-xs text-muted-foreground">{trailing}</p>}
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-border/70">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
