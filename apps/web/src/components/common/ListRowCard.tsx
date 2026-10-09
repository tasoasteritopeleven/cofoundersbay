'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The connection row: a 40px mark, the name and one badge, one subtitle,
 * an optional second line, and the action at the end. Endorsement cards
 * use the same row under their sentence.
 */
const titleClass =
  'person-name inline-flex tap-target-y items-center font-display text-base font-semibold text-foreground transition-colors hover:text-primary-accessible';

export function ListRowCard({
  mark,
  title,
  titleHref,
  badge,
  headline,
  detail,
  actions,
  className,
  onClick,
  id,
}: {
  mark: ReactNode;
  title: ReactNode;
  titleHref?: string;
  badge?: ReactNode;
  headline?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
}) {
  return (
    <Card id={id} className={cn('card-interactive', className)} onClick={onClick}>
      <CardContent className="flex items-center gap-4">
        {mark}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {titleHref ? (
              <Link href={titleHref} className={titleClass}>{title}</Link>
            ) : (
              <h3 className={titleClass}>{title}</h3>
            )}
            {badge}
          </div>
          {headline ? <p className="row-ellipsis text-sm text-muted-foreground">{headline}</p> : null}
          {detail ? <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{detail}</p> : null}
        </div>
        {actions ? <div className="flex max-w-[50%] shrink flex-wrap items-center justify-end gap-1">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
