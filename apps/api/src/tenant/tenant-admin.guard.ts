import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TenantAdminAccess = {
  userId: string;
  isPlatformAdmin: boolean;
  tenantRole?: TenantMemberRole;
};

type TenantAdminRequest = {
  user?: { id?: string; role?: string | null };
  params?: { id?: string; tenantId?: string };
  tenantAdminAccess?: TenantAdminAccess;
};

/**
 * Authorizes a tenant-scoped administration route. Platform admins retain
 * cross-tenant access; otherwise the actor must be an active owner/admin of
 * the tenant named by the route. The resolved access is attached to the
 * request so member-management policy can enforce the hierarchy as well.
 */
@Injectable()
export class TenantAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantAdminRequest>();
    const userId = request.user?.id;
    const tenantId = request.params?.id ?? request.params?.tenantId;

    if (!userId || !tenantId) {
      throw new ForbiddenException('Tenant administration context is missing');
    }

    if (request.user?.role === 'admin' || request.user?.role === 'super_admin') {
      request.tenantAdminAccess = { userId, isPlatformAdmin: true };
      return true;
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { role: true, isActive: true },
    });

    if (
      !membership?.isActive
      || (membership.role !== TenantMemberRole.owner && membership.role !== TenantMemberRole.admin)
    ) {
      throw new ForbiddenException('Active tenant owner or administrator access is required');
    }

    request.tenantAdminAccess = {
      userId,
      isPlatformAdmin: false,
      tenantRole: membership.role,
    };
    return true;
  }
}
