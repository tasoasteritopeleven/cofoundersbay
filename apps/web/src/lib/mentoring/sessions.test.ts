import { describe, expect, it } from 'vitest';
import type { MentorBookingItem, MentorshipRelationshipItem, MentorshipSessionItem } from '@/lib/api';
import { fromBooking, fromMentorshipSession, isUpcoming, mergeSessions } from './sessions';

const booking = (over: Partial<MentorBookingItem> = {}): MentorBookingItem => ({
  id: 'b1',
  mentorId: 'mentor-1',
  menteeId: 'mentee-1',
  startAt: '2026-10-10T10:00:00.000Z',
  endAt: '2026-10-10T11:00:00.000Z',
  timezone: 'Europe/Athens',
  meetingType: 'video',
  meetingUrl: 'https://meet.example.com/x',
  notes: null,
  status: 'requested',
  priceCents: null,
  currency: null,
  mentor: { id: 'mentor-1', displayName: 'Mentor One', avatarUrl: null },
  mentee: { id: 'mentee-1', displayName: 'Mentee One', avatarUrl: null },
  ...over,
});

const relationship = (over: Partial<MentorshipRelationshipItem> = {}): MentorshipRelationshipItem => ({
  id: 'rel-1',
  mentorId: 'mentor-1',
  menteeId: 'mentee-1',
  status: 'active',
  goals: null,
  focusAreas: [],
  startedAt: '2026-07-01T00:00:00.000Z',
  completedAt: null,
  nextSessionAt: null,
  totalSessions: 2,
  mentor: { id: 'mentor-1', displayName: 'Mentor One', headline: 'Former product lead', avatarUrl: null },
  mentee: { id: 'mentee-1', displayName: 'Mentee One', headline: 'Founder', avatarUrl: null, role: 'founder' },
  ...over,
});

const session = (over: Partial<MentorshipSessionItem> = {}): MentorshipSessionItem => ({
  id: 's1',
  relationshipId: 'rel-1',
  title: 'Roadmap review',
  description: null,
  scheduledAt: '2026-10-10T10:00:00.000Z',
  duration: 45,
  timezone: 'Europe/Athens',
  meetingType: 'video',
  meetingUrl: null,
  meetingLocation: null,
  status: 'scheduled',
  agenda: null,
  mentorNotes: null,
  menteeNotes: null,
  actionItems: null,
  mentorRating: null,
  menteeRating: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('fromBooking', () => {
  it('names the mentee as the counterpart for the mentor viewer', () => {
    const u = fromBooking(booking(), 'mentor-1');
    expect(u.key).toBe('booking:b1');
    expect(u.source).toBe('booking');
    expect(u.counterpart.id).toBe('mentee-1');
    expect(u.counterpart.displayName).toBe('Mentee One');
    expect(u.durationMin).toBe(60);
    expect(u.status).toBe('requested');
  });

  it('names the mentor as the counterpart for the mentee viewer (and for an unknown viewer)', () => {
    expect(fromBooking(booking(), 'mentee-1').counterpart.id).toBe('mentor-1');
    expect(fromBooking(booking(), null).counterpart.id).toBe('mentor-1');
    expect(fromBooking(booking(), 'someone-else').counterpart.id).toBe('mentor-1');
  });
});

describe('fromMentorshipSession', () => {
  it('derives endAt from scheduledAt + duration minutes', () => {
    const u = fromMentorshipSession(session(), relationship(), 'mentor-1');
    expect(u.key).toBe('session:s1');
    expect(u.endAt).toBe('2026-10-10T10:45:00.000Z');
    expect(u.durationMin).toBe(45);
    expect(u.title).toBe('Roadmap review');
    expect(u.counterpart.id).toBe('mentee-1');
  });

  it('carries the relationship so callers keep mentor/mentee context', () => {
    const u = fromMentorshipSession(session(), relationship(), 'mentee-1');
    expect(u.relationship?.id).toBe('rel-1');
    expect(u.counterpart.displayName).toBe('Mentor One');
  });
});

describe('isUpcoming', () => {
  it.each([
    ['requested', true],
    ['scheduled', true],
    ['confirmed', true],
    ['completed', false],
    ['cancelled', false],
    ['no_show', false],
  ] as const)('returns %s → %s', (status, expected) => {
    const base = fromBooking(booking(), 'mentor-1');
    expect(isUpcoming({ ...base, status })).toBe(expected);
  });
});

describe('mergeSessions', () => {
  it('dedupes by key and orders upcoming asc, then past desc', () => {
    const rel = relationship();
    const items = [
      fromBooking(booking({ id: 'p1', status: 'completed', startAt: '2026-09-01T10:00:00.000Z' }), null),
      fromMentorshipSession(session({ id: 'u1', scheduledAt: '2026-10-20T10:00:00.000Z' }), rel, null),
      fromBooking(booking({ id: 'u2', status: 'confirmed', startAt: '2026-10-15T10:00:00.000Z' }), null),
      // Same booking arriving twice (two queries) collapses to one row.
      fromBooking(booking({ id: 'u2', status: 'confirmed', startAt: '2026-10-15T10:00:00.000Z' }), null),
      fromMentorshipSession(session({ id: 'p2', status: 'cancelled', scheduledAt: '2026-09-10T10:00:00.000Z' }), rel, null),
    ];
    const merged = mergeSessions(items);
    expect(merged.map((u) => u.id)).toEqual(['u2', 'u1', 'p2', 'p1']);
  });
});
