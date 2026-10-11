import { PROMOTED_COPY } from '@cofounderbay/shared';
/**
 * billing.ts — Feature gating constants and plan-to-feature mapping.
 * This is the single source of truth for what each plan includes.
 * The backend enforces the same rules via BillingService.getFeatureAccess().
 */

export type PlanFeatureKey =
  | 'advancedMatching'
  | 'unlimitedMessages'
  | 'mentorBooking'
  | 'analyticsBasic'
  | 'analyticsAdvanced'
  | 'teamSeats'
  | 'orgBranding'
  | 'customDomain'
  | 'sso'
  | 'whiteLabel'
  | 'apiAccess'
  | 'prioritySupport'
  | 'priorityDiscovery'
  | 'dedicatedSupport'
  | 'customOnboarding'
  | 'programManagement'
  | 'communityModules'
  | 'advancedExports'
  | 'featureFlags';

export type PlanFeatureSet = Record<PlanFeatureKey, boolean | string>;

/** What each plan tier includes. Mirrors the BillingPlan.features JSON in the DB. */
export const PLAN_FEATURES: Record<string, PlanFeatureSet> = {
  free: {
    advancedMatching: false,
    unlimitedMessages: false,
    mentorBooking: false,
    analyticsBasic: false,
    analyticsAdvanced: false,
    teamSeats: false,
    orgBranding: false,
    customDomain: false,
    sso: false,
    whiteLabel: false,
    apiAccess: false,
    prioritySupport: false,
    priorityDiscovery: false,
    dedicatedSupport: false,
    customOnboarding: false,
    programManagement: false,
    communityModules: false,
    advancedExports: false,
    featureFlags: false,
  },
  individual_premium: {
    advancedMatching: true,
    unlimitedMessages: true,
    mentorBooking: true,
    analyticsBasic: true,
    analyticsAdvanced: false,
    teamSeats: false,
    orgBranding: false,
    customDomain: false,
    sso: false,
    whiteLabel: false,
    apiAccess: false,
    prioritySupport: true,
    priorityDiscovery: true,
    dedicatedSupport: false,
    customOnboarding: false,
    programManagement: false,
    communityModules: false,
    advancedExports: false,
    featureFlags: false,
  },
  team: {
    advancedMatching: true,
    unlimitedMessages: true,
    mentorBooking: true,
    analyticsBasic: true,
    analyticsAdvanced: 'advanced',
    teamSeats: true,
    orgBranding: true,
    customDomain: false,
    sso: false,
    whiteLabel: false,
    apiAccess: false,
    prioritySupport: true,
    priorityDiscovery: true,
    dedicatedSupport: 'email',
    customOnboarding: false,
    programManagement: true,
    communityModules: true,
    advancedExports: true,
    featureFlags: false,
  },
  organization: {
    advancedMatching: true,
    unlimitedMessages: true,
    mentorBooking: true,
    analyticsBasic: true,
    analyticsAdvanced: true,
    teamSeats: true,
    orgBranding: true,
    customDomain: true,
    sso: true,
    whiteLabel: false,
    apiAccess: true,
    prioritySupport: true,
    priorityDiscovery: true,
    dedicatedSupport: 'email',
    customOnboarding: false,
    programManagement: true,
    communityModules: true,
    advancedExports: true,
    featureFlags: false,
  },
  enterprise: {
    advancedMatching: true,
    unlimitedMessages: true,
    mentorBooking: true,
    analyticsBasic: true,
    analyticsAdvanced: true,
    teamSeats: true,
    orgBranding: true,
    customDomain: true,
    sso: true,
    whiteLabel: true,
    apiAccess: true,
    prioritySupport: true,
    priorityDiscovery: true,
    dedicatedSupport: '24/7',
    customOnboarding: true,
    programManagement: true,
    communityModules: true,
    advancedExports: true,
    featureFlags: true,
  },
};

