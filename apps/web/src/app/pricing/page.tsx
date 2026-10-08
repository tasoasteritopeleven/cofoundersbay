'use client';

// ──────────────────────────────────────────────────────────────────────────────
// Full rewrite — pricing page backed by real /api/billing/plans data
// ──────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Sparkles,
  Building2,
  Users,
  Crown,
  Zap,
  Shield,
  MessageCircle,
  Calendar,
  BarChart3,
  Palette,
  Key,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { listBillingPlans, createBillingCheckout, type BillingPlanItem } from '@/lib/api';
import { formatCents, annualSavingsPct, PLAN_HIGHLIGHTS } from '@/lib/billing';
import { useSession } from '@/hooks/useSession';
import { LandingNav } from '@/components/layout/LandingNav';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';

type PlanFeature = {
  name: string;
  nameEl: string;
  free: boolean | string;
  pro: boolean | string;
  team: boolean | string;
  enterprise: boolean | string;
};

const FEATURES: PlanFeature[] = [
  { name: 'Profile & Discovery', nameEl: 'Προφίλ και αναζήτηση', free: true, pro: true, team: true, enterprise: true },
  { name: 'Basic Matching', nameEl: 'Βασική αντιστοίχιση', free: true, pro: true, team: true, enterprise: true },
  { name: 'Direct Messages', nameEl: 'Άμεσα μηνύματα', free: '50/month', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Connection Requests', nameEl: 'Αιτήματα σύνδεσης', free: '10/month', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Event Access', nameEl: 'Πρόσβαση σε εκδηλώσεις', free: true, pro: true, team: true, enterprise: true },
  { name: 'Advanced Matching Filters', nameEl: 'Προηγμένα φίλτρα αντιστοίχισης', free: false, pro: true, team: true, enterprise: true },
  // Sold before it existed; it is now a labelled "Promoted" slot (shared promotion rules).
  { name: 'Promoted placement in discovery (labelled “Promoted”)', nameEl: 'Προωθημένη θέση στην αναζήτηση (με την ένδειξη «Προώθηση»)', free: false, pro: true, team: true, enterprise: true },
  { name: 'Mentor Booking', nameEl: 'Κρατήσεις μεντόρων', free: false, pro: true, team: true, enterprise: true },
  { name: 'Analytics Dashboard', nameEl: 'Πίνακας στατιστικών', free: false, pro: 'Basic', team: 'Advanced', enterprise: 'Custom' },
  { name: 'Team Members', nameEl: 'Μέλη ομάδας', free: false, pro: false, team: 'Up to 25', enterprise: 'Unlimited' },
  { name: 'Organization Branding', nameEl: 'Επωνυμία οργανισμού', free: false, pro: false, team: true, enterprise: true },
  { name: 'Custom Domain', nameEl: 'Δικό σας domain', free: false, pro: false, team: false, enterprise: true },
  { name: 'SSO Integration', nameEl: 'Ενσωμάτωση SSO', free: false, pro: false, team: false, enterprise: true },
  { name: 'API Access', nameEl: 'Πρόσβαση στο API', free: false, pro: false, team: false, enterprise: true },
  { name: 'Dedicated Support', nameEl: 'Αποκλειστική υποστήριξη', free: false, pro: false, team: 'Email', enterprise: '24/7 Priority' },
  { name: 'Custom Onboarding', nameEl: 'Εξατομικευμένη ένταξη', free: false, pro: false, team: false, enterprise: true },
];

const PLANS = [
  {
    id: 'free',
    apiName: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    descriptionEl: 'Ιδανικό για να ξεκινήσετε',
    priceMonthly: 0,
    priceAnnual: 0,
    icon: Zap,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    popular: false,
    cta: 'Get Started',
    ctaEl: 'Ξεκινήστε',
    features: PLAN_HIGHLIGHTS.free,
  },
  {
    id: 'pro',
    apiName: 'premium',
    name: 'Pro',
    description: 'For serious founders & mentors',
    descriptionEl: 'Για ιδρυτές και μέντορες που το εννοούν',
    priceMonthly: 19,
    priceAnnual: 159,
    icon: Sparkles,
    color: 'text-primary-accessible',
    bgColor: 'bg-primary/10',
    popular: true,
    cta: 'Choose Pro',
    ctaEl: 'Επιλογή Pro',
    features: PLAN_HIGHLIGHTS.pro,
  },
  {
    id: 'team',
    apiName: 'team',
    name: 'Team',
    description: 'For accelerators & organizations',
    descriptionEl: 'Για επιταχυντές και οργανισμούς',
    priceMonthly: 99,
    priceAnnual: 899,
    icon: Users,
    color: 'text-status-accent',
    bgColor: 'bg-status-accent-bg',
    popular: false,
    cta: 'Choose Team',
    ctaEl: 'Επιλογή Team',
    features: PLAN_HIGHLIGHTS.team,
  },
  {
    id: 'enterprise',
    apiName: 'enterprise',
    name: 'Enterprise',
    description: 'For large institutions',
    descriptionEl: 'Για μεγάλους φορείς',
    priceMonthly: null,
    priceAnnual: null,
    icon: Building2,
    color: 'text-status-warning',
    bgColor: 'bg-status-warning-bg',
    popular: false,
    cta: 'Contact Sales',
    ctaEl: 'Επικοινωνία με πωλήσεις',
    features: PLAN_HIGHLIGHTS.enterprise,
  },
];

