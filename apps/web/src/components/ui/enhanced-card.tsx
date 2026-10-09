import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, initialsOf } from '@/lib/utils';
import { TREND } from '@/lib/semantic-colors';
import { Slot } from '@radix-ui/react-slot';
import { Badge } from './badge';
import { Button } from './button';

const enhancedCardVariants = cva(
  'relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-none transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'border-border hover:border-foreground/15',
        elevated: 'border-border',
        outlined: 'border border-border hover:border-foreground/15',
        ghost: 'border-transparent bg-transparent hover:bg-secondary/50',
        gradient: 'border-transparent bg-primary/[0.03] hover:bg-primary/[0.05]',
        glass: 'border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      interactive: {
        true: 'cursor-pointer active:scale-[0.98]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      interactive: false,
    },
  },
);

export interface EnhancedCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof enhancedCardVariants> {
  asChild?: boolean;
  loading?: boolean;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  actions?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hover?: boolean;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant, size, interactive, asChild = false, loading, badge, badgeVariant, actions, header, footer, hover: _hover, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';
    
    return (
      <Comp
        data-surface="card"
        className={cn(
          enhancedCardVariants({ variant, size, interactive }),
          loading && 'opacity-50 pointer-events-none',
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* Badge */}
        {badge && (
          <div className="absolute top-4 right-4 z-10">
            <Badge variant={badgeVariant}>{badge}</Badge>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className="h-full flex flex-col">
          {/* Header */}
          {header && (
            <div className="flex items-center justify-between mb-4">
              {header}
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1">{children}</div>

          {/* Footer */}
          {(footer || actions) && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div>{footer}</div>
              {actions && <div className="flex gap-2">{actions}</div>}
            </div>
          )}
        </div>
      </Comp>
    );
  },
);
EnhancedCard.displayName = 'EnhancedCard';

export { EnhancedCard, enhancedCardVariants };

// Enhanced Card Components
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('page-section text-base font-semibold leading-tight tracking-tight sm:text-lg', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Specialized Card Components
export const ProfileCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    profile: {
      name: string;
      role: string;
      avatar?: string;
      headline?: string;
      location?: string;
      skills?: string[];
      verified?: boolean;
    };
    showActions?: boolean;
  }
>(({ profile, showActions = true, className, ...props }, ref) => {
  return (
    <EnhancedCard
      ref={ref}
      variant="elevated"
      size="md"
      interactive={showActions}
      className={className}
      {...props}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {initialsOf(profile.name).toUpperCase()}
          </div>
          {profile.verified && (
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-status-success-mark rounded-full flex items-center justify-center">
              <div className="h-2 w-2 bg-white rounded-full" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{profile.name}</h3>
            {profile.verified && (
              <Badge variant="secondary" className="text-xs">
                Verified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-1">{profile.role}</p>
          {profile.headline && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {profile.headline}
            </p>
          )}
          {profile.location && (
            <p className="text-xs text-muted-foreground mb-2">📍 {profile.location}</p>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <FactLine items={[...profile.skills.slice(0, 3), profile.skills.length > 3 ? `+${profile.skills.length - 3}` : null]} />
          )}
        </div>
      </div>
      
      {showActions && (
        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="outline" className="flex-1">
            Connect
          </Button>
          <Button variant="ghost" size="icon" className="sm:w-auto sm:px-3" aria-label={`Message ${profile.name}`}>
            <MessageCircle className="icon-sm" />
            <span className="hidden sm:inline">Message</span>
          </Button>
        </div>
      )}
    </EnhancedCard>
  );
});
ProfileCard.displayName = 'ProfileCard';

export const StatsCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title: string;
    value: string | number;
    change?: {
      value: number;
      type: 'increase' | 'decrease';
      period: string;
    };
    icon?: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
  }
>(({ title, value, change, icon, trend, className, ...props }, ref) => {
  const getTrendColor = () => {
    if (trend === 'up') return TREND.up;
    if (trend === 'down') return TREND.down;
    return TREND.flat;
  };

  const getTrendIcon = () => {
    if (trend === 'up') return '↗';
    if (trend === 'down') return '↘';
    return '→';
  };

  return (
    <EnhancedCard
      ref={ref}
      variant="gradient"
      size="md"
      className={className}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="page-stat text-2xl font-bold mt-1">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs font-medium',
                  change.type === 'increase' ? TREND.up : TREND.down
                )}
              >
                {change.type === 'increase' ? '+' : '-'}{change.value}%
              </span>
              <span className="text-xs text-muted-foreground">{change.period}</span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="p-3 bg-primary/10 rounded-lg">
            {icon}
          </div>
        )}
        
        {trend && (
          <div className={cn('text-lg', getTrendColor())}>
            {getTrendIcon()}
          </div>
        )}
      </div>
    </EnhancedCard>
  );
});
StatsCard.displayName = 'StatsCard';

export const ActivityCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title: string;
    description: string;
    timestamp: string;
    user?: {
      name: string;
      avatar?: string;
    };
    action?: React.ReactNode;
  }
>(({ title, description, timestamp, user, action, className, ...props }, ref) => {
  return (
    <EnhancedCard
      ref={ref}
      variant="ghost"
      size="sm"
      interactive
      className={className}
      {...props}
    >
      <div className="flex items-start gap-3">
        {user && (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
            {initialsOf(user.name).toUpperCase()}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1">{title}</h4>
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mb-2">
            {description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{timestamp}</span>
            {action && <div>{action}</div>}
          </div>
        </div>
      </div>
    </EnhancedCard>
  );
});
ActivityCard.displayName = 'ActivityCard';

import { MessageCircle } from 'lucide-react';
import { FactLine } from '@/components/common/FactLine';
