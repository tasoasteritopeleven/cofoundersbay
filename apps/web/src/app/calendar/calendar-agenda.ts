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
  const todayKey = now.toISOString().slice(0, 10);
  const groups = { overdue: [] as T[], today: [] as T[], later: [] as T[] };
  for (const event of events) {
    const date = new Date(event.date);
    if (!Number.isFinite(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    groups[key < todayKey ? 'overdue' : key === todayKey ? 'today' : 'later'].push(event);
  }
  return groups;
}
