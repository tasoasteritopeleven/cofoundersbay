'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <Card className={cn('transition-all', className)}>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FilterTabProps {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  color?: string;
}

export function FilterTab({ isActive, onClick, children, count, color }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      {color && (
        <span 
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color }} 
        />
      )}
      {children}
      {count !== undefined && (
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold',
          isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
