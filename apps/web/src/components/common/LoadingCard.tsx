import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type LoadingCardProps = {
  variant?: 'profile' | 'stat' | 'message' | 'list-item' | 'default';
  className?: string;
  style?: React.CSSProperties;
};

export function LoadingCard({ variant = 'default', className, style }: LoadingCardProps) {
  switch (variant) {
    case 'profile':
      return (
        <div style={style} className={cn('rounded-xl border border-border bg-card/80 p-6 space-y-4', className)}>
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      );

    case 'stat':
      return (
        <div style={style} className={cn('rounded-xl border border-border bg-card/80 p-4 space-y-2', className)}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      );

    case 'message':
      return (
        <div style={style} className={cn('flex items-start gap-3 py-3', className)}>
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      );

    case 'list-item':
      return (
        <div style={style} className={cn('flex items-center gap-3 py-2', className)}>
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      );

    default:
      return (
        <div style={style} className={cn('rounded-xl border border-border bg-card/80 p-6 space-y-3', className)}>
          <Skeleton className="h-5 w-1/3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      );
  }
}

// Grid of loading cards
export function LoadingCardGrid({ 
  count = 4, 
  variant = 'default',
  className,
  columns = 2,
}: { 
  count?: number; 
  variant?: LoadingCardProps['variant'];
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}) {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid grid-cols-1 gap-4', colsClass[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard 
          key={i} 
          variant={variant} 
          className="animate-fade-in"
          style={{ animationDelay: `${i * 100}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
