'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Palette,
  Users,
  Shield,
  Bell,
  CreditCard,
  Globe,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  getOrgProfile,
  listOrganizationMembers,
  updateOrganization,
  updateOrganizationMember,
  type OrgAdminMember,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { CardHead } from '@/components/common/CardAnatomy';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/utils';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';

/*
 * The selects offered `gr` and `europe_athens` while the organisation stores
 * ISO and IANA values (`GR`, `Europe/Athens`), so a saved country or timezone
 * never showed as selected and a save wrote a code nothing else reads. The
 * options are the canonical values now; older lowercase ones are mapped on
 * load.
 */
const COUNTRIES: ReadonlyArray<readonly [string, string]> = [
  ['GR', 'Greece'],
  ['CY', 'Cyprus'],
  ['GB', 'United Kingdom'],
  ['DE', 'Germany'],
  ['US', 'United States'],
];
const TIMEZONES = ['Europe/Athens', 'Europe/Nicosia', 'Europe/London', 'Europe/Berlin', 'America/New_York'] as const;

function normalCountry(value: string | null | undefined): string {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'UK' ? 'GB' : v;
}

function normalTimezone(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || v.includes('/')) return v;
  // Legacy option values: europe_athens -> Europe/Athens, america_new_york -> America/New_York.
  const [region, ...city] = v.split('_');
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  return `${cap(region)}/${city.map(cap).join('_')}`;
}

