import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TenantMemberRole } from '@prisma/client';
import { TenantAdminGuard } from './tenant-admin.guard';

function contextFor(request: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('TenantAdminGuard', () => {
  it('retains cross-tenant access for platform administrators without a membership query', async () => {
    const findUnique = vi.fn();
    const guard = new TenantAdminGuard({ tenantMembership: { findUnique } } as never);
    const request = { user: { id: 'platform-1', role: 'admin' }, params: { id: 'tenant-1' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
    expect(request).toHaveProperty('tenantAdminAccess', {
      userId: 'platform-1',
      isPlatformAdmin: true,
    });
  });

  it.each([TenantMemberRole.owner, TenantMemberRole.admin])(
    'allows an active tenant %s only for the tenant in the route',
    async (role) => {
      const findUnique = vi.fn().mockResolvedValue({ role, isActive: true });
      const guard = new TenantAdminGuard({ tenantMembership: { findUnique } } as never);
      const request: any = { user: { id: 'member-1', role: 'founder' }, params: { id: 'tenant-1' } };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'member-1' } },
        select: { role: true, isActive: true },
      });
      expect(request.tenantAdminAccess).toEqual({
        userId: 'member-1',
        isPlatformAdmin: false,
        tenantRole: role,
      });
    },
  );

  it.each([
    null,
    { role: TenantMemberRole.owner, isActive: false },
    { role: TenantMemberRole.manager, isActive: true },
    { role: TenantMemberRole.member, isActive: true },
  ])('denies missing, inactive or non-admin memberships (%j)', async (membership) => {
    const guard = new TenantAdminGuard({
      tenantMembership: { findUnique: vi.fn().mockResolvedValue(membership) },
    } as never);

    await expect(guard.canActivate(contextFor({
      user: { id: 'member-1', role: 'founder' },
      params: { id: 'tenant-1' },
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
