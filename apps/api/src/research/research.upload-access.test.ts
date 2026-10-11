import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ResearchService } from './research.service';

describe('research upload attachment authorization', () => {
  it('rejects an upload that is not a research asset owned by the acting user', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const aggregate = vi.fn();
    const service = new ResearchService({
      upload: { findFirst },
      researchNode: { aggregate },
    } as never);
    vi.spyOn(service as any, 'assertBoardAccess').mockResolvedValue(undefined);

    await expect(service.createNode('user-1', 'board-1', {
      type: 'document',
      uploadId: 'upload-from-another-user',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'upload-from-another-user', userId: 'user-1', kind: 'research_asset' },
      select: { id: true },
    });
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('does not perform an upload lookup for content-only nodes', async () => {
    const findFirst = vi.fn();
    const now = new Date('2026-09-25T12:00:00Z');
    const create = vi.fn().mockResolvedValue({
      id: 'node-1', boardId: 'board-1', type: 'note', title: null, content: 'Evidence',
      url: null, uploadId: null, upload: null, posX: 0, posY: 0, width: 280,
      height: 200, zIndex: 1, color: null, collapsed: false, locked: false,
      refEntityType: null, refEntityId: null, metadata: null, tags: [],
      createdAt: now, updatedAt: now,
    });
    const service = new ResearchService({
      upload: { findFirst },
      researchNode: { aggregate: vi.fn().mockResolvedValue({ _max: { zIndex: null } }), create },
    } as never);
    vi.spyOn(service as any, 'assertBoardAccess').mockResolvedValue(undefined);

    await expect(service.createNode('user-1', 'board-1', { type: 'note', content: 'Evidence' }))
      .resolves.toMatchObject({ id: 'node-1', content: 'Evidence' });
    expect(findFirst).not.toHaveBeenCalled();
  });
});
