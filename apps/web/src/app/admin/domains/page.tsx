'use client';

import { StatusText } from '@/components/common/StatusText';
import { FactLine } from '@/components/common/FactLine';
import { RowHead } from '@/components/dashboard/SectionCard';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTenants,
  listTenantDomains,
  addTenantSubdomain,
  addTenantCustomDomain,
  verifyTenantDomain,
  setTenantPrimaryDomain,
  toggleTenantDomainActive,
  deleteTenantDomain,
  getDomainDnsInstructions,
  type TenantItem,
  type TenantDomainItem,
  type DnsInstructions,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/layout/AppShell';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { qk } from '@/lib/query-keys';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Star,
  StarOff,
  Power,
  Copy,
  ChevronDown,
  ChevronRight,
  Link2,
} from 'lucide-react';

function statusBadge(status: TenantDomainItem['verificationStatus']) {
  switch (status) {
    case 'verified': return <Badge className="bg-status-success-bg text-status-success border-status-success-border gap-1"><CheckCircle2 className="icon-sm" /><BilingualText en="Verified" el="Επαληθευμένος" compact /></Badge>;
    case 'pending':  return <Badge className="bg-status-warning-bg text-status-warning border-status-warning-border gap-1"><Clock className="icon-sm" /><BilingualText en="Pending" el="Σε αναμονή" compact /></Badge>;
    case 'failed':   return <Badge className="bg-status-danger-bg text-status-danger border-status-danger-border gap-1"><XCircle className="icon-sm" /><BilingualText en="Failed" el="Απέτυχε" compact /></Badge>;
    case 'expired':  return <Badge className="bg-muted text-muted-foreground border-border gap-1"><XCircle className="icon-sm" /><BilingualText en="Expired" el="Έληξε" compact /></Badge>;
  }
}

function DnsInstructionsPanel({ instructions }: { instructions: DnsInstructions }) {
  const copy = (text: string) => navigator.clipboard.writeText(text);
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm">
      <p className="font-semibold text-foreground"><BilingualText en="DNS Setup Instructions" el="Οδηγίες ρύθμισης DNS" compact /></p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide"><BilingualText en="Step 1 – Verification TXT Record" el="Βήμα 1 – Εγγραφή TXT επαλήθευσης" compact /></p>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 font-mono text-xs bg-background rounded p-2 border border-border">
          <span className="text-muted-foreground"><BilingualText en="Type" el="Τύπος" compact /></span>
          <span>{instructions.verification.type}</span>
          <span />
          <span className="text-muted-foreground"><BilingualText en="Name" el="Όνομα" compact /></span>
          <span className="break-all">{instructions.verification.name}</span>
          <button aria-label="Copy record name" onClick={() => copy(instructions.verification.name)} className="text-muted-foreground hover:text-foreground"><Copy className="icon-sm" /></button>
          <span className="text-muted-foreground"><BilingualText en="Value" el="Τιμή" compact /></span>
          <span className="break-all">{instructions.verification.value}</span>
          <button aria-label="Copy record value" onClick={() => copy(instructions.verification?.value ?? '')} className="text-muted-foreground hover:text-foreground"><Copy className="icon-sm" /></button>
          <span className="text-muted-foreground">TTL</span>
          <span>{instructions.verification.ttl}</span>
          <span />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide"><BilingualText en="Step 2 – CNAME Record" el="Βήμα 2 – Εγγραφή CNAME" compact /></p>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 font-mono text-xs bg-background rounded p-2 border border-border">
          <span className="text-muted-foreground"><BilingualText en="Type" el="Τύπος" compact /></span>
          <span>{instructions.cname.type}</span>
          <span />
          <span className="text-muted-foreground"><BilingualText en="Name" el="Όνομα" compact /></span>
          <span className="break-all">{instructions.cname.name}</span>
          <button aria-label="Copy CNAME name" onClick={() => copy(instructions.cname.name)} className="text-muted-foreground hover:text-foreground"><Copy className="icon-sm" /></button>
          <span className="text-muted-foreground"><BilingualText en="Value" el="Τιμή" compact /></span>
          <span className="break-all">{instructions.cname.value}</span>
          <button aria-label="Copy CNAME value" onClick={() => copy(instructions.cname.value)} className="text-muted-foreground hover:text-foreground"><Copy className="icon-sm" /></button>
        </div>
      </div>
      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
        {instructions.instructions.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  );
}

