import { useEffect, useState } from 'react';

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
  const today = calendarDayKey(now);
  const groups = { overdue: [] as T[], today: [] as T[], later: [] as T[] };
  for (const event of events) {
    const day = calendarDayKey(event.date);
    if (!day) continue;
    groups[day < today ? 'overdue' : day === today ? 'today' : 'later'].push(event);
  }
  return groups;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value: number) => String(value).padStart(2, '0');

export function calendarDate(iso: string) {
  return new Date(DATE_ONLY.test(iso) ? `${iso}T00:00:00` : iso);
}

export function calendarDayKey(value: Date | string): string {
  const date = typeof value === 'string' ? calendarDate(value) : value;
  if (!Number.isFinite(date.getTime())) return '';
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function eventsOnDay<T extends { date: string }>(events: readonly T[], day: Date): T[] {
  const key = calendarDayKey(day);
  return key ? events.filter((event) => calendarDayKey(event.date) === key) : [];
}

export function calendarTime(iso: string) {
  const date = calendarDate(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function agendaDateLabel(iso: string, timed: boolean) {
  const day = calendarDayKey(iso);
  return timed ? `${day} ${calendarTime(iso)}` : day;
}
