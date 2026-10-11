import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from './preview-api';

type BoardList = { boards?: Array<{ id: string; isPinned?: boolean; isArchived?: boolean; nodeCount?: number; title?: string }> };
type BoardDetail = {
  board?: {
    id: string;
    isPinned?: boolean;
    isArchived?: boolean;
    nodes?: Array<{ id: string; boardId?: string; title?: string; content?: string | null }>;
  } | null;
};

describe('preview research boards', () => {
  it('keeps Harbor GTM aligned with Idea Core and the $750K seed', () => {
    const board = resolvePreviewApi('/api/research/boards/board-gtm') as BoardDetail;
    expect(board.board?.id).toBe('board-gtm');
    const metrics = board.board?.nodes?.find((n) => n.id === 'n-gtm-metrics')?.content ?? '';
    const problem = board.board?.nodes?.find((n) => n.id === 'n-gtm-problem')?.content ?? '';
    expect(metrics).toContain('$750K');
    expect(metrics).toContain('Athens Tech Angels');
    expect(problem).toContain('stitching matching, messaging, and fundraising');
  });

  it('replaces leftover generic GTM notes with Harbor copy on the next board GET', () => {
    resolvePreviewApi('/api/research/nodes/n-gtm-problem', {
      method: 'PATCH',
      body: JSON.stringify({
        content: '<p>Who experiences this, how painful is it, and how do they cope today?</p>',
      }),
    });
    const board = resolvePreviewApi('/api/research/boards/board-gtm') as BoardDetail;
    const problem = board.board?.nodes?.find((n) => n.id === 'n-gtm-problem')?.content ?? '';
    expect(problem).toContain('stitching matching, messaging, and fundraising');
    expect(problem).not.toContain('Who experiences this, how painful is it');
  });

  it('creates, pins, archives, and deletes a board without aliasing Harbor GTM', () => {
    const created = resolvePreviewApi('/api/research/boards', {
      method: 'POST',
      body: JSON.stringify({ title: 'Competitive map', description: 'Live preview board' }),
    }) as { board?: { id: string; title: string } };
    expect(created.board?.title).toBe('Competitive map');
    const boardId = created.board?.id;
    expect(boardId).toBeTruthy();

    const listed = resolvePreviewApi('/api/research/boards') as BoardList;
    expect(listed.boards?.some((b) => b.id === boardId)).toBe(true);
    expect(listed.boards?.some((b) => b.id === 'board-gtm')).toBe(true);

    const detail = resolvePreviewApi(`/api/research/boards/${boardId}`) as BoardDetail;
    expect(detail.board?.id).toBe(boardId);
    expect(detail.board?.nodes).toEqual([]);

    resolvePreviewApi(`/api/research/boards/${boardId}/nodes`, {
      method: 'POST',
      body: JSON.stringify({ type: 'note', title: 'Wedge', content: '<p>Harbor vs directories</p>' }),
    });
    const withNode = resolvePreviewApi(`/api/research/boards/${boardId}`) as BoardDetail;
    expect(withNode.board?.nodes?.some((n) => n.title === 'Wedge' && n.boardId === boardId)).toBe(true);
    const gtm = resolvePreviewApi('/api/research/boards/board-gtm') as BoardDetail;
    expect(gtm.board?.nodes?.some((n) => n.title === 'Wedge')).toBe(false);

    resolvePreviewApi(`/api/research/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPinned: true }),
    });
    const pinned = resolvePreviewApi('/api/research/boards') as BoardList;
    expect(pinned.boards?.find((b) => b.id === boardId)?.isPinned).toBe(true);

    resolvePreviewApi(`/api/research/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived: true }),
    });
    const active = resolvePreviewApi('/api/research/boards') as BoardList;
    const archived = resolvePreviewApi('/api/research/boards?archived=1') as BoardList;
    expect(active.boards?.some((b) => b.id === boardId)).toBe(false);
    expect(archived.boards?.find((b) => b.id === boardId)?.isArchived).toBe(true);

    resolvePreviewApi(`/api/research/boards/${boardId}`, { method: 'DELETE' });
    expect(resolvePreviewApi(`/api/research/boards/${boardId}`)).toEqual({ board: null });
    expect(resolvePreviewApi('/api/research/boards/__audit_missing__')).toEqual({ board: null });
  });
});
