'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, Search, TrendingUp, CreditCard, Building2,
  AlertTriangle, CheckCircle2, Clock, XCircle, Plus, Trash2,
  RefreshCw, Loader2, FileText, Download, Tag, Settings,
  ChevronDown, Users, Crown,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  getAdminBillingStats, listAdminSubscriptions, listAdminInvoices,
  adminCreatePlan, adminUpdatePlan, adminDeletePlan,
  adminOverrideSubscription, adminExtendTrial, adminCancelSubscription,
  listCoupons, createCoupon, deleteCoupon,
  type BillingSubscription, type BillingInvoice, type BillingPlanItem, type PromotionCodeItem,
} from '@/lib/api';
import { formatCents, STATUS_COLORS } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { bilingualInline } from '@/lib/i18n/format';

const ALL_STATUSES = 'all';

/** Who a subscription belongs to, as the row and the assistant both name it. */
function subscriptionOwner(sub: BillingSubscription): string {
  const owner = (sub as Record<string, unknown>).user as { email?: string } | null
    ?? (sub as Record<string, unknown>).tenant as { name?: string } | null;
  return (owner as { email?: string })?.email
    ?? (owner as { name?: string })?.name
    ?? sub.userId ?? sub.tenantId ?? '—';
}

function SubRow({
  sub, plans, onExtendTrial, onCancel, onOverride,
}: {
  sub: BillingSubscription;
  plans: BillingPlanItem[];
  onExtendTrial: (id: string) => void;
  onCancel: (id: string, immediate: boolean) => void;
  onOverride: (sub: BillingSubscription) => void;
}) {
  const ownerLabel = subscriptionOwner(sub);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[200px]">{ownerLabel}</span>
          <Badge variant="outline" className={cn('text-xs capitalize shrink-0', STATUS_COLORS[sub.status] ?? '')}>
            <StatusText value={sub.status} />
          </Badge>
          <Badge variant="outline" className="text-xs shrink-0">{sub.plan?.displayName ?? '—'}</Badge>
        </div>
        <p className="text-xs text-muted-foreground capitalize">
          {sub.billingCycle} · {sub.currentPeriodEnd ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}` : ''}
          {sub.seatLimit ? ` · ${sub.activeSeatCount}/${sub.seatLimit} seats` : ''}
        </p>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-sm font-semibold">
          {formatCents(sub.billingCycle === 'annual' ? (sub.plan?.priceAnnual ?? 0) : (sub.plan?.priceMonthly ?? 0), sub.plan?.currency)}
        </p>
        <p className="text-xs text-muted-foreground">/{sub.billingCycle === 'annual' ? 'yr' : 'mo'}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOverride(sub)}>
          <Settings className="icon-sm mr-1" aria-hidden="true" /><BilingualText en="Override" el="Παράκαμψη" compact />
        </Button>
        {sub.status === 'trialing' && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onExtendTrial(sub.id)}>
            <Clock className="icon-sm mr-1" aria-hidden="true" />+7d
          </Button>
        )}
        {sub.status !== 'canceled' && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive-accessible hover:text-destructive-accessible" onClick={() => onCancel(sub.id, false)}>
            <XCircle className="icon-sm mr-1" /><BilingualText en="Cancel" el="Ακύρωση" compact />
          </Button>
        )}
      </div>
    </div>
  );
}

function InvRow({ inv }: { inv: BillingInvoice }) {
  const statusColors: Record<string, string> = {
    paid: 'bg-status-success-bg text-status-success border-status-success-border',
    open: 'bg-status-info-bg text-status-info border-status-info-border',
    draft: 'bg-muted text-muted-foreground border-border',
    void: 'bg-muted text-muted-foreground border-border',
    uncollectible: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  };
  const sub = (inv as Record<string, unknown>).subscription as { user?: { email?: string }; tenant?: { name?: string } } | null;
  const ownerLabel = sub?.user?.email ?? sub?.tenant?.name ?? inv.subscriptionId.slice(0, 8);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <FileText className="icon-sm text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{inv.invoiceNumber}</span>
          <Badge variant="outline" className={cn('text-xs capitalize', statusColors[inv.status] ?? '')}><StatusText value={inv.status} /></Badge>
        </div>
        <p className="text-xs text-muted-foreground">{ownerLabel} · {new Date(inv.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</p>
      </div>
      <p className="text-sm font-semibold shrink-0">{formatCents(inv.total, inv.currency)}</p>
      {inv.hostedInvoiceUrl && (
        // A <button> inside an <a> is two interactive elements nested - one
        // tab stop too many and axe nested-interactive. The link is the control.
        <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" aria-label={`Download invoice ${inv.invoiceNumber}`}>
            <Download className="icon-sm" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}

export default function AdminBillingPage() {
  const qc = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  // Radix <Select.Item> forbids an empty-string value (it is reserved for
  // "cleared"), so the no-filter option carries a sentinel that is mapped
  // back to `undefined` at the query boundary.
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [overrideTarget, setOverrideTarget] = useState<BillingSubscription | null>(null);
  const [overridePlanId, setOverridePlanId] = useState('');
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percent', discountValue: 10, maxRedemptions: '' as string | number });
  const [tab, setTab] = useState('subscriptions');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: qk('admin', 'billing', 'stats'),
    queryFn: getAdminBillingStats,
    staleTime: 60_000,
  });

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: qk('admin', 'billing', 'subscriptions', statusFilter, search),
    queryFn: () => listAdminSubscriptions({ status: statusFilter === ALL_STATUSES ? undefined : statusFilter, search: search || undefined }),
    staleTime: 30_000,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: qk('admin', 'billing', 'invoices', statusFilter),
    queryFn: () => listAdminInvoices({ status: statusFilter === ALL_STATUSES ? undefined : statusFilter }),
    staleTime: 30_000,
  });

  const { data: couponsData, isLoading: couponsLoading } = useQuery({
    queryKey: qk('admin', 'billing', 'coupons'),
    queryFn: listCoupons,
    staleTime: 60_000,
  });

  // `?? []` only guards nullishness. A payload that arrives as an object —
  // a paginated envelope, or a stub answering an endpoint it does not model —
  // passes straight through it and throws on the first `.map`. These four fed
  // three tables and a card grid, and took the page to its error boundary.
  const plans = Array.isArray(statsData?.plans) ? statsData.plans : [];
  const subs = Array.isArray(subsData) ? subsData : [];
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];
  const coupons = Array.isArray(couponsData) ? couponsData : [];

  const { mutate: extendTrial, mutateAsync: extendTrialAsync } = useMutation({
    mutationFn: (id: string) => adminExtendTrial(id, 7),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('admin', 'billing', 'subscriptions') }); toastSuccess('Trial extended by 7 days'); },
    onError: () => toastError('Failed to extend trial'),
  });

  const { mutate: cancelSub, mutateAsync: cancelSubAsync } = useMutation({
    mutationFn: ({ id, immediate }: { id: string; immediate: boolean }) => adminCancelSubscription(id, immediate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('admin', 'billing', 'subscriptions') }); toastSuccess('Subscription canceled'); },
    onError: () => toastError('Failed to cancel'),
  });

  const { mutate: applyOverride, isPending: overriding } = useMutation({
    mutationFn: () => adminOverrideSubscription(overrideTarget!.id, { planId: overridePlanId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('admin', 'billing', 'subscriptions') });
      setOverrideTarget(null);
      toastSuccess('Plan override applied');
    },
    onError: () => toastError('Override failed'),
  });

  const { mutate: saveCoupon, isPending: savingCoupon } = useMutation({
    mutationFn: () => createCoupon({
      code: couponForm.code,
      discountType: couponForm.discountType,
      discountValue: Number(couponForm.discountValue),
      maxRedemptions: couponForm.maxRedemptions ? Number(couponForm.maxRedemptions) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('admin', 'billing', 'coupons') });
      setShowCouponForm(false);
      setCouponForm({ code: '', discountType: 'percent', discountValue: 10, maxRedemptions: '' });
      toastSuccess('Coupon created');
    },
    onError: () => toastError('Failed to create coupon'),
  });

  const { mutate: removeCoupon, mutateAsync: removeCouponAsync } = useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('admin', 'billing', 'coupons') }); toastSuccess('Coupon deactivated'); },
    onError: () => toastError('Failed to remove coupon'),
  });

  const mrr = statsData?.mrrCents ?? 0;
  const arr = mrr * 12;

  const subRow = (sub: BillingSubscription) => {
    const name = `${subscriptionOwner(sub)} · ${sub.plan?.displayName ?? sub.planId}`;
    return { value: sub.id, labelEn: name, labelEl: name };
  };
  usePageList([
    {
      id: 'subscriptions',
      labelEn: 'Subscriptions',
      labelEl: 'Συνδρομές',
      rows: subsLoading ? undefined : subs.map((s) =>
        `${subscriptionOwner(s)} · ${s.plan?.displayName ?? s.planId} · ${s.status}${s.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}`,
      ),
    },
    {
      id: 'invoices',
      labelEn: 'Invoices',
      labelEl: 'Τιμολόγια',
      rows: invoicesLoading ? undefined : invoices.map((i) => `${i.invoiceNumber} · ${formatCents(i.total, i.currency)} · ${i.status}`),
    },
    {
      id: 'coupons',
      labelEn: 'Coupons',
      labelEl: 'Κουπόνια',
      rows: couponsLoading ? undefined : coupons.map((c) =>
        `${c.code} · ${c.discountType === 'percent' ? `${c.discountValue}% off` : formatCents(c.discountValue)} · ${c.timesRedeemed}${c.maxRedemptions ? `/${c.maxRedemptions}` : ''} redeemed`,
      ),
    },
  ]);
  usePageControls([
    choiceControl('status_filter', 'Status filter', 'Φίλτρο κατάστασης', [
      { value: ALL_STATUSES, en: 'All statuses', el: 'Όλες οι καταστάσεις' },
      { value: 'active', en: 'Active', el: 'Ενεργή' },
      { value: 'trialing', en: 'Trialing', el: 'Σε δοκιμή' },
      { value: 'past_due', en: 'Past due', el: 'Ληξιπρόθεσμη' },
      { value: 'canceled', en: 'Canceled', el: 'Ακυρωμένη' },
    ], statusFilter, setStatusFilter),
    choiceControl('billing_tab', 'Billing section', 'Ενότητα χρεώσεων', [
      { value: 'subscriptions', en: 'Subscriptions', el: 'Συνδρομές' },
      { value: 'invoices', en: 'Invoices', el: 'Τιμολόγια' },
      { value: 'plans', en: 'Plans', el: 'Πακέτα' },
      { value: 'coupons', en: 'Coupons', el: 'Κουπόνια' },
    ], tab, setTab),
    { id: 'refresh', labelEn: 'Refresh billing data', labelEl: 'Ανανέωση δεδομένων χρεώσεων', writes: false, run: () => void qc.invalidateQueries({ queryKey: qk('admin', 'billing') }) },
    { id: 'new_coupon', labelEn: 'Open the new coupon form', labelEl: 'Άνοιγμα φόρμας νέου κουπονιού', writes: false, run: () => { setTab('coupons'); setShowCouponForm(true); } },
    {
      id: 'override_plan',
      labelEn: 'Override a subscription plan',
      labelEl: 'Αλλαγή πακέτου συνδρομής',
      writes: false,
      options: subs.map(subRow),
      run: (value) => {
        const sub = subs.find((s) => s.id === value);
        if (sub) { setOverrideTarget(sub); setOverridePlanId(sub.planId); }
      },
    },
    {
      id: 'extend_trial',
      labelEn: 'Extend trial by 7 days',
      labelEl: 'Παράταση δοκιμής κατά 7 ημέρες',
      writes: true,
      options: subs.filter((s) => s.status === 'trialing').map(subRow),
      run: async (value) => { if (value) await extendTrialAsync(value); },
    },
    {
      id: 'cancel_subscription',
      labelEn: 'Cancel subscription',
      labelEl: 'Ακύρωση συνδρομής',
      writes: true,
      options: subs.filter((s) => s.status !== 'canceled').map(subRow),
      run: async (value) => { if (value) await cancelSubAsync({ id: value, immediate: false }); },
    },
    {
      id: 'deactivate_coupon',
      labelEn: 'Deactivate coupon',
      labelEl: 'Απενεργοποίηση κουπονιού',
      writes: true,
      options: coupons.map((c) => ({ value: c.id, labelEn: c.code, labelEl: c.code })),
      run: async (value) => { if (value) await removeCouponAsync(value); },
    },
  ]);

  /*
   * The page rail: revenue figures, the status filter and Refresh are about
   * the lists, not the lists themselves. The column keeps the tabs, the
   * search and the rows.
   */
  const rail: PageRailSection[] = [
    {
      id: 'metrics',
      glyph: 'chart',
      labelEn: 'Revenue metrics',
      labelEl: 'Οικονομικά',
      badge: statsData?.pastDueSubs || null,
      content: (
        <div className="space-y-2">
          {[
            { label: 'MRR', value: formatCents(mrr), icon: DollarSign, color: 'text-status-success' },
            { label: 'ARR (est.)', value: formatCents(arr), icon: TrendingUp, color: 'text-status-info' },
            { label: 'Active Subs', value: statsData?.activeSubs ?? '—', icon: CheckCircle2, color: 'text-status-accent' },
            { label: 'Past Due', value: statsData?.pastDueSubs ?? '—', icon: AlertTriangle, color: 'text-status-warning' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Icon className={cn('icon-sm', color)} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <p className="page-stat text-xl font-bold mt-1">
                {statsLoading ? <Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /> : value}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Status filter',
      labelEl: 'Φίλτρο κατάστασης',
      badge: statusFilter !== ALL_STATUSES ? 1 : null,
      content: (
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Subscription status">
            <SelectValue placeholder={bilingualInline("All statuses", "Όλες οι καταστάσεις")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}><BilingualText en="All statuses" el="Όλες οι καταστάσεις" compact /></SelectItem>
            <SelectItem value="active"><BilingualText en="Active" el="Ενεργή" compact /></SelectItem>
            <SelectItem value="trialing"><BilingualText en="Trialing" el="Σε δοκιμή" compact /></SelectItem>
            <SelectItem value="past_due"><BilingualText en="Past due" el="Ληξιπρόθεσμη" compact /></SelectItem>
            <SelectItem value="canceled"><BilingualText en="Canceled" el="Ακυρωμένη" compact /></SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Billing tools',
      labelEl: 'Εργαλεία χρεώσεων',
      content: (
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: qk('admin', 'billing') })}
          className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
        >
          <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1"><BilingualText en="Refresh billing data" el="Ανανέωση δεδομένων" compact wrap /></span>
        </button>
      ),
    },
  ];

  return (
    <AppShell rail={rail}>
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <TabsList>
              <TabsTrigger value="subscriptions"><BilingualText en="Subscriptions" el="Συνδρομές" compact /></TabsTrigger>
              <TabsTrigger value="invoices"><BilingualText en="Invoices" el="Τιμολόγια" compact /></TabsTrigger>
              <TabsTrigger value="plans"><BilingualText en="Plans" el="Πλάνα" compact /></TabsTrigger>
              <TabsTrigger value="coupons"><BilingualText en="Coupons" el="Κουπόνια" compact /></TabsTrigger>
            </TabsList>
            <div className="flex gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                <Input
                  aria-label={bilingualInline("Search billing records", "Αναζήτηση εγγραφών χρέωσης")}
                  placeholder={bilingualInline("Search…", "Αναζήτηση…")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 w-48 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Subscriptions tab */}
          <TabsContent value="subscriptions" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {subsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /></div>
                ) : subs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <BilingualText en="No subscriptions found" el="Δεν βρέθηκαν συνδρομές" compact />
                    <span className="mt-1 block text-xs"><BilingualText en="Subscriptions appear here once an organization picks a plan." el="Οι συνδρομές εμφανίζονται εδώ μόλις ένας οργανισμός επιλέξει πλάνο." compact /></span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {subs.map(sub => (
                      <SubRow
                        key={sub.id}
                        sub={sub}
                        plans={plans}
                        onExtendTrial={id => extendTrial(id)}
                        onCancel={(id, immediate) => cancelSub({ id, immediate })}
                        onOverride={s => { setOverrideTarget(s); setOverridePlanId(s.planId); }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices tab */}
          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {invoicesLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /></div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground"><BilingualText en="No invoices found" el="Δεν βρέθηκαν τιμολόγια" compact /></div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {invoices.map(inv => <InvRow key={inv.id} inv={inv} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans tab */}
          <TabsContent value="plans" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base"><BilingualText en="Billing Plans" el="Πλάνα χρέωσης" compact /></CardTitle>
                  <p className="text-xs text-muted-foreground"><BilingualText en="Edit plan details via the API or admin actions." el="Επεξεργαστείτε τα πλάνα μέσω API ή ενεργειών διαχείρισης." wrap /></p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /></div>
                ) : plans.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground"><BilingualText en="No plans configured" el="Δεν έχουν οριστεί πλάνα" compact /></div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {plans.map(plan => (
                      <div key={plan.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                          <Crown className="icon-sm text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{plan.displayName}</span>
                            <Badge variant="outline" className="text-xs"><StatusText value={plan.planType} /></Badge>
                            {!plan.isActive && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground"><BilingualText en="Inactive" el="Ανενεργό" compact /></Badge>}
                            {!plan.isPublic && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground"><BilingualText en="Private" el="Ιδιωτικό" compact /></Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatCents(plan.priceMonthly)}/mo · {formatCents(plan.priceAnnual)}/yr
                            {plan.seatLimit ? ` · ${plan.seatLimit} seats` : ' · Unlimited seats'}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {(statsData?.totalSubs ?? 0)} active
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons tab */}
          <TabsContent value="coupons" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2" onClick={() => setShowCouponForm(!showCouponForm)}>
                <Plus className="icon-sm" />
                <BilingualText en="New coupon" el="Νέο κουπόνι" compact />
              </Button>
            </div>

            {showCouponForm && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm"><BilingualText en="Create coupon" el="Δημιουργία κουπονιού" compact /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="code">Code *</Label>
                      <Input id="code"
                        placeholder="LAUNCH30"
                        value={couponForm.code}
                        onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="discountType"><BilingualText en="Discount type" el="Τύπος έκπτωσης" compact /></Label>
                      <Select value={couponForm.discountType} onValueChange={v => setCouponForm(p => ({ ...p, discountType: v }))}>
                        <SelectTrigger id="discountType" aria-label="Discount type" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent"><BilingualText en="Percent" el="Ποσοστό" compact /></SelectItem>
                          <SelectItem value="fixed"><BilingualText en="Fixed amount" el="Σταθερό ποσό" compact /></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="discountValue">Value ({couponForm.discountType === 'percent' ? '%' : '$'})</Label>
                      <Input id="discountValue"
                        type="number"
                        value={couponForm.discountValue}
                        onChange={e => setCouponForm(p => ({ ...p, discountValue: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="maxRedemptions"><BilingualText en="Max redemptions (optional)" el="Μέγιστες χρήσεις (προαιρετικά)" compact /></Label>
                      <Input id="maxRedemptions"
                        type="number"
                        placeholder={bilingualInline("Unlimited", "Απεριόριστο")}
                        value={couponForm.maxRedemptions}
                        onChange={e => setCouponForm(p => ({ ...p, maxRedemptions: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => saveCoupon()} disabled={savingCoupon || !couponForm.code}>
                      {savingCoupon && <Loader2 className="mr-1.5 icon-sm animate-spin" />}
                      Create
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCouponForm(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                {couponsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /></div>
                ) : coupons.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground"><BilingualText en="No coupons yet" el="Δεν υπάρχουν κουπόνια ακόμα" compact /></div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {coupons.map(coupon => (
                      <div key={coupon.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                          <Tag className="icon-sm text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-semibold">{coupon.code}</span>
                            {!coupon.isActive && <Badge variant="outline" className="text-xs bg-muted text-muted-foreground"><BilingualText en="Inactive" el="Ανενεργό" compact /></Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : formatCents(coupon.discountValue)} ·
                            {coupon.timesRedeemed}/{coupon.maxRedemptions ?? '∞'} used
                            {coupon.validUntil ? ` · Expires ${new Date(coupon.validUntil).toLocaleDateString('en-GB', { timeZone: 'UTC' })}` : ''}
                          </p>
                        </div>
                        {coupon.isActive && (
                          <Button aria-label="Delete"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive-accessible hover:text-destructive-accessible shrink-0"
                            onClick={() => removeCoupon(coupon.id)}
                          >
                            <Trash2 className="icon-sm" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Override Dialog */}
      <Dialog open={Boolean(overrideTarget)} onOpenChange={open => !open && setOverrideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><BilingualText en="Override Subscription Plan" el="Παράκαμψη πλάνου συνδρομής" compact /></DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <DialogDescription><BilingualText en="Select a new plan to apply immediately. This bypasses payment." el="Επιλέξτε νέο πλάνο που εφαρμόζεται αμέσως, χωρίς πληρωμή." wrap /></DialogDescription>
            <div className="space-y-1.5">
              <Label htmlFor="overridePlanId"><BilingualText en="New plan" el="Νέο πλάνο" compact /></Label>
              <Select value={overridePlanId} onValueChange={setOverridePlanId}>
                <SelectTrigger id="overridePlanId" aria-label="New plan">
                  <SelectValue placeholder={bilingualInline("Select plan", "Επιλογή πακέτου")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
            <Button onClick={() => applyOverride()} disabled={overriding || !overridePlanId}>
              {overriding && <Loader2 className="mr-1.5 icon-sm animate-spin" />}
              Apply override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
