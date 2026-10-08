import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { readSaveRequest, SAVED_ITEMS_LIMIT } from '@cofounderbay/shared';
import { SavedItemsService } from './saved-items.service';

function setup() {
  const rows: Array<{ userId: string; kind: string; itemId: string; title: string; createdAt: Date }> = [];
  const prisma = {
    opportunity: { findUnique: vi.fn(async ({ where }: any) => (where.id === 'opp-1' ? { title: 'Pre-seed bootcamp' } : null)) },
    jobPosting: { findUnique: vi.fn(async ({ where }: any) => (where.id === 'job-1' ? { title: 'Founding engineer' } : null)) },
    savedItem: {
      findMany: vi.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId && (!where.kind || r.kind === where.kind)).reverse()),
      findUnique: vi.fn(async ({ where }: any) => {
        const k = where.userId_kind_itemId;
        return rows.find((r) => r.userId === k.userId && r.kind === k.kind && r.itemId === k.itemId) ?? null;
      }),
      count: vi.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId).length),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: new Date('2026-10-08T10:00:00Z') };
        rows.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          if (r.userId === where.userId && r.kind === where.kind && r.itemId === where.itemId) rows.splice(i, 1);
        }
        return { count: 1 };
      }),
    },
  };
  return { service: new SavedItemsService(prisma as never), prisma, rows };
}

describe('saved items', () => {
  it('reads a save request only with a known kind and an id', () => {
    expect(readSaveRequest({ kind: 'job', itemId: ' job-1 ' })).toEqual({ kind: 'job', itemId: 'job-1' });
    expect(readSaveRequest({ kind: 'profile', itemId: 'x' })).toBeNull();
    expect(readSaveRequest({ kind: 'job' })).toBeNull();
    expect(readSaveRequest(null)).toBeNull();
  });

  it('saves only what exists, copies the title from the source, and is idempotent', async () => {
    const { service, prisma } = setup();
    const first = await service.save('u1', { kind: 'opportunity', itemId: 'opp-1', title: 'Injected title' });
    expect(first.item).toMatchObject({ kind: 'opportunity', itemId: 'opp-1', title: 'Pre-seed bootcamp' });
    await service.save('u1', { kind: 'opportunity', itemId: 'opp-1' });
    expect(prisma.savedItem.create).toHaveBeenCalledTimes(1);
    await expect(service.save('u1', { kind: 'job', itemId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.save('u1', { kind: 'nope', itemId: 'opp-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only the reader’s own rows, by kind, and removes exactly one', async () => {
    const { service } = setup();
    await service.save('u1', { kind: 'opportunity', itemId: 'opp-1' });
    await service.save('u1', { kind: 'job', itemId: 'job-1' });
    await service.save('u2', { kind: 'job', itemId: 'job-1' });
    expect((await service.list('u1')).items.map((i) => i.itemId)).toEqual(['job-1', 'opp-1']);
    expect((await service.list('u1', 'job')).items.map((i) => i.itemId)).toEqual(['job-1']);
    await expect(service.list('u1', 'profile')).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.remove('u1', 'job', 'job-1')).toEqual({ saved: false });
    expect((await service.list('u1')).items.map((i) => i.itemId)).toEqual(['opp-1']);
    expect((await service.list('u2')).items.map((i) => i.itemId)).toEqual(['job-1']);
  });

  it('caps the rows a member keeps', async () => {
    const { service, rows } = setup();
    for (let i = 0; i < SAVED_ITEMS_LIMIT; i++) rows.push({ userId: 'u1', kind: 'job', itemId: `j${i}`, title: 't', createdAt: new Date() });
    await expect(service.save('u1', { kind: 'opportunity', itemId: 'opp-1' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
