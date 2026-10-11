'use client';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

/**
 * The date tile every session row opens with: month over day, one anatomy for
 * bookings and mentorship sessions alike. It is the card's mark (where a
 * person's card has an avatar): 2.5rem like an avatar, so the title beside
 * it keeps the card's title step and the day (text-sm) never outranks it.
 */
export function SessionDateTile({ date }: { date: Date }) {
  const fmtDate = useDateFormat();
  return (
    <div data-card-mark="" className="flex h-10 w-10 flex-col items-center justify-center self-start rounded-xl bg-primary/5 leading-none">
      <span className="text-2xs uppercase text-muted-foreground">
        {fmtDate(date, { month: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-bold tabular-nums">{date.getUTCDate()}</span>
    </div>
  );
}
