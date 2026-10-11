'use client';

import { cloneElement, isValidElement, type ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The connection row, used by every browse card.
 * A 40px mark, the name and one badge on the first line, the action at the
 * end of that line, then the subtitle and one smaller sentence.
 * Those two lines start on the title's left edge, beside the mark, so
 * they never cover the circle or leave the card.
 */
export const rowTitleClass =
  'person-name inline-flex tap-target-y items-center font-semibold text-foreground transition-colors hover:text-primary-accessible';

function keptMark(mark: ReactNode) {
  if (!isValidElement<{ className?: string }>(mark)) {
    return <span data-keep-icon="" className="shrink-0">{mark}</span>;
  }
  return cloneElement(mark, {
    'data-keep-icon': '',
    className: cn('shrink-0', mark.props.className),
  } as { 'data-keep-icon': string; className: string });
}

function leadIn(node: ReactNode): ReactNode {
  if (typeof node !== 'string') return node;
  return node.replace(/^(\s*)(\p{Ll})/u, (_, space: string, letter: string) => space + letter.toLocaleUpperCase());
}

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
    <Card
      id={id}
      className={cn('card-interactive', className)}
      onClick={onClick
        ? (event) => {
            if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
            onClick();
          }
        : undefined}
    >
      <CardContent className="flex items-start gap-4">
        {keptMark(mark)}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {titleHref ? (
              <Link href={titleHref} className={rowTitleClass}>{title}</Link>
            ) : (
              <h3 className={rowTitleClass}>{title}</h3>
            )}
            {badge}
            {actions ? (
              <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                {actions}
              </div>
            ) : null}
          </div>
          {headline || detail ? (
            <div>
              {headline ? <p className="text-sm text-muted-foreground truncate">{leadIn(headline)}</p> : null}
              {detail ? <p className="card-copy mt-1 text-xs text-muted-foreground line-clamp-2">{leadIn(detail)}</p> : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
