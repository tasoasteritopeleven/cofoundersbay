import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const isInvalid = Boolean(invalid || ariaInvalid);
    return (
      <textarea
        aria-invalid={isInvalid || undefined}
        className={cn(
          'flex min-h-[calc(96px*var(--chrome-y))] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm text-foreground transition-colors',
          'placeholder:text-muted-foreground/70 hover:border-foreground/15',
          'focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40 resize-y',
          isInvalid && 'border-destructive',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
