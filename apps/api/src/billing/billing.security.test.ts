import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing.service';

function makeService(prisma: Record<string, any>) {
  return new BillingService(
    prisma as never,
    { get: vi.fn() } as never,
    {} as never,
  );
}

describe('tenant billing authorization', () => {
  it('rejects unrelated and ordinary tenant members before reading billing data', async () => {
    const subscription = { findFirst: vi.fn() };
    const tenantMembership = { findUnique: vi.fn().mockResolvedValue({ role: 'member', isActive: true }) };
    const service = makeService({ subscription, tenantMembership });

    await expect(service.getTenantSubscriptionFor({ id: 'user-1', role: 'founder' }, 'tenant-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(subscription.findFirst).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'])('allows an active tenant %s', async (role) => {
    const subscription = { findFirst: vi.fn().mockResolvedValue({ id: 'subscription-1' }) };
    const tenantMembership = { findUnique: vi.fn().mockResolvedValue({ role, isActive: true }) };
    const service = makeService({ subscription, tenantMembership });

    await expect(service.getTenantSubscriptionFor({ id: 'user-1', role: 'founder' }, 'tenant-1'))
      .resolves.toEqual({ subscription: { id: 'subscription-1' } });
  });

  it('keeps platform administrators operational but still rejects a non-member seat target', async () => {
    const subscription = { findFirst: vi.fn() };
    const tenantMembership = { findUnique: vi.fn().mockResolvedValue(null) };
    const service = makeService({ subscription, tenantMembership });

    await expect(service.allocateTenantSeatFor({ id: 'platform-admin', role: 'admin' }, 'tenant-1', 'outsider'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(subscription.findFirst).not.toHaveBeenCalled();
  });
});

describe('seat state transitions', () => {
  function statefulSeatService() {
    let allocation: Record<string, any> | null = null;
    let activeSeatCount = 99;
    const subscription = {
      findUnique: vi.fn().mockResolvedValue({ id: 'subscription-1', tenantId: 'tenant-1', seatLimit: 3 }),
      update: vi.fn(async ({ data }: any) => {
        activeSeatCount = data.activeSeatCount;
        return { activeSeatCount };
      }),
    };
    const seatAllocation = {
      findUnique: vi.fn(async () => allocation),
      count: vi.fn(async () => allocation?.isActive ? 1 : 0),
      upsert: vi.fn(async ({ create, update }: any) => {
        allocation = allocation ? { ...allocation, ...update } : { id: 'seat-1', ...create };
        return allocation;
      }),
      update: vi.fn(async ({ data }: any) => {
        allocation = { ...allocation, ...data };
        return allocation;
      }),
    };
    const prisma: Record<string, any> = { subscription, seatAllocation };
    prisma.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));
    return { service: makeService(prisma), seatAllocation, subscription, count: () => activeSeatCount };
  }

  it('allocates the same user twice without consuming two seats and reconciles drift', async () => {
    const { service, seatAllocation, count } = statefulSeatService();
    await service.allocateSeat('subscription-1', 'member-1', 'admin-1');
    await service.allocateSeat('subscription-1', 'member-1', 'admin-1');
    expect(seatAllocation.upsert).toHaveBeenCalledTimes(1);
    expect(count()).toBe(2); // one included owner seat + one allocation
  });

  it('makes repeated revocation idempotent and never decrements below the included seat', async () => {
    const { service, seatAllocation, count } = statefulSeatService();
    await service.allocateSeat('subscription-1', 'member-1', 'admin-1');
    await service.revokeSeat('subscription-1', 'member-1');
    await service.revokeSeat('subscription-1', 'member-1');
    expect(seatAllocation.update).toHaveBeenCalledTimes(1);
    expect(count()).toBe(1);
  });
});

describe('billing contact allowlist', () => {
  it('does not forward identifiers or timestamps even when called outside ValidationPipe', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'contact-1' });
    const service = makeService({ billingContact: { upsert } });
    await service.upsertBillingContact('subscription-1', {
      name: 'Ada', email: 'ada@example.com', subscriptionId: 'attacker-value', id: 'attacker-id',
    } as never);
    expect(upsert).toHaveBeenCalledWith({
      where: { subscriptionId: 'subscription-1' },
      create: { subscriptionId: 'subscription-1', name: 'Ada', email: 'ada@example.com' },
      update: { name: 'Ada', email: 'ada@example.com' },
    });
  });
});
