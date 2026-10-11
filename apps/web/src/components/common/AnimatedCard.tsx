'use client';

import { cn } from '@/lib/utils';

type AnimatedCardProps = {
  children: React.ReactNode;
  index?: number;
  className?: string;
};

export function AnimatedCard({ children, index = 0, className }: AnimatedCardProps) {
  return (
    <div
      className={cn('animate-fade-in-up', className)}
      style={{ animationDelay: `${(index ?? 0) * 60}ms`, animationFillMode: 'both' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
