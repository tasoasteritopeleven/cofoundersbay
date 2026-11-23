import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { groupAgenda, useAgendaClock } from './calendar-agenda';

it('stamps the clock after mount and refreshes at midnight and when returning', () => {
  vi.useFakeTimers();
  const first = new Date(2026, 9, 24, 23, 59, 59);
  vi.setSystemTime(first);
  const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { result, unmount } = renderHook(() => useAgendaClock());
  try {
    expect(result.current).toEqual(first);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toEqual(new Date(2026, 9, 25));
    vi.setSystemTime(new Date(2026, 9, 27, 12));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toEqual(new Date(2026, 9, 27, 12));
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    act(() => window.dispatchEvent(new Event('pageshow')));
    expect(result.current).toEqual(new Date(2026, 9, 29, 12));
  } finally {
    unmount();
    visible.mockRestore();
    vi.useRealTimers();
  }
});

it('groups the existing agenda by UTC day without displacing overdue follow-ups', () => {
  const overdue = { id: 'followup-1', date: '2026-10-24T23:59:00Z' };
  const today = { id: 'session-1', date: '2026-10-25T01:30:00+01:00' };
  const later = { id: 'milestone-1', date: '2026-10-26' };
  expect(groupAgenda([overdue, today, later], new Date('2026-10-25T12:00:00Z'))).toEqual({
    overdue: [overdue],
    today: [today],
    later: [later],
  });
});
