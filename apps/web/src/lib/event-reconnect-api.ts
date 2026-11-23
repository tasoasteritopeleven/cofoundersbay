import { apiRequest } from '@/lib/api';

type Person = { userId: string; displayName: string | null; avatarUrl: string | null };

export type AttendanceRow = Person & { attended: boolean; status: 'going' | 'interested' | 'not_going' };
export type ReconnectRow = Person & { interested: boolean; mutual: boolean };
export type EventAttendance = { opensAt: string; closesAt: string; editable: boolean; rows: AttendanceRow[] };
export type EventReconnect = {
  state: 'before_end' | 'not_confirmed' | 'open' | 'closed';
  closesAt: string;
  rows: ReconnectRow[];
};
export type AttendanceChange = { userId: string; attended: boolean } | { allGoing: true };

export function getEventAttendance(eventId: string) {
  return apiRequest<EventAttendance>(`/api/events/${encodeURIComponent(eventId)}/attendance`);
}

export function setEventAttendance(eventId: string, change: AttendanceChange) {
  return apiRequest<{ changed: number }>(`/api/events/${encodeURIComponent(eventId)}/attendance`, {
    method: 'PUT',
    body: JSON.stringify(change),
  });
}

export function getEventReconnect(eventId: string) {
  return apiRequest<EventReconnect>(`/api/events/${encodeURIComponent(eventId)}/reconnect`);
}

export function setEventReconnect(eventId: string, userId: string, interested: boolean) {
  return apiRequest<{ interested: boolean; mutual: boolean }>(`/api/events/${encodeURIComponent(eventId)}/reconnect/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ interested }),
  });
}