export default function OrgSettingsPage() {
  /*
   * The three fields opened with another organisation's details written into
   * the source, and both Save buttons had no handler — typing into them
   * changed nothing anywhere. They load the organisation's own profile now
   * and write it back through `PATCH /organizations/:id`, which has existed
   * all along without a client.
   */
  const { slug, membership } = useCurrentOrg();
  const organizationId = membership?.organizationId ?? null;
  const qc = useQueryClient();
  const { success, error: showError } = useToast();

  const { data: profileData } = useQuery({
    queryKey: qk('org', 'profile', slug),
    queryFn: () => getOrgProfile(slug!),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: 0,
  });

  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [website, setWebsite] = useState('');
  /* type, country and timezone are real columns on the model — the selects
     used to render `defaultValue` and go nowhere. */
  const [orgType, setOrgType] = useState('accelerator');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6756dc');
  /* Access policies persist under `settings.policies` on the organisation. */
  const [policies, setPolicies] = useState<Record<string, boolean>>({
    publicProfile: true,
    openApplications: true,
    mentorSelfRegistration: false,
    workspaceAccess: true,
  });
  const savedSettings = profileData?.org?.settings ?? null;

  const membersQuery = useQuery({
    queryKey: qk('org', 'admin-members', organizationId),
    queryFn: () => listOrganizationMembers(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    retry: 0,
  });

  // Seed the form once the profile arrives, without stamping over edits made
  // while it was in flight.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !profileData?.org) return;
    const org = profileData.org;
    setOrgName(org?.name ?? '');
    setOrgDescription(org?.description ?? '');
    setWebsite(org?.website ?? '');
    if (org?.type) setOrgType(org.type);
    setCountry(normalCountry(org?.country));
    setTimezone(normalTimezone(org?.timezone));
    if (org?.primaryColor) setPrimaryColor(org.primaryColor);
    const saved = (org?.settings as { policies?: Record<string, boolean> } | null)?.policies;
    if (saved) setPolicies((prev) => ({ ...prev, ...saved }));
    setSeeded(true);
  }, [profileData, seeded]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateOrganization(organizationId!, {
        name: orgName.trim(),
        description: orgDescription.trim(),
        website: website.trim(),
        type: orgType,
        country,
        timezone,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('org') });
      success('Organisation details saved');
    },
    onError: (err) =>
      showError('Could not save the details', err instanceof Error ? err.message : undefined),
  });

  const saveBranding = useMutation({
    mutationFn: () => updateOrganization(organizationId!, { primaryColor }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('org') });
      success('Branding saved');
    },
    onError: (err) =>
      showError('Could not save the branding', err instanceof Error ? err.message : undefined),
  });

  const savePolicies = useMutation({
    mutationFn: (next: Record<string, boolean>) =>
      updateOrganization(organizationId!, {
        settings: { ...(savedSettings ?? {}), policies: next },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('org') });
      success('Access policies saved');
    },
    onError: (err) =>
      showError('Could not save the policies', err instanceof Error ? err.message : undefined),
  });
  const setPolicy = (key: string, value: boolean) => {
    const next = { ...policies, [key]: value };
    setPolicies(next);
    if (organizationId) savePolicies.mutate(next);
  };

  const changeMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      updateOrganizationMember(organizationId!, memberId, { role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk('org', 'admin-members', organizationId) });
      success('Role updated');
    },
    onError: (err) =>
      showError('Could not update the role', err instanceof Error ? err.message : undefined),
  });

  const memberName = (m: OrgAdminMember) =>
    m.user?.profile?.displayName ||
    [m.user?.profile?.firstName, m.user?.profile?.lastName].filter(Boolean).join(' ') ||
    m.user?.email ||
    'Member';

  return (
    <AppShell showHelp
      title="Organization Settings"
      description="Profile, branding, team, permissions, and billing for your organization."
    >
      <div className="space-y-6">

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="w-full lg:grid lg:grid-cols-5">
            <TabsTrigger value="general"><BilingualText en="General" el="Γενικά" compact /></TabsTrigger>
            <TabsTrigger value="branding"><BilingualText en="Branding" el="Εμφάνιση" compact /></TabsTrigger>
            <TabsTrigger value="team"><BilingualText en="Team" el="Ομάδα" compact /></TabsTrigger>
            <TabsTrigger value="permissions"><BilingualText en="Permissions" el="Δικαιώματα" compact /></TabsTrigger>
            <TabsTrigger value="billing"><BilingualText en="Billing" el="Χρεώσεις" compact /></TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="icon-md" aria-hidden="true" />
                  <BilingualText en="Organization Profile" el="Προφίλ οργανισμού" compact />
                </CardTitle>
                <CardDescription>
                  <BilingualText en="Basic information about your organization" el="Βασικές πληροφορίες για τον οργανισμό σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName"><BilingualText en="Organization Name" el="Όνομα οργανισμού" compact /></Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgDescription"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
                  <Textarea
                    id="orgDescription"
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="website"><BilingualText en="Website" el="Ιστότοπος" compact /></Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgType"><BilingualText en="Organization Type" el="Τύπος οργανισμού" compact /></Label>
                    <Select value={orgType} onValueChange={setOrgType}>
                      <SelectTrigger id="orgType" aria-label={bilingualAria('Organization type', 'Τύπος οργανισμού')}>
                        <SelectValue placeholder={bilingualInline("Choose a type", "Επιλέξτε τύπο")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incubator"><BilingualText en="Incubator" el="Θερμοκοιτίδα" compact /></SelectItem>
                        <SelectItem value="accelerator"><BilingualText en="Accelerator" el="Επιταχυντής" compact /></SelectItem>
                        <SelectItem value="venture_studio"><BilingualText en="Venture Studio" el="Venture studio" compact /></SelectItem>
                        <SelectItem value="university"><BilingualText en="University" el="Πανεπιστήμιο" compact /></SelectItem>
                        <SelectItem value="innovation_hub"><BilingualText en="Innovation Hub" el="Κόμβος καινοτομίας" compact /></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="country"><BilingualText en="Country" el="Χώρα" compact /></Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="country" aria-label={bilingualAria('Country', 'Χώρα')}>
                        <SelectValue placeholder={bilingualInline("Choose a country", "Επιλέξτε χώρα")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(([code, name]) => (
                          <SelectItem key={code} value={code}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone"><BilingualText en="Timezone" el="Ζώνη ώρας" compact /></Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="timezone" aria-label={bilingualAria('Timezone', 'Ζώνη ώρας')}>
                        <SelectValue placeholder={bilingualInline("Choose a timezone", "Επιλέξτε ζώνη ώρας")} />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  disabled={!organizationId || saveProfile.isPending}
                  onClick={() => saveProfile.mutate()}
                >
                  <Save className="mr-2 icon-sm" aria-hidden="true" />
                  {saveProfile.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Settings */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="icon-md" aria-hidden="true" />
                  <BilingualText en="Branding" el="Εμφάνιση" compact />
                </CardTitle>
                <CardDescription>
                  <BilingualText en="Customize your organization's appearance" el="Προσαρμόστε την εμφάνιση του οργανισμού σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p id="page-cap1-cap" className="text-sm font-medium leading-tight"><BilingualText en="Logo" el="Λογότυπο" compact /></p>
                  <div role="group" aria-labelledby="page-cap1-cap" className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-lg bg-secondary flex items-center justify-center">
                      <Building2 className="icon-xl text-muted-foreground" />
                    </div>
                    <Button variant="outline" disabled title="Logo storage is not connected yet"><BilingualText en="Upload Logo" el="Μεταφόρτωση λογοτύπου" compact /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor"><BilingualText en="Primary Color" el="Κύριο χρώμα" compact /></Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="page-f2"><BilingualText en="Custom Domain" el="Προσαρμοσμένος τομέας" compact /></Label>
                  <div className="flex items-center gap-2">
                    <Input id="page-f2" placeholder="accelerator.yourdomain.com" />
                    <Button variant="outline" disabled title="Custom domains are not connected yet"><BilingualText en="Verify" el="Επαλήθευση" compact /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <BilingualText en="Set up a custom domain for your organization's portal" el="Ορίστε προσαρμοσμένο τομέα για την πύλη του οργανισμού σας" wrap />
                  </p>
                </div>
                {/* primaryColor is a real column; the logo and custom domain
                    have no backing field, so their controls stay inert with the
                    reason on them rather than looking live. */}
                <div className="flex items-center gap-3">
                  <Button
                    disabled={!organizationId || saveBranding.isPending}
                    onClick={() => saveBranding.mutate()}
                  >
                    <Save className="mr-2 icon-sm" aria-hidden="true" />
                    {saveBranding.isPending ? 'Saving…' : 'Save Branding'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    <BilingualText en="Saves the primary colour. Logo and domain are not stored yet." el="Αποθηκεύεται το κύριο χρώμα. Λογότυπο και τομέας δεν αποθηκεύονται ακόμα." wrap />
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Settings */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="icon-md" aria-hidden="true" />
                  <BilingualText en="Team Members" el="Μέλη ομάδας" compact />
                </CardTitle>
                <CardDescription>
                  <BilingualText en="Manage your organization's team" el="Διαχείριση της ομάδας του οργανισμού σας" compact wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {membersQuery.data
                      ? `${membersQuery.data.length} team member${membersQuery.data.length === 1 ? '' : 's'}`
                      : 'Members could not be loaded'}
                  </p>
                  <Button asChild>
                    <Link href={slug ? `/org/${slug}/admin` : '/org/dashboard'}><BilingualText en="Invite Member" el="Πρόσκληση μέλους" compact /></Link>
                  </Button>
                </div>
                {/* Rows of a card's head without their frames: the person,
                    their address under the name, the role at the right. */}
                <div className="card-rows">
                  {(membersQuery.data ?? []).map((member) => (
                    <CardHead
                      key={member.id}
                      titleAs="h4"
                      mark={(
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.user?.profile?.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initialsOf(memberName(member))}</AvatarFallback>
                        </Avatar>
                      )}
                      title={memberName(member)}
                      subtitle={member.user?.email ? <span className="block truncate">{member.user.email}</span> : undefined}
                      aside={(
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          changeMemberRole.mutate({ memberId: member.id, role })
                        }
                        disabled={member.role === 'owner'}
                      >
                        <SelectTrigger aria-label={`Role for ${memberName(member)}`} className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin"><BilingualText en="Admin" el="Διαχειριστής" compact /></SelectItem>
                          <SelectItem value="program_manager"><BilingualText en="Program Manager" el="Υπεύθυνος προγράμματος" compact /></SelectItem>
                          <SelectItem value="mentor"><BilingualText en="Mentor" el="Μέντορας" compact /></SelectItem>
                          <SelectItem value="reviewer"><BilingualText en="Reviewer" el="Αξιολογητής" compact /></SelectItem>
                          <SelectItem value="member"><BilingualText en="Member" el="Μέλος" compact /></SelectItem>
                        </SelectContent>
                      </Select>
                      )}
                    />
                  ))}
                  {!membersQuery.data && (
                    <p className="text-xs text-muted-foreground">
                      The member list lives under the organisation&apos;s admin page until the
                      directory responds.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Settings */}
          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="icon-md" aria-hidden="true" />
                  <BilingualText en="Permissions & Access" el="Δικαιώματα & πρόσβαση" compact />
                </CardTitle>
                <CardDescription>
                  <BilingualText en="Configure access controls for your organization" el="Ρυθμίστε τον έλεγχο πρόσβασης του οργανισμού σας" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'publicProfile', label: 'Public Profile', hint: 'Allow your organization to be discovered publicly' },
                  { key: 'openApplications', label: 'Open Applications', hint: 'Accept applications from any startup' },
                  { key: 'mentorSelfRegistration', label: 'Mentor Self-Registration', hint: 'Allow mentors to request to join your pool' },
                  { key: 'workspaceAccess', label: 'Startup Workspace Access', hint: 'Org admins can view all startup workspaces' },
                ].map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.hint}</p>
                    </div>
                    <Switch
                      aria-label={p.label}
                      checked={policies[p.key]}
                      onCheckedChange={(v) => setPolicy(p.key, v)}
                      disabled={!organizationId || savePolicies.isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Settings */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="icon-md" aria-hidden="true" />
                  <BilingualText en="Subscription & Billing" el="Συνδρομή & χρεώσεις" compact />
                </CardTitle>
                <CardDescription>
                  <BilingualText en="Manage your subscription and payment methods" el="Διαχείριση συνδρομής και τρόπων πληρωμής" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Plan and payment details are illustrative — billing is not connected to the
                  organisation yet.
                </p>
                {/* The plan, the usage and the payment method as rows of the
                    card, not as cards drawn inside it. */}
                <div className="card-rows">
                  <CardHead
                    titleAs="h4"
                    title="Organization Pro"
                    subtitle="$299/month · Billed annually"
                    aside={<Button size="sm" variant="outline" disabled title="Billing is not connected yet"><BilingualText en="Change Plan" el="Αλλαγή πλάνου" compact /></Button>}
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-medium"><BilingualText en="Usage" el="Χρήση" compact /></p>
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground"><BilingualText en="Startups" el="Startups" compact /></dt>
                        <dd className="card-body font-semibold tabular-nums">32 / 50</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground"><BilingualText en="Team Members" el="Μέλη ομάδας" compact /></dt>
                        <dd className="card-body font-semibold tabular-nums">5 / 10</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground"><BilingualText en="Programs" el="Προγράμματα" compact /></dt>
                        <dd className="card-body font-semibold tabular-nums">4 / Unlimited</dd>
                      </div>
                    </dl>
                  </div>
                  <CardHead
                    titleAs="h4"
                    title={<BilingualText en="Payment Method" el="Τρόπος πληρωμής" compact />}
                    subtitle={<span className="tabular-nums">•••• •••• •••• 4242</span>}
                    aside={<Button variant="outline" size="sm" disabled title="Billing is not connected yet"><BilingualText en="Update" el="Ενημέρωση" compact /></Button>}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
