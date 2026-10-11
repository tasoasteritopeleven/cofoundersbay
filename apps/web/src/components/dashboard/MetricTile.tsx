import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { TREND } from '@/lib/semantic-colors';
import { cn } from '@/lib/utils';

/**
 * One figure at the top of a home screen: what it counts, the number, and a
 * line that says what the number means.
 *
 * Each role dashboard drew its own tile. The founder's put the label above a
 * large figure with a quiet glyph and a footer band of equal height, while
 * the investor, mentor, provider and incubator homes put an English-only label
 * over a smaller figure beside a tinted icon block. Moving from one role to
 * another looked like moving between products. This is the founder's
 * anatomy, shared:
 * - the label is bilingual and stacked;
 * - the figure is the largest text in the tile;
 * - the glyph stays quiet and never competes with the figure;
 * - a footer band of fixed height holds a trend or a caption, so a row of
 *   tiles keeps one baseline whether or not each has something to say.
 *
 * With `href` the whole tile is the link to the page that lists what it
 * counts.
 */
export type MetricTileProps = {
  label: string;
  labelEl?: string;
  value: ReactNode;
  /** A lucide icon, or `glyph` for the product's own glyph set. */
  icon?: ElementType;
  glyph?: CfbGlyphName;
  caption?: string;
  captionEl?: string;
  trend?: { value: number; positive: boolean; en?: string; el?: string };
  href?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  metaClassName?: string;
  /**
   * Centre the label, figure and caption in the tile. Off everywhere except
   * the four founder-dashboard figures that were asked to sit in the middle.
   */
  align?: 'start' | 'center';
};

export function MetricTile({ label, labelEl, value, icon: Icon, glyph, caption, captionEl, trend, href, className, labelClassName, valueClassName, metaClassName, align = 'start' }: MetricTileProps) {
  const centered = align === 'center';
  const mark = glyph ? (
    <CfbGlyph name={glyph} className="icon-sm shrink-0 text-muted-foreground/70" />
  ) : Icon ? (
    <Icon className="icon-sm shrink-0 text-muted-foreground/70" aria-hidden="true" />
  ) : null;
  const content = (
    <Card className={cn('relative h-full min-w-0 overflow-hidden transition-colors group-hover:border-primary/30', className)}>
      <CardContent className={cn('flex h-full flex-col', centered && 'items-center text-center')}>
        <div className={cn('flex w-full items-start gap-3', centered ? 'flex-col items-center' : 'justify-between')}>
          {centered ? mark : null}
          <div className={cn('min-w-0 flex-1 space-y-1.5', centered && 'w-full')}>
            <p className={cn('page-stat-label leading-snug text-muted-foreground', labelClassName)}>
              <BilingualText en={label} el={labelEl} stacked wrap />
            </p>
            <p className={cn('page-stat font-semibold tabular-nums tracking-tight', valueClassName)}>{value}</p>
          </div>
          {centered ? null : mark}
        </div>
        <div className={cn('mt-auto min-h-[2.75rem] pt-2', centered && 'w-full')}>
          {trend ? (
            <div className="space-y-0.5">
              <p className={cn('page-stat-meta font-medium tabular-nums leading-snug', trend.positive ? TREND.up : TREND.down, metaClassName)}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </p>
              {trend.en ? (
                <p className={cn('page-stat-meta leading-snug text-muted-foreground', metaClassName)}>
                  <BilingualText en={trend.en} el={trend.el} stacked wrap />
                </p>
              ) : null}
            </div>
          ) : caption ? (
            <p className={cn('page-stat-meta leading-snug text-muted-foreground', metaClassName)}>
              <BilingualText en={caption} el={captionEl} stacked wrap />
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block h-full min-w-0 w-full rounded-2xl focus-ring">
      {content}
    </Link>
  ) : (
    content
  );
}
