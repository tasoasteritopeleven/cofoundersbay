'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'wordmark';
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  inverted?: boolean;
}

const SIZE_MAP = {
  xs: { icon: 22, text: 'text-sm',   gap: 'gap-1.5', tracking: 'tracking-tight' },
  sm: { icon: 41, text: 'text-base', gap: 'gap-2',   tracking: 'tracking-tight' },
  md: { icon: 32, text: 'text-lg',   gap: 'gap-2.5', tracking: 'tracking-tight' },
  lg: { icon: 40, text: 'text-2xl',  gap: 'gap-3',   tracking: 'tracking-tight' },
  xl: { icon: 52, text: 'text-3xl',  gap: 'gap-3.5', tracking: 'tracking-tighter' },
};

/**
 * CoFounderBay mark — a surfer on the board at sunset, and the cofounder
 * under the board in the bay. Two people, one venture, one waterline.
 *
 * Colour mark is the painted scene (`/icons/logo-surf.png`). `mono` is a
 * compact “Co” lettermark in currentColor — for the chat bubble and
 * inverted chrome, where the painted scene cannot read.
 */
function CoMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('pointer-events-none block shrink-0', className)}
    >
      <text
        x="15.6"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        style={{
          fontFamily: 'var(--font-co-mark), var(--font-inter), system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 15.2,
          letterSpacing: '-0.045em',
        }}
      >
        Co
      </text>
    </svg>
  );
}

export function LogoIcon({
  size = 32,
  className,
  mono = false,
}: { size?: number; className?: string; mono?: boolean }) {
  if (mono) {
    return <CoMark size={size} className={className} />;
  }

  return (
    <img
      src="/icons/logo-surf.png"
      width={size}
      height={size}
      alt=""
      draggable={false}
      // The mark's corner is 28% of its size at every size, like an app icon;
      // the corner-ladder test skips it by this attribute.
      data-brand-mark=""
      className={cn('inline-block select-none object-cover', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    />
  );
}

/** Full CoFounderBay brand mark — icon + wordmark */
export function Logo({
  size = 'md',
  variant = 'full',
  className,
  iconClassName,
  textClassName,
  inverted = false,
}: LogoProps) {
  const config = SIZE_MAP[size];

  if (variant === 'icon') {
    return <LogoIcon size={config.icon} mono={inverted} className={cn(iconClassName, className)} />;
  }

  // `data-logotype`: WCAG 1.4.3 exempts text that is part of a logo, and the
  // brand's "Bay" wears the exact accent on purpose (53f8bdb). The axe scans
  // exclude this one attribute rather than the colour-contrast rule.
  const wordmark = (
    <span
      data-logotype=""
      className={cn(
        'font-display font-semibold select-none',
        config.text,
        config.tracking,
        inverted ? 'text-white' : 'text-foreground',
        textClassName,
      )}
    >
      CoFounder
      <span className={inverted ? 'text-white/80' : 'text-primary'}>Bay</span>
    </span>
  );

  if (variant === 'wordmark') return wordmark;

  return (
    <div className={cn('inline-flex items-center', config.gap, className)}>
      <LogoIcon size={config.icon} mono={inverted} className={iconClassName} />
      {wordmark}
    </div>
  );
}
