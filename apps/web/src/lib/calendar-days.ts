export function restoreDateOnly(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?Z$/.test(value) ? value.slice(0, 10) : value;
}

/**
 * Whole calendar days from today to a date, in the reader's time zone: 0 on
 * the day itself, 1 on the day before, negative once the day has passed.
 *
 * Five places counted milliseconds and rounded up (`Math.ceil`), which
 * answers another question: a deadline at 17:00 read "1 day left" on its own
 * morning, "Today!" only once it had passed (an opportunity closing today
 * read "Expired"), and a round closing on 26 November read "37 days" on 21
 * October. A date written without a time ("2026-11-11") is that day where
 * the reader is, not midnight in London.
 */
export function calendarDaysUntil(date: string | number | Date | null | undefined, now: number | Date = Date.now()): number | null {
  if (date === null || date === undefined || date === '') return null;
  let target: Date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    target = new Date(y, m - 1, d);
  } else {
    target = new Date(date);
  }
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now);
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}
