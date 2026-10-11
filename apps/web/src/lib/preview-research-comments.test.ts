import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from './preview-api';

describe('preview research canvas', () => {
  it('returns an empty comments array instead of the generic fallback', () => {
    const res = resolvePreviewApi('/api/research/nodes/n-gtm-problem/comments') as {
      comments?: unknown;
    };
    expect(Array.isArray(res.comments)).toBe(true);
    expect(res.comments).toEqual([]);
  });

  it('persists inspector fills on the same board GET that the canvas reads', () => {
    const patched = resolvePreviewApi('/api/research/nodes/n-gtm-problem', {
      method: 'PATCH',
      body: JSON.stringify({ color: '#EDE9FE', metadata: { fillColor: '#EDE9FE' } }),
    }) as { node?: { color?: string; metadata?: { fillColor?: string } } };
    expect(patched.node?.color).toBe('#EDE9FE');
    expect(patched.node?.metadata?.fillColor).toBe('#EDE9FE');
    const board = resolvePreviewApi('/api/research/boards/board-gtm') as {
      board?: { nodes?: Array<{ id: string; color?: string }> };
    };
    expect(board.board?.nodes?.find((n) => n.id === 'n-gtm-problem')?.color).toBe('#EDE9FE');
  });
});
