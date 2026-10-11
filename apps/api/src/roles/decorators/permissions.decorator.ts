import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ALL_KEY = 'requireAllPermissions';

/**
 * Decorator to require specific permissions for a route
 * @param permissions - Array of permission strings required
 * @example @RequirePermissions('builder:read', 'builder:write')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require ALL specified permissions (instead of any)
 * Use in combination with @RequirePermissions
 * @example
 * @RequirePermissions('org:read', 'org:write')
 * @RequireAllPermissions()
 */
export const RequireAllPermissions = () => SetMetadata(REQUIRE_ALL_KEY, true);

// Common permission groups for convenience
export const FounderPermissions = ['profile:read', 'profile:write', 'builder:read', 'builder:write'];
export const MentorPermissions = ['mentees:read', 'sessions:read', 'sessions:write'];
export const InvestorPermissions = ['deals:read', 'portfolio:read'];
export const OrgAdminPermissions = ['org:read', 'org:write', 'org:admin'];
export const PlatformAdminPermissions = ['*'];
