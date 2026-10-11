'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock, Shield, Plus, Trash2, CheckCircle, AlertCircle,
  Copy, Key, Globe, ShieldOff, X, Check,
  AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenant } from '@/components/providers/TenantContext';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import {
  listSSOProviders,
  createSSOProvider,
  updateSSOProvider,
  deleteSSOProvider,
  getTenantSSOConfig,
  upsertTenantSSOConfig,
  listSSODomainMappings,
  createSSODomainMapping,
  deleteSSODomainMapping,
  verifySSODomainMapping,
  type SSOMode,
  type SSOProviderType,
  type IdentityProviderItem,
  type SSODomainMapping,
} from '@/lib/api';

type RoleMappingRule = { claim: string; value: string; role: string };

function SSOModeBadge({ mode }: { mode?: SSOMode | null }) {
  if (mode === 'required') return <Badge className="bg-status-success-bg text-status-success border-status-success-border"><BilingualText en="Required" el="Υποχρεωτικό" compact /></Badge>;
  if (mode === 'optional') return <Badge className="bg-status-info-bg text-status-info border-status-info-border"><BilingualText en="Optional" el="Προαιρετικό" compact /></Badge>;
  return <Badge variant="secondary"><BilingualText en="Disabled" el="Ανενεργό" compact /></Badge>;
}

