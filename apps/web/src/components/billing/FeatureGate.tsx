'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeaturePlan } from '@/hooks/useFeaturePlan';
import type { PlanFeatureKey } from '@/lib/billing';

type FeatureGateProps = {
  feature: PlanFeatureKey;
  /** Content shown when the user HAS access */
  children: ReactNode;
  /** Content shown when blocked. Defaults to an upgrade prompt. */
  fallback?: ReactNode;
  /** If true, renders nothing when blocked instead of the fallback */
  silent?: boolean;
};

/**
 * Wraps any UI element with a plan-based access check.
 * When the user lacks the required feature, either the fallback or a
 * default upgrade prompt is shown.
 *
 * Usage:
 *   <FeatureGate feature="advancedMatching">
 *     <AdvancedMatchingUI />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback, silent }: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeaturePlan();

  if (isLoading) return null;
  if (hasFeature(feature)) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  return <UpgradePrompt feature={feature} />;
}

function UpgradePrompt({ feature }: { feature: PlanFeatureKey }) {
  const label = FEATURE_LABELS[feature] ?? feature;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Lock className="icon-md text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{label} requires an upgrade</p>
        <p className="text-xs text-muted-foreground">This feature is not included in your current plan.</p>
      </div>
      <Button size="sm" className="gap-2" asChild>
        <Link href="/pricing">Upgrade plan</Link>
      </Button>
    </div>
  );
}

const FEATURE_LABELS: Partial<Record<PlanFeatureKey, string>> = {
  advancedMatching: 'Advanced Matching',
  unlimitedMessages: 'Unlimited Messages',
  mentorBooking: 'Mentor Booking',
  analyticsBasic: 'Analytics',
  analyticsAdvanced: 'Advanced Analytics',
  teamSeats: 'Team Seats',
  orgBranding: 'Organization Branding',
  customDomain: 'Custom Domain',
  sso: 'SSO Integration',
  whiteLabel: 'White Labeling',
  apiAccess: 'API Access',
  prioritySupport: 'Priority Support',
  dedicatedSupport: 'Dedicated Support',
  customOnboarding: 'Custom Onboarding',
  programManagement: 'Program Management',
  communityModules: 'Community Modules',
  advancedExports: 'Advanced Exports',
  featureFlags: 'Feature Flags',
};
