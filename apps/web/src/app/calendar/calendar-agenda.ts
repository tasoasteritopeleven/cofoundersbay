import { useEffect, useState } from 'react';
import { calendarDaysUntil } from '@/lib/calendar-days';

export function useAgendaClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      const current = new Date();
      setNow(current);
      const nextDay = new Date(current);
      nextDay.setHours(24, 0, 0, 0);
      timer = window.setTimeout(refresh, nextDay.getTime() - current.getTime());
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);
  return now;
}

export function groupAgenda<T extends { date: string }>(events: readonly T[], now: Date) {
  const groups = { overdue: [] as T[], today: [] as T[], later: [] as T[] };
  for (const event of events) {
    const offset = calendarDaysUntil(event.date, now);
    if (offset === null) continue;
    groups[offset < 0 ? 'overdue' : offset === 0 ? 'today' : 'later'].push(event);
  }
  return groups;
}

export function agendaLocalDate(iso: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}

export function agendaDateLabel(iso: string, timed: boolean) {
  const date = agendaLocalDate(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return timed ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}
