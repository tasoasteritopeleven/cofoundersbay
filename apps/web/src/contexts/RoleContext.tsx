'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { apiRequest } from '@/lib/api';
import { isPreviewDemo } from '@/lib/preview-demo';

// Role types matching backend
export type UserRoleType =
  | 'aspiring_founder'
  | 'existing_founder'
  | 'cofounder_candidate'
  | 'technical_talent'
  | 'business_operator'
  | 'mentor'
  | 'advisor'
  | 'coach'
  | 'course_creator'
  | 'incubator_admin'
  | 'accelerator_admin'
  | 'university_admin'
  | 'venture_studio_admin'
  | 'angel_investor'
  | 'vc_scout'
  | 'vc_analyst'
  | 'syndicate_manager'
  | 'service_provider'
  | 'legal_partner'
  | 'finance_advisor'
  | 'recruiter'
  | 'platform_admin';

export type RoleFacetScope = 'global' | 'tenant' | 'workspace' | 'community' | 'program';

export interface RoleFacet {
  id: string;
  roleType: UserRoleType;
  scope: RoleFacetScope;
  scopeId?: string;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface DashboardConfig {
  defaultRoute: string;
  dashboardWidgets: string[];
  sidebarItems: string[];
  features: string[];
}

export interface OrganizationContext {
  id: string;
  name: string;
  type: string;
  role: string;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface RoleContextState {
  primaryRole: UserRoleType | null;
  allRoles: RoleFacet[];
  permissions: string[];
  dashboard: DashboardConfig | null;
  organizations: OrganizationContext[];
  tenants: TenantContext[];
  isLoading: boolean;
  error: string | null;
}

type DashboardContextResponse = Omit<RoleContextState, 'isLoading' | 'error'>;

interface RoleContextValue extends RoleContextState {
  refreshRoles: () => Promise<void>;
  switchPrimaryRole: (roleId: string) => Promise<void>;
  addRole: (roleType: UserRoleType, scope?: RoleFacetScope, scopeId?: string) => Promise<void>;
  removeRole: (roleId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isRoleActive: (roleType: UserRoleType) => boolean;
  navigateToDashboard: () => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const EMPTY_ROLE_STATE: DashboardContextResponse = {
  primaryRole: null,
  allRoles: [],
  permissions: [],
  dashboard: null,
  organizations: [],
  tenants: [],
};

const ROLE_DASHBOARD: Record<UserRoleType, string> = {
  aspiring_founder: '/dashboard/founder',
  existing_founder: '/dashboard/founder',
  cofounder_candidate: '/dashboard/founder',
  technical_talent: '/dashboard/founder',
  business_operator: '/dashboard/founder',
  mentor: '/dashboard/mentor',
  advisor: '/dashboard/mentor',
  coach: '/dashboard/mentor',
  course_creator: '/dashboard/mentor',
  angel_investor: '/dashboard/investor',
  vc_scout: '/dashboard/investor',
  vc_analyst: '/dashboard/investor',
  syndicate_manager: '/dashboard/investor',
  incubator_admin: '/dashboard/incubator',
  accelerator_admin: '/dashboard/incubator',
  university_admin: '/dashboard/incubator',
  venture_studio_admin: '/dashboard/incubator',
  service_provider: '/dashboard/provider',
  legal_partner: '/dashboard/provider',
  finance_advisor: '/dashboard/provider',
  recruiter: '/dashboard/provider',
  platform_admin: '/admin/dashboard',
};

const previewRoleStates = new Map<UserRoleType, RoleContextState>();

/**
 * Role state for the preview demo. One founder by default, as before; when the
 * `cfb_primary_role` cookie names a known role (the same cookie the middleware
 * reads to route /dashboard), the demo takes that role, so a mentor's,
 * investor's or provider's navigation can be previewed and audited - the demo
 * used to be a founder whatever the cookie said. One object per role, built
 * once, so the bail-out in refreshRoles below keeps working.
 */
function previewDemoRoleState(): RoleContextState {
  const fromCookie = typeof document !== 'undefined'
    ? /(?:^|;\s*)cfb_primary_role=([a-z_]+)/.exec(document.cookie)?.[1]
    : undefined;
  const role: UserRoleType = fromCookie && fromCookie in ROLE_DASHBOARD ? (fromCookie as UserRoleType) : 'existing_founder';
  let state = previewRoleStates.get(role);
  if (!state) {
    state = {
      primaryRole: role,
      allRoles: [{ id: `preview-${role}`, roleType: role, scope: 'global', isPrimary: true, isVerified: true }],
      permissions: ['*'],
      dashboard: { defaultRoute: ROLE_DASHBOARD[role], dashboardWidgets: [], sidebarItems: [], features: [] },
      organizations: [],
      tenants: [],
      isLoading: false,
      error: null,
    };
    previewRoleStates.set(role, state);
  }
  return state;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { hasSession, mounted } = useSession();
  const [state, setState] = useState<RoleContextState>({
    ...EMPTY_ROLE_STATE,
    isLoading: true,
    error: null,
  });

  const refreshRoles = useCallback(async () => {
    if (!mounted) return;

    if (!hasSession) {
      setState({
        ...EMPTY_ROLE_STATE,
        isLoading: false,
        error: null,
      });
      return;
    }

    if (isPreviewDemo()) {
      // Bail out when the demo state is already applied. This branch is fixed
      // data, but it used to build a fresh object (with fresh nested arrays) on
      // every call, which React can never treat as equal — so each call re-rendered
      // every useRole() consumer, SideNav included, to arrive at identical values.
      const preview = previewDemoRoleState();
      setState((prev) => (prev === preview ? prev : preview));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const context = await apiRequest<DashboardContextResponse>('/api/roles/dashboard-context');
      setState({
        primaryRole: context.primaryRole,
        allRoles: context.allRoles,
        permissions: context.permissions,
        dashboard: context.dashboard,
        organizations: context.organizations,
        tenants: context.tenants,
        isLoading: false,
        error: null,
      });
      // Persist role to cookie so middleware can redirect /dashboard at the edge
      if (typeof document !== 'undefined' && context.primaryRole) {
        document.cookie = `cfb_primary_role=${context.primaryRole}; path=/; SameSite=Lax; max-age=86400`;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load roles',
      }));
    }
  }, [hasSession, mounted]);

