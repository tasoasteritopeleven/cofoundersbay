'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Check, Download, FileText, Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { settingsEn, settingsEl } from '@/lib/i18n/strings-settings';
import { bilingualAria } from '@/lib/i18n/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  getBillingSubscription, getUserInvoices, createBillingPortal,
  getBillingContact, upsertBillingContact, type BillingInvoice, type BillingContact,
} from '@/lib/api';
import { formatCents, PLAN_FEATURE_LABELS, PLAN_HIGHLIGHTS, type PlanFeatureKey } from '@/lib/billing';
import { HairlineMeter } from '@/components/ui/hairline-meter';
import { SettingsRow } from '@/components/ui/settings-row';
import { cn } from '@/lib/utils';
import { StatusText } from '@/components/common/StatusText';
import { qk } from '@/lib/query-keys';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-status-success-bg text-status-success border-status-success-border',
    open: 'bg-status-info-bg text-status-info border-status-info-border',
    draft: 'bg-muted text-muted-foreground border-border',
    void: 'bg-muted text-muted-foreground border-border',
    uncollectible: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  };
  return (
    <Badge variant="outline" className={cn('text-xs capitalize', colors[status] ?? 'bg-muted text-muted-foreground')}>
      <StatusText value={status} />
    </Badge>
  );
}

/** What a plan includes: one quiet list, shared with /pricing through PLAN_HIGHLIGHTS. */
function PlanHighlights({ items }: { items: { en: string; el: string }[] }) {
  return (
    <ul className="space-y-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item.en} className="flex items-start gap-2">
          <Check className="mt-0.5 icon-sm shrink-0 text-status-success" aria-hidden="true" />
          <span className="min-w-0"><BilingualText en={item.en} el={item.el} wrap /></span>
        </li>
      ))}
    </ul>
  );
}

