import { useQuery } from '@tanstack/react-query';
import { getBillingSubscription } from '@/lib/api';
import { planHasFeature, type PlanFeatureKey } from '@/lib/billing';
import { useSession } from './useSession';
import { qk } from '@/lib/query-keys';

/**
 * Returns the current user's active subscription + a helper to check
 * whether a given feature is accessible under their plan.
 *
 * Feature overrides set by admins take absolute priority over plan defaults.
 */
export function useFeaturePlan() {
  const { hasSession } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: qk('billing', 'subscription'),
    queryFn: getBillingSubscription,
    enabled: hasSession,
    staleTime: 5 * 60_000,
  });

  const subscription = data?.subscription ?? null;
  const planName = subscription?.plan?.name ?? 'free';
  const overrides = subscription?.featureOverrides ?? null;

  function hasFeature(feature: PlanFeatureKey): boolean {
    // Admin override always wins
    if (overrides && feature in overrides) return Boolean(overrides[feature]);
    return planHasFeature(planName, feature);
  }

  return {
    subscription,
    plan: subscription?.plan ?? null,
    planName,
    isLoading,
    hasFeature,
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    isTrial: subscription?.status === 'trialing',
    isPastDue: subscription?.status === 'past_due',
    isFree: planName === 'free',
    isPremium: planName === 'individual_premium',
    isTeam: planName === 'team',
    isOrg: planName === 'organization',
    isEnterprise: planName === 'enterprise',
  };
}
