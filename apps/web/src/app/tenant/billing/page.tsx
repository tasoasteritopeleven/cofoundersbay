'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users, Crown, Building2, AlertTriangle, CheckCircle2, Clock,
  CreditCard, ExternalLink, Mail, FileText, Download, Loader2,
  UserMinus, UserPlus, ChevronRight, Shield,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/components/providers/TenantContext';
import {
  getTenantBillingSubscription, listTenantSeats, revokeTenantSeat,
  upsertTenantBillingContact, createBillingPortal,
  type SeatAllocation,
} from '@/lib/api';
import { formatCents, STATUS_COLORS } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';

function SeatRow({
  seat, onRevoke, revoking,
}: {
  seat: SeatAllocation;
  onRevoke: (userId: string) => void;
  revoking: boolean;
}) {
  const initials = seat.user.email.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{seat.user.email}</p>
        <p className="text-xs text-muted-foreground">
          Allocated {new Date(seat.allocatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-destructive-accessible hover:text-destructive-accessible gap-1.5 shrink-0"
        onClick={() => onRevoke(seat.userId)}
        disabled={revoking}
      >
        {revoking ? <Loader2 className="icon-sm animate-spin" /> : <UserMinus className="icon-sm" />}
        Revoke
      </Button>
    </div>
  );
}

export default function TenantBillingPage() {
  const qc = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? '';

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '', email: '', company: '', vatId: '', legalName: '',
    addressLine1: '', city: '', postalCode: '', country: 'US',
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: qk('billing', 'tenant', tenantId),
    queryFn: () => getTenantBillingSubscription(tenantId),
    enabled: Boolean(tenantId),
  });

  const { data: seatsData, isLoading: seatsLoading } = useQuery({
    queryKey: qk('billing', 'tenant', tenantId, 'seats'),
    queryFn: () => listTenantSeats(tenantId),
    enabled: Boolean(tenantId),
  });

  const { mutate: openPortal, isPending: portalLoading } = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: () => toastError('Stripe portal unavailable'),
  });

  const { mutate: saveContact, isPending: savingContact } = useMutation({
    mutationFn: () => upsertTenantBillingContact(tenantId, contactForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('billing', 'tenant', tenantId) });
      setShowContactForm(false);
      toastSuccess('Billing contact saved');
    },
    onError: () => toastError('Failed to save contact'),
  });

  async function handleRevokeSeat(userId: string) {
    setRevokingId(userId);
    try {
      await revokeTenantSeat(tenantId, userId);
      qc.invalidateQueries({ queryKey: qk('billing', 'tenant', tenantId, 'seats') });
      qc.invalidateQueries({ queryKey: qk('billing', 'tenant', tenantId) });
      toastSuccess('Seat revoked');
    } catch {
      toastError('Failed to revoke seat');
    } finally {
      setRevokingId(null);
    }
  }

  const sub = subData?.subscription;
  const seats = seatsData?.seats ?? [];
  const seatUsage = sub?.activeSeatCount ?? seats.length;
  const seatLimit = sub?.seatLimit ?? null;
  const seatPct = seatLimit ? Math.round((seatUsage / seatLimit) * 100) : null;

  return (
    <AppShell
      title="Organization Billing"
      description="Plan, seats, invoices, and payment methods for your workspace."
      actions={(
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/pricing">
            <BilingualText en="View plans" el="Προβολή πλάνων" compact />
            <ChevronRight className="icon-sm" />
          </Link>
        </Button>
      )}
    >
      <div className="space-y-6 max-w-3xl">

        {/* Plan Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base"><BilingualText en="Current Plan" el="Τρέχον πλάνο" compact /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="icon-sm animate-spin" />
                <span className="text-sm"><BilingualText en="Loading…" el="Φόρτωση…" compact /></span>
              </div>
            ) : sub ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-status-accent-bg shrink-0">
                    <Building2 className="icon-lg text-status-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{sub.plan?.displayName}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', STATUS_COLORS[sub.status] ?? '')}
                      >
                        <StatusText value={sub.status} />
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {sub.billingCycle} · Renews {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="page-stat text-xl font-bold">
                      {formatCents(
                        sub.billingCycle === 'annual' ? (sub.plan?.priceAnnual ?? 0) : (sub.plan?.priceMonthly ?? 0),
                        sub.plan?.currency,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">/{sub.billingCycle === 'annual' ? 'year' : 'month'}</p>
                  </div>
                </div>

                {sub.status === 'past_due' && (
                  <div className="flex items-center gap-2 rounded-lg bg-status-danger-bg border border-status-danger-border p-3 text-sm text-status-danger">
                    <AlertTriangle className="icon-sm shrink-0" />
                    <BilingualText en="Payment overdue. Update your payment method to avoid service interruption." el="Η πληρωμή καθυστερεί. Ενημερώστε τον τρόπο πληρωμής για να μη διακοπεί η υπηρεσία." wrap />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm" variant="outline" className="gap-2"
                    onClick={() => openPortal(undefined)}
                    disabled={portalLoading}
                  >
                    {portalLoading ? <Loader2 className="icon-sm animate-spin" /> : <CreditCard className="icon-sm" />}
                    Manage billing
                    <ExternalLink className="icon-sm" />
                  </Button>
                  {(sub.plan?.planType === 'team' || sub.plan?.planType === 'organization') && (
                    <Button size="sm" variant="outline" className="gap-2" asChild>
                      <a href="mailto:enterprise@cofounderbay.com?subject=Enterprise Upgrade Request">
                        <Crown className="icon-sm" />
                        <BilingualText en="Request enterprise upgrade" el="Αίτημα αναβάθμισης enterprise" compact />
                      </a>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground"><BilingualText en="No active subscription for this organization." el="Δεν υπάρχει ενεργή συνδρομή για αυτόν τον οργανισμό." wrap /></p>
                <Button size="sm" className="gap-2" asChild>
                  <Link href="/pricing">
                    <Building2 className="icon-sm" />
                    <BilingualText en="See organization plans" el="Πλάνα οργανισμών" compact />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seat Usage */}
        {sub && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base"><BilingualText en="Seat Usage" el="Χρήση θέσεων" compact /></CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {seatLimit ? `${seatUsage} of ${seatLimit} seats used` : `${seatUsage} seats active`}
                  </CardDescription>
                </div>
                {seatLimit && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      (seatPct ?? 0) >= 90 ? 'bg-status-danger-bg text-status-danger border-status-danger-border' :
                      (seatPct ?? 0) >= 70 ? 'bg-status-warning-bg text-status-warning border-status-warning-border' :
                      'bg-status-success-bg text-status-success border-status-success-border',
                    )}
                  >
                    {seatPct}% used
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {seatLimit && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      (seatPct ?? 0) >= 90 ? 'bg-status-danger-mark' :
                      (seatPct ?? 0) >= 70 ? 'bg-status-warning-mark' : 'bg-status-success-mark',
                    )}
                    style={{ width: `${Math.min(seatPct ?? 0, 100)}%` }}
                  />
                </div>
              )}

              {seatLimit && seatUsage >= seatLimit && (
                <div className="flex items-center gap-2 rounded-lg bg-status-warning-bg border border-status-warning-border p-3 text-sm text-status-warning">
                  <AlertTriangle className="icon-sm shrink-0" />
                  <BilingualText en="Seat limit reached. Upgrade your plan or revoke unused seats to add more members." el="Εξαντλήθηκαν οι θέσεις. Αναβαθμίστε το πλάνο ή ανακαλέστε αχρησιμοποίητες θέσεις." wrap />
                </div>
              )}

              <div className="space-y-0.5">
                {seatsLoading ? (
                  <p className="text-sm text-muted-foreground p-3"><BilingualText en="Loading seats…" el="Φόρτωση θέσεων…" compact /></p>
                ) : seats.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3"><BilingualText en="No seats allocated yet." el="Δεν έχουν δοθεί θέσεις ακόμα." compact wrap /></p>
                ) : (
                  seats.map(seat => (
                    <SeatRow
                      key={seat.id}
                      seat={seat}
                      onRevoke={handleRevokeSeat}
                      revoking={revokingId === seat.userId}
                    />
                  ))
                )}
              </div>

              {seatLimit && seatUsage < seatLimit && (
                <div className="pt-1 flex items-center gap-2">
                  <Users className="icon-sm text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {seatLimit - seatUsage} seat{seatLimit - seatUsage !== 1 ? 's' : ''} available. Invite team members from the Members page.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Included Features */}
        {sub?.plan?.features && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base"><BilingualText en="Plan Features" el="Δυνατότητες πλάνου" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sub.plan.features as Record<string, unknown>)
                  .filter(([, v]) => Boolean(v))
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="icon-sm text-status-success shrink-0" />
                      <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}{typeof v === 'string' ? `: ${v}` : ''}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Contact */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base"><BilingualText en="Billing Contact" el="Στοιχεία τιμολόγησης" compact /></CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  <BilingualText en="Used for invoices and legal/tax documentation." el="Χρησιμοποιούνται σε τιμολόγια και νομικά/φορολογικά έγγραφα." wrap />
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowContactForm(!showContactForm)}>
                {showContactForm ? 'Cancel' : 'Edit'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showContactForm ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                {contactForm.name ? (
                  <>
                    <p className="font-medium text-foreground">{contactForm.name}</p>
                    {contactForm.company && <p>{contactForm.company}</p>}
                    {contactForm.legalName && <p className="text-xs">Legal: {contactForm.legalName}</p>}
                    <p>{contactForm.email}</p>
                    {contactForm.addressLine1 && (
                      <p>{contactForm.addressLine1}, {contactForm.city} {contactForm.postalCode}, {contactForm.country}</p>
                    )}
                    {contactForm.vatId && <p>VAT: {contactForm.vatId}</p>}
                  </>
                ) : (
                  <p><BilingualText en="No billing contact set. Click Edit to add one." el="Δεν έχουν οριστεί στοιχεία τιμολόγησης. Πατήστε Επεξεργασία για προσθήκη." wrap /></p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Contact name *</Label>
                    <Input id="name" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Billing email *</Label>
                    <Input id="email" type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="billing@org.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company"><BilingualText en="Company name" el="Επωνυμία" compact /></Label>
                    <Input id="company" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))} placeholder="Acme Accelerator" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="legalName"><BilingualText en="Legal entity name" el="Νομική επωνυμία" compact /></Label>
                    <Input id="legalName" value={contactForm.legalName} onChange={e => setContactForm(p => ({ ...p, legalName: e.target.value }))} placeholder="Acme Accelerator Ltd." />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vatId"><BilingualText en="VAT / Tax ID" el="ΑΦΜ" compact /></Label>
                    <Input id="vatId" value={contactForm.vatId} onChange={e => setContactForm(p => ({ ...p, vatId: e.target.value }))} placeholder="EU123456789" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="country"><BilingualText en="Country" el="Χώρα" compact /></Label>
                    <Input id="country" value={contactForm.country} onChange={e => setContactForm(p => ({ ...p, country: e.target.value }))} placeholder="US" maxLength={2} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="addressLine1"><BilingualText en="Street address" el="Διεύθυνση" compact /></Label>
                    <Input id="addressLine1" value={contactForm.addressLine1} onChange={e => setContactForm(p => ({ ...p, addressLine1: e.target.value }))} placeholder="123 Innovation Blvd" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city"><BilingualText en="City" el="Πόλη" compact /></Label>
                    <Input id="city" value={contactForm.city} onChange={e => setContactForm(p => ({ ...p, city: e.target.value }))} placeholder="San Francisco" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode"><BilingualText en="Postal code" el="Ταχυδρομικός κώδικας" compact /></Label>
                    <Input id="postalCode" value={contactForm.postalCode} onChange={e => setContactForm(p => ({ ...p, postalCode: e.target.value }))} placeholder="94107" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => saveContact()}
                    disabled={savingContact || !contactForm.name || !contactForm.email}
                  >
                    {savingContact && <Loader2 className="mr-1.5 icon-sm animate-spin" />}
                    Save contact
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowContactForm(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enterprise upgrade CTA */}
        {sub && sub.plan?.planType !== 'enterprise' && (
          <Card className="border-primary/15 bg-primary/5">
            <CardContent className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                <Shield className="icon-md text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm"><BilingualText en="Need enterprise features?" el="Χρειάζεστε δυνατότητες enterprise;" compact /></p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <BilingualText en="Custom domain, SSO, unlimited seats, white-labeling, dedicated support, and SLA guarantees." el="Προσαρμοσμένος τομέας, SSO, απεριόριστες θέσεις, white-labeling, αποκλειστική υποστήριξη και εγγυήσεις SLA." wrap />
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 gap-2" asChild>
                <a href="mailto:enterprise@cofounderbay.com?subject=Enterprise Upgrade">
                  <Mail className="icon-sm" />
                  <BilingualText en="Contact sales" el="Επικοινωνία με πωλήσεις" compact />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
