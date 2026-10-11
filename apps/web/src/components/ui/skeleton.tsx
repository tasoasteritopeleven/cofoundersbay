import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Purely decorative placeholder. Hidden from assistive tech so screen-reader
 * users hear the region's own loading announcement rather than a run of empty
 * boxes; wrap groups in a container with `role="status"` + `aria-label` when
 * the loading state itself needs announcing.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('shimmer rounded-md bg-secondary/50', className)}
      {...props}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

export { Skeleton };