function ProviderCard({
  provider,
  onToggle,
  onDelete,
  callbackBase,
}: {
  provider: IdentityProviderItem;
  onToggle: (p: IdentityProviderItem) => void;
  onDelete: (id: string) => void;
  callbackBase: string;
}) {
  const [copied, setCopied] = useState(false);
  const confirm = useConfirm();
  const callbackUrl = `${callbackBase}/api/sso/callback/${provider.id}`;

  const handleDelete = async () => {
    const ok = await confirm({
      title: <BilingualText en={`Delete SSO provider “${provider.providerName}”?`} el={`Διαγραφή παρόχου SSO “${provider.providerName}”;`} />,
      description: (
        <BilingualText
          en="Members who sign in through this provider will lose that sign-in method. This cannot be undone."
          el="Τα μέλη που συνδέονται μέσω αυτού του παρόχου θα χάσουν αυτή τη μέθοδο σύνδεσης. Δεν μπορεί να αναιρεθεί."
        />
      ),
      confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact />,
    });
    if (ok) onDelete(provider.id);
  };

  const copy = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isConfigured = provider.providerType === 'saml'
    ? !!(provider.samlEntryPoint || provider.samlMetadataUrl)
    : !!(provider.oidcIssuerUrl && provider.oidcClientId);

  // The Opportunities card: the provider's mark, its name over its protocol
  // and state, the switch and delete at the right; the callback URL and the
  // endpoints start on the mark's edge.
  return (
    <Card className={provider.isActive ? undefined : 'surface-inactive'}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Key className="icon-md" aria-hidden="true" />
            </div>
          )}
          title={provider.providerName}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <span key="type" className="uppercase">{provider.providerType}</span>,
                isConfigured ? (
                  <span key="state" className="text-status-success"><BilingualText en="Configured" el="Ρυθμισμένος" compact /></span>
                ) : (
                  <span key="state" className="text-status-warning"><BilingualText en="Needs configuration" el="Χρειάζεται ρύθμιση" compact /></span>
                ),
              ]}
            />
          )}
          asideStays
          aside={(
            <>
              <Switch checked={provider.isActive} onCheckedChange={() => onToggle(provider)} aria-label={bilingualInline(`${provider.providerName} active`, `${provider.providerName} ενεργός`)} />
              <button
                type="button"
                aria-label={bilingualInline(`Delete ${provider.providerName}`, `Διαγραφή ${provider.providerName}`)}
                onClick={() => void handleDelete()}
                className="tap-target text-muted-foreground transition-colors hover:text-destructive-accessible"
              >
                <Trash2 className="icon-sm" aria-hidden="true" />
              </button>
            </>
          )}
        />
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground"><BilingualText en="Callback URL" el="URL επιστροφής" compact /></span>
          <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{callbackUrl}</code>
          <button
            type="button"
            onClick={copy}
            className="tap-target shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={copied ? bilingualInline('Callback URL copied', 'Το URL επιστροφής αντιγράφηκε') : bilingualInline('Copy the callback URL', 'Αντιγραφή του URL επιστροφής')}
          >
            {copied ? <Check className="icon-sm text-status-success" aria-hidden="true" /> : <Copy className="icon-sm" aria-hidden="true" />}
          </button>
        </div>
        {provider.oidcIssuerUrl || provider.samlEntryPoint ? (
          <div className="space-y-1">
            {provider.oidcIssuerUrl && (
              <p className="break-all text-xs text-muted-foreground"><BilingualText en="Issuer" el="Εκδότης" compact />: {provider.oidcIssuerUrl}</p>
            )}
            {provider.samlEntryPoint && (
              <p className="break-all text-xs text-muted-foreground"><BilingualText en="Entry point" el="Σημείο εισόδου" compact />: {provider.samlEntryPoint}</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DomainRow({
  mapping,
  onDelete,
  onVerify,
}: {
  mapping: SSODomainMapping;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
}) {
  // A row of the card's head without its frame: the domain's mark, the
  // address over what it does, the state and the remove control at the right.
  return (
    <CardHead
      titleAs="h4"
      mark={(
        <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Globe className="icon-md" aria-hidden="true" />
        </div>
      )}
      title={<span className="break-all">@{mapping.domain}</span>}
      subtitle={mapping.autoRedirectToSSO
        ? <BilingualText en="Sends matching emails straight to SSO" el="Στέλνει τα αντίστοιχα email κατευθείαν στο SSO" compact wrap />
        : <BilingualText en="Offers SSO to matching emails" el="Προτείνει SSO στα αντίστοιχα email" compact wrap />}
      aside={(
        <>
          {mapping.isVerified ? (
            <Badge variant="outline" className="text-xs bg-status-success-bg text-status-success border-status-success-border">
              <CheckCircle className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Verified" el="Επαληθευμένο" compact />
            </Badge>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => onVerify(mapping.id)}>
              <BilingualText en="Mark verified" el="Σήμανση ως επαληθευμένο" compact />
            </Button>
          )}
          <button
            type="button"
            aria-label={bilingualInline(`Remove @${mapping.domain}`, `Αφαίρεση @${mapping.domain}`)}
            onClick={() => onDelete(mapping.id)}
            className="tap-target text-muted-foreground transition-colors hover:text-destructive-accessible"
          >
            <X className="icon-sm" aria-hidden="true" />
          </button>
        </>
      )}
    />
  );
}

function RoleMappingEditor({
  rules,
  onChange,
}: {
  rules: RoleMappingRule[];
  onChange: (rules: RoleMappingRule[]) => void;
}) {
  const add = () => onChange([...rules, { claim: '', value: '', role: 'member' }]);
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof RoleMappingRule, val: string) =>
    onChange(rules.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium"><BilingualText en="Role mapping rules" el="Κανόνες αντιστοίχισης ρόλων" compact /></p>
        <button type="button" onClick={add} className="tap-target flex items-center gap-1 text-xs text-primary-accessible hover:underline">
          <Plus className="icon-sm" aria-hidden="true" /><BilingualText en="Add rule" el="Προσθήκη κανόνα" compact />
        </button>
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          <BilingualText en="No rules: every SSO user gets the default role." el="Χωρίς κανόνες: κάθε χρήστης SSO παίρνει τον προεπιλεγμένο ρόλο." wrap />
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <Input value={r.claim} onChange={e => update(i, 'claim', e.target.value)} placeholder={bilingualInline('Claim (e.g. groups)', 'Claim (π.χ. groups)')} aria-label={bilingualInline(`Rule ${i + 1} claim`, `Κανόνας ${i + 1}: claim`)} className="text-xs h-8" />
              <Input value={r.value} onChange={e => update(i, 'value', e.target.value)} placeholder={bilingualInline('Value (e.g. admins)', 'Τιμή (π.χ. admins)')} aria-label={bilingualInline(`Rule ${i + 1} value`, `Κανόνας ${i + 1}: τιμή`)} className="text-xs h-8" />
              <select value={r.role} onChange={e => update(i, 'role', e.target.value)}
                aria-label={bilingualInline(`Rule ${i + 1} role`, `Κανόνας ${i + 1}: ρόλος`)}
                className="h-8 w-full rounded-xl border border-input bg-background px-2 text-xs">
                {['founder', 'investor', 'mentor', 'member', 'admin'].map(role =>
                  <option key={role} value={role}>{role}</option>
                )}
              </select>
              <button aria-label={bilingualInline(`Remove rule ${i + 1}`, `Αφαίρεση κανόνα ${i + 1}`)} type="button" onClick={() => remove(i)} className="tap-target text-muted-foreground hover:text-destructive-accessible">
                <X className="icon-sm" aria-hidden="true" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            <BilingualText en="When the identity provider sends a claim with that value, the member gets that role. Rules without a claim and a value are not saved." el="Όταν ο πάροχος ταυτότητας στέλνει ένα claim με αυτή την τιμή, το μέλος παίρνει αυτόν τον ρόλο. Κανόνες χωρίς claim και τιμή δεν αποθηκεύονται." wrap />
          </p>
        </div>
      )}
    </div>
  );
}

