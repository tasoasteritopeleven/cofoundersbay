'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { qk } from '@/lib/query-keys';
import {
  Building2, Shield, Plus, Check, X, AlertTriangle,
  Key, Activity, ChevronRight, RefreshCw, Trash2,
  Lock, ShieldCheck, ShieldOff, Globe,
} from 'lucide-react';
import {
  listTenants,
  getSSOStats,
  getSSOAuthEvents,
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
  type TenantItem,
  type SSOMode,
  type SSOProviderType,
  type IdentityProviderItem,
  type TenantSSOConfig,
  type SSOAuthEvent,
  type SSODomainMapping,
} from '@/lib/api';
import { bilingualInline } from '@/lib/i18n/format';
import { statusEl } from '@/components/common/StatusText';

import { pressableProps } from '@/lib/pressable';
function SSOModeBadge({ mode }: { mode?: SSOMode | null }) {
  if (mode === 'required') return <Badge className="bg-status-success-bg text-status-success border-status-success-border"><BilingualText en="SSO Required" el="SSO υποχρεωτικό" compact /></Badge>;
  if (mode === 'optional') return <Badge className="bg-status-info-bg text-status-info border-status-info-border"><BilingualText en="SSO Optional" el="SSO προαιρετικό" compact /></Badge>;
  return <Badge variant="secondary"><BilingualText en="SSO Disabled" el="SSO ανενεργό" compact /></Badge>;
}

