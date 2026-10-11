'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Users,
  CreditCard,
  Globe,
  Key,
  Save,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useTenant } from '@/components/providers/TenantContext';
import { updateTenant, type TenantSettings } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { qk } from '@/lib/query-keys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

export default function TenantSettingsPage() {
  /*
   * Seven controls that set local state and a Save button with no handler:
   * the whole screen was decoration. None of them had anywhere to live either
   * — `Tenant` had no field for a timezone, a currency or a membership policy
   * — so a `settings` column was added alongside this, one nullable object
   * rather than seven columns, because they are read and written together and
   * none is ever queried on.
   */
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? null;
  const stored = (activeTenant as { settings?: TenantSettings } | null)?.settings ?? {};
  const qc = useQueryClient();
  const { success, error: showError } = useToast();

  const [timezone, setTimezone] = useState('utc');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('eur');
  const [autoApprove, setAutoApprove] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // Seeded once the tenant resolves, and not again, so a value changed while
  // the request was in flight is not stamped over.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !activeTenant) return;
    if (stored.timezone) setTimezone(stored.timezone);
    if (stored.language) setLanguage(stored.language);
    if (stored.currency) setCurrency(stored.currency);
    if (stored.autoApprove !== undefined) setAutoApprove(stored.autoApprove);
    if (stored.requireApproval !== undefined) setRequireApproval(stored.requireApproval);
    if (stored.emailNotifications !== undefined) setEmailNotifications(stored.emailNotifications);
    if (stored.weeklyDigest !== undefined) setWeeklyDigest(stored.weeklyDigest);
    setSeeded(true);
  }, [activeTenant, stored, seeded]);

  const save = useMutation({
    mutationFn: () =>
      updateTenant(tenantId!, {
        settings: {
          timezone,
          language,
          currency,
          autoApprove,
          requireApproval,
          emailNotifications,
          weeklyDigest,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('tenant') });
      success('Settings saved');
    },
    onError: (err) =>
      showError('Could not save the settings', err instanceof Error ? err.message : undefined),
  });

  return (
    <AppShell
      title="Tenant Settings"
      description="General workspace settings: membership policy, notifications, and email preferences."
      actions={(
        <Button disabled={!tenantId || save.isPending} onClick={() => save.mutate()}>
          <Save className="mr-2 icon-sm" />
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      )}
    >
      <div className="space-y-6">

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general"><BilingualText en="General" el="Γενικά" compact /></TabsTrigger>
            <TabsTrigger value="access"><BilingualText en="Access Control" el="Έλεγχος πρόσβασης" compact /></TabsTrigger>
            <TabsTrigger value="notifications"><BilingualText en="Notifications" el="Ειδοποιήσεις" compact /></TabsTrigger>
            <TabsTrigger value="integrations"><BilingualText en="Integrations" el="Ενσωματώσεις" compact /></TabsTrigger>
            <TabsTrigger value="billing"><BilingualText en="Billing" el="Χρεώσεις" compact /></TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Organization Settings" el="Ρυθμίσεις οργανισμού" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Basic configuration for your organization" el="Βασικές ρυθμίσεις του οργανισμού σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone"><BilingualText en="Timezone" el="Ζώνη ώρας" compact /></Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder={bilingualInline("Select timezone", "Επιλογή ζώνης ώρας")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est"><BilingualText en="Eastern Time (EST)" el="Ώρα ανατολικών ΗΠΑ (EST)" compact /></SelectItem>
                      <SelectItem value="pst"><BilingualText en="Pacific Time (PST)" el="Ώρα Ειρηνικού (PST)" compact /></SelectItem>
                      <SelectItem value="cet"><BilingualText en="Central European Time (CET)" el="Ώρα Κεντρικής Ευρώπης (CET)" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language"><BilingualText en="Default Language" el="Προεπιλεγμένη γλώσσα" compact /></Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder={bilingualInline("Select language", "Επιλογή γλώσσας")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en"><BilingualText en="English" el="Αγγλικά" compact /></SelectItem>
                      <SelectItem value="es"><BilingualText en="Spanish" el="Ισπανικά" compact /></SelectItem>
                      <SelectItem value="fr"><BilingualText en="French" el="Γαλλικά" compact /></SelectItem>
                      <SelectItem value="de"><BilingualText en="German" el="Γερμανικά" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency"><BilingualText en="Currency" el="Νόμισμα" compact /></Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder={bilingualInline("Select currency", "Επιλογή νομίσματος")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Control */}
          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Member Access" el="Πρόσβαση μελών" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Control how members join your organization" el="Ελέγξτε πώς εντάσσονται τα μέλη στον οργανισμό σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p id="page-cap1-cap" className="text-sm font-medium leading-tight"><BilingualText en="Require Approval for New Members" el="Έγκριση για νέα μέλη" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="New members must be approved by an admin" el="Τα νέα μέλη εγκρίνονται από διαχειριστή" wrap />
                    </p>
                  </div>
                  <Switch checked={requireApproval} onCheckedChange={setRequireApproval} aria-label="Require Approval for New Members" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p id="page-cap2-cap" className="text-sm font-medium leading-tight"><BilingualText en="Auto-approve from Allowed Domains" el="Αυτόματη έγκριση από επιτρεπόμενους τομείς" wrap /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Automatically approve members from specific email domains" el="Αυτόματη έγκριση μελών από συγκεκριμένους τομείς email" wrap />
                    </p>
                  </div>
                  <Switch checked={autoApprove} onCheckedChange={setAutoApprove} aria-label="Auto-approve from Allowed Domains" />
                </div>
                {autoApprove && (
                  <div className="space-y-2">
                    <Label htmlFor="page-f3"><BilingualText en="Allowed Domains" el="Επιτρεπόμενοι τομείς" compact /></Label>
                    <Input id="page-f3" placeholder="example.com, company.org" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="SSO Configuration" el="Ρύθμιση SSO" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Enable Single Sign-On for your organization" el="Ενεργοποιήστε ενιαία σύνδεση (SSO) για τον οργανισμό σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="page-f4"><BilingualText en="SSO Provider" el="Πάροχος SSO" compact /></Label>
                  <Select defaultValue="none">
                    <SelectTrigger id="page-f4" aria-label="SSO Provider">
                      <SelectValue placeholder={bilingualInline("Select provider", "Επιλογή παρόχου")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><BilingualText en="None" el="Κανένας" compact /></SelectItem>
                      <SelectItem value="google">Google Workspace</SelectItem>
                      <SelectItem value="okta">Okta</SelectItem>
                      <SelectItem value="azure">Azure AD</SelectItem>
                      <SelectItem value="saml"><BilingualText en="Custom SAML" el="Προσαρμοσμένο SAML" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Email Notifications" el="Ειδοποιήσεις email" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Configure notification preferences for your organization" el="Ρυθμίστε τις ειδοποιήσεις του οργανισμού σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p id="page-cap5-cap" className="text-sm font-medium leading-tight"><BilingualText en="Email Notifications" el="Ειδοποιήσεις email" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Send email notifications to members" el="Αποστολή ειδοποιήσεων email στα μέλη" wrap />
                    </p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} aria-label="Email Notifications" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p id="page-cap6-cap" className="text-sm font-medium leading-tight"><BilingualText en="Weekly Digest" el="Εβδομαδιαία σύνοψη" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Send weekly summary emails to members" el="Αποστολή εβδομαδιαίας σύνοψης στα μέλη" wrap />
                    </p>
                  </div>
                  <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} aria-label="Weekly Digest" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Connected Services" el="Συνδεδεμένες υπηρεσίες" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Integrate with external services" el="Σύνδεση με εξωτερικές υπηρεσίες" compact wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Slack', description: 'Send notifications to Slack channels', connected: true },
                  { name: 'Google Calendar', description: 'Sync events with Google Calendar', connected: false },
                  { name: 'Zoom', description: 'Create Zoom meetings for sessions', connected: true },
                  { name: 'Notion', description: 'Sync resources with Notion', connected: false },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                    </div>
                    <Button variant={integration.connected ? 'outline' : 'default'} size="sm" disabled title="Third-party integrations are not available yet">
                      {integration.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="API Access" el="Πρόσβαση API" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Manage API keys for programmatic access" el="Διαχείριση κλειδιών API για προγραμματιστική πρόσβαση" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input value="sk_live_xxxxxxxxxxxxxxxxxxxxx" readOnly className="font-mono text-sm" />
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/tenant/api-keys">
                      <Key className="mr-2 icon-sm" aria-hidden="true" />
                      <BilingualText en="Manage keys" el="Διαχείριση κλειδιών" compact />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Current Plan" el="Τρέχον πλάνο" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Your organization's subscription details" el="Στοιχεία συνδρομής του οργανισμού σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg"><BilingualText en="Enterprise Plan" el="Πλάνο Enterprise" compact /></p>
                      <p className="text-sm text-muted-foreground"><BilingualText en="Up to 500 members, unlimited programs" el="Έως 500 μέλη, απεριόριστα προγράμματα" wrap /></p>
                    </div>
                    <p className="page-stat text-xl font-bold">$499<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" asChild><Link href="/tenant/billing"><BilingualText en="Change Plan" el="Αλλαγή πλάνου" compact /></Link></Button>
                  <Button variant="outline" asChild><Link href="/tenant/billing"><BilingualText en="View Invoices" el="Προβολή τιμολογίων" compact /></Link></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Payment Method" el="Τρόπος πληρωμής" compact /></CardTitle>
                <CardDescription>
                  <BilingualText en="Manage your payment information" el="Διαχείριση στοιχείων πληρωμής" compact wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-lg border">
                  <CreditCard className="icon-xl text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">•••• •••• •••• 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2026</p>
                  </div>
                  <Button variant="outline" size="sm" asChild><Link href="/tenant/billing"><BilingualText en="Update" el="Ενημέρωση" compact /></Link></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
