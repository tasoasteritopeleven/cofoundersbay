'use client';

// Required: the `asChild` branch below hands `onClickCapture` / `onKeyDownCapture`
// to Radix's Slot. Without this directive Button compiles as a Server Component
// wherever a server tree imports it (app/not-found.tsx and
// app/investor/dashboard/page.tsx both render <Button asChild>), and React
// rejects the render with "Event handlers cannot be passed to Client Component
// props" — which is what broke the /login response.

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150 focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // A coloured fill with a white label. The fill is deep enough that
        // the letters clear 4.6:1. Hover darkens the same fill; mixing toward
        // the mid tone would lighten Cyan, whose mid is the pale tint.
        default:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_hsl,hsl(var(--primary))_86%,black)]',
        // A fill or an edge, never both. The outline is the same hairline as a
        // card (cursor.com "Adjust Plan"): never --input, which is a field edge.
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-foreground/[0.06]',
        ghost:
          'bg-transparent text-foreground/70 hover:text-foreground hover:bg-secondary/60',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-secondary/50 hover:border-foreground/15',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link:
          'text-primary-accessible underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      /*
       * Heights and horizontal padding are re-stated in pixels from `lg` up.
       *
       * The desktop root is 82%, so every rem here rendered about a fifth
       * short of the value it names: `h-8` came out 26.24px, `h-7` came out
       * 22.96px — under the 24px floor of WCAG 2.5.8, which counts CSS pixels
       * and not rems. Buttons therefore sat tight around their own text while
       * the type beside them had been retuned to stay legible, which is what
       * made the controls feel cramped.
       *
       * The height is the Help topic pill (All topics, Getting started):
       * 31.08px below 640px and 33.67px from there up. On a phone, a purple
       * primary and a transparent outline or ghost are another 5% under that
       * (29.53px). xs stays the shorter mark. A call site that passes a
       * stacked label still grows with it.
       *
       * Expressed as `min-height` with `height: auto`, not as a fixed height.
       * A fixed one is indistinguishable from the ladder for an ordinary
       * button — its text is far shorter than 32px — but it overrides the
       * `h-auto` that call sites pass for a stacked control, and the three
       * Readiness CTAs (glyph over label over subtitle) were pushed clean
       * outside their own 36px box by it. A floor gives the ladder where the
       * ladder applies and gets out of the way where the author asked it to.
       */
      size: {
        xs:   'h-7 min-h-7 px-2.5 text-xs lg:h-auto lg:min-h-[calc(28px*var(--chrome-y))] lg:px-[10px]',
        sm:   'h-auto min-h-[31.08px] px-3 text-xs sm:min-h-[33.67px] lg:px-[12px]',
        md:   'h-auto min-h-[31.08px] px-4 sm:min-h-[33.67px] lg:px-[16px]',
        lg:   'h-auto min-h-[31.08px] px-6 text-base sm:min-h-[33.67px] lg:px-[24px]',
        xl:   'h-auto min-h-[31.08px] px-8 text-base sm:min-h-[33.67px] lg:px-[32px]',
        // An icon button has no text to outgrow its box, so it stays a fixed
        // square — the same height as the topic pill.
        icon: 'h-[31.08px] w-[31.08px] min-h-[31.08px] min-w-[31.08px] sm:h-[33.67px] sm:w-[33.67px] sm:min-h-[33.67px] sm:min-w-[33.67px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

type ButtonBaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

/**
 * Icon-only sizes have no text node, so they need an explicit accessible name.
 * The type system enforces it rather than leaving it to review: picking an
 * icon size without `aria-label` (or `aria-labelledby`) is a compile error.
 *
 * This guard existed before the two branches merged and was lost in the
 * merge; the axe run noticed immediately (`button-name` ×11 on /settings).
 * The instances were fixed by hand, but only the type keeps the class of bug
 * from coming back.
 *
 * `asChild` is exempt: a button rendering as someone else's element —
 * almost always a Link — delegates its name to that element, and requiring
 * one here too would put two competing accessible names on one control.
 *
 * `size` may be `null` because cva's VariantProps admits null for an unset
 * variant, and a wrapper forwarding `size` from its own props carries that
 * null through.
 */
type IconOnlySize = 'icon';

type ButtonSize = NonNullable<ButtonBaseProps['size']>;

export type ButtonProps = ButtonBaseProps &
  (
    // Text buttons: any non-icon size, no extra requirement.
    | { size?: Exclude<ButtonSize, IconOnlySize> | null }
    // `asChild` renders someone else's element — almost always a Link — and
    // that element carries its own name.
    | { asChild: true }
    // Icon sizes (including a size prop whose union merely *may* be an icon
    // size, as in wrapper components that forward `size`) must name themselves.
    | { size: ButtonSize | null | undefined; 'aria-label': string }
    | { size: ButtonSize | null | undefined; 'aria-labelledby': string }
  );

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    if (asChild) {
      const inactive = disabled || loading;
      return (
        <Slot
          {...props}
          // Conventional identity hook for tooling and tests. Note it does NOT
          // reach the DOM on this branch -- Radix's Slot does not forward it to
          // the child -- so nothing in CSS may depend on it here.
          data-slot="button"
          className={cn(buttonVariants({ variant, size, className }), inactive && 'pointer-events-none opacity-50')}
          ref={ref}
          aria-disabled={inactive || props['aria-disabled']}
          aria-busy={loading || props['aria-busy']}
          tabIndex={inactive ? -1 : props.tabIndex}
          onClickCapture={(event) => {
            if (inactive) { event.preventDefault(); event.stopPropagation(); }
            else props.onClickCapture?.(event as React.MouseEvent<HTMLButtonElement>);
          }}
          onKeyDownCapture={(event) => {
            if (inactive && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); }
            else props.onKeyDownCapture?.(event as React.KeyboardEvent<HTMLButtonElement>);
          }}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
