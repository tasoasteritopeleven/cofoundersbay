import type { Milestone, ResearchBoard } from '@/lib/api';
import { PREVIEW_MILESTONE_EL } from '@/lib/i18n/strings-milestones';
import { orderMilestones } from '@/lib/milestone-order';

type Board = Pick<ResearchBoard, 'id' | 'title' | 'updatedAt' | 'isArchived'>;
type Step = Pick<Milestone, 'id' | 'title' | 'status' | 'dueDate'>;
type Source<T> = { rows?: readonly T[]; failed?: boolean; busy?: boolean };
export type ContinuationTarget = {
  kind: 'board' | 'milestone';
  id: string;
  href: string;
  en: string;
  el: string;
  ask: { en: string; el: string };
};

export function matchesContinuation(target: ContinuationTarget | undefined, notice: { key: string; entityId?: string; href: string }): boolean {
  return target !== undefined && notice.key === target.kind && notice.entityId === target.id && notice.href === target.href;
}

export function homeContinuation(boards: Source<Board>, milestones: Source<Step>) {
  const board = [...(boards.rows ?? [])]
    .filter((item) => item?.id && item.title && item.isArchived === false)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  const boardsFailed = Boolean(boards.failed || (!boards.busy && !boards.rows));
  const waitingForBoards = !boards.rows && !boardsFailed;
  const milestone = !board && !waitingForBoards
    ? orderMilestones((milestones.rows ?? []).filter((m) => m?.id && m.title && ['todo', 'in_progress', 'blocked'].includes(m.status)))[0]
    : undefined;
  const milestonesFailed = !board && !waitingForBoards && Boolean(milestones.failed || (!milestones.busy && !milestones.rows));
  let target: ContinuationTarget | undefined;
  if (board) {
    target = {
      kind: 'board', id: board.id, href: `/research/${encodeURIComponent(board.id)}`, en: board.title, el: board.title,
      ask: { en: `What should I do next on the board “${board.title}”?`, el: `Τι να κάνω στη συνέχεια στον πίνακα «${board.title}»;` },
    };
  } else if (milestone) {
    const el = PREVIEW_MILESTONE_EL[milestone.title]?.title ?? milestone.title;
    target = {
      kind: 'milestone', id: milestone.id, href: '/milestones', en: milestone.title, el,
      ask: { en: `What is left on the milestone “${milestone.title}”?`, el: `Τι απομένει στο ορόσημο «${el}»;` },
    };
  }
  return {
    target,
    boardsFailed,
    milestonesFailed,
    pending: !target && (waitingForBoards || (!milestones.rows && !milestonesFailed)),
  };
}
