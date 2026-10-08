'use client';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

/**
 * The date tile every session row opens with: month over day, one anatomy for
 * bookings and mentorship sessions alike.
 */
export function SessionDateTile({ date }: { date: Date }) {
  const fmtDate = useDateFormat();
  return (
    <div className="flex w-14 min-w-[3.5rem] flex-col items-center justify-center self-start rounded-lg bg-primary/5 p-2">
      <span className="text-xs uppercase text-muted-foreground">
        {fmtDate(date, { month: 'short' })}
      </span>
      <span className="text-xl font-bold">{date.getUTCDate()}</span>
    </div>
  );
}
