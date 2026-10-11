'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2 className={cn('animate-spin text-primary-accessible', sizeClasses[size], className)} />
  );
}

// Full page loading spinner with optional message
// Uses a simple inline render — no portal, no backdrop-blur (both cause hydration
// issues and GPU compositing overhead that delay first meaningful paint).
export function PageLoader({ message }: { message?: string }) {
  return (
    <div
      aria-label="Loading"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="icon-xl animate-spin text-primary-accessible" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

// Inline loading state
export function InlineLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Spinner size="sm" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// Button loading state
export function ButtonLoader({ className }: { className?: string }) {
  return <Spinner size="sm" className={cn('mr-2', className)} />;
}
