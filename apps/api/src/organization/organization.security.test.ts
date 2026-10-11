import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationService } from './organization.service';

function makeService(prisma: Record<string, any>) {
  return new OrganizationService(prisma as never);
}

function transactionalPrisma(membershipOverrides: Record<string, any> = {}) {
  const organizationMembership = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    ...membershipOverrides,
  };
  const prisma: Record<string, any> = {
    organizationMembership,
    organization: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  return { prisma, organizationMembership, service: makeService(prisma) };
}

describe('organization read boundaries', () => {
  it('returns only a public projection to an authenticated non-member', async () => {
    const publicOrganization = { id: 'org-1', name: 'Public org' };
    const organization = {
      findFirst: vi.fn().mockResolvedValue(publicOrganization),
      findUnique: vi.fn(),
    };
    const organizationMembership = { findUnique: vi.fn().mockResolvedValue(null) };
    const service = makeService({ organization, organizationMembership });

    await expect(service.findById('org-1', 'outsider')).resolves.toEqual(publicOrganization);
    const query = organization.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'org-1', isActive: true });
    expect(query.select).not.toHaveProperty('email');
    expect(query.select).not.toHaveProperty('phone');
    expect(query.select).not.toHaveProperty('address');
    expect(query.select).not.toHaveProperty('settings');
    expect(query.select).not.toHaveProperty('memberships');
    expect(query.select).not.toHaveProperty('createdById');
  });

  it('allows an active member to read the member projection', async () => {
    const privateOrganization = { id: 'org-1', email: 'team@example.com', memberships: [] };
    const organization = { findUnique: vi.fn().mockResolvedValue(privateOrganization), findFirst: vi.fn() };
    const organizationMembership = { findUnique: vi.fn().mockResolvedValue({ isActive: true }) };
    const service = makeService({ organization, organizationMembership });

    await expect(service.findById('org-1', 'member-1')).resolves.toEqual(privateOrganization);
    expect(organization.findFirst).not.toHaveBeenCalled();
    expect(organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-1' },
      include: expect.objectContaining({ memberships: expect.any(Object) }),
    }));
  });

  it('blocks member-directory reads before any profile or email query for a non-member', async () => {
    const organizationMembership = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
    };
    const service = makeService({ organizationMembership });

    await expect(service.getMembers('org-1', 'outsider')).rejects.toBeInstanceOf(ForbiddenException);
    expect(organizationMembership.findMany).not.toHaveBeenCalled();
  });
});

describe('organization membership mutation boundaries', () => {
  it('does not treat a program manager as an organization administrator', async () => {
    const organizationMembership = { findFirst: vi.fn().mockResolvedValue(null) };
    const service = makeService({ organizationMembership });

    await expect(service.checkAdminAccess('org-1', 'program-manager-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(organizationMembership.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'program-manager-1',
        isActive: true,
        role: { in: ['owner', 'admin'] },
      },
    });
  });

  it('scopes a membership update to the organization from the route', async () => {
    const { service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'owner', isActive: true })
      .mockResolvedValueOnce(null);

    await expect(service.updateMember('org-a', 'owner-1', 'membership-from-org-b', { title: 'Changed' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(organizationMembership.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'membership-from-org-b', organizationId: 'org-a' },
    });
    expect(organizationMembership.update).not.toHaveBeenCalled();
  });

  it('atomically prevents demotion of the last active owner', async () => {
    const { prisma, service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'owner', isActive: true })
      .mockResolvedValueOnce({ id: 'target-membership', role: 'owner', isActive: true });
    organizationMembership.count.mockResolvedValue(1);

    await expect(service.updateMember('org-1', 'owner-1', 'target-membership', { role: 'admin' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(organizationMembership.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('atomically prevents removal of the last active owner', async () => {
    const { service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'owner', isActive: true })
      .mockResolvedValueOnce({ id: 'target-membership', role: 'owner', isActive: true });
    organizationMembership.count.mockResolvedValue(1);

    await expect(service.removeMember('org-1', 'owner-1', 'target-membership'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(organizationMembership.update).not.toHaveBeenCalled();
  });

  it('scopes membership removal to the organization from the route', async () => {
    const { service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'owner', isActive: true })
      .mockResolvedValueOnce(null);

    await expect(service.removeMember('org-a', 'owner-1', 'membership-from-org-b'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(organizationMembership.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'membership-from-org-b', organizationId: 'org-a' },
    });
    expect(organizationMembership.update).not.toHaveBeenCalled();
  });

  it('does not let an admin promote or modify an owner membership', async () => {
    const { service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'admin', isActive: true })
      .mockResolvedValueOnce({ id: 'target-membership', role: 'owner', isActive: true });

    await expect(service.updateMember('org-1', 'admin-1', 'target-membership', { title: 'Changed' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(organizationMembership.update).not.toHaveBeenCalled();
  });

  it('allowlists mutable membership fields even when invoked without a validation pipe', async () => {
    const { service, organizationMembership } = transactionalPrisma();
    organizationMembership.findFirst
      .mockResolvedValueOnce({ id: 'actor-membership', role: 'owner', isActive: true })
      .mockResolvedValueOnce({ id: 'target-membership', role: 'member', isActive: true });
    organizationMembership.update.mockResolvedValue({ id: 'target-membership' });

    await service.updateMember('org-1', 'owner-1', 'target-membership', {
      title: 'Lead',
      organizationId: 'attacker-org',
      userId: 'attacker-user',
      permissions: { all: true },
    } as never);

    expect(organizationMembership.update).toHaveBeenCalledWith({
      where: { id: 'target-membership' },
      data: { title: 'Lead' },
    });
  });
});