/** How each feature reads to a person, in both languages. */
export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, { en: string; el: string }> = {
  advancedMatching: { en: 'Advanced matching filters', el: 'Προηγμένα φίλτρα αντιστοίχισης' },
  unlimitedMessages: { en: 'Unlimited messages', el: 'Απεριόριστα μηνύματα' },
  mentorBooking: { en: 'Mentor booking', el: 'Κρατήσεις μεντόρων' },
  analyticsBasic: { en: 'Analytics', el: 'Στατιστικά' },
  analyticsAdvanced: { en: 'Advanced analytics', el: 'Προηγμένα στατιστικά' },
  teamSeats: { en: 'Team seats', el: 'Θέσεις ομάδας' },
  orgBranding: { en: 'Organisation branding', el: 'Επωνυμία οργανισμού' },
  customDomain: { en: 'Custom domain', el: 'Δικό σας domain' },
  sso: { en: 'Single sign-on (SSO)', el: 'Ενιαία σύνδεση (SSO)' },
  whiteLabel: { en: 'White label', el: 'Λευκή ετικέτα' },
  apiAccess: { en: 'API access', el: 'Πρόσβαση στο API' },
  prioritySupport: { en: 'Priority support', el: 'Υποστήριξη προτεραιότητας' },
  priorityDiscovery: { en: PROMOTED_COPY.plan.en, el: PROMOTED_COPY.plan.el },
  dedicatedSupport: { en: 'Dedicated support', el: 'Αποκλειστική υποστήριξη' },
  customOnboarding: { en: 'Custom onboarding', el: 'Εξατομικευμένη ένταξη' },
  programManagement: { en: 'Programme management', el: 'Διαχείριση προγραμμάτων' },
  communityModules: { en: 'Community modules', el: 'Ενότητες κοινότητας' },
  advancedExports: { en: 'Advanced exports', el: 'Προηγμένες εξαγωγές' },
  featureFlags: { en: 'Feature flags', el: 'Σημαίες λειτουργιών' },
};

/**
 * The short list each plan card shows, on /pricing and on the billing page.
 * Limits (messages, connections) live here rather than in PLAN_FEATURES,
 * which only says whether a feature is on.
 */
export const PLAN_HIGHLIGHTS: Record<'free' | 'pro' | 'team' | 'enterprise', { en: string; el: string }[]> = {
  free: [
    { en: 'Basic profile & discovery', el: 'Βασικό προφίλ και αναζήτηση' },
    { en: '50 messages per month', el: '50 μηνύματα τον μήνα' },
    { en: '10 connection requests', el: '10 αιτήματα σύνδεσης' },
    { en: 'Access to public events', el: 'Πρόσβαση σε δημόσιες εκδηλώσεις' },
    { en: 'Community support', el: 'Υποστήριξη από την κοινότητα' },
  ],
  pro: [
    { en: 'Everything in Free', el: 'Όλα όσα έχει το Free' },
    { en: 'Unlimited messages', el: 'Απεριόριστα μηνύματα' },
    { en: 'Unlimited connections', el: 'Απεριόριστες συνδέσεις' },
    { en: 'Advanced matching filters', el: 'Προηγμένα φίλτρα αντιστοίχισης' },
    { en: PROMOTED_COPY.plan.en, el: PROMOTED_COPY.plan.el },
    { en: 'Mentor booking', el: 'Κρατήσεις μεντόρων' },
    { en: 'Basic analytics', el: 'Βασικά στατιστικά' },
  ],
  team: [
    { en: 'Everything in Pro', el: 'Όλα όσα έχει το Pro' },
    { en: 'Up to 25 team members', el: 'Έως 25 μέλη ομάδας' },
    { en: 'Organization branding', el: 'Επωνυμία οργανισμού' },
    { en: 'Advanced analytics', el: 'Προηγμένα στατιστικά' },
    { en: 'Program management', el: 'Διαχείριση προγραμμάτων' },
    { en: 'Email support', el: 'Υποστήριξη μέσω email' },
  ],
  enterprise: [
    { en: 'Everything in Team', el: 'Όλα όσα έχει το Team' },
    { en: 'Unlimited seats', el: 'Απεριόριστες θέσεις' },
    { en: 'Custom domain', el: 'Δικό σας domain' },
    { en: 'SSO integration', el: 'Ενσωμάτωση SSO' },
    { en: 'API access', el: 'Πρόσβαση στο API' },
    { en: '24/7 priority support', el: 'Υποστήριξη προτεραιότητας 24/7' },
    { en: 'Custom onboarding', el: 'Εξατομικευμένη ένταξη' },
    { en: 'SLA guarantee', el: 'Εγγύηση SLA' },
  ],
};

/** Returns true if the given plan includes the feature. */
export function planHasFeature(planName: string, feature: PlanFeatureKey): boolean {
  const features = PLAN_FEATURES[planName] ?? PLAN_FEATURES.free;
  const value = features[feature];
  return Boolean(value);
}

/** Cents to display string. E.g. 1900 → "$19" */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Compute annual savings % vs paying monthly × 12 */
export function annualSavingsPct(monthlyPriceCents: number, annualPriceCents: number): number {
  if (monthlyPriceCents === 0) return 0;
  const monthlyCost12 = monthlyPriceCents * 12;
  return Math.round(((monthlyCost12 - annualPriceCents) / monthlyCost12) * 100);
}

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-status-success-bg text-status-success border-status-success-border',
  trialing: 'bg-status-info-bg text-status-info border-status-info-border',
  past_due: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  canceled: 'bg-gray-500/10 text-muted-foreground border-gray-500/20',
  unpaid: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  incomplete: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  incomplete_expired: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  paused: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
};
