'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTenantDomains,
  addTenantSubdomain,
  addTenantCustomDomain,
  verifyTenantDomain,
  setTenantPrimaryDomain,
  toggleTenantDomainActive,
  deleteTenantDomain,
  getDomainDnsInstructions,
  type TenantDomainItem,
  type DnsInstructions,
} from '@/lib/api';
import { useTenant } from '@/components/providers/TenantContext';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { CANCELLED, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Globe, Plus, Trash2, CheckCircle2, XCircle, Clock, RefreshCw,
  Star, Power, Copy, ChevronDown, ChevronRight, Link2, AlertTriangle,
  Shield, Info,
} from 'lucide-react';
import { EmptyTenantDomains } from '@/components/common/EmptyStates';
import { qk } from '@/lib/query-keys';

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: TenantDomainItem['verificationStatus']) {
  switch (status) {
    case 'verified': return <Badge className="bg-status-success-bg text-status-success border-status-success-border gap-1" size="sm"><CheckCircle2 className="icon-sm" /><BilingualText en="Verified" el="Επαληθευμένος" compact /></Badge>;
    case 'pending':  return <Badge className="bg-status-warning-bg text-status-warning border-status-warning-border gap-1" size="sm"><Clock className="icon-sm" /><BilingualText en="Pending" el="Σε αναμονή" compact /></Badge>;
    case 'failed':   return <Badge className="bg-status-danger-bg text-status-danger border-status-danger-border gap-1" size="sm"><XCircle className="icon-sm" /><BilingualText en="Failed" el="Απέτυχε" compact /></Badge>;
    case 'expired':  return <Badge className="bg-muted text-muted-foreground border-border gap-1" size="sm"><XCircle className="icon-sm" /><BilingualText en="Expired" el="Έληξε" compact /></Badge>;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy" aria-label="Copy. Αντιγραφή">
      {copied ? <CheckCircle2 className="icon-sm text-status-success" /> : <Copy className="icon-sm" />}
    </button>
  );
}

