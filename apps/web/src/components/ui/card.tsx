import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-surface="card"
      data-card=""
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-none',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    /* `card-header` carries one thing: the seam to the body below. It cannot
       live at the call site — `.card-comfortable` is declared after Tailwind's
       own utilities in the same layer, so every `pb-2`/`pb-3` passed here has
       been silently losing to it at every width. See globals.css. */
    <div ref={ref} className={cn('flex flex-col gap-1.5 card-comfortable card-header', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('page-section font-semibold leading-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    /* The card's subtitle step (globals.css "Card text ladder"): over the
       sentences and rows the card holds, under its title. It sat on the
       page-lead step, a notch under the rows it introduced. */
    <p ref={ref} className={cn('card-subtitle', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    /* No pt-0 here: call-site utilities lose to .card-comfortable in source
       order, so a lone content would still render its top padding anyway and
       the header→body seam is owned by the sibling rule in globals.css. */
    <div ref={ref} className={cn('card-comfortable', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center card-comfortable', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

