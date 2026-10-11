'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePopupChatOptional } from '@/contexts/PopupChatContext';
import { BilingualText } from '@/components/common/BilingualText';

type IllustrationType = 'search' | 'connection' | 'message' | 'rocket' | 'profile' | 'calendar' | 'default';

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  illustration?: IllustrationType;
  size?: 'sm' | 'md' | 'lg';
  /** Secondary Ask AI action — never replaces the primary `action`. */
  askAiPrompt?: string;
};

// SVG Illustrations for different empty states
function EmptyIllustration({ type, className }: { type: IllustrationType; className?: string }) {
  const drawings: Record<IllustrationType, ReactNode> = {
    search: <>
      <circle cx="51" cy="51" r="25" /><path d="m70 70 22 22M38 56c6 9 20 10 27-1" />
      <circle cx="41" cy="45" r="3" fill="currentColor" stroke="none" /><circle cx="61" cy="45" r="3" fill="currentColor" stroke="none" />
    </>,
    connection: <>
      <circle cx="29" cy="43" r="10" /><circle cx="91" cy="43" r="10" />
      <path d="M29 57c0 22 19 32 31 35 12-3 31-13 31-35M39 43h42" />
      <circle cx="60" cy="92" r="4" fill="currentColor" stroke="none" />
    </>,
    message: <>
      <path d="M31 28h58a10 10 0 0 1 10 10v36a10 10 0 0 1-10 10H54L34 97V84h-3a10 10 0 0 1-10-10V38a10 10 0 0 1 10-10Z" />
      <path d="M39 49h42M39 63h25" /><circle cx="81" cy="63" r="3" fill="currentColor" stroke="none" />
    </>,
    rocket: <>
      <path d="M47 73c-2-25 3-42 13-53 10 11 15 28 13 53ZM47 55 34 70v15l13-9M73 55l13 15v15l-13-9M51 91l9 11 9-11" />
      <circle cx="60" cy="49" r="7" /><path d="M53 81h14" />
    </>,
    profile: <>
      <circle cx="60" cy="43" r="17" /><path d="M28 96c0-18 14-29 32-29s32 11 32 29M24 26l8-8M96 26l-8-8" />
      <path d="M45 77c6 11 24 11 30 0" />
    </>,
    calendar: <>
      <rect x="24" y="30" width="72" height="65" rx="12" /><path d="M24 49h72M43 22v16M77 22v16M42 66h5M58 66h5M74 66h5M42 81h5M58 81h5" />
      <circle cx="77" cy="81" r="5" fill="currentColor" stroke="none" />
    </>,
    default: <>
      <path d="M32 42c0 29 18 43 28 47 10-4 28-18 28-47" />
      <circle cx="32" cy="37" r="9" fill="currentColor" stroke="none" />
      <circle cx="88" cy="37" r="9" fill="currentColor" stroke="none" />
      <circle cx="60" cy="89" r="5" fill="currentColor" stroke="none" />
    </>,
  };
  return (
    <svg className={cn('mx-auto text-primary-accessible', className)} width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="104" height="104" rx="30" fill="currentColor" fillOpacity="0.04" stroke="none" />
      {drawings[type] ?? drawings.default}
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
  illustration = 'default',
  size = 'md',
  askAiPrompt,
}: EmptyStateProps) {
  const popup = usePopupChatOptional();
  const sizeClasses = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
  const illustrationSizes = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card/80 text-center shadow-sm',
        sizeClasses[size],
        className,
      )}
    >
      {/* Quiet identity wash — crisp tint outlines, not a blurred stain. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute -top-12 left-8 h-32 w-32 rounded-full border border-primary/20 bg-primary/[0.04]" />
        <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full border border-primary/15 bg-primary/[0.03]" />
      </div>
      <div className="relative space-y-4">
        {/* SVG Illustration */}
        <div className={cn('mx-auto', illustrationSizes[size])}>
          <EmptyIllustration type={illustration} className={illustrationSizes[size]} />
        </div>
        {/* Text content */}
        <div className="space-y-2">
          <p className="mx-auto max-w-prose text-balance break-words text-base font-semibold leading-snug">{title}</p>
          {description && <p className="mx-auto max-w-prose break-words text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {(action || askAiPrompt) && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {action}
            {askAiPrompt && (popup ? (
              <Button variant="outline" size="sm" onClick={() => popup.ask(askAiPrompt)}>
                <BilingualText en="Ask AI" el="Ρωτήστε το AI" compact />
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={`/ai?q=${encodeURIComponent(askAiPrompt)}`}>
                  <BilingualText en="Ask AI" el="Ρωτήστε το AI" compact />
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
