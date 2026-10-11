import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { halfYearOf, parseHalfYear, previousHalfYear } from '@cofounderbay/shared';
import { TransparencyService } from './transparency.service';
import { CommitmentsService } from '../commitments/commitments.service';

describe('half years', () => {
  it('splits the year at July, in UTC', () => {
    expect(halfYearOf(Date.parse('2026-10-07T09:00:00Z'))).toEqual({ key: '2026-H2', from: '2026-07-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' });
    expect(halfYearOf(Date.parse('2026-06-30T23:59:59Z')).key).toBe('2026-H1');
    expect(parseHalfYear('2026-H1')?.to).toBe('2026-07-01T00:00:00.000Z');
    expect(parseHalfYear('2026-H3')).toBeNull();
    expect(parseHalfYear('1999-H1')).toBeNull();
    expect(previousHalfYear(parseHalfYear('2026-H1')!).key).toBe('2025-H2');
  });
});

function prisma(events: Array<{ kind: string; surface: string; _count: { _all: number } }>) {
  return {
    transparencyEvent: { create: vi.fn(async () => ({})), groupBy: vi.fn(async () => events) },
    report: { count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (where.status === 'resolved' ? 4 : where.status === 'dismissed' ? 2 : 'createdAt' in where && !('status' in where) ? 9 : 3)) },
    userBlock: { count: vi.fn(async () => 5) },
  };
}

describe('the transparency report', () => {
  const now = new Date('2026-10-07T09:00:00Z');

  it('adds up refusals by kind and surface, and counts reports and blocks for the period', async () => {
    const db = prisma([
      { kind: 'contact_refused', surface: 'conversation', _count: { _all: 12 } },
      { kind: 'contact_refused', surface: 'interest', _count: { _all: 3 } },
      { kind: 'promise_refused', surface: 'need_card', _count: { _all: 2 } },
      { kind: 'made_up', surface: 'conversation', _count: { _all: 99 } },
    ]);
    const report = await new TransparencyService(db as never).report(undefined, now);
    expect(report.period.key).toBe('2026-H2');
    expect(report.inProgress).toBe(true);
    expect(report.refusals.contact_refused).toEqual({ total: 15, bySurface: { conversation: 12, interest: 3 } });
    expect(report.refusals.promise_refused).toEqual({ total: 2, bySurface: { need_card: 2 } });
    expect(report.reports).toEqual({ received: 9, resolved: 4, dismissed: 2, open: 3 });
    expect(report.blocks).toBe(5);
    expect(db.transparencyEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { createdAt: { gte: new Date('2026-07-01T00:00:00Z'), lt: new Date('2027-01-01T00:00:00Z') } } }));
  });

  it('refuses a malformed or future period, and answers a past one as finished', async () => {
    const service = new TransparencyService(prisma([]) as never);
    await expect(service.report('next-year', now)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.report('2027-H1', now)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.report('2026-H1', now)).inProgress).toBe(false);
  });

  it('still reports when the events table does not exist yet', async () => {
    const db = prisma([]);
    db.transparencyEvent.groupBy.mockRejectedValue(new Error('relation does not exist'));
    const report = await new TransparencyService(db as never).report('2026-H1', now);
    expect(report.refusals.contact_refused.total).toBe(0);
  });

  it('stores a refusal as kind and surface only, and never fails the request it describes', async () => {
    const db = prisma([]);
    db.transparencyEvent.create.mockRejectedValue(new Error('no table'));
    const service = new TransparencyService(db as never);
    expect(() => service.record('contact_refused', 'conversation')).not.toThrow();
    expect(db.transparencyEvent.create).toHaveBeenCalledWith({ data: { kind: 'contact_refused', surface: 'conversation' } });
  });

  it('is told about a refused note of interest by the commitments rules', async () => {
    const record = vi.fn();
    const card = { id: 'c1', ownerId: 'elena', status: 'open', kind: 'cofounder', version: 1, owner: { id: 'elena' } };
    const commitments = new CommitmentsService(
      { commitmentCard: { findUnique: vi.fn(async () => card) } } as never,
      {} as never,
      { isVerified: async () => true, publicMethods: async () => [], roleCleared: async () => true } as never,
      { record } as never,
    );
    await expect(commitments.expressInterest({ id: 'marcus' }, 'c1', { note: 'Call me on 6912345678' })).rejects.toBeInstanceOf(BadRequestException);
    expect(record).toHaveBeenCalledWith('contact_refused', 'interest');
    await expect(commitments.expressInterest({ id: 'marcus' }, 'c1', { note: 'A guaranteed return of 30%' })).rejects.toBeInstanceOf(BadRequestException);
    expect(record).toHaveBeenCalledWith('promise_refused', 'interest');
  });
});