const VALUE_EL: Record<string, string> = {
  '50/month': '50/μήνα',
  '10/month': '10/μήνα',
  Unlimited: 'Απεριόριστα',
  Basic: 'Βασικό',
  Advanced: 'Προηγμένο',
  Custom: 'Κατά περίπτωση',
  'Up to 25': 'Έως 25',
  Email: 'Email',
  '24/7 Priority': 'Προτεραιότητα 24/7',
};

/** `relative`: the sr-only name must not escape the table's horizontal scroller. */
function FeatureCheck({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="relative inline-flex">
        <Check className="icon-sm text-status-success" aria-hidden="true" />
        <span className="sr-only">{bilingualAria('Included', 'Περιλαμβάνεται')}</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="relative inline-flex">
        <X className="icon-sm text-muted-foreground/40" aria-hidden="true" />
        <span className="sr-only">{bilingualAria('Not included', 'Δεν περιλαμβάνεται')}</span>
      </span>
    );
  }
  return <span className="text-xs font-medium text-foreground"><BilingualText en={value} el={VALUE_EL[value] ?? value} compact /></span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { hasSession } = useSession();

  const { data: plansData } = useQuery({
    queryKey: qk('billing', 'plans'),
    queryFn: listBillingPlans,
    staleTime: 10 * 60_000,
  });

  const apiPlans = plansData?.plans ?? [];

  async function handleCheckout(plan: typeof PLANS[0]) {
    if (plan.id === 'enterprise') { window.location.href = 'mailto:enterprise@cofounderbay.com?subject=Enterprise%20plan'; return; }
    if (!hasSession) { window.location.href = '/register'; return; }
    const apiPlan = apiPlans.find(p => p.name === plan.apiName);
    const priceId = annual ? apiPlan?.stripePriceIdAnnual : apiPlan?.stripePriceIdMonthly;
    setCheckoutLoading(plan.id);
    try {
      const { url } = await createBillingCheckout(priceId ?? undefined);
      if (url) window.location.href = url;
      else window.location.href = '/settings/billing';
    } finally {
      setCheckoutLoading(null);
    }
  }

  // Use real API prices if available, fall back to static
  function getPlanPrice(plan: typeof PLANS[0]) {
    const api = apiPlans.find(p => p.name === plan.apiName);
    if (!api) return annual ? plan.priceAnnual : plan.priceMonthly;
    return annual ? Math.round(api.priceAnnual / 100) : Math.round(api.priceMonthly / 100);
  }

  function getSavings(plan: typeof PLANS[0]) {
    const api = apiPlans.find(p => p.name === plan.apiName);
    if (!api || api.priceMonthly === 0) return plan.id === 'pro' ? 30 : plan.id === 'team' ? 24 : 0;
    return annualSavingsPct(api.priceMonthly, api.priceAnnual);
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      {/* Header */}
      <div className="border-b border-border bg-primary/[0.03] pt-[52px]">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <Badge variant="secondary" className="mb-4">
            <Crown className="mr-1.5 icon-sm" />
            <BilingualText en="Simple, transparent pricing" el="Απλές, διαφανείς τιμές" compact />
          </Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            <BilingualText en="Choose the plan that fits your journey" el="Επιλέξτε το πλάνο που ταιριάζει στη διαδρομή σας" wrap />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            <BilingualText en="Start free, with no time limit. A paid plan starts when you subscribe and can be cancelled at any time." el="Ξεκινήστε δωρεάν, χωρίς χρονικό όριο. Ένα πληρωμένο πλάνο ξεκινά όταν εγγραφείτε συνδρομητές και ακυρώνεται οποτεδήποτε." wrap />
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-border bg-secondary/40 p-0.5">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                !annual ? 'bg-background text-foreground' : 'text-muted-foreground',
              )}
            >
              <BilingualText en="Monthly" el="Μηνιαία" compact />
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                annual ? 'bg-background text-foreground' : 'text-muted-foreground',
              )}
            >
              <BilingualText en="Annual" el="Ετήσια" compact />
            </button>
            {annual && (
              <span className="ml-2 pr-2 text-xs text-status-success">
                {(() => {
                  const most = Math.max(...PLANS.filter(p => p.priceMonthly).map(p => getSavings(p)));
                  return <BilingualText en={`Save up to ${most}%`} el={`Έως ${most}% έκπτωση`} compact />;
                })()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = getPlanPrice(plan);
            const isEnterprise = plan.id === 'enterprise';
            const isFree = plan.id === 'free';
            const savings = getSavings(plan);

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col border border-border transition-colors duration-300 hover:border-foreground/20',
                  plan.popular && 'border-primary ring-1 ring-primary/20'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm"><BilingualText en="Most Popular" el="Πιο δημοφιλές" compact /></Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', plan.bgColor)}>
                    <Icon className={cn('icon-md', plan.color)} />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription><BilingualText en={plan.description} el={plan.descriptionEl} wrap /></CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  {/* Price */}
                  <div className="mb-6">
                    {isEnterprise ? (
                      <div className="text-3xl font-bold text-foreground"><BilingualText en="Custom" el="Κατά περίπτωση" compact /></div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">${price}</span>
                        <span className="text-muted-foreground">/{annual ? 'yr' : 'mo'}</span>
                      </div>
                    )}
                    {!isEnterprise && !isFree && annual && savings > 0 && (
                      <p className="mt-1 text-xs text-status-success font-medium"><BilingualText en={`${savings}% off vs monthly`} el={`${savings}% φθηνότερα από το μηνιαίο`} compact /></p>
                    )}
                    {!isEnterprise && !isFree && !annual && (
                      <p className="mt-1 text-xs text-muted-foreground"><BilingualText en={`Save ${savings}% with annual billing`} el={`Εξοικονόμηση ${savings}% με ετήσια χρέωση`} compact /></p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature.en} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 icon-sm shrink-0 text-status-success" aria-hidden="true" />
                        <span className="text-muted-foreground"><BilingualText en={feature.en} el={feature.el} wrap /></span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className={cn('w-full gap-2', plan.popular && 'bg-primary hover:bg-primary/90')}
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={checkoutLoading === plan.id}
                    onClick={() => handleCheckout(plan)}
                  >
                    {checkoutLoading === plan.id
                      ? <BilingualText en="Redirecting…" el="Ανακατεύθυνση…" compact />
                      : <BilingualText en={plan.cta} el={plan.ctaEl} compact />}
                    {checkoutLoading !== plan.id && <ArrowRight className="icon-sm" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="border-t border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-semibold text-foreground">
            <BilingualText en="Compare all features" el="Σύγκριση όλων των δυνατοτήτων" compact />
          </h2>

          {/* A scroll container that a keyboard user cannot reach is a WCAG 2.1.1
              failure on narrow viewports, where this table is the only way to
              read the comparison. tabIndex + a group role make it focusable and
              scrollable with the arrow keys. */}
          <div
            className="focus-ring overflow-x-auto rounded-md"
            tabIndex={0}
            role="group"
            aria-label="Plan feature comparison, scrolls horizontally"
          >
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 text-left text-sm font-semibold text-foreground"><BilingualText en="Feature" el="Δυνατότητα" compact /></th>
                  <th className="py-4 text-center text-sm font-semibold text-foreground"><BilingualText en="Free" el="Δωρεάν" compact /></th>
                  <th className="py-4 text-center text-sm font-semibold text-primary-accessible">Pro</th>
                  <th className="py-4 text-center text-sm font-semibold text-foreground"><BilingualText en="Team" el="Ομάδα" compact /></th>
                  <th className="py-4 text-center text-sm font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr key={feature.name} className={cn('border-b border-border', i % 2 === 0 && 'bg-card/50')}>
                    <td className="py-3 text-sm text-muted-foreground"><BilingualText en={feature.name} el={feature.nameEl} wrap /></td>
                    <td className="py-3 text-center">
                      <div className="flex justify-center">
                        <FeatureCheck value={feature.free} />
                      </div>
                    </td>
                    <td className="py-3 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <FeatureCheck value={feature.pro} />
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex justify-center">
                        <FeatureCheck value={feature.team} />
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex justify-center">
                        <FeatureCheck value={feature.enterprise} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-semibold text-foreground">
          <BilingualText en="Frequently asked questions" el="Συχνές ερωτήσεις" compact />
        </h2>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          {/* Every answer says what the code does: checkout grants no trial
              (the "14-day free trial, no card" answers described nothing that
              existed), and plan changes and cancellation go through the
              payment provider's portal opened from Settings → Billing. */}
          {[
            {
              q: { en: 'Can I switch plans later?', el: 'Μπορώ να αλλάξω πλάνο αργότερα;' },
              a: { en: 'Yes. Settings → Billing opens the payment provider’s portal, where you change or cancel your plan.', el: 'Ναι. Οι Ρυθμίσεις → Τιμολόγηση ανοίγουν την πύλη του παρόχου πληρωμών, όπου αλλάζετε ή ακυρώνετε το πλάνο σας.' },
            },
            {
              q: { en: 'How do I pay?', el: 'Πώς πληρώνω;' },
              a: { en: 'By card, through Stripe. Enterprise plans can be invoiced.', el: 'Με κάρτα, μέσω Stripe. Τα πλάνα Enterprise μπορούν να τιμολογηθούν.' },
            },
            {
              q: { en: 'Is there a free trial?', el: 'Υπάρχει δωρεάν δοκιμή;' },
              a: { en: 'The Free plan has no time limit, so you can use the platform before paying. A paid plan starts when you subscribe.', el: 'Το πλάνο Free δεν έχει χρονικό όριο, οπότε χρησιμοποιείτε την πλατφόρμα πριν πληρώσετε. Ένα πληρωμένο πλάνο ξεκινά όταν εγγραφείτε συνδρομητές.' },
            },
            {
              q: { en: 'Can I cancel at any time?', el: 'Μπορώ να ακυρώσω οποτεδήποτε;' },
              a: { en: 'Yes, from the same portal. You keep access until the end of the period you paid for.', el: 'Ναι, από την ίδια πύλη. Κρατάτε την πρόσβαση μέχρι το τέλος της περιόδου που πληρώσατε.' },
            },
            {
              q: { en: 'Does paying change my match scores?', el: 'Αλλάζει η πληρωμή τις βαθμολογίες αντιστοίχισης;' },
              a: { en: 'No. Paid plans may appear in a separate slot labelled “Promoted”; scores and the order of results are the same for everyone.', el: 'Όχι. Τα πληρωμένα πλάνα μπορεί να εμφανίζονται σε χωριστή θέση με την ένδειξη «Προώθηση»· οι βαθμολογίες και η σειρά των αποτελεσμάτων είναι ίδιες για όλους.' },
            },
            {
              q: { en: 'Nonprofits and universities?', el: 'Μη κερδοσκοπικοί οργανισμοί και πανεπιστήμια;' },
              a: { en: 'Write to enterprise@cofounderbay.com; pricing for them is agreed case by case.', el: 'Γράψτε στο enterprise@cofounderbay.com· η τιμή τους συμφωνείται κατά περίπτωση.' },
            },
          ].map(({ q, a }) => (
            <div key={q.en} className="rounded-xl border border-border bg-card/50 p-5">
              <h3 className="font-semibold text-foreground"><BilingualText en={q.en} el={q.el} wrap /></h3>
              <p className="mt-2 text-sm text-muted-foreground"><BilingualText en={a.en} el={a.el} wrap /></p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t border-border bg-primary/[0.03]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            <BilingualText en="Ready to accelerate your startup journey?" el="Έτοιμοι να επιταχύνετε τη διαδρομή της startup σας;" wrap />
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            <BilingualText en="Join founders, mentors, and investors building meaningful connections." el="Ελάτε μαζί με ιδρυτές, μέντορες και επενδυτές που χτίζουν ουσιαστικές συνδέσεις." wrap />
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2" asChild>
              <Link href="/register">
                <BilingualText en="Start free" el="Ξεκινήστε δωρεάν" compact />
                <ArrowRight className="icon-sm" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="mailto:enterprise@cofounderbay.com?subject=Enterprise%20plan"><BilingualText en="Talk to sales" el="Μιλήστε με τις πωλήσεις" compact /></a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