function DomainRow({
  domain,
  tenantId,
  onRefresh,
}: {
  domain: TenantDomainItem;
  tenantId: string;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showDns, setShowDns] = useState(false);
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [loadingDns, setLoadingDns] = useState(false);
  const fmtDate = useDateFormat();

  const handleRemove = async () => {
    const ok = await confirm({
      title: <BilingualText en={`Remove domain “${domain.domainName}”?`} el={`Αφαίρεση domain “${domain.domainName}”;`} />,
      description: (
        <BilingualText
          en="Sign-in and links on this domain will stop working for your members."
          el="Η σύνδεση και οι σύνδεσμοι σε αυτό το domain θα σταματήσουν να λειτουργούν για τα μέλη σας."
        />
      ),
      confirmLabel: <BilingualText en="Remove" el="Αφαίρεση" compact />,
    });
    if (ok) remove.mutate();
  };

  const verify = useMutation({
    mutationFn: () => verifyTenantDomain(tenantId, domain.id),
    onSuccess: onRefresh,
  });
  const setPrimary = useMutation({
    mutationFn: () => setTenantPrimaryDomain(tenantId, domain.id),
    onSuccess: onRefresh,
  });
  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleTenantDomainActive(tenantId, domain.id, active),
    onSuccess: onRefresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteTenantDomain(tenantId, domain.id),
    onSuccess: onRefresh,
  });

  const handleShowDns = async () => {
    if (domain.domainType !== 'custom') return;
    if (dnsInstructions) { setShowDns(!showDns); return; }
    setLoadingDns(true);
    try {
      const result = await getDomainDnsInstructions(tenantId, domain.id);
      setDnsInstructions(result);
      setShowDns(true);
    } finally {
      setLoadingDns(false);
    }
  };

  // A row of the list, not a framed tile inside the card: the address over
  // its kind and state, the verification at the right, the actions on the
  // address's edge (outline first, so the row's letters keep the axis).
  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <RowHead
        title={<span className="break-all font-mono" translate="no">{domain.domainName}</span>}
        subtitle={(
          <FactLine
            items={[
              <StatusText key="type" value={domain.domainType} />,
              domain.isPrimary ? <BilingualText key="primary" en="Primary" el="Κύριος" compact /> : null,
              domain.isActive
                ? <span key="active" className="text-status-success"><BilingualText en="Active" el="Ενεργός" compact /></span>
                : <BilingualText key="active" en="Inactive" el="Ανενεργός" compact />,
              domain.sslStatus === 'active' ? <span key="ssl">SSL</span> : null,
              domain.verifiedAt ? (
                <BilingualText
                  key="verified"
                  en={`Verified ${fmtDate(domain.verifiedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  el={`Επαληθεύτηκε ${fmtDate(domain.verifiedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  compact
                />
              ) : null,
            ]}
          />
        )}
        aside={statusBadge(domain.verificationStatus)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {domain.domainType === 'custom' && domain.verificationStatus !== 'verified' && (
          <>
            <Button size="sm" variant="outline" onClick={handleShowDns} disabled={loadingDns} aria-expanded={showDns} className="gap-1 h-7 text-xs">
              <Link2 className="icon-sm" />
              <BilingualText en="DNS Setup" el="Ρύθμιση DNS" compact />
              {showDns ? <ChevronDown className="icon-sm" /> : <ChevronRight className="icon-sm" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending} className="gap-1 h-7 text-xs">
              <RefreshCw className={`icon-sm ${verify.isPending ? 'animate-spin' : ''}`} />
              <BilingualText en="Verify" el="Επαλήθευση" compact />
            </Button>
          </>
        )}
        {!domain.isPrimary && domain.isActive && (
          <Button size="sm" variant="outline" onClick={() => setPrimary.mutate()} disabled={setPrimary.isPending} className="gap-1 h-7 text-xs">
            <Star className="icon-sm" />
            <BilingualText en="Set Primary" el="Ορισμός ως κύριου" compact />
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggle.mutate(!domain.isActive)}
          disabled={toggle.isPending}
          className={`gap-1 h-7 text-xs ${domain.isActive ? 'text-status-warning hover:text-status-warning' : 'text-status-success hover:text-status-success'}`}
        >
          <Power className="icon-sm" />
          {domain.isActive ? <BilingualText en="Deactivate" el="Απενεργοποίηση" compact /> : <BilingualText en="Activate" el="Ενεργοποίηση" compact />}
        </Button>
        <Button aria-label="Remove domain"
          size="sm"
          variant="ghost"
          onClick={() => void handleRemove()}
          disabled={remove.isPending}
          className="gap-1 h-7 text-xs text-destructive-accessible hover:text-destructive-accessible"
        >
          <Trash2 className="icon-sm" />
        </Button>
      </div>

      {showDns && dnsInstructions && <DnsInstructionsPanel instructions={dnsInstructions} />}
    </div>
  );
}

function TenantDomainPanel({ tenant }: { tenant: TenantItem }) {
  const qc = useQueryClient();
  const [subdomainInput, setSubdomainInput] = useState('');
  const [customDomainInput, setCustomDomainInput] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: qk('tenant', tenant.id, 'domains'),
    queryFn: () => listTenantDomains(tenant.id),
    staleTime: 30_000,
  });

  const addSub = useMutation({
    mutationFn: () => addTenantSubdomain(tenant.id, subdomainInput.trim()),
    onSuccess: () => { setSubdomainInput(''); refetch(); },
  });
  const addCustom = useMutation({
    mutationFn: () => addTenantCustomDomain(tenant.id, customDomainInput.trim()),
    onSuccess: () => { setCustomDomainInput(''); refetch(); },
  });

  const domains = Array.isArray(data?.domains) ? data.domains : [];
  usePageList([
    {
      id: 'organisation_domains',
      labelEn: `Domains of ${tenant.displayName || tenant.name}`,
      labelEl: `Domains του οργανισμού ${tenant.displayName || tenant.name}`,
      rows: isLoading ? undefined : domains.map((d) => `${d.domainName} · ${d.domainType} · ${d.verificationStatus} · ${d.isActive ? 'active' : 'inactive'}${d.isPrimary ? ' · primary' : ''}`),
      total: domains.length,
      sample: false,
    },
  ]);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground"><BilingualText en="Loading domains..." el="Φόρτωση τομέων…" compact /></p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-muted-foreground"><BilingualText en="No domains configured yet." el="Δεν έχουν οριστεί τομείς ακόμα." compact wrap /></p>
      ) : (
        <div className="divide-y divide-border">
          {domains.map((d) => (
            <DomainRow key={d.id} domain={d} tenantId={tenant.id} onRefresh={refetch} />
          ))}
        </div>
      )}

      {/* Add subdomain */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium"><BilingualText en="Add Platform Subdomain" el="Προσθήκη υποτομέα πλατφόρμας" compact /></p>
        <p className="text-xs text-muted-foreground"><BilingualText en="Your org will be accessible at" el="Ο οργανισμός σας θα είναι διαθέσιμος στο" compact wrap /> <code className="bg-muted px-1 rounded">[subdomain].cofounderbay.com</code></p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="e.g. athens"
              value={subdomainInput}
              onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="pr-40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              .cofounderbay.com
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => addSub.mutate()}
            disabled={addSub.isPending || !subdomainInput.trim()}
            className="gap-1"
          >
            <Plus className="icon-sm" />
            <BilingualText en="Add" el="Προσθήκη" compact />
          </Button>
        </div>
        {addSub.isError && <p className="text-xs text-destructive-accessible">{(addSub.error as Error).message}</p>}
      </div>

      {/* Add custom domain */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium"><BilingualText en="Add Custom Domain" el="Προσθήκη προσαρμοσμένου τομέα" compact /></p>
        <p className="text-xs text-muted-foreground"><BilingualText en="Use your own domain, such as" el="Χρησιμοποιήστε το δικό σας domain, όπως" compact wrap /> <code className="bg-muted px-1 rounded">founders.youruni.edu</code></p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. founders.university.edu"
            value={customDomainInput}
            onChange={(e) => setCustomDomainInput(e.target.value.toLowerCase())}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => addCustom.mutate()}
            disabled={addCustom.isPending || !customDomainInput.trim()}
            className="gap-1"
          >
            <Plus className="icon-sm" />
            <BilingualText en="Add" el="Προσθήκη" compact />
          </Button>
        </div>
        {addCustom.isError && <p className="text-xs text-destructive-accessible">{(addCustom.error as Error).message}</p>}
      </div>
    </div>
  );
}

