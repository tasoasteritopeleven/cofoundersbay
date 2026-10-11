import type { MentorBookingItem, MentorshipRelationshipItem, MentorshipSessionItem } from '@/lib/api';

export type UnifiedSessionStatus = 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/**
 * One session row across the two stores that both mean "a session between a
 * founder and a mentor": a MentorBooking made on /mentoring, and a
 * MentorshipSession inside a MentorshipRelationship. Pages merge both through
 * these adapters so neither side of a real session is invisible to the other.
 */
export type UnifiedSession = {
  key: string; // `booking:${id}` | `session:${id}`
  source: 'booking' | 'mentorship';
  id: string;
  startAt: string; // ISO
  endAt: string | null; // booking.endAt, or scheduledAt + duration min
  durationMin: number | null;
  title: string | null;
  meetingType: 'video' | 'in_person' | 'chat' | null;
  meetingUrl: string | null;
  status: UnifiedSessionStatus;
  mentorId: string;
  menteeId: string;
  /** The other person, relative to viewerId. */
  counterpart: { id: string; displayName: string; avatarUrl: string | null; headline: string | null };
  booking?: MentorBookingItem;
  session?: MentorshipSessionItem;
  relationship?: MentorshipRelationshipItem;
};

function pickCounterpart(
  mentorId: string,
  menteeId: string,
  mentor: { id: string; displayName: string; avatarUrl: string | null; headline?: string | null } | undefined,
  mentee: { id: string; displayName: string; avatarUrl: string | null; headline?: string | null } | undefined,
  viewerId: string | null,
): UnifiedSession['counterpart'] {
  const other = viewerId && viewerId === mentorId ? mentee : mentor;
  return {
    id: other?.id ?? (viewerId === mentorId ? menteeId : mentorId),
    displayName: other?.displayName ?? '—',
    avatarUrl: other?.avatarUrl ?? null,
    headline: other?.headline ?? null,
  };
}

export function fromBooking(b: MentorBookingItem, viewerId: string | null): UnifiedSession {
  return {
    key: `booking:${b.id}`,
    source: 'booking',
    id: b.id,
    startAt: b.startAt,
    endAt: b.endAt ?? null,
    durationMin:
      b.startAt && b.endAt
        ? Math.max(0, Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000))
        : null,
    title: null,
    meetingType: b.meetingType ?? null,
    meetingUrl: b.meetingUrl ?? null,
    status: b.status,
    mentorId: b.mentorId,
    menteeId: b.menteeId,
    counterpart: pickCounterpart(b.mentorId, b.menteeId, b.mentor, b.mentee, viewerId),
    booking: b,
  };
}

export function fromMentorshipSession(
  s: MentorshipSessionItem,
  rel: MentorshipRelationshipItem,
  viewerId: string | null,
): UnifiedSession {
  const start = new Date(s.scheduledAt).getTime();
  return {
    key: `session:${s.id}`,
    source: 'mentorship',
    id: s.id,
    startAt: s.scheduledAt,
    endAt: Number.isNaN(start) || s.duration == null ? null : new Date(start + s.duration * 60000).toISOString(),
    durationMin: s.duration ?? null,
    title: s.title ?? null,
    meetingType: s.meetingType ?? null,
    meetingUrl: s.meetingUrl ?? null,
    status: s.status,
    mentorId: rel.mentorId,
    menteeId: rel.menteeId,
    counterpart: pickCounterpart(rel.mentorId, rel.menteeId, rel.mentor, rel.mentee, viewerId),
    session: s,
    relationship: rel,
  };
}

export const isUpcoming = (u: UnifiedSession): boolean =>
  u.status === 'requested' || u.status === 'scheduled' || u.status === 'confirmed';

/**
 * Dedupe by key (the same booking or session can arrive from two queries),
 * then order upcoming sessions soonest first and past sessions latest first.
 */
export function mergeSessions(items: UnifiedSession[]): UnifiedSession[] {
  const byKey = new Map<string, UnifiedSession>();
  for (const item of items) {
    if (!byKey.has(item.key)) byKey.set(item.key, item);
  }
  const all = [...byKey.values()];
  const upcoming = all.filter(isUpcoming).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = all.filter((u) => !isUpcoming(u)).sort((a, b) => b.startAt.localeCompare(a.startAt));
  return [...upcoming, ...past];
}
