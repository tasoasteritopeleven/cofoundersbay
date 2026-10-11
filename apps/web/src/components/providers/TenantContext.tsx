'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getUserTenantMemberships,
  getTenantBySlug,
  resolveTenantFromDomain,
  type TenantItem,
  type TenantBranding,
  type TenantMembershipItem,
} from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import { useApiAvailability } from '@/hooks/useApiAvailability';
import { qk } from '@/lib/query-keys';

// ── Domain detection (client-side only) ──────────────────────────────────────

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'cofounderbay.com';

function detectDomainContext(): { type: 'subdomain' | 'custom' | 'none'; value: string | null } {
  if (typeof window === 'undefined') return { type: 'none', value: null };
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { type: 'none', value: null };
  }
  const subMatch = host.match(new RegExp(`^([^.]+)\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`));
  if (subMatch) {
    const sub = subMatch[1].toLowerCase();
    if (!['www', 'app', 'api', 'admin', 'mail', 'cdn', 'static'].includes(sub)) {
      return { type: 'subdomain', value: sub };
    }
  }
  if (!host.endsWith(`.${PLATFORM_DOMAIN}`) && host !== PLATFORM_DOMAIN) {
    return { type: 'custom', value: host };
  }
  return { type: 'none', value: null };
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TenantContextValue = {
  activeTenant: TenantItem | null;
  activeMembership: TenantMembershipItem | null;
  memberships: TenantMembershipItem[];
  branding: TenantBranding | null;
  isLoading: boolean;
  communityLabel: string;
  getRoleLabel: (role: string) => string;
};

// ── Context ───────────────────────────────────────────────────────────────────

const TenantCtx = createContext<TenantContextValue>({
  activeTenant: null,
  activeMembership: null,
  memberships: [],
  branding: null,
  isLoading: false,
  communityLabel: 'Community',
  getRoleLabel: (r) => r,
});

// ── CSS variable injection ────────────────────────────────────────────────────

function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBrandingCssVars(branding: TenantBranding | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (branding?.primaryColor) {
    root.style.setProperty('--primary', hexToHsl(branding.primaryColor));
    root.style.setProperty('--primary-foreground', '0 0% 100%');
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-foreground');
  }
  if (branding?.secondaryColor) {
    root.style.setProperty('--secondary', hexToHsl(branding.secondaryColor));
  } else {
    root.style.removeProperty('--secondary');
  }
  if (branding?.accentColor) {
    root.style.setProperty('--accent', hexToHsl(branding.accentColor));
  } else {
    root.style.removeProperty('--accent');
  }
}