export default function DomainsAdminPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const { data: tenantsData, isLoading } = useQuery({
    queryKey: qk('admin', 'tenants'),
    queryFn: () => listTenants({ limit: 100 }),
    staleTime: 60_000,
  });

  const tenants = Array.isArray(tenantsData) ? tenantsData : [];
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null;

  // Picking an organisation is the page's one view control; its domains then
  // publish themselves from the panel below.
  usePageControls([
    {
      id: 'select_organisation',
      labelEn: 'Organisation whose domains to show',
      labelEl: 'Οργανισμός του οποίου τα domains εμφανίζονται',
      writes: false,
      options: rowOptions(tenants, (t) => t.id, (t) => t.displayName || t.name),
      current: selectedTenantId ?? undefined,
      unavailableEn: tenants.length === 0 ? 'No organisations are listed.' : undefined,
      unavailableEl: tenants.length === 0 ? 'Δεν υπάρχουν οργανισμοί.' : undefined,
      run: (value) => { if (value) setSelectedTenantId(value); },
    },
  ]);
  usePageList([
    {
      id: 'organisations',
      labelEn: 'Organisations',
      labelEl: 'Οργανισμοί',
      rows: isLoading ? undefined : tenants.map((t) => `${t.displayName || t.name} · /${t.slug}`),
      total: tenants.length,
      sample: false,
    },
  ]);

  return (
    <AppShell
      title="Domain Management"
      titleEl="Διαχείριση τομέων"
      description="Configure subdomains and custom domains for each tenant organization."
      descriptionEl="Ρυθμίστε υποτομείς και προσαρμοσμένους τομείς για κάθε οργανισμό."
    >
      <div className="space-y-6">

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Tenant selector */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle><BilingualText en="Organizations" el="Οργανισμοί" compact /></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground px-4 sm:px-6 py-3"><BilingualText en="Loading..." el="Φόρτωση…" compact /></p>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 sm:px-6 py-3"><BilingualText en="No tenants found." el="Δεν βρέθηκαν οργανισμοί." compact /></p>
            ) : (
              <div className="divide-y divide-border/50">
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTenantId(t.id)}
                    aria-pressed={selectedTenantId === t.id}
                    className={`w-full text-left px-4 sm:px-6 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors focus-ring ${
                      selectedTenantId === t.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                  >
                    {t.logoUrl
                      ? <img src={t.logoUrl} alt="" className="icon-lg rounded" />
                      : <div data-keep-icon="" className="icon-lg rounded bg-primary/10 flex items-center justify-center"><Globe className="icon-sm text-muted-foreground" aria-hidden="true" /></div>}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.displayName || t.name}</p>
                      <p className="text-xs text-muted-foreground truncate" translate="no">/{t.slug}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Domain panel */}
        <div>
          {!selectedTenant ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground"><BilingualText en="Select an organization to manage its domains" el="Επιλέξτε οργανισμό για να διαχειριστείτε τους τομείς του" wrap /></p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {selectedTenant.logoUrl && <img src={selectedTenant.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />}
                  <div className="min-w-0">
                    <CardTitle>{selectedTenant.displayName || selectedTenant.name}</CardTitle>
                    <CardDescription translate="no">/{selectedTenant.slug}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TenantDomainPanel tenant={selectedTenant} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </AppShell>
  );
}
