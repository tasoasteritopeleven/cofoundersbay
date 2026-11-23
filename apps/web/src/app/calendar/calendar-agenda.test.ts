import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { agendaDateLabel, groupAgenda, useAgendaClock } from './calendar-agenda';

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

it('groups the existing agenda by local day without displacing overdue follow-ups', () => {
  const overdue = { id: 'followup-1', date: '2026-10-24' };
  const today = { id: 'session-1', date: new Date(2026, 9, 25, 1, 30).toISOString() };
  const later = { id: 'milestone-1', date: '2026-10-26' };
  expect(groupAgenda([overdue, today, later], new Date(2026, 9, 25, 12))).toEqual({
    overdue: [overdue],
    today: [today],
    later: [later],
  });
});

it('keeps the previous local day’s follow-up overdue just after local midnight', () => {
  const yesterday = { id: 'followup-yesterday', date: '2026-10-24' };
  const today = { id: 'followup-today', date: '2026-10-25' };
  const session = { id: 'session-today', date: new Date(2026, 9, 25, 23).toISOString() };
  expect(groupAgenda([yesterday, today, session], new Date(2026, 9, 25, 0, 30))).toEqual({
    overdue: [yesterday],
    today: [today, session],
    later: [],
  });
  expect(agendaDateLabel(yesterday.date, false)).toBe('2026-10-24');
  expect(agendaDateLabel(session.date, true)).toBe('2026-10-25 23:00');
});
