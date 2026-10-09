import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Facts about a card's subject - stage, place, sector, level, topics,
 * cheque size - as one muted line, dot-separated.
 *
 * A pill is kept for a state (status, outcome, "actively scouting") or a
 * control. Facts set as pills read as buttons, add a tint each, and are one
 * more level to rank: on 2026-10-09 a phone met up to eight of them on one
 * investor card (`.probes/card_type.mjs`).
 */
export function FactLine({
  items,
  label,
  className,
}: {
  items: ReactNode[];
  /** Names the list for a screen reader when the facts are not self-evident. */
  label?: string;
  className?: string;
}) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== '');
  if (!shown.length) return null;
  return (
    <ul aria-label={label} className={cn('facts-dotted flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground', className)}>
      {shown.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
