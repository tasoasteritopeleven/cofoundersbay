import io
p = 'src/app/org/settings/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { getOrgProfile, updateOrganization } from '@/lib/api';"""
new = """import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import {
  getOrgProfile,
  listOrganizationMembers,
  updateOrganization,
  updateOrganizationMember,
  type OrgAdminMember,
} from '@/lib/api';"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [website, setWebsite] = useState('');

  // Seed the form once the profile arrives, without stamping over edits made
  // while it was in flight.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !profileData?.org) return;
    setOrgName(profileData.org?.name ?? '');
    setOrgDescription(profileData.org?.description ?? '');
    setWebsite(profileData.org?.website ?? '');
    setSeeded(true);
  }, [profileData, seeded]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateOrganization(organizationId!, {
        name: orgName.trim(),
        description: orgDescription.trim(),
        website: website.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org'] });
      success('Organisation details saved');
    },
    onError: (err) =>
      showError('Could not save the details', err instanceof Error ? err.message : undefined),
  });
  const [primaryColor, setPrimaryColor] = useState('#6366f1');"""
new = """  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [website, setWebsite] = useState('');
  /* type, country and timezone are real columns on the model — the selects
     used to render `defaultValue` and go nowhere. */
  const [orgType, setOrgType] = useState('accelerator');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  /* Access policies persist under `settings.policies` on the organisation. */
  const [policies, setPolicies] = useState<Record<string, boolean>>({
    publicProfile: true,
    openApplications: true,
    mentorSelfRegistration: false,
    workspaceAccess: true,
  });
  const savedSettings = profileData?.org?.settings ?? null;

  const membersQuery = useQuery({
    queryKey: ['org', 'admin-members', organizationId],
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
    setCountry(org?.country ?? '');
    setTimezone(org?.timezone ?? '');
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
      void qc.invalidateQueries({ queryKey: ['org'] });
      success('Organisation details saved');
    },
    onError: (err) =>
      showError('Could not save the details', err instanceof Error ? err.message : undefined),
  });

  const saveBranding = useMutation({
    mutationFn: () => updateOrganization(organizationId!, { primaryColor }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org'] });
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
      void qc.invalidateQueries({ queryKey: ['org'] });
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
      void qc.invalidateQueries({ queryKey: ['org', 'admin-members', organizationId] });
      success('Role updated');
    },
    onError: (err) =>
      showError('Could not update the role', err instanceof Error ? err.message : undefined),
  });

  const memberName = (m: OrgAdminMember) =>
    m.user?.profile?.displayName ||
    [m.user?.profile?.firstName, m.user?.profile?.lastName].filter(Boolean).join(' ') ||
    m.user?.email ||
    'Member';"""
assert s.count(old) == 1; s = s.replace(old, new)

# General tab selects -> controlled
old = """                  <div className="space-y-2">
                    <Label htmlFor="orgType">Organization Type</Label>
                    <Select defaultValue="accelerator">"""
new = """                  <div className="space-y-2">
                    <Label htmlFor="orgType">Organization Type</Label>
                    <Select value={orgType} onValueChange={setOrgType}>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select defaultValue="gr">"""
new = """                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select value={country} onValueChange={setCountry}>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="europe_athens">"""
new = """                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>"""
assert s.count(old) == 1; s = s.replace(old, new)

# Branding save now persists primaryColor
old = """                {/*
                  * Branding has no field on the organisation model — colours
                  * and logos live on `Tenant`, not here — so this stays
                  * disabled with the reason on it rather than looking live and
                  * doing nothing.
                  */}
                <Button disabled title="Branding is configured under Tenant settings">
                  <Save className="mr-2 icon-sm" aria-hidden="true" />
                  Save Branding
                </Button>"""
new = """                {/* primaryColor is a real column; the logo and custom domain
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
                    Saves the primary colour. Logo and domain are not stored yet.
                  </p>
                </div>"""
