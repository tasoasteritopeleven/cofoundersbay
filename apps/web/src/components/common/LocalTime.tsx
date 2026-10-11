'use client';

import { useEffect, useState } from 'react';

/**
 * A clock time in the reader's own time zone, rendered safely under SSR.
 *
 * Dates elsewhere in the product are pinned to UTC (see `formatDate` in
 * lib/i18n/format.ts) because a date is a date whoever reads it. A *time* is
 * not: "14:32" only means anything in the reader's own zone, so it cannot be
 * pinned the same way — and `toLocaleTimeString` on the server (UTC) against
 * the browser (anything) is exactly the mismatch React refuses to hydrate.
 *
 * So this renders UTC on the server and during the first client render — the
 * two agree, hydration passes — then swaps to local time in an effect, which
 * React treats as an ordinary update. The slot is never empty, so there is no
 * layout shift and no blank first paint; only the digits change, within a frame
 * of hydration. `dateTime` carries the exact instant either way, which is what
 * a machine reader should be taking.
 */
export function LocalTime({
  value,
  className,
}: {
  value: string | number | Date | null | undefined;
  className?: string;
}) {
  const [local, setLocal] = useState(false);

  useEffect(() => {
    setLocal(true);
  }, []);

  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const text = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(local ? {} : { timeZone: 'UTC' }),
  });

  return (
    <time dateTime={date.toISOString()} className={className}>
      {text}
    </time>
  );
}

// "2 hours ago" used to live here as a second, single-purpose RelativeTime.
// It is now `@/components/common/RelativeTime`, which keeps the same
// hydration-stable two-pass shape and additionally lets a call site keep its
// own wording through a `format` prop. One name, one component.