export default function TenantSSOPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? '';
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainAutoRedirect, setNewDomainAutoRedirect] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [providerType, setProviderType] = useState<SSOProviderType>('oidc');
  const [newProvider, setNewProvider] = useState({
    providerName: '', oidcIssuerUrl: '', oidcClientId: '',
    oidcClientSecret: '', oidcScopes: 'openid profile email',
    samlEntryPoint: '', samlIssuer: '', samlCert: '', samlMetadataUrl: '',
    loginButtonText: 'Continue with SSO',
  });

  const [ssoMode, setSsoMode] = useState<SSOMode>('disabled');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [enforceEmailDomain, setEnforceEmailDomain] = useState(false);
  const [autoProvision, setAutoProvision] = useState(true);
  const [allowPasswordFallback, setAllowPasswordFallback] = useState(true);
  const [defaultRole, setDefaultRole] = useState('member');
  const [sessionDuration, setSessionDuration] = useState(24);
  const [postLoginRedirect, setPostLoginRedirect] = useState('');
  const [roleMappingRules, setRoleMappingRules] = useState<RoleMappingRule[]>([]);

  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: qk('sso', 'providers', tenantId),
    queryFn: () => listSSOProviders(tenantId),
    enabled: !!tenantId,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: qk('sso', 'config', tenantId),
    queryFn: () => getTenantSSOConfig(tenantId),
    enabled: !!tenantId,
  });

  const { data: domainMappings, isLoading: domainsLoading } = useQuery({
    queryKey: qk('sso', 'domains', tenantId),
    queryFn: () => listSSODomainMappings(tenantId),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (config) {
      setSsoMode(config.ssoMode);
      setSelectedProviderId(config.identityProviderId ?? '');
      setAllowedDomains(config.allowedDomains.join(', '));
      setEnforceEmailDomain(config.enforceEmailDomain);
      setAutoProvision(config.autoProvisionEnabled);
      setAllowPasswordFallback(config.allowPasswordFallback);
      setDefaultRole(config.defaultRole);
      setSessionDuration(config.sessionDurationHours);
      setRoleMappingRules(config.roleMappingRules ?? []);
      setPostLoginRedirect(config.postLoginRedirect ?? '');
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: () => upsertTenantSSOConfig(tenantId, {
      ssoMode,
      providerId: selectedProviderId || undefined,
      allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
      enforceEmailDomain,
      autoProvisionEnabled: autoProvision,
      allowPasswordFallback,
      defaultRole,
      sessionDurationHours: sessionDuration,
      postLoginRedirect: postLoginRedirect || undefined,
      // The rules were edited here but never sent, so "Save policy" kept
      // whatever the database already had. Half-filled rows are dropped.
      roleMappingRules: roleMappingRules
        .map((r) => ({ claim: r.claim.trim(), value: r.value.trim(), role: r.role }))
        .filter((r) => r.claim && r.value),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('sso', 'config', tenantId) });
      setSaveError('');
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const createProviderMut = useMutation({
    mutationFn: () => createSSOProvider(tenantId, {
      providerType, providerName: newProvider.providerName,
      oidcIssuerUrl: newProvider.oidcIssuerUrl || undefined,
      oidcClientId: newProvider.oidcClientId || undefined,
      oidcClientSecret: newProvider.oidcClientSecret || undefined,
      oidcScopes: newProvider.oidcScopes || undefined,
      samlEntryPoint: newProvider.samlEntryPoint || undefined,
      samlIssuer: newProvider.samlIssuer || undefined,
      samlCert: newProvider.samlCert || undefined,
      samlMetadataUrl: newProvider.samlMetadataUrl || undefined,
      loginButtonText: newProvider.loginButtonText || undefined,
      isActive: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('sso', 'providers', tenantId) });
      setShowNewProvider(false);
      setNewProvider({ providerName: '', oidcIssuerUrl: '', oidcClientId: '', oidcClientSecret: '', oidcScopes: 'openid profile email', samlEntryPoint: '', samlIssuer: '', samlCert: '', samlMetadataUrl: '', loginButtonText: 'Continue with SSO' });
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const toggleProviderMut = useMutation({
    mutationFn: (p: IdentityProviderItem) => updateSSOProvider(p.id, { isActive: !p.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('sso', 'providers', tenantId) }),
  });

  const deleteProviderMut = useMutation({
    mutationFn: (id: string) => deleteSSOProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('sso', 'providers', tenantId) }),
  });

  const addDomainMut = useMutation({
    mutationFn: () => createSSODomainMapping(tenantId, newDomain, newDomainAutoRedirect),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('sso', 'domains', tenantId) });
      setNewDomain('');
      setNewDomainAutoRedirect(false);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const deleteDomainMut = useMutation({
    mutationFn: (id: string) => deleteSSODomainMapping(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('sso', 'domains', tenantId) }),
  });

  const verifyDomainMut = useMutation({
    mutationFn: (id: string) => verifySSODomainMapping(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('sso', 'domains', tenantId) }),
  });

  if (!tenantId) {
    return (
      <AppShell>
        <div className="py-12 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3" aria-hidden="true" />
          <p><BilingualText en="No organisation is selected. Open this page from your organisation." el="Δεν έχει επιλεγεί οργανισμός. Ανοίξτε αυτή τη σελίδα από τον οργανισμό σας." wrap /></p>
        </div>
      </AppShell>
    );
  }

  const apiBase = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : '';
  const activeProviderCount = providers?.filter(p => p.isActive).length ?? 0;

  return (
    <AppShell
      title="SSO / Authentication"
      titleEl="SSO / Αυθεντικοποίηση"
      description="Configure SAML, OIDC, or Google Workspace SSO for your members. Optional rules map IdP claims to roles."
      descriptionEl="Ρυθμίστε SSO με SAML, OIDC ή Google Workspace για τα μέλη σας. Προαιρετικοί κανόνες αντιστοιχίζουν claims του παρόχου σε ρόλους."
      actions={<SSOModeBadge mode={config?.ssoMode} />}
    >
      <div className="space-y-6">

        {/* Status Banner */}
        {ssoMode !== 'disabled' && activeProviderCount > 0 ? (
          <Card className="border-status-success-border bg-status-success-bg">
            <CardContent className="flex items-center gap-3">
              <Shield className="icon-md text-status-success shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium"><BilingualText en="SSO is active" el="Το SSO είναι ενεργό" compact /></p>
                <p className="text-xs text-muted-foreground">
                  <BilingualText
                    en={`${activeProviderCount} provider${activeProviderCount !== 1 ? 's' : ''} active · ${ssoMode === 'required' ? 'password sign-in is off' : 'password sign-in still allowed'}`}
                    el={`${activeProviderCount} ${activeProviderCount !== 1 ? 'ενεργοί πάροχοι' : 'ενεργός πάροχος'} · ${ssoMode === 'required' ? 'η σύνδεση με κωδικό είναι ανενεργή' : 'η σύνδεση με κωδικό επιτρέπεται ακόμα'}`}
                    wrap
                  />
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-status-warning-border bg-status-warning-bg">
            <CardContent className="flex items-center gap-3">
              <AlertCircle className="icon-md text-status-warning shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium"><BilingualText en="SSO is not set up" el="Το SSO δεν έχει ρυθμιστεί" compact /></p>
                <p className="text-xs text-muted-foreground">
                  <BilingualText en="Add an identity provider, then choose an SSO mode under Policy." el="Προσθέστε πάροχο ταυτότητας και επιλέξτε λειτουργία SSO στην Πολιτική." wrap />
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {saveError && (
          <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive-accessible flex items-center gap-2">
            <AlertTriangle className="icon-sm shrink-0" aria-hidden="true" />{saveError}
          </div>
        )}

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers"><BilingualText en="Identity providers" el="Πάροχοι ταυτότητας" compact /></TabsTrigger>
            <TabsTrigger value="policy"><BilingualText en="Policy" el="Πολιτική" compact /></TabsTrigger>
            <TabsTrigger value="domains"><BilingualText en="Email domains" el="Τομείς email" compact /></TabsTrigger>
          </TabsList>

          {/* ── Providers Tab ─── */}
          <TabsContent value="providers" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <BilingualText
                  en={`${providers?.length ?? 0} provider${(providers?.length ?? 0) !== 1 ? 's' : ''} configured`}
                  el={`${providers?.length ?? 0} ${(providers?.length ?? 0) !== 1 ? 'πάροχοι' : 'πάροχος'}`}
                  compact
                />
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowNewProvider(v => !v)} className="gap-2" aria-expanded={showNewProvider}>
                {showNewProvider ? <X className="icon-sm" aria-hidden="true" /> : <Plus className="icon-sm" aria-hidden="true" />}
                {showNewProvider
                  ? <BilingualText en="Cancel" el="Ακύρωση" compact />
                  : <BilingualText en="Add provider" el="Προσθήκη παρόχου" compact />}
              </Button>
            </div>

            {showNewProvider && (
              <Card className="border-primary/15 bg-primary/[0.03]">
                <CardHeader>
                  <CardTitle><BilingualText en="New identity provider" el="Νέος πάροχος ταυτότητας" compact /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label={bilingualInline('Protocol', 'Πρωτόκολλο')}>
                    {(['oidc', 'saml', 'oauth2'] as const).map(t => (
                      <button key={t} type="button" aria-pressed={providerType === t} onClick={() => setProviderType(t)}
                        className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${providerType === t ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border hover:bg-muted/50'}`}>
                        {t === 'oidc' ? 'OpenID Connect' : t === 'saml' ? 'SAML 2.0' : 'OAuth 2.0'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="sso-provider-name" className="text-sm font-medium"><BilingualText en="Provider Name *" el="Όνομα παρόχου *" compact /></label>
                    <Input id="sso-provider-name" value={newProvider.providerName} onChange={e => setNewProvider(p => ({ ...p, providerName: e.target.value }))} placeholder={bilingualInline('e.g. University SSO, Okta, Azure AD', 'π.χ. SSO Πανεπιστημίου, Okta, Azure AD')} />
                  </div>

                  {(providerType === 'oidc' || providerType === 'oauth2') && (
                    <>
                      <div className="space-y-1">
                        <label htmlFor="sso-issuer" className="text-sm font-medium"><BilingualText en="Issuer / Discovery URL *" el="URL εκδότη / discovery *" compact /></label>
                        <Input id="sso-issuer" value={newProvider.oidcIssuerUrl} onChange={e => setNewProvider(p => ({ ...p, oidcIssuerUrl: e.target.value }))} placeholder="https://accounts.google.com" />
                        <p className="text-xs text-muted-foreground">
                          <BilingualText en="Discovery is tried at this URL + /.well-known/openid-configuration" el="Η ανακάλυψη δοκιμάζεται σε αυτό το URL + /.well-known/openid-configuration" wrap />
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label htmlFor="sso-client-id" className="text-sm font-medium"><BilingualText en="Client ID *" el="Client ID *" compact /></label>
                          <Input id="sso-client-id" value={newProvider.oidcClientId} onChange={e => setNewProvider(p => ({ ...p, oidcClientId: e.target.value }))} placeholder="client-id" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="sso-client-secret" className="text-sm font-medium"><BilingualText en="Client Secret" el="Client secret" compact /></label>
                          <Input id="sso-client-secret" type="password" value={newProvider.oidcClientSecret} onChange={e => setNewProvider(p => ({ ...p, oidcClientSecret: e.target.value }))} placeholder="••••••••" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="sso-scopes" className="text-sm font-medium"><BilingualText en="Scopes" el="Scopes" compact /></label>
                        <Input id="sso-scopes" value={newProvider.oidcScopes} onChange={e => setNewProvider(p => ({ ...p, oidcScopes: e.target.value }))} placeholder="openid profile email" />
                      </div>
                    </>
                  )}

                  {providerType === 'saml' && (
                    <>
                      <div className="space-y-1">
                        <label htmlFor="sso-metadata" className="text-sm font-medium"><BilingualText en="Metadata URL (recommended)" el="URL metadata (προτείνεται)" compact /></label>
                        <Input id="sso-metadata" value={newProvider.samlMetadataUrl} onChange={e => setNewProvider(p => ({ ...p, samlMetadataUrl: e.target.value }))} placeholder="https://idp.example.com/metadata.xml" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label htmlFor="sso-entry" className="text-sm font-medium"><BilingualText en="SSO Entry Point" el="Σημείο εισόδου SSO" compact /></label>
                          <Input id="sso-entry" value={newProvider.samlEntryPoint} onChange={e => setNewProvider(p => ({ ...p, samlEntryPoint: e.target.value }))} placeholder="https://idp.example.com/sso" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="sso-entity" className="text-sm font-medium"><BilingualText en="Issuer / Entity ID" el="Εκδότης / Entity ID" compact /></label>
                          <Input id="sso-entity" value={newProvider.samlIssuer} onChange={e => setNewProvider(p => ({ ...p, samlIssuer: e.target.value }))} placeholder="urn:example:idp" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="sso-cert" className="text-sm font-medium"><BilingualText en="Public certificate (PEM)" el="Δημόσιο πιστοποιητικό (PEM)" compact /></label>
                        <textarea id="sso-cert" value={newProvider.samlCert} onChange={e => setNewProvider(p => ({ ...p, samlCert: e.target.value }))}
                          placeholder="-----BEGIN CERTIFICATE-----&#10;..." rows={3}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono resize-none" />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="sso-button-text" className="text-sm font-medium"><BilingualText en="Login Button Text" el="Κείμενο κουμπιού σύνδεσης" compact /></label>
                    <Input id="sso-button-text" value={newProvider.loginButtonText} onChange={e => setNewProvider(p => ({ ...p, loginButtonText: e.target.value }))} placeholder="Continue with SSO" />
                  </div>

                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => createProviderMut.mutate()} disabled={createProviderMut.isPending || !newProvider.providerName} className="gap-2">
                      <Plus className="icon-sm" aria-hidden="true" />
                      {createProviderMut.isPending
                        ? <BilingualText en="Creating…" el="Δημιουργία…" compact />
                        : <BilingualText en="Create provider" el="Δημιουργία παρόχου" compact />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {providersLoading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
            ) : !providers?.length ? (
              <div className="py-10 text-center text-muted-foreground border border-dashed rounded-xl">
                <Key className="icon-xl mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm"><BilingualText en="No identity providers yet" el="Δεν υπάρχουν πάροχοι ταυτότητας ακόμα" compact /></p>
                <p className="text-xs mt-1"><BilingualText en="Use Add provider above to connect OIDC or SAML." el="Χρησιμοποιήστε την Προσθήκη παρόχου για σύνδεση OIDC ή SAML." wrap /></p>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map(p => (
                  <ProviderCard key={p.id} provider={p} callbackBase={apiBase}
                    onToggle={p => toggleProviderMut.mutate(p)}
                    onDelete={id => deleteProviderMut.mutate(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Policy Tab ─── */}
          <TabsContent value="policy" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="SSO mode" el="Λειτουργία SSO" compact /></CardTitle>
                <CardDescription><BilingualText en="How SSO sits beside password sign-in for your organisation's members." el="Πώς συνυπάρχει το SSO με τη σύνδεση με κωδικό για τα μέλη του οργανισμού σας." wrap /></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={bilingualInline('SSO mode', 'Λειτουργία SSO')}>
                  {([
                    ['disabled', 'Disabled', 'Ανενεργό', ShieldOff, 'Password sign-in only', 'Μόνο σύνδεση με κωδικό'],
                    ['optional', 'Optional', 'Προαιρετικό', Shield, 'SSO offered, password still allowed', 'Προσφέρεται SSO, ο κωδικός επιτρέπεται'],
                    ['required', 'Required', 'Υποχρεωτικό', Lock, 'Every member signs in with SSO', 'Όλα τα μέλη συνδέονται με SSO'],
                  ] as const).map(([mode, label, labelEl, Icon, desc, descEl]) => (
                    <button key={mode} type="button" aria-pressed={ssoMode === mode} onClick={() => setSsoMode(mode as SSOMode)}
                      className={`p-3 rounded-lg border text-left transition-colors ${ssoMode === mode ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                      <Icon className={`icon-sm mb-1 ${ssoMode === mode ? 'text-primary-accessible' : 'text-muted-foreground'}`} aria-hidden="true" />
                      <p className={`text-sm font-medium ${ssoMode === mode ? 'text-primary-accessible' : ''}`}><BilingualText en={label} el={labelEl} compact /></p>
                      <p className="text-xs text-muted-foreground mt-0.5"><BilingualText en={desc} el={descEl} wrap /></p>
                    </button>
                  ))}
                </div>

                {ssoMode !== 'disabled' && (
                  <>
                    <div className="space-y-1">
                      <label htmlFor="sso-selected-provider" className="text-sm font-medium"><BilingualText en="Identity provider" el="Πάροχος ταυτότητας" compact /></label>
                      <select id="sso-selected-provider" value={selectedProviderId} onChange={e => setSelectedProviderId(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2">
                        <option value="">{bilingualInline('None selected', 'Καμία επιλογή')}</option>
                        {providers?.map(p => <option key={p.id} value={p.id}>{p.providerName} ({p.providerType.toUpperCase()})</option>)}
                      </select>
                    </div>

                    <div className="card-rows">
                    {[
                      { key: 'allowPasswordFallback', label: 'Allow password fallback', labelEl: 'Να επιτρέπεται ο κωδικός', desc: 'Members may also sign in with email and password', descEl: 'Τα μέλη μπορούν να συνδεθούν και με email και κωδικό', value: allowPasswordFallback, set: setAllowPasswordFallback },
                      { key: 'autoProvision', label: 'Create accounts on first sign-in (JIT)', labelEl: 'Δημιουργία λογαριασμού στην πρώτη σύνδεση (JIT)', desc: 'A member signing in with SSO for the first time gets an account', descEl: 'Όποιος συνδέεται πρώτη φορά με SSO αποκτά λογαριασμό', value: autoProvision, set: setAutoProvision },
                    ].map(({ key, label, labelEl, desc, descEl, value, set }) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium"><BilingualText en={label} el={labelEl} wrap /></p>
                          <p className="text-xs text-muted-foreground"><BilingualText en={desc} el={descEl} wrap /></p>
                        </div>
                        <Switch checked={value} onCheckedChange={set} aria-label={bilingualInline(label, labelEl)} />
                      </div>
                    ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {ssoMode !== 'disabled' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle><BilingualText en="New members" el="Νέα μέλη" compact /></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="sso-default-role" className="text-sm font-medium"><BilingualText en="Default role for new SSO members" el="Προεπιλεγμένος ρόλος νέων μελών SSO" compact wrap /></label>
                        <select id="sso-default-role" value={defaultRole} onChange={e => setDefaultRole(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2">
                          {['founder', 'investor', 'mentor', 'member'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="sso-session" className="text-sm font-medium"><BilingualText en="Session length (hours)" el="Διάρκεια συνεδρίας (ώρες)" compact /></label>
                        <Input id="sso-session" type="number" min={1} max={720} value={sessionDuration} onChange={e => setSessionDuration(Number(e.target.value))} />
                      </div>
                    </div>

                    <RoleMappingEditor rules={roleMappingRules} onChange={setRoleMappingRules} />
                  </CardContent>
                </Card>

                <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(v => !v)} className="tap-target flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {showAdvanced ? <ChevronUp className="icon-sm" aria-hidden="true" /> : <ChevronDown className="icon-sm" aria-hidden="true" />}
                  <BilingualText en="Advanced settings" el="Προχωρημένες ρυθμίσεις" compact />
                </button>

                {showAdvanced && (
                  <Card>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <label htmlFor="sso-redirect" className="text-sm font-medium"><BilingualText en="Page after sign-in" el="Σελίδα μετά τη σύνδεση" compact /></label>
                        <Input id="sso-redirect" value={postLoginRedirect} onChange={e => setPostLoginRedirect(e.target.value)} placeholder={bilingualInline('/dashboard (blank for the default)', '/dashboard (κενό για την προεπιλογή)')} />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="sso-allowed-domains" className="text-sm font-medium"><BilingualText en="Allowed email domains" el="Επιτρεπόμενοι τομείς email" compact /></label>
                        <Input id="sso-allowed-domains" value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)} placeholder={bilingualInline('uoa.gr, di.uoa.gr (comma-separated)', 'uoa.gr, di.uoa.gr (με κόμμα)')} />
                        <p className="text-xs text-muted-foreground"><BilingualText en="Leave empty to allow any domain." el="Αφήστε κενό για οποιονδήποτε τομέα." compact wrap /></p>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium"><BilingualText en="Enforce email domain" el="Επιβολή τομέα email" compact /></p>
                          <p className="text-xs text-muted-foreground"><BilingualText en="Refuse SSO sign-ins from domains not on the allowed list" el="Απόρριψη συνδέσεων SSO από τομείς εκτός λίστας" wrap /></p>
                        </div>
                        <Switch checked={enforceEmailDomain} onCheckedChange={setEnforceEmailDomain} aria-label={bilingualInline('Enforce email domain', 'Επιβολή τομέα email')} />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {saveOk && <span className="text-xs text-status-success flex items-center gap-1" role="status"><Check className="icon-sm" aria-hidden="true" /><BilingualText en="Saved" el="Αποθηκεύτηκε" compact /></span>}
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
                <Check className="icon-sm" aria-hidden="true" />
                {saveMut.isPending
                  ? <BilingualText en="Saving…" el="Αποθήκευση…" compact />
                  : <BilingualText en="Save policy" el="Αποθήκευση πολιτικής" compact />}
              </Button>
            </div>
          </TabsContent>

          {/* ── Email Domains Tab ─── */}
          <TabsContent value="domains" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Email domains" el="Τομείς email" compact /></CardTitle>
                <CardDescription>
                  <BilingualText
                    en="Someone who types an email at one of these domains on the sign-in page is offered your organisation's SSO."
                    el="Όποιος πληκτρολογεί email σε έναν από αυτούς τους τομείς στη σελίδα σύνδεσης βλέπει το SSO του οργανισμού σας."
                    wrap
                  />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-sm" aria-hidden="true">@</span>
                  <Input value={newDomain} onChange={e => setNewDomain(e.target.value.replace('@', ''))} placeholder="uoa.gr" aria-label={bilingualInline('Email domain to add', 'Τομέας email για προσθήκη')} className="min-w-[10rem] flex-1" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <input type="checkbox" id="auto-redirect" checked={newDomainAutoRedirect} onChange={e => setNewDomainAutoRedirect(e.target.checked)} className="rounded" />
                    <label htmlFor="auto-redirect"><BilingualText en="Send straight to SSO" el="Απευθείας στο SSO" compact /></label>
                  </div>
                  <Button size="sm" onClick={() => addDomainMut.mutate()} disabled={!newDomain.trim() || addDomainMut.isPending} className="gap-1.5 shrink-0">
                    <Plus className="icon-sm" aria-hidden="true" /><BilingualText en="Add domain" el="Προσθήκη τομέα" compact />
                  </Button>
                </div>

                {domainsLoading ? (
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}</div>
                ) : !domainMappings?.length ? (
                  <div className="py-8 text-center text-muted-foreground border border-dashed rounded-xl">
                    <Globe className="h-7 w-7 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm"><BilingualText en="No email domains yet" el="Δεν υπάρχουν τομείς email ακόμα" compact /></p>
                    <p className="text-xs mt-1"><BilingualText en="Add your organisation's email domain so the sign-in page can offer SSO." el="Προσθέστε τον τομέα email του οργανισμού σας ώστε η σελίδα σύνδεσης να προτείνει SSO." wrap /></p>
                  </div>
                ) : (
                  <div className="card-rows">
                    {domainMappings.map(m => (
                      <DomainRow key={m.id} mapping={m}
                        onDelete={id => deleteDomainMut.mutate(id)}
                        onVerify={id => verifyDomainMut.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