assert s.count(old) == 1; s = s.replace(old, new)

# Team tab -> live members
old = """              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">5 team members</p>
                  <Button>Invite Member</Button>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'John Doe', email: 'john@example.com', role: 'Admin' },
                    { name: 'Jane Smith', email: 'jane@example.com', role: 'Program Manager' },
                    { name: 'Mike Johnson', email: 'mike@example.com', role: 'Reviewer' },
                  ].map((member) => (
                    <div key={member.email} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <Select defaultValue={member.role.toLowerCase().replace(' ', '_')}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="program_manager">Program Manager</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>"""
new = """              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {membersQuery.data
                      ? `${membersQuery.data.length} team member${membersQuery.data.length === 1 ? '' : 's'}`
                      : 'Members could not be loaded'}
                  </p>
                  <Button asChild>
                    <Link href={slug ? `/org/${slug}/admin` : '/org/dashboard'}>Invite Member</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {(membersQuery.data ?? []).map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{memberName(member)}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                      </div>
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          changeMemberRole.mutate({ memberId: member.id, role })
                        }
                        disabled={member.role === 'owner'}
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="program_manager">Program Manager</SelectItem>
                          <SelectItem value="mentor">Mentor</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {!membersQuery.data && (
                    <p className="text-xs text-muted-foreground">
                      The member list lives under the organisation&apos;s admin page until the
                      directory responds.
                    </p>
                  )}
                </div>
              </CardContent>"""
assert s.count(old) == 1; s = s.replace(old, new)

# Permissions switches -> controlled + persisted under settings.policies
old = """                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Public Profile</p>
                    <p className="text-sm text-muted-foreground">
                      Allow your organization to be discovered publicly
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Open Applications</p>
                    <p className="text-sm text-muted-foreground">
                      Accept applications from any startup
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mentor Self-Registration</p>
                    <p className="text-sm text-muted-foreground">
                      Allow mentors to request to join your pool
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Startup Workspace Access</p>
                    <p className="text-sm text-muted-foreground">
                      Org admins can view all startup workspaces
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>"""
new = """                {[
                  { key: 'publicProfile', label: 'Public Profile', hint: 'Allow your organization to be discovered publicly' },
                  { key: 'openApplications', label: 'Open Applications', hint: 'Accept applications from any startup' },
                  { key: 'mentorSelfRegistration', label: 'Mentor Self-Registration', hint: 'Allow mentors to request to join your pool' },
                  { key: 'workspaceAccess', label: 'Startup Workspace Access', hint: 'Org admins can view all startup workspaces' },
                ].map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="text-sm text-muted-foreground">{p.hint}</p>
                    </div>
                    <Switch
                      checked={policies[p.key]}
                      onCheckedChange={(v) => setPolicy(p.key, v)}
                      disabled={!organizationId || savePolicies.isPending}
                    />
                  </div>
                ))}"""
assert s.count(old) == 1; s = s.replace(old, new)

# Billing honesty
old = """              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border bg-primary/5">"""
new = """              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Plan and payment details are illustrative — billing is not connected to the
                  organisation yet.
                </p>
                <div className="p-4 rounded-lg border bg-primary/5">"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                    <Button variant="outline">Change Plan</Button>"""
new = """                    <Button variant="outline" disabled title="Billing is not connected yet">Change Plan</Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                    <Button variant="ghost" size="sm">Update</Button>"""
new = """                    <Button variant="ghost" size="sm" disabled title="Billing is not connected yet">Update</Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

# Upload Logo / Verify inert buttons -> honest
old = """                    <Button variant="outline">Upload Logo</Button>"""
new = """                    <Button variant="outline" disabled title="Logo storage is not connected yet">Upload Logo</Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """                    <Button variant="outline">Verify</Button>"""
new = """                    <Button variant="outline" disabled title="Custom domains are not connected yet">Verify</Button>"""
assert s.count(old) == 1; s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
