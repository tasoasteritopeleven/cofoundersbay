import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantMemberRole } from '@prisma/client';
import { TenantService } from './tenant.service';

describe('TenantService public tenant lookup', () => {
  it('never joins private SSO or identity-provider material', async () => {
    const tenant = {
      id: 'tenant-1',
      slug: 'acme',
      name: 'Acme',
      branding: { primaryColor: '#123456' },
    };
    const findUnique = vi.fn().mockResolvedValue(tenant);
    const service = new TenantService({ tenant: { findUnique } } as never);

    await expect(service.findById('tenant-1')).resolves.toEqual(tenant);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      include: { branding: true },
    });
    expect(JSON.stringify(findUnique.mock.calls[0])).not.toContain('identityProvider');
    expect(JSON.stringify(findUnique.mock.calls[0])).not.toContain('ssoConfig');
  });

  it('keeps the existing not-found contract', async () => {
    const service = new TenantService({
      tenant: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TenantService member-management invariants', () => {
  const tenantId = 'tenant-1';
  const targetUserId = 'target-1';

  function createService(membership: any, ownerCount = 2) {
    const prisma: any = {
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue(membership),
        count: vi.fn().mockResolvedValue(ownerCount),
        update: vi.fn().mockImplementation(async ({ data }) => ({ ...membership, ...data })),
      },
    };
    prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(prisma));
    return { service: new TenantService(prisma), prisma };
  }

  it('prevents deactivation or demotion of the last active owner', async () => {
    const { service, prisma } = createService({
      id: 'membership-1', userId: targetUserId, role: TenantMemberRole.owner, isActive: true,
    }, 1);

    await expect(service.updateMember(tenantId, targetUserId, {
      role: TenantMemberRole.member,
    }, {
      userId: 'platform-1', isPlatformAdmin: true,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('does not let a tenant admin modify an owner or peer administrator', async () => {
    const { service, prisma } = createService({
      id: 'membership-1', userId: targetUserId, role: TenantMemberRole.admin, isActive: true,
    });

    await expect(service.removeMember(tenantId, targetUserId, {
      userId: 'tenant-admin-1',
      isPlatformAdmin: false,
      tenantRole: TenantMemberRole.admin,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('does not allow implicit ownership grants or self-edits', async () => {
    const { service } = createService({
      id: 'membership-1', userId: targetUserId, role: TenantMemberRole.member, isActive: true,
    });
    const ownerAccess = {
      userId: 'owner-1', isPlatformAdmin: false, tenantRole: TenantMemberRole.owner,
    };

    await expect(service.updateMember(tenantId, targetUserId, {
      role: TenantMemberRole.owner,
    }, ownerAccess)).rejects.toBeInstanceOf(ForbiddenException);

    await expect(service.updateMember(tenantId, targetUserId, {
      role: TenantMemberRole.manager,
    }, { ...ownerAccess, userId: targetUserId })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a tenant owner to delegate an administrator while preserving scoped fields', async () => {
    const { service, prisma } = createService({
      id: 'membership-1', userId: targetUserId, role: TenantMemberRole.member, isActive: true,
    });

    await expect(service.updateMember(tenantId, targetUserId, {
      role: TenantMemberRole.admin,
      isActive: true,
    }, {
      userId: 'owner-1', isPlatformAdmin: false, tenantRole: TenantMemberRole.owner,
    })).resolves.toMatchObject({ role: TenantMemberRole.admin, isActive: true });

    expect(prisma.tenantMembership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { role: TenantMemberRole.admin, isActive: true },
    });
  });
});
