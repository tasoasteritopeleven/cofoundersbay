import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

function setup(actorRole: Role, targetRole: Role, options?: { actorId?: string; targetId?: string; superAdminCount?: number }) {
  const actorId = options?.actorId ?? 'actor-1';
  const targetId = options?.targetId ?? 'target-1';
  const user = {
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.id === actorId) return { id: actorId, role: actorRole, moderationStatus: 'active' };
      if (where.id === targetId) return { id: targetId, role: targetRole, moderationStatus: 'active' };
      return null;
    }),
    update: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(options?.superAdminCount ?? 2),
  };
  const adminAuditLog = { create: vi.fn().mockResolvedValue({}) };
  const prisma: Record<string, any> = { user, adminAuditLog };
  prisma.$transaction = vi.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  return { service: new AdminService(prisma as never, audit as never), prisma, user, adminAuditLog, audit, actorId, targetId };
}

describe('administrator hierarchy', () => {
  it('prevents an ordinary admin from granting an administrative role', async () => {
    const { service, user, actorId, targetId } = setup(Role.admin, Role.founder);
    await expect(service.changeUserRole({ adminId: actorId, userId: targetId, newRole: Role.super_admin }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('prevents every administrator from changing their own role', async () => {
    const { service } = setup(Role.super_admin, Role.super_admin, { actorId: 'same', targetId: 'same' });
    await expect(service.changeUserRole({ adminId: 'same', userId: 'same', newRole: Role.founder }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a super administrator to promote another account and writes the audit atomically', async () => {
    const { service, user, adminAuditLog, actorId, targetId } = setup(Role.super_admin, Role.founder);
    await service.changeUserRole({ adminId: actorId, userId: targetId, newRole: Role.admin });
    expect(user.update).toHaveBeenCalledWith({ where: { id: targetId }, data: { role: Role.admin } });
    expect(adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId, entityId: targetId, action: 'user.role_change' }),
    });
  });

  it('protects the last active super administrator from demotion', async () => {
    const { service, user, actorId, targetId } = setup(Role.super_admin, Role.super_admin, { superAdminCount: 1 });
    await expect(service.changeUserRole({ adminId: actorId, userId: targetId, newRole: Role.admin }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(user.update).not.toHaveBeenCalled();
  });
});

describe('administrator moderation boundaries', () => {
  it('prevents an ordinary admin from suspending another administrator', async () => {
    const { service, user, actorId, targetId } = setup(Role.admin, Role.admin);
    await expect(service.updateUserModerationStatus({
      adminId: actorId, userId: targetId, status: 'suspended', reason: 'attempt',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('keeps super administrators behind a separate break-glass moderation workflow', async () => {
    const { service, user, actorId, targetId } = setup(Role.super_admin, Role.super_admin);
    await expect(service.banUser({ adminId: actorId, userId: targetId, reason: 'attempt' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('allows a super administrator to moderate an ordinary admin', async () => {
    const { service, user, actorId, targetId } = setup(Role.super_admin, Role.admin);
    await service.updateUserModerationStatus({ adminId: actorId, userId: targetId, status: 'suspended' });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: targetId }, data: { moderationStatus: 'suspended' },
    });
  });
});