  const switchPrimaryRole = useCallback(async (roleId: string) => {
    try {
      await apiRequest(`/api/roles/${roleId}/set-primary`, { method: 'PATCH' });
      await refreshRoles();
    } catch (error) {
      console.error('Failed to switch primary role:', error);
      throw error;
    }
  }, [refreshRoles]);

  const addRole = useCallback(async (
    roleType: UserRoleType,
    scope: RoleFacetScope = 'global',
    scopeId?: string,
  ) => {
    try {
      await apiRequest('/api/roles/add', {
        method: 'POST',
        body: JSON.stringify({ roleType, scope, scopeId }),
      });
      await refreshRoles();
    } catch (error) {
      console.error('Failed to add role:', error);
      throw error;
    }
  }, [refreshRoles]);

  const removeRole = useCallback(async (roleId: string) => {
    try {
      await apiRequest(`/api/roles/${roleId}`, { method: 'DELETE' });
      await refreshRoles();
    } catch (error) {
      console.error('Failed to remove role:', error);
      throw error;
    }
  }, [refreshRoles]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (state.permissions.includes('*')) return true;
    return state.permissions.includes(permission);
  }, [state.permissions]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (state.permissions.includes('*')) return true;
    return permissions.some((p) => state.permissions.includes(p));
  }, [state.permissions]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (state.permissions.includes('*')) return true;
    return permissions.every((p) => state.permissions.includes(p));
  }, [state.permissions]);

  const isRoleActive = useCallback((roleType: UserRoleType): boolean => {
    return state.allRoles.some((r) => r.roleType === roleType);
  }, [state.allRoles]);

  const navigateToDashboard = useCallback(() => {
    if (state.dashboard?.defaultRoute) {
      router.push(state.dashboard.defaultRoute);
    } else {
      router.push('/dashboard');
    }
  }, [router, state.dashboard]);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  const value: RoleContextValue = {
    ...state,
    refreshRoles,
    switchPrimaryRole,
    addRole,
    removeRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isRoleActive,
    navigateToDashboard,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

export function useRoleOptional() {
  return useContext(RoleContext);
}

// HOC for role-based access control
export function withRoleGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions: string[],
  requireAll = false,
) {
  return function RoleGuardedComponent(props: P) {
    const { hasAnyPermission, hasAllPermissions, isLoading } = useRole();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading) {
        const hasAccess = requireAll
          ? hasAllPermissions(requiredPermissions)
          : hasAnyPermission(requiredPermissions);

        if (!hasAccess) {
          router.push('/unauthorized');
        }
      }
    }, [isLoading, hasAnyPermission, hasAllPermissions, router, requiredPermissions, requireAll]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

// Hook for conditional rendering based on permissions
export function usePermissionCheck(permissions: string[], requireAll = false): boolean {
  const { hasAnyPermission, hasAllPermissions, isLoading } = useRole();

  if (isLoading) return false;

  return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
}

// Component for conditional rendering
export function PermissionGate({
  children,
  permissions,
  requireAll = false,
  fallback = null,
}: {
  children: ReactNode;
  permissions: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}) {
  const hasAccess = usePermissionCheck(permissions, requireAll);
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Role-specific gate
export function RoleGate({
  children,
  roles,
  fallback = null,
}: {
  children: ReactNode;
  roles: UserRoleType[];
  fallback?: ReactNode;
}) {
  const { allRoles, isLoading } = useRole();

  if (isLoading) return null;

  const hasRole = allRoles.some((r) => roles.includes(r.roleType));
  return hasRole ? <>{children}</> : <>{fallback}</>;
}
