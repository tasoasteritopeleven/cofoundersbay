import { expect, it } from 'vitest';
import { groupAgenda } from './calendar-agenda';

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