function InvoiceRow({ invoice }: { invoice: BillingInvoice }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
        <FileText className="icon-sm text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{invoice.invoiceNumber}</span>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(invoice.periodStart).toLocaleDateString('en-GB', { timeZone: 'UTC' })} – {new Date(invoice.periodEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatCents(invoice.total, invoice.currency)}</p>
        {invoice.paidAt && (
          <p className="text-xs text-muted-foreground">{new Date(invoice.paidAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</p>
        )}
      </div>
      {invoice.hostedInvoiceUrl && (
        // One control, not a button nested in a link (axe nested-interactive).
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={bilingualAria(`Download invoice ${invoice.invoiceNumber}`, `Λήψη τιμολογίου ${invoice.invoiceNumber}`)}
          >
            <Download className="icon-sm" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}

export default function UserBillingPage() {
  const qc = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '', email: '', company: '', vatId: '', addressLine1: '', city: '', postalCode: '', country: 'US',
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: qk('billing', 'subscription'),
    queryFn: getBillingSubscription,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: qk('billing', 'invoices'),
    queryFn: getUserInvoices,
  });

  const { data: contactData } = useQuery({
    queryKey: qk('billing', 'contact'),
    queryFn: getBillingContact,
  });

  useEffect(() => {
    const bc = (contactData as { billingContact?: BillingContact | null })?.billingContact;
    if (bc) {
      setContactForm({
        name: bc.name ?? '',
        email: bc.email ?? '',
        company: bc.company ?? '',
        vatId: bc.vatId ?? '',
        addressLine1: bc.addressLine1 ?? '',
        city: bc.city ?? '',
        postalCode: bc.postalCode ?? '',
        country: bc.country ?? 'US',
      });
    }
  }, [contactData]);

  const { mutate: openPortal, isPending: portalLoading } = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: ({ url }) => { if (url) window.location.href = url; },
    onError: () => toastError('Stripe portal unavailable'),
  });

  const { mutate: saveContact, isPending: savingContact } = useMutation({
    mutationFn: () => upsertBillingContact(contactForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('billing', 'contact') });
      setShowContactForm(false);
      toastSuccess('Billing contact saved');
    },
    onError: () => toastError('Failed to save contact'),
  });

  const sub = subData?.subscription;
  const invoices = invoicesData?.invoices ?? [];

  // Offered to the assistant: the portal, the contact form, and opening an
  // invoice - the same handlers and links; the invoices go out as a list.
  usePageList([
    {
      id: 'invoices',
      labelEn: 'Invoices',
      labelEl: 'Τιμολόγια',
      rows: invoicesLoading ? undefined : invoices.map((i) =>
        `${i.invoiceNumber} · ${formatCents(i.total, i.currency)} · ${i.status} · ${i.periodStart.slice(0, 10)} to ${i.periodEnd.slice(0, 10)}${i.paidAt ? ` · paid ${i.paidAt.slice(0, 10)}` : ''}`,
      ),
    },
  ]);
  const withLinks = invoices.filter((i) => i.hostedInvoiceUrl);
  usePageControls([
    {
      id: 'open_billing_portal',
      labelEn: 'Open the billing portal',
      labelEl: 'Άνοιγμα πύλης χρεώσεων',
      writes: false,
      unavailableEn: sub ? undefined : 'There is no subscription to manage.',
      unavailableEl: sub ? undefined : 'Δεν υπάρχει συνδρομή για διαχείριση.',
      run: () => openPortal(),
    },
    { id: 'edit_billing_contact', labelEn: 'Edit the billing contact', labelEl: 'Επεξεργασία στοιχείων χρέωσης', writes: false, run: () => setShowContactForm(true) },
    {
      id: 'open_invoice',
      labelEn: 'Open an invoice',
      labelEl: 'Άνοιγμα τιμολογίου',
      writes: false,
      options: rowOptions(withLinks, (i) => i.id, (i) => i.invoiceNumber),
      unavailableEn: withLinks.length ? undefined : 'No invoice has a document to open.',
      unavailableEl: withLinks.length ? undefined : 'Κανένα τιμολόγιο δεν έχει έγγραφο.',
      run: (v) => {
        const url = withLinks.find((i) => i.id === v)?.hostedInvoiceUrl;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      },
    },
  ]);

  return (
    <AppShell
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <BilingualText en={settingsEn('settings')} el={settingsEl('settings')} />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6 pb-10">

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2">
              <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                <BilingualText en="Current plan" el="Τρέχον πλάνο" />
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {subLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="icon-sm animate-spin" />
                  <span className="text-sm"><BilingualText en="Loading subscription…" el="Φόρτωση συνδρομής…" compact /></span>
                </div>
              ) : sub ? (
                <>
                  <div>
                    <p className="text-lg font-semibold">{sub.plan?.displayName ?? <BilingualText en="Unknown plan" el="Άγνωστο πλάνο" compact />}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCents(sub.billingCycle === 'annual' ? sub.plan?.priceAnnual : sub.plan?.priceMonthly ?? 0, sub.plan?.currency)}
                      {sub.billingCycle === 'annual'
                        ? <BilingualText en="/year" el="/έτος" compact />
                        : <BilingualText en="/mo" el="/μήνα" compact />}
                      {sub.currentPeriodEnd && (
                        <> · <BilingualText
                          en={`Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`}
                          el={`Ανανεώνεται ${new Date(sub.currentPeriodEnd).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`}
                          compact
                        /></>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary-accessible hover:underline"
                    onClick={() => openPortal(undefined)}
                    disabled={portalLoading}
                  >
                    {portalLoading
                      ? <BilingualText en="Opening…" el="Άνοιγμα…" compact />
                      : <BilingualText en="Adjust plan" el="Προσαρμογή πλάνου" compact />}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-lg font-semibold"><BilingualText en="Free" el="Δωρεάν" compact /></p>
                    <p className="text-sm text-muted-foreground">$0<BilingualText en="/mo" el="/μήνα" compact /></p>
                  </div>
                  <PlanHighlights items={PLAN_HIGHLIGHTS.free} />
                </>
              )}
            </CardContent>
          </Card>

          {(sub?.plan?.name === 'free' || !sub) && (
            <Card className="border-primary/15 bg-primary/[0.03]">
              <CardHeader className="pb-2">
                <p className="text-2xs font-medium uppercase tracking-widest text-primary-accessible">
                  <BilingualText en="Upgrade available" el="Διαθέσιμη αναβάθμιση" />
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-lg font-semibold">Pro</p>
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="Unlock more usage on matching, messages, and mentor booking." el="Περισσότερη χρήση σε αντιστοιχίσεις, μηνύματα και κρατήσεις μεντόρων." wrap />
                  </p>
                </div>
                {/* "Everything in Free" is the first line; the card already says it is an upgrade. */}
                <PlanHighlights items={PLAN_HIGHLIGHTS.pro.slice(1)} />
                <Button size="sm" asChild>
                  <Link href="/pricing"><BilingualText en="Upgrade" el="Αναβάθμιση" compact /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {sub?.cancelAtPeriodEnd && (
          <p className="text-sm text-status-warning">
            <BilingualText
              en={`Subscription cancels on ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}.`}
              el={`Η συνδρομή λήγει στις ${new Date(sub.currentPeriodEnd).toLocaleDateString('el-GR', { timeZone: 'UTC' })}.`}
              wrap
            />
          </p>
        )}
        {sub?.status === 'trialing' && sub.trialEnd && (
          <p className="text-sm text-status-info">
            <BilingualText
              en={`Free trial ends ${new Date(sub.trialEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' })}.`}
              el={`Η δωρεάν δοκιμή λήγει στις ${new Date(sub.trialEnd).toLocaleDateString('el-GR', { timeZone: 'UTC' })}.`}
              wrap
            />
          </p>
        )}
        {sub?.status === 'past_due' && (
          <p className="text-sm text-status-danger"><BilingualText en="Payment failed. Update the payment method in Adjust plan." el="Η πληρωμή απέτυχε. Ενημερώστε τον τρόπο πληρωμής στην Προσαρμογή πλάνου." wrap /></p>
        )}

        {sub?.plan?.features && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base"><BilingualText en="Included" el="Περιλαμβάνονται" compact /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(sub.plan.features as Record<string, unknown>)
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => {
                  const known = PLAN_FEATURE_LABELS[k as PlanFeatureKey];
                  return (
                    <HairlineMeter
                      key={k}
                      label={known ? <BilingualText en={known.en} el={known.el} compact /> : k.replace(/([A-Z])/g, ' $1').trim()}
                      caption={typeof v === 'string' ? String(v) : undefined}
                      percent={v === true || v === 'Unlimited' ? 0 : 0}
                      trailing={v === true ? <BilingualText en="Included" el="Περιλαμβάνεται" compact /> : typeof v === 'string' ? String(v) : undefined}
                    />
                  );
                })}
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-none">
          <CardContent className="pt-2">
            <SettingsRow
              label={<BilingualText en="Payment method" el="Τρόπος πληρωμής" compact />}
              helper={<BilingualText en="Opens the Stripe billing portal." el="Ανοίγει την πύλη χρεώσεων του Stripe." wrap />}
            >
              <button
                type="button"
                className="text-sm font-medium text-primary-accessible hover:underline"
                onClick={() => openPortal(undefined)}
                disabled={portalLoading}
              >
                {portalLoading
                  ? <BilingualText en="Opening…" el="Άνοιγμα…" compact />
                  : <BilingualText en="Manage" el="Διαχείριση" compact />}
              </button>
            </SettingsRow>
          </CardContent>
        </Card>

        {/* Billing Contact */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base"><BilingualText en="Billing Contact" el="Στοιχεία τιμολόγησης" compact /></CardTitle>
                <CardDescription className="text-xs mt-0.5"><BilingualText en="Used on invoices and for tax compliance." el="Χρησιμοποιούνται σε τιμολόγια και για φορολογικούς σκοπούς." wrap /></CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowContactForm(!showContactForm)}>
                {showContactForm
                  ? <BilingualText en="Cancel" el="Ακύρωση" compact />
                  : (contactData as { billingContact?: BillingContact | null })?.billingContact
                    ? <BilingualText en="Edit" el="Επεξεργασία" compact />
                    : <BilingualText en="Add" el="Προσθήκη" compact />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showContactForm && (contactData as { billingContact?: BillingContact | null })?.billingContact ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                {(() => { const bc = (contactData as { billingContact?: BillingContact | null }).billingContact!; return (<>
                <p className="font-medium text-foreground">{bc.name}</p>
                {bc.company && <p>{bc.company}</p>}
                <p>{bc.email}</p>
                {bc.addressLine1 && (
                  <p>{bc.addressLine1}, {bc.city} {bc.postalCode}, {bc.country}</p>
                )}
                {bc.vatId && <p><BilingualText en="VAT" el="ΑΦΜ" compact />: {bc.vatId}</p>}
                </>); })()}
              </div>
            ) : !showContactForm ? (
              <p className="text-sm text-muted-foreground"><BilingualText en="No billing contact set." el="Δεν έχουν οριστεί στοιχεία τιμολόγησης." compact wrap /></p>
            ) : null}

            {showContactForm && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-name" className="text-xs"><BilingualText en="Full name" el="Ονοματεπώνυμο" compact /> *</Label>
                    <Input
                      id="billing-contact-name"
                      placeholder="Jane Doe"
                      value={contactForm.name}
                      onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-email" className="text-xs">Email *</Label>
                    <Input
                      id="billing-contact-email"
                      type="email"
                      placeholder="billing@company.com"
                      value={contactForm.email}
                      onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-company" className="text-xs"><BilingualText en="Company" el="Επωνυμία" compact /></Label>
                    <Input
                      id="billing-contact-company"
                      placeholder="Acme Inc."
                      value={contactForm.company}
                      onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-vat" className="text-xs"><BilingualText en="VAT / Tax ID" el="ΑΦΜ" compact /></Label>
                    <Input
                      id="billing-contact-vat"
                      placeholder="EU123456789"
                      value={contactForm.vatId}
                      onChange={e => setContactForm(p => ({ ...p, vatId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="billing-contact-address" className="text-xs"><BilingualText en="Address" el="Διεύθυνση" compact /></Label>
                    <Input
                      id="billing-contact-address"
                      placeholder="123 Main Street"
                      value={contactForm.addressLine1}
                      onChange={e => setContactForm(p => ({ ...p, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-city" className="text-xs"><BilingualText en="City" el="Πόλη" compact /></Label>
                    <Input
                      id="billing-contact-city"
                      placeholder="Athens"
                      value={contactForm.city}
                      onChange={e => setContactForm(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact-postal" className="text-xs"><BilingualText en="Postal Code" el="Ταχυδρομικός κώδικας" compact /></Label>
                    <Input
                      id="billing-contact-postal"
                      placeholder="10431"
                      value={contactForm.postalCode}
                      onChange={e => setContactForm(p => ({ ...p, postalCode: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => saveContact()}
                    disabled={savingContact || !contactForm.name || !contactForm.email}
                  >
                    {savingContact && <Loader2 className="mr-1.5 icon-sm animate-spin" />}
                    <BilingualText en="Save contact" el="Αποθήκευση στοιχείων" compact />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowContactForm(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice history */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base"><BilingualText en="Invoice History" el="Ιστορικό τιμολογίων" compact /></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invoicesLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground">
                <Loader2 className="icon-sm animate-spin" />
                <span className="text-sm"><BilingualText en="Loading invoices…" el="Φόρτωση τιμολογίων…" compact /></span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="card-comfortable">
                <FileText className="icon-xl mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground"><BilingualText en="No invoices yet" el="Δεν υπάρχουν τιμολόγια ακόμα" compact /></p>
                <p className="mt-1 text-xs text-muted-foreground"><BilingualText en="Invoices appear here after each billing cycle." el="Τα τιμολόγια εμφανίζονται εδώ μετά από κάθε κύκλο χρέωσης." compact /></p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {invoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
