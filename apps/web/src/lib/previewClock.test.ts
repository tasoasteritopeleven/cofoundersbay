import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewClockOffsetMs, resolvePreviewApiNow, shiftPreviewDates } from './preview-api';

/**
 * The demo world keeps time with the reader's calendar.
 *
 * Its seed was written against 4 Sept 2026. Before this, a reader three weeks
 * later saw /events list "upcoming" events that the event page called ended.
 * What is asserted: the offset is whole weeks (weekdays and times survive);
 * shifting there and back is exact; "upcoming" is upcoming on the real clock;
 * and a date the reader enters comes back as they entered it.
 */

const WEEK = 7 * 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('the demo clock', () => {
  it('moves by whole weeks, and not at all before the seed day', () => {
    expect(previewClockOffsetMs(Date.parse('2026-09-01T00:00:00Z'))).toBe(0);
    expect(previewClockOffsetMs(Date.parse('2026-09-10T00:00:00Z'))).toBe(0);
    expect(previewClockOffsetMs(Date.parse('2026-09-25T12:00:00Z'))).toBe(3 * WEEK);
  });

  it('keeps the weekday and time of day of every shifted date', () => {
    const out = shiftPreviewDates({ at: '2026-09-11T16:00:00.000Z', day: '2026-09-11', label: 'Friday' }, 3 * WEEK);
    expect(out.at).toBe('2026-10-02T16:00:00.000Z');
    expect(new Date(out.at).getUTCDay()).toBe(new Date('2026-09-11T16:00:00.000Z').getUTCDay());
    expect(out.day).toBe('2026-10-02');
    expect(out.label).toBe('Friday');
  });

  it('round-trips exactly', () => {
    const payload = { events: [{ startAt: '2026-09-24T07:30:00.000Z', nested: { due: '2026-10-01' } }] };
    expect(shiftPreviewDates(shiftPreviewDates(payload, 5 * WEEK), -5 * WEEK)).toEqual(payload);
  });

  it('lists as upcoming only events that start after the reader’s now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T09:00:00Z'));
    const { events } = resolvePreviewApiNow('/api/events?scope=upcoming') as { events: Array<{ startAt: string }> };
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(Date.parse(e.startAt)).toBeGreaterThanOrEqual(Date.now());
    const { events: past } = resolvePreviewApiNow('/api/events?scope=past') as { events: Array<{ startAt: string }> };
    for (const e of past) expect(Date.parse(e.startAt)).toBeLessThan(Date.now());
  });

  it('gives back a date the reader entered as they entered it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T09:00:00Z'));
    const created = resolvePreviewApiNow('/api/milestones', {
      method: 'POST',
      body: JSON.stringify({ title: 'Ship v2', dueDate: '2026-11-03T17:00:00.000Z' }),
    }) as { id: string; dueDate: string; createdAt: string };
    expect(created.dueDate).toBe('2026-11-03T17:00:00.000Z');
    // Stamped "now" on the reader's calendar, not weeks ahead of it.
    expect(Math.abs(Date.parse(created.createdAt) - Date.now())).toBeLessThan(WEEK);
    const { milestones } = resolvePreviewApiNow('/api/milestones') as { milestones: Array<{ id: string; dueDate: string }> };
    expect(milestones.find((m) => m.id === created.id)?.dueDate).toBe('2026-11-03T17:00:00.000Z');
  });
});