function applyBrandingFonts(branding: TenantBranding | null) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('tenant-font-link');
  if (existing) existing.remove();

  const fonts = new Set<string>();
  if (branding?.headingFont) fonts.add(branding.headingFont);
  if (branding?.bodyFont) fonts.add(branding.bodyFont);

  if (fonts.size > 0) {
    const link = document.createElement('link');
    link.id = 'tenant-font-link';
    link.rel = 'stylesheet';
    const families = Array.from(fonts).map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }

  const root = document.documentElement;
  if (branding?.headingFont) {
    root.style.setProperty('--font-heading', `'${branding.headingFont}', sans-serif`);
  } else {
    root.style.removeProperty('--font-heading');
  }
  if (branding?.bodyFont) {
    root.style.setProperty('--font-sans', `'${branding.bodyFont}', sans-serif`);
  } else {
    root.style.removeProperty('--font-sans');
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

/** Stable empty fallback, so "no memberships" keeps one identity across renders. */
const EMPTY_MEMBERSHIPS: NonNullable<
  Awaited<ReturnType<typeof getUserTenantMemberships>>['memberships']
> = [];

export function TenantProvider({ children }: { children: ReactNode }) {
  const { hasSession } = useSession();
  const apiAvailable = useApiAvailability();

  // Detect if we're on a tenant-owned domain (subdomain or custom)
  const [domainCtx] = useState(() => detectDomainContext());

  // Resolve tenant from subdomain (by slug)
  const { data: subdomainTenantData, isLoading: subdomainLoading } = useQuery({
    queryKey: qk('tenant', 'by-slug', domainCtx.value),
    queryFn: () => getTenantBySlug(domainCtx.value!),
    enabled: domainCtx.type === 'subdomain' && !!domainCtx.value,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve tenant from custom domain (by full hostname)
  const { data: customDomainData, isLoading: customDomainLoading } = useQuery({
    queryKey: qk('tenant', 'by-domain', domainCtx.value),
    queryFn: () => resolveTenantFromDomain(domainCtx.value!),
    enabled: domainCtx.type === 'custom' && !!domainCtx.value,
    staleTime: 5 * 60 * 1000,
  });

  // Membership-based tenant (used when not on a domain)
  const { data: membershipsData, isLoading: membershipsLoading } = useQuery({
    queryKey: qk('tenant', 'memberships'),
    queryFn: getUserTenantMemberships,
    enabled: hasSession && domainCtx.type === 'none' && apiAvailable,
    staleTime: 5 * 60 * 1000,
  });

  // Must be memoised: `?? []` allocates a fresh array on every render, and this
  // value is a dependency of the context `value` memo below. An unstable identity
  // there meant the tenant context object was recreated on every single render of
  // this provider, which re-rendered every useTenant() consumer in the app —
  // defeating memoisation everywhere downstream for a value that had not changed.
  const memberships = useMemo(
    () => membershipsData?.memberships ?? EMPTY_MEMBERSHIPS,
    [membershipsData],
  );

  const membershipActiveTenant = useMemo(
    () => {
      const m = memberships.find(m => m.isActive) ?? memberships[0] ?? null;
      return m?.tenant as TenantItem | null ?? null;
    },
    [memberships],
  );
  const activeMembership = useMemo(
    () => memberships.find(m => m.isActive) ?? memberships[0] ?? null,
    [memberships],
  );

  // Domain-resolved tenant takes priority over membership-based
  // getTenantBySlug returns TenantItem directly; resolveTenantFromDomain returns { tenant, branding, domain }
  const domainTenant: TenantItem | null = useMemo(() => {
    if (domainCtx.type === 'subdomain' && subdomainTenantData) {
      return subdomainTenantData as TenantItem;
    }
    if (domainCtx.type === 'custom' && customDomainData?.tenant) {
      return customDomainData.tenant as TenantItem;
    }
    return null;
  }, [domainCtx.type, subdomainTenantData, customDomainData]);

  const domainBranding: TenantBranding | null = useMemo(() => {
    if (domainCtx.type === 'subdomain' && subdomainTenantData) {
      return (subdomainTenantData as any).branding as TenantBranding | null ?? null;
    }
    if (domainCtx.type === 'custom' && customDomainData?.branding) {
      return customDomainData.branding as unknown as TenantBranding;
    }
    return null;
  }, [domainCtx.type, subdomainTenantData, customDomainData]);

  const activeTenant = domainTenant ?? membershipActiveTenant;
  const branding: TenantBranding | null = domainBranding ?? ((activeTenant as any)?.branding as TenantBranding | null ?? null);

  const isLoading = domainCtx.type === 'subdomain'
    ? subdomainLoading
    : domainCtx.type === 'custom'
      ? customDomainLoading
      : membershipsLoading;

  const communityLabel = branding?.communityNaming ?? 'Community';
  // Same reasoning as `memberships`: this is handed to consumers through the
  // context value, so it needs a stable identity per branding, not per render.
  const getRoleLabel = useCallback(
    (role: string) => {
      const roleLabels: Record<string, string> = branding?.roleLabels ?? {};
      return roleLabels[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
    },
    [branding],
  );

  useEffect(() => {
    if (branding?.isBrandingActive) {
      applyBrandingCssVars(branding);
      applyBrandingFonts(branding);
    } else {
      applyBrandingCssVars(null);
      applyBrandingFonts(null);
    }
  }, [branding]);

  const value = useMemo<TenantContextValue>(
    () => ({ activeTenant, activeMembership, memberships, branding, isLoading, communityLabel, getRoleLabel }),
    [activeTenant, activeMembership, memberships, branding, isLoading, communityLabel, getRoleLabel],
  );

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  return useContext(TenantCtx);
}