function DnsPanel({ instructions }: { instructions: DnsInstructions }) {
  return (
    <div className="mt-3 rounded-lg border border-status-warning-border bg-status-warning-bg p-4 space-y-4 text-sm">
      <div className="flex items-start gap-2">
        <Info className="icon-sm text-status-warning mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-foreground"><BilingualText en="DNS Configuration Required" el="Απαιτείται ρύθμιση DNS" compact /></p>
          <p className="text-xs text-muted-foreground mt-0.5"><BilingualText en="Add these records to your DNS provider to verify ownership and route traffic to CoFounderBay." el="Προσθέστε αυτές τις εγγραφές στον πάροχο DNS για να επαληθεύσετε την κυριότητα και να δρομολογήσετε την κίνηση στο CoFounderBay." wrap /></p>
        </div>
      </div>

      {/* Step 1 — TXT verification */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"><BilingualText en="Step 1 — TXT Verification Record" el="Βήμα 1 — Εγγραφή TXT επαλήθευσης" compact /></p>
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {['Type', 'Host / Name', 'Value', 'TTL'].map(h => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-3 py-2 font-mono">{instructions.verification.type}</td>
                <td className="px-3 py-2 font-mono break-all">
                  <div className="flex items-center gap-2">{instructions.verification.name}<CopyButton value={instructions.verification.name} /></div>
                </td>
                <td className="px-3 py-2 font-mono break-all max-w-[200px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{instructions.verification.value}</span>
                    <CopyButton value={instructions.verification?.value ?? ''} />
                  </div>
                </td>
                <td className="px-3 py-2 font-mono">{instructions.verification.ttl}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 2 — CNAME */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"><BilingualText en="Step 2 — CNAME Record" el="Βήμα 2 — Εγγραφή CNAME" compact /></p>
        <div className="rounded-md border border-border bg-background overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {['Type', 'Host / Name', 'Points to', 'TTL'].map(h => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-3 py-2 font-mono">{instructions.cname.type}</td>
                <td className="px-3 py-2 font-mono break-all">
                  <div className="flex items-center gap-2">{instructions.cname.name}<CopyButton value={instructions.cname.name} /></div>
                </td>
                <td className="px-3 py-2 font-mono">
                  <div className="flex items-center gap-2">{instructions.cname.value}<CopyButton value={instructions.cname.value} /></div>
                </td>
                <td className="px-3 py-2 font-mono">{instructions.verification.ttl}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside pl-0.5">
        {instructions.instructions.map((line, i) => <li key={i}>{line}</li>)}
      </ol>
    </div>
  );
}

// ── Domain row ────────────────────────────────────────────────────────────────

function DomainRow({
  domain,
  tenantId,
  onRefresh,
}: {
  domain: TenantDomainItem;
  tenantId: string;
  onRefresh: () => void;
}) {
  const { success: toastSuccess, error: toastError } = useToast();
  const confirm = useConfirm();
  const [showDns, setShowDns] = useState(false);
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [loadingDns, setLoadingDns] = useState(false);

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
    onSuccess: (res) => {
      onRefresh();
      if (res.verified) toastSuccess('Domain verified successfully');
      else toastError(res.message);
    },
    onError: (e: Error) => toastError(e.message),
  });

  const setPrimary = useMutation({
    mutationFn: () => setTenantPrimaryDomain(tenantId, domain.id),
    onSuccess: () => { onRefresh(); toastSuccess('Primary domain updated'); },
    onError: (e: Error) => toastError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) => toggleTenantDomainActive(tenantId, domain.id, active),
    onSuccess: (_, active) => { onRefresh(); toastSuccess(active ? 'Domain activated' : 'Domain deactivated'); },
    onError: (e: Error) => toastError(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteTenantDomain(tenantId, domain.id),
    onSuccess: () => { onRefresh(); toastSuccess('Domain removed'); },
    onError: (e: Error) => toastError(e.message),
  });

  const handleShowDns = async () => {
    if (domain.domainType !== 'custom') return;
    if (dnsInstructions) { setShowDns(v => !v); return; }
    setLoadingDns(true);
    try {
      const result = await getDomainDnsInstructions(tenantId, domain.id);
      setDnsInstructions(result);
      setShowDns(true);
    } catch (e) {
      toastError((e as Error).message || 'Failed to load DNS instructions');
    } finally {
      setLoadingDns(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Globe className="icon-sm text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://${domain.domainName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm font-medium break-all hover:underline"
              >
                {domain.domainName}
              </a>
              {domain.isPrimary && (
                <Badge className="bg-primary/10 text-primary-accessible border-primary/20 text-xs"><BilingualText en="Primary" el="Κύριος" compact /></Badge>
              )}
              <Badge variant="outline" className="text-xs"><BilingualText en={domain.domainType === 'custom' ? 'Custom' : 'Subdomain'} el={domain.domainType === 'custom' ? 'Προσαρμοσμένο' : 'Υποτομέας'} compact /></Badge>
              {statusBadge(domain.verificationStatus)}
              {domain.isActive
                ? <Badge className="bg-status-success-bg text-status-success border-status-success-border text-xs"><BilingualText en="Active" el="Ενεργός" compact /></Badge>
                : <Badge variant="outline" className="text-xs text-muted-foreground"><BilingualText en="Inactive" el="Ανενεργός" compact /></Badge>}
              {domain.sslStatus === 'active' && (
                <Badge className="bg-status-info-bg text-status-info border-status-info-border text-xs gap-1">
                  <Shield className="h-2.5 w-2.5" />SSL
                </Badge>
              )}
            </div>
            {domain.verifiedAt && (
              <p className="text-xs text-muted-foreground">
                <BilingualText
                  en={`Verified ${new Date(domain.verifiedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`}
                  el={`Επαληθεύτηκε ${new Date(domain.verifiedAt).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`}
                  compact
                />
              </p>
            )}
            {domain.lastVerificationCheck && domain.verificationStatus === 'failed' && (
              <p className="text-xs text-status-danger">
                <BilingualText
                  en={`Last check: ${new Date(domain.lastVerificationCheck).toLocaleString('en-GB', { timeZone: 'UTC' })} — DNS record not found`}
                  el={`Τελευταίος έλεγχος: ${new Date(domain.lastVerificationCheck).toLocaleString('el-GR', { timeZone: 'UTC' })} — δεν βρέθηκε εγγραφή DNS`}
                  compact
                  wrap
                />
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {domain.domainType === 'custom' && domain.verificationStatus !== 'verified' && (
            <>
              <Button
                size="sm" variant="outline"
                onClick={handleShowDns}
                disabled={loadingDns}
                className="gap-1 h-7 text-xs"
              >
                <Link2 className="icon-sm" aria-hidden="true" />
                <BilingualText en="DNS Setup" el="Ρύθμιση DNS" compact />
                {showDns ? <ChevronDown className="icon-sm" /> : <ChevronRight className="icon-sm" />}
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => verify.mutate()}
                disabled={verify.isPending}
                className="gap-1 h-7 text-xs"
              >
                <RefreshCw className={`icon-sm ${verify.isPending ? 'animate-spin' : ''}`} />
                <BilingualText en="Verify" el="Επαλήθευση" compact />
              </Button>
            </>
          )}
          {!domain.isPrimary && domain.isActive && (
            <Button
              size="sm" variant="ghost"
              onClick={() => setPrimary.mutate()}
              disabled={setPrimary.isPending}
              className="gap-1 h-7 text-xs"
            >
              <Star className="icon-sm" /><BilingualText en="Set Primary" el="Ορισμός ως κύριου" compact />
            </Button>
          )}
          <Button
            size="sm" variant="ghost"
            onClick={() => toggle.mutate(!domain.isActive)}
            disabled={toggle.isPending || (domain.verificationStatus !== 'verified' && !domain.isActive)}
            className={`gap-1 h-7 text-xs ${domain.isActive ? 'text-status-warning' : 'text-status-success'}`}
          >
            <Power className="icon-sm" aria-hidden="true" />
            {domain.isActive
              ? <BilingualText en="Deactivate" el="Απενεργοποίηση" compact />
              : <BilingualText en="Activate" el="Ενεργοποίηση" compact />}
          </Button>
          <Button aria-label={`Remove ${domain.domainName}. Αφαίρεση ${domain.domainName}`}
            size="sm" variant="ghost"
            onClick={() => void handleRemove()}
            disabled={remove.isPending}
            className="gap-1 h-7 text-xs text-destructive-accessible hover:text-destructive-accessible"
          >
            <Trash2 className="icon-sm" />
          </Button>
        </div>
      </div>

      {showDns && dnsInstructions && <DnsPanel instructions={dnsInstructions} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TenantDomainsPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? '';
  const { success: toastSuccess, error: toastError } = useToast();
  const [subdomainInput, setSubdomainInput] = useState('');
  const [customDomainInput, setCustomDomainInput] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: qk('tenant', tenantId, 'domains'),
    queryFn: () => listTenantDomains(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });

  const addSub = useMutation({
    mutationFn: () => addTenantSubdomain(tenantId, subdomainInput.trim()),
    onSuccess: ({ domain }) => {
      setSubdomainInput('');
      refetch();
      toastSuccess(`Subdomain ${domain.domainName} created`);
    },
    onError: (e: Error) => toastError(e.message),
  });

  const addCustom = useMutation({
    mutationFn: () => addTenantCustomDomain(tenantId, customDomainInput.trim()),
    onSuccess: ({ domain }) => {
      setCustomDomainInput('');
      refetch();
      toastSuccess(`${domain.domainName} added — follow DNS instructions to verify`);
    },
    onError: (e: Error) => toastError(e.message),
  });

  const domains = data?.domains ?? [];
  const activeDomains = domains.filter(d => d.isActive);
  const primaryDomain = domains.find(d => d.isPrimary);

  /*
   * The row buttons, offered to the assistant. Read against
   * TenantDomainService: `toggleDomainActive` writes only `isActive`, so
   * activate and deactivate undo each other (activating still refuses an
   * unverified domain). `setPrimaryDomain` clears every other primary and sets
   * one, so setting the previous primary back restores exactly that state; a
   * tenant that had none has nothing to go back to. Removing deletes the row.
   */
  const confirm = useConfirm();
  const domainRows = (list: TenantDomainItem[]) => rowOptions(list, (d) => d.id, (d) => d.domainName);
  const noDomains = domains.length === 0 ? 'No domains yet.' : undefined;
  const noDomainsEl = domains.length === 0 ? 'Δεν υπάρχουν ακόμη domains.' : undefined;
  const after = () => void refetch();
  const activeCommand = (id: string, en: string, el: string, next: boolean, back: string) => {
    const eligible = domains.filter((d) => d.isActive !== next && (!next || d.verificationStatus === 'verified'));
    return {
      id,
      labelEn: en,
      labelEl: el,
      writes: true,
      options: domainRows(eligible),
      unavailableEn: eligible.length === 0 ? (next ? 'No verified domain is inactive.' : 'No domain is active.') : undefined,
      unavailableEl: eligible.length === 0 ? (next ? 'Κανένα επαληθευμένο domain δεν είναι ανενεργό.' : 'Κανένα domain δεν είναι ενεργό.') : undefined,
      undo: (value?: string) => (value ? { control: back, value } : undefined),
      run: async (value?: string): Promise<PageControlRunResult> => {
        if (!value) return;
        try {
          await toggleTenantDomainActive(tenantId, value, next);
          toastSuccess(next ? 'Domain activated' : 'Domain deactivated');
        } catch (e) {
          toastError((e as Error).message);
          return { error: (e as Error).message || 'The domain did not change.' };
        } finally {
          after();
        }
      },
    };
  };
  const unverified = domains.filter((d) => d.domainType === 'custom' && d.verificationStatus !== 'verified');
  const primaryCandidates = domains.filter((d) => !d.isPrimary && d.isActive);
  usePageControls([
    {
      id: 'verify_domain',
      labelEn: 'Check a custom domain\'s DNS',
      labelEl: 'Έλεγχος DNS για προσαρμοσμένο domain',
      writes: true,
      options: domainRows(unverified),
      unavailableEn: unverified.length === 0 ? 'No custom domain is waiting for verification.' : undefined,
      unavailableEl: unverified.length === 0 ? 'Κανένα προσαρμοσμένο domain δεν περιμένει επαλήθευση.' : undefined,
      run: async (value) => {
        if (!value) return;
        try {
          const res = await verifyTenantDomain(tenantId, value);
          if (res.verified) {
            toastSuccess('Domain verified successfully');
          } else {
            // The check ran and the records are not there yet: the reader asked
            // for a verified domain, so the card says why it is not one.
            toastError(res.message);
            return { error: res.message || 'The DNS records are not in place yet.' };
          }
        } catch (e) {
          toastError((e as Error).message);
          return { error: (e as Error).message || 'The domain could not be checked.' };
        } finally {
          after();
        }
      },
    },
    activeCommand('activate_domain', 'Activate a domain', 'Ενεργοποίηση domain', true, 'deactivate_domain'),
    activeCommand('deactivate_domain', 'Deactivate a domain', 'Απενεργοποίηση domain', false, 'activate_domain'),
    {
      id: 'set_primary_domain',
      labelEn: 'Make a domain the primary one',
      labelEl: 'Ορισμός κύριου domain',
      writes: true,
      options: domainRows(primaryCandidates),
      unavailableEn: primaryCandidates.length === 0 ? 'No other active domain to make primary.' : undefined,
      unavailableEl: primaryCandidates.length === 0 ? 'Δεν υπάρχει άλλο ενεργό domain για κύριο.' : undefined,
      undo: () => (primaryDomain ? { control: 'set_primary_domain', value: primaryDomain.id } : undefined),
      run: async (value) => {
        if (!value) return;
        try {
          await setTenantPrimaryDomain(tenantId, value);
          toastSuccess('Primary domain updated');
        } catch (e) {
          toastError((e as Error).message);
          return { error: (e as Error).message || 'The primary domain did not change.' };
        } finally {
          after();
        }
      },
    },
    {
      id: 'remove_domain',
      labelEn: 'Remove a domain',
      labelEl: 'Αφαίρεση domain',
      writes: true,
      options: domainRows(domains),
      unavailableEn: noDomains,
      unavailableEl: noDomainsEl,
      run: async (value) => {
        const domain = domains.find((d) => d.id === value);
        if (!domain) return ROW_GONE;
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
        if (!ok) return CANCELLED;
        try {
          await deleteTenantDomain(tenantId, domain.id);
          toastSuccess('Domain removed');
        } catch (e) {
          toastError((e as Error).message);
          return { error: (e as Error).message || 'The domain was not removed.' };
        } finally {
          after();
        }
      },
    },
  ]);
  usePageList([
    {
      id: 'domains',
      labelEn: 'Domains',
      labelEl: 'Domains',
      rows: data
        ? domains.map((d) => `${d.domainName} · ${d.domainType} · ${d.verificationStatus} · ${d.isActive ? 'active' : 'inactive'}${d.isPrimary ? ' · primary' : ''}`)
        : undefined,
      total: domains.length,
      sample: false,
    },
  ]);

  if (!tenantId) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground"><BilingualText en="No organization context. Please select or join an organization first." el="Δεν έχει επιλεγεί οργανισμός. Επιλέξτε ή ενταχθείτε σε έναν πρώτα." wrap /></p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Domain Management"
      titleEl="Διαχείριση τομέων"
      description="Add a subdomain or connect a custom domain. SSL is provisioned automatically once DNS verifies."
    >
      <div className="space-y-6">

        {/* Status overview */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground"><BilingualText en="Total Domains" el="Σύνολο τομέων" compact wrap /></p>
              <p className="page-stat text-2xl font-bold mt-0.5">{domains.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground"><BilingualText en="Active" el="Ενεργός" compact /></p>
              <p className="page-stat text-2xl font-bold mt-0.5 text-status-success">{activeDomains.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground"><BilingualText en="Primary Domain" el="Κύριος τομέας" compact wrap /></p>
              <p className="text-sm font-medium mt-0.5 truncate">
                {primaryDomain?.domainName ?? <span className="text-muted-foreground">—</span>}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Domain list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base"><BilingualText en="Your Domains" el="Οι τομείς σας" compact /></CardTitle>
            <CardDescription className="text-xs">
              <BilingualText en="Members can access your organization through any active domain. Set one as primary for a canonical URL." el="Τα μέλη μπαίνουν από οποιονδήποτε ενεργό τομέα. Ορίστε έναν ως κύριο για κανονικό URL." wrap />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : domains.length === 0 ? (
              <EmptyTenantDomains
                action={
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => document.getElementById('add-subdomain')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    <Globe className="icon-sm" /><BilingualText en="Add a subdomain" el="Προσθήκη υποτομέα" compact />
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {domains.map(d => (
                  <DomainRow key={d.id} domain={d} tenantId={tenantId} onRefresh={refetch} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add subdomain */}
        <Card id="add-subdomain">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="icon-sm text-muted-foreground" />
              <BilingualText en="Platform Subdomain" el="Υποτομέας πλατφόρμας" compact />
            </CardTitle>
            <CardDescription className="text-xs">
              Claim a subdomain on <code className="bg-muted px-1 rounded">cofounderbay.com</code>. Auto-verified, no DNS setup required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  aria-label={bilingualAria("Platform subdomain", "Υποτομέας πλατφόρμας")}
                  placeholder="yourorg"
                  value={subdomainInput}
                  onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="pr-44"
                  maxLength={63}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">
                  .cofounderbay.com
                </span>
              </div>
              <Button
                onClick={() => addSub.mutate()}
                disabled={addSub.isPending || subdomainInput.trim().length < 2}
                className="gap-1 shrink-0"
                size="sm"
              >
                <Plus className="icon-sm" />
                {addSub.isPending ? 'Adding…' : 'Add'}
              </Button>
            </div>
            {addSub.isError && (
              <p className="text-xs text-destructive-accessible flex items-center gap-1">
                <XCircle className="icon-sm" />{(addSub.error as Error).message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              <BilingualText en="Subdomains are instantly active and covered by the platform SSL certificate." el="Οι υποτομείς ενεργοποιούνται αμέσως και καλύπτονται από το πιστοποιητικό SSL της πλατφόρμας." wrap />
            </p>
          </CardContent>
        </Card>

        {/* Add custom domain */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="icon-sm text-muted-foreground" />
              <BilingualText en="Custom Domain" el="Προσαρμοσμένος τομέας" compact />
            </CardTitle>
            <CardDescription className="text-xs">
              Use your own domain like <code className="bg-muted px-1 rounded">founders.youruni.edu</code>. Requires DNS verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                aria-label={bilingualAria("Custom domain", "Προσαρμοσμένος τομέας")}
                placeholder="founders.yourorganization.org"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value.toLowerCase().trim())}
                className="flex-1"
              />
              <Button
                onClick={() => addCustom.mutate()}
                disabled={addCustom.isPending || !customDomainInput.trim().includes('.')}
                className="gap-1 shrink-0"
                size="sm"
              >
                <Plus className="icon-sm" />
                {addCustom.isPending ? 'Adding…' : 'Add'}
              </Button>
            </div>
            {addCustom.isError && (
              <p className="text-xs text-destructive-accessible flex items-center gap-1">
                <XCircle className="icon-sm" />{(addCustom.error as Error).message}
              </p>
            )}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How it works:</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-0.5">
                <li><BilingualText en="Add your domain below — we generate DNS records for you" el="Προσθέστε τον τομέα σας παρακάτω — δημιουργούμε τις εγγραφές DNS για εσάς" wrap /></li>
                <li><BilingualText en="Add those records in your DNS provider (Cloudflare, Route 53, etc.)" el="Προσθέστε τις εγγραφές στον πάροχο DNS (Cloudflare, Route 53 κ.λπ.)" wrap /></li>
                <li><BilingualText en="Click &quot;Verify&quot; after DNS propagation (up to 48h)" el="Πατήστε «Επαλήθευση» μετά τη διάδοση του DNS (έως 48 ώρες)" wrap /></li>
                <li><BilingualText en="Once verified, activate and optionally set as primary" el="Μετά την επαλήθευση, ενεργοποιήστε και προαιρετικά ορίστε ως κύριο" wrap /></li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