export default function SSOAdminPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [eventsPage] = useState(0);

  const { data: tenants, isLoading: tenantsLoading, isError: tenantsError } = useQuery({
    queryKey: qk('admin', 'tenants'),
    queryFn: () => listTenants({ limit: 100 }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: qk('sso', 'stats'),
    queryFn: getSSOStats,
  });

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: qk('sso', 'events', eventsPage),
    queryFn: () => getSSOAuthEvents({ limit: 20, offset: eventsPage * 20 }),
  });

  return (
    <AppShell
      title="SSO Configuration"
      titleEl="Ρύθμιση SSO"
      description="Configure Single Sign-On for organization tenants"
      descriptionEl="Ρυθμίστε την ενιαία σύνδεση (SSO) για τους οργανισμούς"
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 kpi-odd-span-lg gap-4 lg:grid-cols-4 mb-6">
        {[
          { label: 'Total Tenants', labelEl: 'Σύνολο οργανισμών', value: tenants?.length ?? 0, icon: Building2, color: 'text-primary-accessible' },
          { label: 'Active Providers', labelEl: 'Ενεργοί πάροχοι', value: statsLoading ? '…' : (stats?.activeProviders ?? 0), icon: Key, color: 'text-status-info' },
          { label: 'Total Providers', labelEl: 'Σύνολο παρόχων', value: statsLoading ? '…' : (stats?.totalProviders ?? 0), icon: Shield, color: 'text-status-accent' },
          { label: 'Events (24h)', labelEl: 'Συμβάντα (24 ώρες)', value: statsLoading ? '…' : (stats?.recentEvents ?? 0), icon: Activity, color: 'text-status-success' },
        ].map(({ label, labelEl, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon className={`icon-md ${color}`} />
                <span className="page-stat text-xl font-bold">{value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tenant list */}
      <Card>
        <CardHeader>
          <CardTitle><BilingualText en="Organization Tenants" el="Οργανισμοί" compact /></CardTitle>
          <CardDescription><BilingualText en="Click a tenant to configure its SSO settings" el="Επιλέξτε οργανισμό για να ρυθμίσετε το SSO του" wrap /></CardDescription>
        </CardHeader>
        <CardContent>
          {tenantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : tenantsError ? (
            <div className="py-2 text-muted-foreground">
              <AlertTriangle className="icon-xl mx-auto mb-2 text-destructive-accessible" />
              <p><BilingualText en="Failed to load tenants" el="Δεν ήταν δυνατή η φόρτωση των οργανισμών" compact /></p>
            </div>
          ) : !tenants?.length ? (
            <div className="py-2 text-muted-foreground">
              <Building2 className="icon-xl mx-auto mb-2" />
              <p className="text-sm"><BilingualText en="No tenants yet — create one in the Tenants admin page." el="Δεν υπάρχουν οργανισμοί ακόμα — δημιουργήστε έναν στη διαχείριση οργανισμών." wrap /></p>
            </div>
          ) : (
            <div className="space-y-2">
              {tenants.map(tenant => (
                <TenantSSORow
                  key={tenant.id}
                  tenant={tenant}
                  onClick={() => setSelectedTenantId(tenant.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSO Config Panel */}
      {selectedTenantId && (
        <SSOConfigPanel
          tenantId={selectedTenantId}
          tenantName={tenants?.find(t => t.id === selectedTenantId)?.displayName || tenants?.find(t => t.id === selectedTenantId)?.name || selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
        />
      )}

      {/* Auth Events */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="icon-md" />
              <BilingualText en="Recent SSO Auth Events" el="Πρόσφατες συνδέσεις SSO" compact />
            </CardTitle>
            <CardDescription><BilingualText en="Authentication activity across all tenants (last 20)" el="Δραστηριότητα αυθεντικοποίησης σε όλους τους οργανισμούς (τελευταίες 20)" wrap /></CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchEvents()} className="gap-2">
            <RefreshCw className="icon-sm" />
            <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}</div>
          ) : !events?.length ? (
            <div className="py-2 text-muted-foreground">
              <Activity className="icon-xl mx-auto mb-2" />
              <p className="text-sm"><BilingualText en="No SSO events yet" el="Δεν υπάρχουν συμβάντα SSO ακόμα" compact /></p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map(ev => <SSOEventRow key={ev.id} event={ev} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function TenantSSORow({ tenant, onClick }: { tenant: TenantItem; onClick: () => void }) {
  const { data: config } = useQuery({
    queryKey: qk('sso', 'config', tenant.id),
    queryFn: () => getTenantSSOConfig(tenant.id),
  });

  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
      {...pressableProps()}
    >
      <div className="flex items-center gap-4">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="icon-md text-muted-foreground" />
          </div>
        )}
        <div>
          <h3 className="font-medium">{tenant.displayName || tenant.name}</h3>
          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SSOModeBadge mode={config?.ssoMode} />
        {config?.identityProvider && (
          <span className="text-xs text-muted-foreground">{config.identityProvider.providerName}</span>
        )}
        <ChevronRight className="icon-sm text-muted-foreground" />
      </div>
    </div>
  );
}

function SSOEventRow({ event }: { event: SSOAuthEvent }) {
  const isSuccess = !event.errorCode;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 text-sm">
      {isSuccess
        ? <ShieldCheck className="icon-sm text-status-success shrink-0" />
        : <ShieldOff className="icon-sm text-destructive-accessible shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="font-medium">{event.eventType}</span>
        {event.email && <span className="ml-2 text-muted-foreground">{event.email}</span>}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{event.identityProvider.tenant.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{new Date(event.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}</span>
      {event.errorMessage && <span className="text-xs text-destructive-accessible truncate max-w-[160px]">{event.errorMessage}</span>}
    </div>
  );
}

function SSOConfigPanel({
  tenantId, tenantName, onClose,
}: {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(true, onClose);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [saveError, setSaveError] = useState('');

  const confirmDeleteProvider = (p: IdentityProviderItem) =>
    confirm({
      title: <BilingualText en={`Delete SSO provider “${p.providerName}”?`} el={`Διαγραφή παρόχου SSO “${p.providerName}”;`} />,
      description: (
        <BilingualText
          en="Members who sign in through this provider will lose that sign-in method. This cannot be undone."
          el="Τα μέλη που συνδέονται μέσω αυτού του παρόχου θα χάσουν αυτή τη μέθοδο σύνδεσης. Δεν μπορεί να αναιρεθεί."
        />
      ),
      confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact />,
    });

  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: qk('sso', 'config', tenantId),
    queryFn: () => getTenantSSOConfig(tenantId),
  });

  const { data: providers, isLoading: providersLoading, refetch: refetchProviders } = useQuery({
    queryKey: qk('sso', 'providers', tenantId),
    queryFn: () => listSSOProviders(tenantId),
  });

  const [ssoMode, setSsoMode] = useState<SSOMode>('disabled');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [enforceEmailDomain, setEnforceEmailDomain] = useState(false);
  const [autoProvision, setAutoProvision] = useState(true);
  const [allowPasswordFallback, setAllowPasswordFallback] = useState(true);
  const [defaultRole, setDefaultRole] = useState('member');
  const [sessionDurationHours, setSessionDurationHours] = useState(24);
  const [roleMappingRules, setRoleMappingRules] = useState<{claim:string;value:string;role:string}[]>([]);
  const [activeTab, setActiveTab] = useState<'providers'|'policy'|'domains'>('providers');
  const [newDomain, setNewDomain] = useState('');
  const [newDomainAutoRedirect, setNewDomainAutoRedirect] = useState(false);

  const [showNewProvider, setShowNewProvider] = useState(false);
  const [providerType, setProviderType] = useState<SSOProviderType>('oidc');
  const [newProvider, setNewProvider] = useState({
    providerName: '',
    oidcIssuerUrl: '',
    oidcClientId: '',
    oidcClientSecret: '',
    oidcScopes: 'openid profile email',
    samlEntryPoint: '',
    samlIssuer: '',
    samlCert: '',
    samlMetadataUrl: '',
    loginButtonText: 'Continue with SSO',
  });

  // Sync form when existing config loads
  useEffect(() => {
    if (existingConfig) {
      setSsoMode(existingConfig.ssoMode);
      setSelectedProviderId(existingConfig.identityProviderId ?? '');
      setAllowedDomains(existingConfig.allowedDomains.join(', '));
      setEnforceEmailDomain(existingConfig.enforceEmailDomain);
      setAutoProvision(existingConfig.autoProvisionEnabled);
      setAllowPasswordFallback(existingConfig.allowPasswordFallback);
      setDefaultRole(existingConfig.defaultRole);
      setSessionDurationHours(existingConfig.sessionDurationHours);
    }
  }, [existingConfig]);

  const configMut = useMutation({
    mutationFn: () => upsertTenantSSOConfig(tenantId, {
      ssoMode,
      providerId: selectedProviderId || undefined,
      allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
      enforceEmailDomain,
      autoProvisionEnabled: autoProvision,
      allowPasswordFallback,
      defaultRole,
      sessionDurationHours,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('sso', 'config', tenantId) });
      queryClient.invalidateQueries({ queryKey: qk('sso', 'stats') });
      setSaveError('');
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const createProviderMut = useMutation({
    mutationFn: () => createSSOProvider(tenantId, {
      providerType,
      providerName: newProvider.providerName,
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

  const deleteProviderMut = useMutation({
    mutationFn: (id: string) => deleteSSOProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('sso', 'providers', tenantId) }),
  });

  const { data: domainMappings, isLoading: domainsLoading } = useQuery({
    queryKey: qk('sso', 'domains', tenantId),
    queryFn: () => listSSODomainMappings(tenantId),
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

  const toggleActive = (p: IdentityProviderItem) =>
    updateSSOProvider(p.id, { isActive: !p.isActive }).then(() =>
      queryClient.invalidateQueries({ queryKey: qk('sso', 'providers', tenantId) })
    );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {/* `useModalA11y`: focus in on open, Tab trapped, Escape closes,
          scroll locked, focus returned. This was a bare overlay with a
          close handler and nothing else a dialog owes a keyboard user. */}
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="SSO configuration"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <CardHeader className="flex flex-row items-center justify-between border-b sticky top-0 bg-card z-10">
          <div>
            <CardTitle>SSO — {tenantName}</CardTitle>
            <CardDescription><BilingualText en="Configure providers and authentication policy" el="Ρύθμιση παρόχων και πολιτικής αυθεντικοποίησης" wrap /></CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" onClick={onClose} aria-label="Close SSO configuration"><X className="icon-sm" aria-hidden="true" /></Button>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {saveError && (
            <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive-accessible flex items-center gap-2">
              <AlertTriangle className="icon-sm shrink-0" />{saveError}
            </div>
          )}

          {/* Tab nav */}
          <div className="flex gap-1 border-b pb-2">
            {(['providers','policy','domains'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-xl transition-colors capitalize ${
                  activeTab === tab ? 'bg-primary/10 text-primary-accessible font-medium' : 'text-muted-foreground hover:bg-muted/50'
                }`}>
                {tab === 'providers' ? 'Providers' : tab === 'policy' ? 'Policy' : 'Email Domains'}
              </button>
            ))}
          </div>

          {/* Identity Providers */}
          <div className={`space-y-3 ${activeTab !== 'providers' ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium"><BilingualText en="Identity Providers" el="Πάροχοι ταυτότητας" compact /></h3>
              <Button variant="outline" size="sm" onClick={() => setShowNewProvider(v => !v)} className="gap-2">
                <Plus className="icon-sm" />
                {showNewProvider ? 'Cancel' : 'Add Provider'}
              </Button>
            </div>

            {providersLoading ? (
              <div className="h-12 rounded-lg bg-muted/50 animate-pulse" />
            ) : !providers?.length && !showNewProvider ? (
              <div className="text-sm text-muted-foreground">
                <BilingualText en="No identity providers yet. Add one to enable SSO." el="Δεν υπάρχουν πάροχοι ταυτότητας. Προσθέστε έναν για να ενεργοποιήσετε το SSO." wrap />
              </div>
            ) : (
              <div className="space-y-2">
                {providers?.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${p.isActive ? 'bg-status-success-mark' : 'bg-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-medium">{p.providerName}</p>
                        <p className="text-xs text-muted-foreground uppercase">{p.providerType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleActive(p)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {p.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button aria-label="Delete provider" type="button" onClick={async () => { if (await confirmDeleteProvider(p)) deleteProviderMut.mutate(p.id); }} className="text-xs text-destructive-accessible hover:opacity-70">
                        <Trash2 className="icon-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Provider Form */}
            {showNewProvider && (
              <div className="p-4 rounded-lg border space-y-4 bg-muted/20">
                <h4 className="text-sm font-semibold"><BilingualText en="New Identity Provider" el="Νέος πάροχος ταυτότητας" compact /></h4>
                <div className="grid grid-cols-2 gap-2">
                  {(['oidc', 'saml', 'oauth2'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setProviderType(t)}
                      className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${providerType === t ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border hover:bg-muted/50'}`}>
                      {t === 'oidc' ? 'OpenID Connect' : t === 'saml' ? 'SAML 2.0' : 'OAuth 2.0'}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label htmlFor="sso-providerName" className="text-sm font-medium">Provider Name *</label>
                  <Input id="sso-providerName" value={newProvider.providerName} onChange={e => setNewProvider(p => ({ ...p, providerName: e.target.value }))} placeholder="e.g., University SSO" />
                </div>
                {(providerType === 'oidc' || providerType === 'oauth2') && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="sso-issuerUrl" className="text-sm font-medium">Issuer URL *</label>
                      <Input id="sso-issuerUrl" value={newProvider.oidcIssuerUrl} onChange={e => setNewProvider(p => ({ ...p, oidcIssuerUrl: e.target.value }))} placeholder="https://accounts.google.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label htmlFor="sso-clientId" className="text-sm font-medium">Client ID *</label>
                        <Input id="sso-clientId" value={newProvider.oidcClientId} onChange={e => setNewProvider(p => ({ ...p, oidcClientId: e.target.value }))} placeholder="client-id" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="sso-clientSecret" className="text-sm font-medium"><BilingualText en="Client Secret" el="Client secret" compact /></label>
                        <Input id="sso-clientSecret" type="password" value={newProvider.oidcClientSecret} onChange={e => setNewProvider(p => ({ ...p, oidcClientSecret: e.target.value }))} placeholder="••••••••" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="sso-scopes" className="text-sm font-medium">Scopes</label>
                      <Input id="sso-scopes" value={newProvider.oidcScopes} onChange={e => setNewProvider(p => ({ ...p, oidcScopes: e.target.value }))} placeholder="openid profile email" />
                    </div>
                  </>
                )}
                {providerType === 'saml' && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="sso-metadataUrl" className="text-sm font-medium"><BilingualText en="Metadata URL (optional)" el="URL metadata (προαιρετικό)" compact /></label>
                      <Input id="sso-metadataUrl" value={newProvider.samlMetadataUrl} onChange={e => setNewProvider(p => ({ ...p, samlMetadataUrl: e.target.value }))} placeholder="https://idp.example.com/metadata.xml" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label htmlFor="sso-entryPoint" className="text-sm font-medium"><BilingualText en="SSO Entry Point" el="Σημείο εισόδου SSO" compact /></label>
                        <Input id="sso-entryPoint" value={newProvider.samlEntryPoint} onChange={e => setNewProvider(p => ({ ...p, samlEntryPoint: e.target.value }))} placeholder="https://idp.example.com/sso" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="sso-entityId" className="text-sm font-medium"><BilingualText en="Issuer / Entity ID" el="Εκδότης / Entity ID" compact /></label>
                        <Input id="sso-entityId" value={newProvider.samlIssuer} onChange={e => setNewProvider(p => ({ ...p, samlIssuer: e.target.value }))} placeholder="urn:example:idp" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="sso-cert" className="text-sm font-medium"><BilingualText en="Public Certificate (PEM)" el="Δημόσιο πιστοποιητικό (PEM)" compact /></label>
                      <textarea id="sso-cert" value={newProvider.samlCert} onChange={e => setNewProvider(p => ({ ...p, samlCert: e.target.value }))} placeholder="-----BEGIN CERTIFICATE-----\n..." className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono resize-none" />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <label htmlFor="sso-loginButtonText" className="text-sm font-medium"><BilingualText en="Login Button Text" el="Κείμενο κουμπιού σύνδεσης" compact /></label>
                  <Input id="sso-loginButtonText" value={newProvider.loginButtonText} onChange={e => setNewProvider(p => ({ ...p, loginButtonText: e.target.value }))} placeholder="Continue with SSO" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => createProviderMut.mutate()} disabled={createProviderMut.isPending || !newProvider.providerName} className="gap-2">
                    <Plus className="icon-sm" />
                    {createProviderMut.isPending ? 'Creating…' : 'Create Provider'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* SSO Policy */}
          <div className={`space-y-4 pt-2 ${activeTab !== 'policy' ? 'hidden' : ''}`}>
            <h4 className="text-sm font-semibold"><BilingualText en="Authentication Policy" el="Πολιτική αυθεντικοποίησης" compact /></h4>

            <div className="space-y-2">
              <p className="text-xs font-medium"><BilingualText en="SSO Mode" el="Λειτουργία SSO" compact /></p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={bilingualInline('SSO Mode', 'Λειτουργία SSO')}>
                {([['disabled', 'Disabled', ShieldOff], ['optional', 'Optional', Shield], ['required', 'Required', Lock]] as const).map(([mode, label, Icon]) => (
                  <button key={mode} type="button" aria-pressed={ssoMode === mode} onClick={() => setSsoMode(mode)}
                    className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${ssoMode === mode ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border hover:bg-muted/50'}`}>
                    <Icon className="icon-sm" />{label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {ssoMode === 'required' ? 'Password login is blocked; all users must authenticate via SSO.' :
                 ssoMode === 'optional' ? 'SSO is available but users can also use password login.' :
                 'SSO is not available for this tenant.'}
              </p>
            </div>

            {ssoMode !== 'disabled' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="sso-selectedProvider" className="text-sm font-medium"><BilingualText en="Identity Provider" el="Πάροχος ταυτότητας" compact /></label>
                  <select id="sso-selectedProvider" value={selectedProviderId} onChange={e => setSelectedProviderId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                    <option value="">— None selected —</option>
                    {providers?.map(p => <option key={p.id} value={p.id}>{p.providerName} ({p.providerType.toUpperCase()})</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sso-allowedDomains" className="text-sm font-medium"><BilingualText en="Allowed Email Domains" el="Επιτρεπόμενοι τομείς email" compact /></label>
                  <Input id="sso-allowedDomains" value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)} placeholder="uoa.gr, di.uoa.gr (comma-separated)" />
                  <p className="text-xs text-muted-foreground"><BilingualText en="Leave empty to allow all domains" el="Αφήστε κενό για όλους τους τομείς" compact /></p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="sso-defaultRole" className="text-sm font-medium"><BilingualText en="Default Role for new users" el="Προεπιλεγμένος ρόλος νέων χρηστών" compact /></label>
                    <select id="sso-defaultRole" value={defaultRole} onChange={e => setDefaultRole(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                      {['founder', 'investor', 'mentor', 'member'].map(r => <option key={r} value={r}>{bilingualInline(r.charAt(0).toUpperCase() + r.slice(1), statusEl(r))}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="sso-sessionDuration" className="text-sm font-medium"><BilingualText en="Session Duration (hours)" el="Διάρκεια συνεδρίας (ώρες)" compact /></label>
                    <Input id="sso-sessionDuration" type="number" min={1} max={720} value={sessionDurationHours} onChange={e => setSessionDurationHours(Number(e.target.value))} />
                  </div>
                </div>

                {[
                  { key: 'enforceEmailDomain', label: 'Enforce email domain', labelEl: 'Επιβολή τομέα email', desc: 'Reject SSO logins from domains not in the allowed list', descEl: 'Απόρριψη συνδέσεων SSO από τομείς εκτός λίστας', value: enforceEmailDomain, set: setEnforceEmailDomain },
                  { key: 'autoProvision', label: 'Auto-provision users (JIT)', labelEl: 'Αυτόματη προμήθεια χρηστών (JIT)', desc: 'Create accounts automatically on first SSO login', descEl: 'Αυτόματη δημιουργία λογαριασμών στην πρώτη σύνδεση SSO', value: autoProvision, set: setAutoProvision },
                  { key: 'allowPasswordFallback', label: 'Allow password fallback', labelEl: 'Εναλλακτική σύνδεση με κωδικό', desc: 'Users may also log in with email + password', descEl: 'Δυνατότητα σύνδεσης και με email + κωδικό', value: allowPasswordFallback, set: setAllowPasswordFallback },
                ].map(({ key, label, labelEl, desc, descEl, value, set }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{bilingualInline(label, labelEl)}</p>
                      <p className="text-xs text-muted-foreground">{bilingualInline(desc, descEl)}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={() => set(!value)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}>
                      <div className={`absolute top-0.5 icon-md rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Domain Mappings */}
          {activeTab === 'domains' && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold"><BilingualText en="Email Domain Mappings" el="Τομείς email" compact /></h4>
              <p className="text-xs text-muted-foreground"><BilingualText en="Users entering emails at these domains will be offered this tenant&apos;s SSO on the login page." el="Όσοι εισάγουν email σε αυτούς τους τομείς βλέπουν το SSO αυτού του οργανισμού στη σύνδεση." wrap /></p>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm shrink-0">@</span>
                <input
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value.replace('@',''))}
                  placeholder="uoa.gr"
                  className="flex-1 h-9 rounded-xl border border-input bg-background px-3 text-sm"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 cursor-pointer">
                  <input type="checkbox" checked={newDomainAutoRedirect} onChange={e => setNewDomainAutoRedirect(e.target.checked)} className="rounded" />
                  <BilingualText en="Auto-redirect" el="Αυτόματη ανακατεύθυνση" compact />
                </label>
                <Button size="sm" onClick={() => addDomainMut.mutate()} disabled={!newDomain.trim() || addDomainMut.isPending} className="gap-1 shrink-0">
                  <Plus className="icon-sm" /><BilingualText en="Add" el="Προσθήκη" compact />
                </Button>
              </div>

              {domainsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />)}</div>
              ) : !domainMappings?.length ? (
                <div className="text-sm text-muted-foreground">
                  <Globe className="icon-lg mx-auto mb-1" />
                  <BilingualText en="No email domains mapped for this tenant" el="Δεν υπάρχουν τομείς email για αυτόν τον οργανισμό" wrap />
                </div>
              ) : (
                <div className="space-y-2">
                  {domainMappings.map((m: SSODomainMapping) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Globe className="icon-sm text-muted-foreground" />
                        <span className="text-sm font-medium">@{m.domain}</span>
                        {m.isVerified
                          ? <span className="text-xs text-status-success">✓ Verified</span>
                          : <button onClick={() => verifyDomainMut.mutate(m.id)} className="text-xs text-primary-accessible hover:underline"><BilingualText en="Mark verified" el="Σήμανση ως επαληθευμένο" compact /></button>}
                        {m.autoRedirectToSSO && <span className="text-xs text-muted-foreground">auto-redirect</span>}
                      </div>
                      <button aria-label="Remove domain mapping" onClick={() => deleteDomainMut.mutate(m.id)} className="text-muted-foreground hover:text-destructive-accessible">
                        <Trash2 className="icon-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <h4 className="text-sm font-semibold pt-2"><BilingualText en="Role Mapping Rules" el="Κανόνες αντιστοίχισης ρόλων" compact /></h4>
              <p className="text-xs text-muted-foreground"><BilingualText en="Map IdP claim values to platform roles on first SSO login." el="Αντιστοιχίστε τιμές claims του παρόχου σε ρόλους στην πρώτη σύνδεση SSO." wrap /></p>
              <div className="space-y-2">
                {roleMappingRules.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <input value={r.claim} onChange={e => setRoleMappingRules(rules => rules.map((x,idx) => idx===i ? {...x,claim:e.target.value} : x))}
                      placeholder={bilingualInline("Claim", "Ισχυρισμός")} className="h-8 rounded-xl border border-input bg-background px-2 text-xs" />
                    <input value={r.value} onChange={e => setRoleMappingRules(rules => rules.map((x,idx) => idx===i ? {...x,value:e.target.value} : x))}
                      placeholder={bilingualInline("Value", "Τιμή")} className="h-8 rounded-xl border border-input bg-background px-2 text-xs" />
                    <select value={r.role} onChange={e => setRoleMappingRules(rules => rules.map((x,idx) => idx===i ? {...x,role:e.target.value} : x))}
                      className="h-8 rounded-xl border border-input bg-background px-2 text-xs">
                      {['founder','investor','mentor','member','admin'].map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button aria-label="Remove rule" onClick={() => setRoleMappingRules(rules => rules.filter((_,idx) => idx !== i))} className="text-muted-foreground hover:text-destructive-accessible">
                      <X className="icon-sm" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setRoleMappingRules(r => [...r, {claim:'',value:'',role:'member'}])}
                  className="text-xs text-primary-accessible hover:underline flex items-center gap-1">
                  <Plus className="icon-sm" /><BilingualText en="Add rule" el="Προσθήκη κανόνα" compact />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
            <Button onClick={() => configMut.mutate()} disabled={configMut.isPending} className="gap-2">
              <Check className="icon-sm" />
              {configMut.isPending ? 'Saving…' : 'Save SSO Config'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
