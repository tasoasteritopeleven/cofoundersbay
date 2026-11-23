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
