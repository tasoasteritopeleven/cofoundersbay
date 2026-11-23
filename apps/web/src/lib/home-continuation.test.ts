import { describe, expect, it } from 'vitest';
import { homeContinuation, matchesContinuation } from './home-continuation';

const board = { id: 'board-one', title: 'Research', updatedAt: '2026-02-02', isArchived: false };
const step = { id: 'step-one', title: 'Validate', dueDate: '2026-02-02', status: 'todo' as const };

describe('homeContinuation', () => {
  it('opens the latest available board rather than an archived board or a milestone', () => {
    const result = homeContinuation(
      { rows: [board, { ...board, id: 'older', updatedAt: '2026-01-01' }, { ...board, updatedAt: '2026-03-01', isArchived: true }] },
      { rows: [step] },
    );
    expect(result.target).toMatchObject({ kind: 'board', id: board.id, href: '/research/board-one' });
    expect(result.target?.ask.en).toContain(board.title);
  });

  it('keeps a readable milestone when boards failed without calling boards empty', () => {
    const result = homeContinuation({ failed: true }, { rows: [step, { ...step, status: 'completed' }] });
    expect(result).toMatchObject({ boardsFailed: true, milestonesFailed: false, target: { kind: 'milestone', id: step.id } });
  });

  it('does not fall through while the preferred read is still pending', () => {
    expect(homeContinuation({ busy: true }, { rows: [step] })).toMatchObject({ target: undefined, pending: true });
  });

  it('distinguishes a genuine empty result from an unread response', () => {
    const done = [{ ...step, status: 'completed' as const }, { ...step, status: 'cancelled' as const }];
    expect(homeContinuation({ rows: [] }, { rows: done })).toMatchObject({
      target: undefined, boardsFailed: false, milestonesFailed: false, pending: false,
    });
    expect(homeContinuation({}, { failed: true })).toMatchObject({
      target: undefined, boardsFailed: true, milestonesFailed: true, pending: false,
    });
  });

  it('merges only the same milestone and route, not an aggregate or a different item', () => {
    const { target } = homeContinuation({ rows: [] }, { rows: [step] });
    expect(matchesContinuation(target, { key: 'milestone', href: '/milestones' })).toBe(false);
    expect(matchesContinuation(target, { key: 'milestone', href: '/milestones', entityId: 'other' })).toBe(false);
    expect(matchesContinuation(target, { key: 'milestone', href: '/milestones', entityId: step.id })).toBe(true);
  });
});
