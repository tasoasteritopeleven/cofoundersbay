import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'badge inline-flex items-center gap-1.5 rounded-md border-0 px-2.5 py-0.5 text-xs font-medium transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary-accessible',
        secondary: 'bg-transparent text-muted-foreground',
        outline: 'bg-transparent text-foreground',
        success: 'bg-status-success-bg text-status-success',
        warning: 'bg-status-warning-bg text-status-warning',
        destructive: 'bg-status-danger-bg text-status-danger',
        info: 'bg-status-info-bg text-status-info',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className, 'border-0 shadow-none !shadow-none')}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
