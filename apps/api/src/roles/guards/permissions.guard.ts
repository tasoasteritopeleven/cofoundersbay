import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesService } from '../roles.service';

export const PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ALL_KEY = 'requireAllPermissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const requireAll = this.reflector.getAllAndOverride<boolean>(REQUIRE_ALL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const userPermissions = await this.rolesService.getUserPermissions(user.id);

    // Platform admins have full access
    if (userPermissions.includes('*')) {
      return true;
    }

    const hasAccess = requireAll
      ? requiredPermissions.every((p) => userPermissions.includes(p))
      : requiredPermissions.some((p) => userPermissions.includes(p));

    if (!hasAccess) {
      throw new ForbiddenException(
        `Missing required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
