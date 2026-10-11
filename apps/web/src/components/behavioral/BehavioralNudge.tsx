'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNextAction } from '@/hooks/useNextAction';
import type { NextAction } from '@/lib/api';
import { STATUS } from '@/lib/semantic-colors';
import { bilingualAria } from '@/lib/i18n/format';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';

const ICON_MAP: Record<string, CfbGlyphName> = {
  User: 'profile',
  Layout: 'builder',
  FileText: 'research',
  Users: 'people',
  MessageSquare: 'messages',
  Zap: 'spark',
  BookOpen: 'book',
  RefreshCw: 'spark',
  UserPlus: 'people',
  Award: 'award',
};

const PRIORITY_STYLES: Record<NonNullable<NextAction['priority']>, string> = {
  critical: cn('border-l-4', STATUS.danger.border, STATUS.danger.bg),
  high:     cn('border-l-4', STATUS.warning.border, STATUS.warning.bg),
  medium:   cn('border-l-4', STATUS.info.border, STATUS.info.bg),
  low:      'border-l-4 border-muted bg-muted/30',
};

interface BehavioralNudgeProps {
  surface?: string;
  className?: string;
  compact?: boolean;
}

export function BehavioralNudge({ surface = 'dashboard', className, compact = false }: BehavioralNudgeProps) {
  const { action, isLoading, dismiss } = useNextAction({ surface });
  const [dismissed, setDismissed] = useState(false);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (action?.key) {
      setDismissed(false);
      setMountKey((k) => k + 1);
    }
  }, [action?.key]);

  // `ctaHref` feeds <Link href>, which throws on undefined rather than warning,
  // so an action without one is dropped instead of blanking the host page.
  if (isLoading || dismissed || !action?.ctaHref) return null;

  const glyph = ICON_MAP[action.icon] ?? 'spark';
  const dismissLabel = bilingualAria('Dismiss suggestion', 'Απόρριψη πρότασης');

  const handleDismiss = () => {
    setDismissed(true);
    dismiss('unknown');
  };

  if (compact) {
    return (
      <div
        key={mountKey}
        className={cn(
          'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm',
          PRIORITY_STYLES[action.priority],
          className,
        )}
      >
        <CfbGlyph name={glyph} className="icon-sm shrink-0 text-foreground/70" />
        <span className="flex-1 text-xs text-foreground/90">{action.title}</span>
        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" asChild>
          <Link href={action.ctaHref}>
            {action.ctaLabel} <ArrowRight className="ml-1 icon-sm" />
          </Link>
        </Button>
        <button type="button" onClick={handleDismiss} className="ml-1 text-muted-foreground hover:text-foreground" aria-label={dismissLabel}>
          <X className="icon-sm" />
        </button>
      </div>
    );
  }

  return (
    <div
      key={mountKey}
      className={cn(
        'relative rounded-xl border p-4 shadow-sm transition-all',
        PRIORITY_STYLES[action.priority],
        className,
      )}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label={dismissLabel}
      >
        <X className="icon-sm" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background">
          <CfbGlyph name={glyph} className="icon-sm text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-foreground">{action.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{action.description}</p>
          <div className="pt-1.5">
            <Button size="sm" className="h-9 gap-1.5 px-3 text-xs" asChild>
              <Link href={action.ctaHref}>
                {action.ctaLabel}
                <ArrowRight className="icon-sm" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
