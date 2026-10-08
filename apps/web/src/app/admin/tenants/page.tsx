'use client';

import { RailStats } from '@/components/layout/RailParts';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Plus, Settings, Palette, Globe, Mail, FileText,
  Eye, Save, X, Upload, Check, AlertTriangle, ExternalLink,
  ChevronRight, Trash2, Users, Image as ImageIcon, Type,
  Search, RefreshCw, Download,
} from 'lucide-react';
import {
  listTenants, createTenant, updateTenant, deleteTenant,
  updateTenantBranding, publishTenantBranding, unpublishTenantBranding,
  type TenantItem, type TenantBranding,
} from '@/lib/api';
import { BulkActionBar, useBulkSelection, BulkCheckbox } from '@/components/ui/bulk-action-bar';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { analytics } from '@/lib/analytics';
import type { PageRailSection } from '@/components/layout/PageRail';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';

type StatusFilter = 'all' | TenantItem['status'];
type BrandingFilter = 'all' | 'branded' | 'unbranded';

const STATUS_OPTIONS: { value: StatusFilter; en: string; el: string }[] = [
  { value: 'all', en: 'All statuses', el: 'Όλες οι καταστάσεις' },
  { value: 'active', en: 'Active', el: 'Ενεργοί' },
  { value: 'draft', en: 'Draft', el: 'Πρόχειροι' },
  { value: 'suspended', en: 'Suspended', el: 'Σε αναστολή' },
];

const BRANDING_OPTIONS: { value: BrandingFilter; en: string; el: string }[] = [
  { value: 'all', en: 'Any branding', el: 'Οποιαδήποτε επωνυμία' },
  { value: 'branded', en: 'With a logo', el: 'Με λογότυπο' },
  { value: 'unbranded', en: 'No logo yet', el: 'Χωρίς λογότυπο' },
];

/** RFC 4180 quoting: a tenant name with a comma must not become two columns. */
function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const TENANT_DELETE_DESCRIPTION = (
  <BilingualText
    en="All their members, programs and data are removed permanently. This cannot be undone."
    el="Όλα τα μέλη, προγράμματα και δεδομένα τους αφαιρούνται οριστικά. Δεν μπορεί να αναιρεθεί."
  />
);

export default function TenantsAdminPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: tenants, isLoading, isError, refetch } = useQuery({
    queryKey: qk('admin', 'tenants'),
    queryFn: () => listTenants({ limit: 100 }),
  });

  // One guarded list, used everywhere below. `tenants?.filter(...)` repeated
  // at each call site guards nullishness only, so a payload that arrives as an
  // object threw on the first stat card. Narrowing once means the rest of the
  // page can treat it as the array it already assumed it was.
  const tenantList = Array.isArray(tenants) ? tenants : [];

  // Search is the column's own control - finding a tenant is what the list is
  // for. Status and branding narrow it from the rail.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [brandingFilter, setBrandingFilter] = useState<BrandingFilter>('all');
  const visibleTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenantList.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (brandingFilter === 'branded' && !t.logoUrl) return false;
      if (brandingFilter === 'unbranded' && t.logoUrl) return false;
      if (!q) return true;
      return [t.name, t.displayName, t.slug].some((v) => v?.toLowerCase().includes(q));
    });
  }, [tenantList, search, statusFilter, brandingFilter]);
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (brandingFilter !== 'all' ? 1 : 0);

  // Selection follows what is on screen: "select all" must not reach tenants
  // a filter is hiding, or a bulk suspend would act on rows nobody saw.
  const tenantIds = visibleTenants.map((t) => t.id);
  const { selectedIds, toggle, toggleAll, clear, isAllSelected, isPartiallySelected } = useBulkSelection(tenantIds);

  const exportCsv = () => {
    const header = ['name', 'display_name', 'slug', 'status', 'website', 'has_logo', 'created_at'];
    const rows = visibleTenants.map((t) =>
      [t.name, t.displayName, t.slug, t.status, t.website, t.logoUrl ? 'yes' : 'no', t.createdAt].map(csvCell).join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    void analytics.track('tenant_export_csv', { count: visibleTenants.length });
  };

  const bulkActions = [
    {
      id: 'activate',
      label: 'Activate',
      onClick: async (ids: string[]) => {
        await Promise.all(ids.map(id => updateTenant(id, { status: 'active' })));
        queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') });
        void analytics.track('tenant_bulk_activate', { count: ids.length });
      },
    },
    {
      id: 'suspend',
      label: 'Suspend',
      variant: 'destructive' as const,
      onClick: async (ids: string[]) => {
        await Promise.all(ids.map(id => updateTenant(id, { status: 'suspended' })));
        queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') });
        void analytics.track('tenant_bulk_suspend', { count: ids.length });
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      variant: 'destructive' as const,
      onClick: async (ids: string[]) => {
        const ok = await confirm({
          title: <BilingualText en={`Delete ${ids.length} tenants?`} el={`Διαγραφή ${ids.length} οργανισμών;`} />,
          description: TENANT_DELETE_DESCRIPTION,
          confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact />,
        });
        if (!ok) return;
        await Promise.all(ids.map(id => deleteTenant(id)));
        queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') });
        void analytics.track('tenant_bulk_delete', { count: ids.length });
      },
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-status-success-bg text-status-success border-status-success-border"><BilingualText en="Active" el="Ενεργός" compact /></Badge>;
      // `TenantItem['status']` is draft | active | suspended. This used to
      // match 'pending', which the API never sends, so a draft tenant fell
      // through to the raw string "draft" in a grey badge.
      case 'draft':
        return <Badge className="bg-status-warning-bg text-status-warning border-status-warning-border"><BilingualText en="Draft" el="Πρόχειρο" compact /></Badge>;
      case 'suspended':
        return <Badge className="bg-status-danger-bg text-status-danger border-status-danger-border"><BilingualText en="Suspended" el="Σε αναστολή" compact /></Badge>;
      default:
        return <Badge variant="secondary"><StatusText value={status} /></Badge>;
    }
  };

  const totals = [
    { id: 'total', en: 'Total tenants', el: 'Σύνολο οργανισμών', value: tenantList.length, icon: Building2, tone: 'text-primary-accessible' },
    { id: 'active', en: 'Active', el: 'Ενεργοί', value: tenantList.filter((t) => t.status === 'active').length, icon: Check, tone: 'text-status-success' },
    { id: 'branded', en: 'With branding', el: 'Με επωνυμία', value: tenantList.filter((t) => t.logoUrl).length, icon: Palette, tone: 'text-status-accent' },
    { id: 'suspended', en: 'Suspended', el: 'Σε αναστολή', value: tenantList.filter((t) => t.status === 'suspended').length, icon: AlertTriangle, tone: 'text-status-warning' },
  ];
  const suspendedCount = totals[3].value;

  /*
   * The page rail. The column is the tenant list and the search that finds a
   * row in it; the totals, the two narrowing filters and the list tools are
   * about the list, so they sit one gesture away. The three stat cards that
   * opened the page are the first three rows of "Totals" - same figures, same
   * icons - and the badge is the suspended count, the one total that asks for
   * someone to look.
   */
  usePageList([
    {
      id: 'tenants',
      labelEn: 'Tenants',
      labelEl: 'Οργανισμοί',
      rows: isLoading ? undefined : visibleTenants.map((t) =>
        `${t.displayName || t.name} (${t.slug}) · ${t.status}${t.logoUrl ? ' · branded' : ''}`,
      ),
      total: tenantList.length,
    },
  ]);
  // Offered to the assistant: the rail's two filters, refresh, export, and
  // opening the create form or a tenant's settings - the same handlers.
  usePageControls([
    choiceControl('status_filter', 'Tenant status filter', 'Φίλτρο κατάστασης tenant', STATUS_OPTIONS, statusFilter, (v) => { setStatusFilter(v as StatusFilter); clear(); }),
    choiceControl('branding_filter', 'Branding filter', 'Φίλτρο επωνυμίας', BRANDING_OPTIONS, brandingFilter, (v) => { setBrandingFilter(v as BrandingFilter); clear(); }),
    { id: 'refresh', labelEn: 'Refresh tenants', labelEl: 'Ανανέωση οργανισμών', writes: false, run: () => void refetch() },
    { id: 'export_csv', labelEn: 'Export tenants as CSV', labelEl: 'Εξαγωγή οργανισμών σε CSV', writes: false, unavailableEn: visibleTenants.length ? undefined : 'No tenant matches the current filters.', run: exportCsv },
    { id: 'create_tenant', labelEn: 'Open the create tenant form', labelEl: 'Άνοιγμα φόρμας νέου οργανισμού', writes: false, run: () => setIsCreating(true) },
    {
      id: 'tenant_settings',
      labelEn: 'Open tenant settings',
      labelEl: 'Άνοιγμα ρυθμίσεων οργανισμού',
      writes: false,
      // The page's guarded list: the payload is not always an array (the
      // comment on tenantList says why), and `.map` on it threw.
      options: tenantList.map((t) => ({ value: t.id, labelEn: t.displayName || t.name, labelEl: t.displayName || t.name })),
      run: (value) => setSelectedTenant(tenantList.find((t) => t.id === value) ?? null),
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'Tenant totals',
      labelEl: 'Σύνολα οργανισμών',
      badge: suspendedCount || null,
      content: (
        <RailStats
          items={totals.map(({ id, en, el, value, icon, tone }) => ({
            key: id,
            label: en,
            labelEl: el,
            value: isLoading ? '—' : value,
            icon,
            tone: `bg-muted ${tone}`,
          }))}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Narrow the list',
      labelEl: 'Φιλτράρισμα λίστας',
      badge: activeFilterCount || null,
      content: (
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Status" el="Κατάσταση" compact />
            </legend>
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={statusFilter === o.value}
                onClick={() => { setStatusFilter(o.value); clear(); }}
                className={cn(
                  'tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors',
                  statusFilter === o.value ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
                )}
              >
                <BilingualText en={o.en} el={o.el} compact wrap />
              </button>
            ))}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BilingualText en="Branding" el="Επωνυμία" compact />
            </legend>
            {BRANDING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={brandingFilter === o.value}
                onClick={() => { setBrandingFilter(o.value); clear(); }}
                className={cn(
                  'tap-target flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors',
                  brandingFilter === o.value ? 'bg-primary/10 font-medium text-primary-accessible' : 'hover:bg-muted/70',
                )}
              >
                <BilingualText en={o.en} el={o.el} compact wrap />
              </button>
            ))}
          </fieldset>
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'List tools',
      labelEl: 'Εργαλεία λίστας',
      content: (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => void refetch()}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Refresh tenants" el="Ανανέωση οργανισμών" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visibleTenants.length === 0}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <BilingualText
                en={`Export ${visibleTenants.length} as CSV`}
                el={`Εξαγωγή ${visibleTenants.length} σε CSV`}
                compact
                wrap
              />
            </span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="Tenant Management"
      titleEl="Διαχείριση tenants"
      description="Manage organizations and their white-label branding"
      descriptionEl="Διαχείριση οργανισμών και της white-label επωνυμίας τους"
      rail={rail}
      actions={
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="icon-sm" aria-hidden="true" />
          <BilingualText en="Create Tenant" el="Νέος οργανισμός" compact />
        </Button>
      }
    >
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
          <div>
            <CardTitle><BilingualText en="Organizations" el="Οργανισμοί" compact /></CardTitle>
            <CardDescription>
              <BilingualText
                en="Configure branding, SSO, and settings for each tenant"
                el="Εταιρική ταυτότητα, SSO και ρυθμίσεις ανά οργανισμό (tenant)"
                compact
                wrap
              />
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); clear(); }}
              placeholder={bilingualInline('Search name or slug', 'Αναζήτηση ονόματος ή slug')}
              aria-label={bilingualAria('Search tenants', 'Αναζήτηση οργανισμών')}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* What a filtered list owes its reader: which filter is on, and a
              way out of it. The filters themselves live in the rail. */}
          {activeFilterCount > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                <BilingualText
                  en={`Showing ${visibleTenants.length} of ${tenantList.length}`}
                  el={`Εμφανίζονται ${visibleTenants.length} από ${tenantList.length}`}
                  compact
                />
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter('all'); setBrandingFilter('all'); clear(); }}
              >
                <BilingualText en="Clear filters" el="Καθαρισμός φίλτρων" compact />
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="icon-xl mx-auto mb-2 text-destructive-accessible" aria-hidden="true" />
              <p><BilingualText en="Failed to load tenants" el="Δεν ήταν δυνατή η φόρτωση των οργανισμών" compact /></p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                <BilingualText en="Retry" el="Επανάληψη" compact />
              </Button>
            </div>
          ) : tenantList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="icon-xl mx-auto mb-2" aria-hidden="true" />
              <p><BilingualText en="No tenants configured yet" el="Δεν υπάρχουν ακόμη οργανισμοί" compact /></p>
              <Button onClick={() => setIsCreating(true)} className="mt-4 gap-2">
                <Plus className="icon-sm" aria-hidden="true" />
                <BilingualText en="Create First Tenant" el="Δημιουργία πρώτου οργανισμού" compact />
              </Button>
            </div>
          ) : visibleTenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="icon-xl mx-auto mb-2" aria-hidden="true" />
              <p>
                <BilingualText
                  en="No tenant matches this search and these filters."
                  el="Κανένας οργανισμός δεν ταιριάζει με την αναζήτηση και τα φίλτρα."
                  compact
                  wrap
                />
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-3 pb-1 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => { if (el) el.indeterminate = isPartiallySelected; }}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                />
                <BilingualText
                  en={`Select all ${visibleTenants.length}`}
                  el={`Επιλογή όλων (${visibleTenants.length})`}
                  compact
                />
              </label>
              {visibleTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="axis-row flex items-center justify-between rounded-md py-3 transition-colors hover:bg-accent"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <BulkCheckbox
                      id={tenant.id}
                      selectedIds={selectedIds}
                      onToggle={toggle}
                      label={`Select ${tenant.displayName || tenant.name}`}
                      className="shrink-0"
                    />
                    {tenant.logoUrl ? (
                      <img src={tenant.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 className="icon-md text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium">{tenant.displayName || tenant.name}</h3>
                      <p className="truncate text-sm text-muted-foreground">/{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {getStatusBadge(tenant.status)}
                    <Button aria-label={`Settings for ${tenant.displayName || tenant.name}`} variant="ghost" size="sm" onClick={() => setSelectedTenant(tenant)}>
                      <Settings className="icon-sm" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={clear}
        actions={bulkActions}
        entityLabel="tenant"
      />

      {/* Tenant Editor Modal */}
      {(selectedTenant || isCreating) && (
        <TenantEditor
          tenant={selectedTenant}
          onClose={() => {
            setSelectedTenant(null);
            setIsCreating(false);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') });
            setSelectedTenant(null);
            setIsCreating(false);
          }}
        />
      )}
    </AppShell>
  );
}

const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Playfair Display', 'Montserrat', 'Lato'];
const BG_STYLES = ['flat', 'gradient', 'image', 'dark'];

function TenantEditor({
  tenant,
  onClose,
  onSave,
}: {
  tenant: TenantItem | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(true, onClose);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const isNew = !tenant;
  const [activeTab, setActiveTab] = useState('general');
  const [previewMode, setPreviewMode] = useState(false);
  const [saveError, setSaveError] = useState('');

  const b = tenant?.branding;

  const [general, setGeneral] = useState({
    name: tenant?.name ?? '',
    slug: tenant?.slug ?? '',
    displayName: tenant?.displayName ?? '',
    shortDescription: tenant?.shortDescription ?? '',
    description: tenant?.description ?? '',
    aboutText: tenant?.aboutText ?? '',
    website: tenant?.website ?? '',
    logoUrl: tenant?.logoUrl ?? '',
    faviconUrl: tenant?.faviconUrl ?? '',
    status: tenant?.status ?? 'draft',
  });

  const [branding, setBranding] = useState({
    primaryColor: b?.primaryColor ?? '#8b5cf6',
    secondaryColor: b?.secondaryColor ?? '#6756dc',
    accentColor: b?.accentColor ?? '#f59e0b',
    backgroundStyle: b?.backgroundStyle ?? 'flat',
    headingFont: b?.headingFont ?? 'Inter',
    bodyFont: b?.bodyFont ?? 'Inter',
    heroImageUrl: b?.heroImageUrl ?? '',
    heroTitle: b?.heroTitle ?? '',
    heroSubtitle: b?.heroSubtitle ?? '',
    aboutText: b?.aboutText ?? '',
    ctaLabel: b?.ctaLabel ?? 'Get Started',
    ctaUrl: b?.ctaUrl ?? '',
    onboardingIntroText: b?.onboardingIntroText ?? '',
    dashboardWelcomeText: b?.dashboardWelcomeText ?? '',
    communityNaming: b?.communityNaming ?? '',
    supportEmail: b?.supportEmail ?? '',
    websiteUrl: b?.websiteUrl ?? '',
    privacyPolicyUrl: b?.privacyPolicyUrl ?? '',
    termsUrl: b?.termsUrl ?? '',
    cookiePolicyUrl: b?.cookiePolicyUrl ?? '',
    linkedinUrl: b?.linkedinUrl ?? '',
    twitterUrl: b?.twitterUrl ?? '',
    instagramUrl: b?.instagramUrl ?? '',
    emailFromName: b?.emailFromName ?? '',
    emailFooterText: b?.emailFooterText ?? '',
  });

  const createMut = useMutation({
    mutationFn: () => createTenant({ ...general }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }); onSave(); },
    onError: (e: Error) => setSaveError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateTenant(tenant!.id, { ...general }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }); onSave(); },
    onError: (e: Error) => setSaveError(e.message),
  });

  const brandingMut = useMutation({
    mutationFn: () => updateTenantBranding(tenant!.id, { ...branding }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }),
    onError: (e: Error) => setSaveError(e.message),
  });

  const publishMut = useMutation({
    mutationFn: () => publishTenantBranding(tenant!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }),
  });

  const unpublishMut = useMutation({
    mutationFn: () => unpublishTenantBranding(tenant!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteTenant(tenant!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk('admin', 'tenants') }); onSave(); },
  });

  const isSaving = createMut.isPending || updateMut.isPending;
  const isBrandingSaving = brandingMut.isPending;

  const handleSaveGeneral = () => {
    setSaveError('');
    if (isNew) createMut.mutate();
    else updateMut.mutate();
  };

  const handleSaveBranding = () => {
    setSaveError('');
    if (!tenant) return;
    brandingMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {/* `useModalA11y`: focus in on open, Tab trapped, Escape closes,
          scroll locked, focus returned. This was a bare overlay with a
          close handler and nothing else a dialog owes a keyboard user. */}
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tenant details"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <CardHeader className="flex flex-row items-center justify-between border-b shrink-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isNew ? 'Create Tenant' : (general.displayName || general.name)}
              {tenant && (
                <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  <StatusText value={tenant.status} />
                </Badge>
              )}
            </CardTitle>
            <CardDescription><BilingualText en="Configure organization settings and branding" el="Ρυθμίσεις και εμφάνιση του οργανισμού" wrap /></CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)} className="gap-2">
                <Eye className="icon-sm" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" onClick={onClose} aria-label={bilingualAria('Close tenant editor', 'Κλείσιμο επεξεργασίας οργανισμού')}>
              <X className="icon-sm" />
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto">
          {previewMode && !isNew ? (
            <TenantPreview general={general} branding={branding} />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
              <TabsList className="mb-6 flex-wrap h-auto gap-1">
                <TabsTrigger value="general" className="gap-1.5"><Settings className="icon-sm" /><BilingualText en="General" el="Γενικά" compact /></TabsTrigger>
                <TabsTrigger value="branding" className="gap-1.5"><Palette className="icon-sm" /><BilingualText en="Colors & Fonts" el="Χρώματα & γραμματοσειρές" compact /></TabsTrigger>
                <TabsTrigger value="media" className="gap-1.5"><ImageIcon className="icon-sm" /><BilingualText en="Media" el="Πολυμέσα" compact /></TabsTrigger>
                <TabsTrigger value="content" className="gap-1.5"><FileText className="icon-sm" /><BilingualText en="Content" el="Περιεχόμενο" compact /></TabsTrigger>
                <TabsTrigger value="links" className="gap-1.5"><Globe className="icon-sm" /><BilingualText en="Links & Legal" el="Σύνδεσμοι & νομικά" compact /></TabsTrigger>
                {!isNew && <TabsTrigger value="email" className="gap-1.5"><Mail className="icon-sm" /><BilingualText en="Email" el="Email" compact /></TabsTrigger>}
              </TabsList>

              {saveError && (
                <div className="mb-4 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive-accessible flex items-center gap-2">
                  <AlertTriangle className="icon-sm shrink-0" />
                  {saveError}
                </div>
              )}

              {/* General tab */}
              <TabsContent value="general" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-general-name" className="text-sm font-medium">Internal Name *</label>
                    <Input id="tn-general-name" value={general.name} onChange={e => setGeneral(p => ({ ...p, name: e.target.value }))} placeholder="acme-corp" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-general-slug" className="text-sm font-medium">URL Slug *</label>
                    <Input id="tn-general-slug" value={general.slug} onChange={e => setGeneral(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} placeholder="acme" />
                    <p className="text-xs text-muted-foreground">Public URL: /t/{general.slug || 'slug'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-general-displayName" className="text-sm font-medium"><BilingualText en="Display Name" el="Εμφανιζόμενο όνομα" compact /></label>
                    <Input id="tn-general-displayName" value={general.displayName} onChange={e => setGeneral(p => ({ ...p, displayName: e.target.value }))} placeholder="Acme Corporation" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-general-website" className="text-sm font-medium"><BilingualText en="Website" el="Ιστότοπος" compact /></label>
                    <Input id="tn-general-website" value={general.website} onChange={e => setGeneral(p => ({ ...p, website: e.target.value }))} placeholder="https://acme.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-general-shortDescription" className="text-sm font-medium"><BilingualText en="Short Description" el="Σύντομη περιγραφή" compact /></label>
                  <Input id="tn-general-shortDescription" value={general.shortDescription} onChange={e => setGeneral(p => ({ ...p, shortDescription: e.target.value }))} placeholder={bilingualInline("One-line description shown in listings", "Περιγραφή μίας γραμμής για τις λίστες")} maxLength={160} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-general-description" className="text-sm font-medium"><BilingualText en="Full Description" el="Πλήρης περιγραφή" compact /></label>
                  <textarea id="tn-general-description" value={general.description} onChange={e => setGeneral(p => ({ ...p, description: e.target.value }))} placeholder={bilingualInline("Detailed description of the organization…", "Αναλυτική περιγραφή του οργανισμού…")} className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-general-aboutText" className="text-sm font-medium"><BilingualText en="About Text (long-form landing page)" el="Κείμενο «Σχετικά» (σελίδα προορισμού)" wrap /></label>
                  <textarea id="tn-general-aboutText" value={general.aboutText} onChange={e => setGeneral(p => ({ ...p, aboutText: e.target.value }))} placeholder={bilingualInline("Full about section displayed on the tenant landing page…", "Πλήρες κείμενο «Σχετικά» για τη σελίδα του οργανισμού…")} className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-general-logoUrl" className="text-sm font-medium"><BilingualText en="Logo URL" el="URL λογοτύπου" compact /></label>
                    <Input id="tn-general-logoUrl" value={general.logoUrl} onChange={e => setGeneral(p => ({ ...p, logoUrl: e.target.value }))} placeholder="https://cdn.acme.com/logo.png" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-general-faviconUrl" className="text-sm font-medium"><BilingualText en="Favicon URL" el="URL favicon" compact /></label>
                    <Input id="tn-general-faviconUrl" value={general.faviconUrl} onChange={e => setGeneral(p => ({ ...p, faviconUrl: e.target.value }))} placeholder="https://cdn.acme.com/favicon.ico" />
                  </div>
                </div>
                {!isNew && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium"><BilingualText en="Organisation status" el="Κατάσταση οργανισμού" compact /></p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={bilingualInline('Organisation status', 'Κατάσταση οργανισμού')}>
                      {(['draft', 'active', 'suspended'] as const).map(s => (
                        <button key={s} type="button" aria-pressed={general.status === s} onClick={() => setGeneral(p => ({ ...p, status: s }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${general.status === s ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border hover:bg-muted/50'}`}>
                          <StatusText value={s} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveGeneral} disabled={isSaving || !general.name || !general.slug} className="gap-2">
                    <Save className="icon-sm" />
                    {isSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : isNew ? <BilingualText en="Create Tenant" el="Δημιουργία οργανισμού" compact /> : <BilingualText en="Save General" el="Αποθήκευση γενικών" compact />}
                  </Button>
                </div>
              </TabsContent>

              {/* Colors & Fonts tab */}
              <TabsContent value="branding" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm"><BilingualText en="Color Palette" el="Παλέτα χρωμάτων" compact /></h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {([['primaryColor', 'Primary'], ['secondaryColor', 'Secondary'], ['accentColor', 'Accent']] as const).map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <label htmlFor={`tn-branding-${key}`} className="text-sm font-medium">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" aria-label={`${label} color picker`} value={(branding as any)[key]} onChange={e => setBranding(p => ({ ...p, [key]: e.target.value }))} className="h-10 w-14 rounded border cursor-pointer p-1" />
                          <Input id={`tn-branding-${key}`} value={(branding as any)[key]} onChange={e => setBranding(p => ({ ...p, [key]: e.target.value }))} className="flex-1 font-mono text-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg border flex gap-2">
                    {['primaryColor', 'secondaryColor', 'accentColor'].map(k => (
                      <div key={k} className="flex-1 h-10 rounded-md" style={{ backgroundColor: (branding as any)[k] }} />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm"><BilingualText en="Background Style" el="Στυλ φόντου" compact /></h4>
                  <div className="flex gap-2 flex-wrap">
                    {BG_STYLES.map(s => (
                      <button key={s} type="button" onClick={() => setBranding(p => ({ ...p, backgroundStyle: s }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${branding.backgroundStyle === s ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border hover:bg-muted/50'}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2"><Type className="icon-sm" /><BilingualText en="Typography" el="Τυπογραφία" compact /></h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="tn-branding-headingFont" className="text-sm font-medium"><BilingualText en="Heading Font" el="Γραμματοσειρά τίτλων" compact /></label>
                      <select id="tn-branding-headingFont" value={branding.headingFont} onChange={e => setBranding(p => ({ ...p, headingFont: e.target.value }))}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="tn-branding-bodyFont" className="text-sm font-medium"><BilingualText en="Body Font" el="Γραμματοσειρά κειμένου" compact /></label>
                      <select id="tn-branding-bodyFont" value={branding.bodyFont} onChange={e => setBranding(p => ({ ...p, bodyFont: e.target.value }))}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                        {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {!isNew && (
                  <div className="flex justify-end pt-2 gap-2">
                    <Button onClick={handleSaveBranding} disabled={isBrandingSaving} className="gap-2">
                      <Save className="icon-sm" />
                      {isBrandingSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save Colors &amp; Fonts" el="Αποθήκευση χρωμάτων και γραμματοσειρών" compact />}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Media tab */}
              <TabsContent value="media" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <label htmlFor="tn-branding-heroImageUrl" className="text-sm font-medium"><BilingualText en="Hero Image URL" el="URL κεντρικής εικόνας" compact /></label>
                  <Input id="tn-branding-heroImageUrl" value={branding.heroImageUrl} onChange={e => setBranding(p => ({ ...p, heroImageUrl: e.target.value }))} placeholder="https://cdn.acme.com/hero-banner.jpg" />
                  <p className="text-xs text-muted-foreground">Displayed as hero background on /t/{general.slug || 'slug'}</p>
                </div>
                {branding.heroImageUrl && (
                  <div className="rounded-lg overflow-hidden border">
                    <img src={branding.heroImageUrl} alt="Hero preview" className="w-full h-40 object-cover" />
                  </div>
                )}
                {!isNew && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBranding} disabled={isBrandingSaving} className="gap-2">
                      <Save className="icon-sm" />
                      {isBrandingSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save Media" el="Αποθήκευση πολυμέσων" compact />}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Content tab */}
              <TabsContent value="content" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-heroTitle" className="text-sm font-medium"><BilingualText en="Hero Title" el="Κεντρικός τίτλος" compact /></label>
                    <Input id="tn-branding-heroTitle" value={branding.heroTitle} onChange={e => setBranding(p => ({ ...p, heroTitle: e.target.value }))} placeholder="Welcome to Our Innovation Hub" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-ctaLabel" className="text-sm font-medium"><BilingualText en="CTA Button Label" el="Κείμενο κουμπιού δράσης" compact /></label>
                    <Input id="tn-branding-ctaLabel" value={branding.ctaLabel} onChange={e => setBranding(p => ({ ...p, ctaLabel: e.target.value }))} placeholder="Get Started" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-branding-heroSubtitle" className="text-sm font-medium"><BilingualText en="Hero Subtitle" el="Κεντρικός υπότιτλος" compact /></label>
                  <textarea id="tn-branding-heroSubtitle" value={branding.heroSubtitle} onChange={e => setBranding(p => ({ ...p, heroSubtitle: e.target.value }))} placeholder="Connect with founders, mentors, and investors..." className="w-full min-h-[70px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-branding-ctaUrl" className="text-sm font-medium"><BilingualText en="CTA URL" el="URL δράσης" compact /></label>
                  <Input id="tn-branding-ctaUrl" value={branding.ctaUrl} onChange={e => setBranding(p => ({ ...p, ctaUrl: e.target.value }))} placeholder="/register or https://..." />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-branding-aboutText" className="text-sm font-medium"><BilingualText en="About / Long-form Content" el="Σχετικά / εκτενές περιεχόμενο" compact /></label>
                  <textarea id="tn-branding-aboutText" value={branding.aboutText} onChange={e => setBranding(p => ({ ...p, aboutText: e.target.value }))} placeholder="About section content shown on the landing page..." className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-onboardingIntroText" className="text-sm font-medium"><BilingualText en="Onboarding Intro Text" el="Εισαγωγικό κείμενο ένταξης" compact /></label>
                    <textarea id="tn-branding-onboardingIntroText" value={branding.onboardingIntroText} onChange={e => setBranding(p => ({ ...p, onboardingIntroText: e.target.value }))} placeholder="Welcome! Let's set up your profile..." className="w-full min-h-[70px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-dashboardWelcomeText" className="text-sm font-medium"><BilingualText en="Dashboard Welcome Message" el="Μήνυμα καλωσορίσματος" compact /></label>
                    <textarea id="tn-branding-dashboardWelcomeText" value={branding.dashboardWelcomeText} onChange={e => setBranding(p => ({ ...p, dashboardWelcomeText: e.target.value }))} placeholder={bilingualInline("Here's what's happening…", "Να τι συμβαίνει…")} className="w-full min-h-[70px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="tn-branding-communityNaming" className="text-sm font-medium"><BilingualText en="Community Naming" el="Όνομα κοινότητας" compact /></label>
                  <Input id="tn-branding-communityNaming" value={branding.communityNaming} onChange={e => setBranding(p => ({ ...p, communityNaming: e.target.value }))} placeholder='Custom label e.g. "Program", "Cohort", "Network"' />
                  <p className="text-xs text-muted-foreground"><BilingualText en={"Replaces the word \"community\" in the UI for this tenant"} el="Αντικαθιστά τη λέξη «κοινότητα» στο περιβάλλον αυτού του οργανισμού" wrap /></p>
                </div>
                {!isNew && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBranding} disabled={isBrandingSaving} className="gap-2">
                      <Save className="icon-sm" />
                      {isBrandingSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save Content" el="Αποθήκευση περιεχομένου" compact />}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Links & Legal tab */}
              <TabsContent value="links" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-supportEmail" className="text-sm font-medium"><BilingualText en="Support Email" el="Email υποστήριξης" compact /></label>
                    <Input id="tn-branding-supportEmail" type="email" value={branding.supportEmail} onChange={e => setBranding(p => ({ ...p, supportEmail: e.target.value }))} placeholder="support@acme.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-websiteUrl" className="text-sm font-medium"><BilingualText en="Branding Website URL" el="URL ιστότοπου" compact /></label>
                    <Input id="tn-branding-websiteUrl" value={branding.websiteUrl} onChange={e => setBranding(p => ({ ...p, websiteUrl: e.target.value }))} placeholder="https://acme.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-privacyPolicyUrl" className="text-sm font-medium"><BilingualText en="Privacy Policy URL" el="URL πολιτικής απορρήτου" compact /></label>
                    <Input id="tn-branding-privacyPolicyUrl" value={branding.privacyPolicyUrl} onChange={e => setBranding(p => ({ ...p, privacyPolicyUrl: e.target.value }))} placeholder="https://acme.com/privacy" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-termsUrl" className="text-sm font-medium"><BilingualText en="Terms of Service URL" el="URL όρων χρήσης" compact /></label>
                    <Input id="tn-branding-termsUrl" value={branding.termsUrl} onChange={e => setBranding(p => ({ ...p, termsUrl: e.target.value }))} placeholder="https://acme.com/terms" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-cookiePolicyUrl" className="text-sm font-medium"><BilingualText en="Cookie Policy URL" el="URL πολιτικής cookies" compact /></label>
                    <Input id="tn-branding-cookiePolicyUrl" value={branding.cookiePolicyUrl} onChange={e => setBranding(p => ({ ...p, cookiePolicyUrl: e.target.value }))} placeholder="https://acme.com/cookies" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-linkedinUrl" className="text-sm font-medium">LinkedIn</label>
                    <Input id="tn-branding-linkedinUrl" value={branding.linkedinUrl} onChange={e => setBranding(p => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/company/acme" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-twitterUrl" className="text-sm font-medium">Twitter / X</label>
                    <Input id="tn-branding-twitterUrl" value={branding.twitterUrl} onChange={e => setBranding(p => ({ ...p, twitterUrl: e.target.value }))} placeholder="https://x.com/acme" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-instagramUrl" className="text-sm font-medium">Instagram</label>
                    <Input id="tn-branding-instagramUrl" value={branding.instagramUrl} onChange={e => setBranding(p => ({ ...p, instagramUrl: e.target.value }))} placeholder="https://instagram.com/acme" />
                  </div>
                </div>
                {!isNew && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBranding} disabled={isBrandingSaving} className="gap-2">
                      <Save className="icon-sm" />
                      {isBrandingSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save Links" el="Αποθήκευση συνδέσμων" compact />}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Email tab */}
              {!isNew && (
                <TabsContent value="email" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="tn-branding-emailFromName" className="text-sm font-medium"><BilingualText en="Email Sender Name" el="Όνομα αποστολέα email" compact /></label>
                      <Input id="tn-branding-emailFromName" value={branding.emailFromName} onChange={e => setBranding(p => ({ ...p, emailFromName: e.target.value }))} placeholder="Acme Startup Network" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tn-branding-emailFooterText" className="text-sm font-medium"><BilingualText en="Email Footer Text" el="Κείμενο υποσέλιδου email" compact /></label>
                    <textarea id="tn-branding-emailFooterText" value={branding.emailFooterText} onChange={e => setBranding(p => ({ ...p, emailFooterText: e.target.value }))} placeholder="© 2025 Acme Corp. All rights reserved. | Powered by CoFounderBay" className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none" />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveBranding} disabled={isBrandingSaving} className="gap-2">
                      <Save className="icon-sm" />
                      {isBrandingSaving ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save Email Settings" el="Αποθήκευση ρυθμίσεων email" compact />}
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>

        {/* Five actions in one unwrapping row ran 79px past a 390px dialog.
            The row wraps; publishing and the public page sit apart from the
            Delete / Cancel / Save group. */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t p-4">
          <div className="flex flex-wrap items-center gap-2">
            {tenant && (
              <>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href={`/t/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="icon-sm" />
                    <BilingualText en="View Public Page" el="Προβολή δημόσιας σελίδας" compact />
                  </a>
                </Button>
                {b?.isBrandingActive ? (
                  <Button variant="outline" size="sm" onClick={() => unpublishMut.mutate()} className="gap-2 text-status-warning border-status-warning-border hover:bg-status-warning-bg">
                    <BilingualText en="Unpublish Branding" el="Απόσυρση εμφάνισης" compact />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending} className="gap-2 text-status-success border-status-success-border hover:bg-status-success-bg">
                    <Check className="icon-sm" />
                    <BilingualText en="Publish Branding" el="Δημοσίευση εμφάνισης" compact />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tenant && (
              <Button variant="ghost" size="sm" className="gap-2 text-destructive-accessible hover:text-destructive-accessible" onClick={async () => {
                if (await confirm({
                  title: <BilingualText en={`Delete tenant “${tenant.name}”?`} el={`Διαγραφή οργανισμού «${tenant.name}»;`} />,
                  description: TENANT_DELETE_DESCRIPTION,
                  confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact />,
                })) deleteMut.mutate();
              }}>
                <Trash2 className="icon-sm" />
                <BilingualText en="Delete" el="Διαγραφή" compact />
              </Button>
            )}
            <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
            {isNew && (
              <Button onClick={handleSaveGeneral} disabled={isSaving || !general.name || !general.slug} className="gap-2">
                <Plus className="icon-sm" />
                {isSaving ? 'Creating…' : 'Create Tenant'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function TenantPreview({
  general,
  branding,
}: {
  general: { displayName: string; logoUrl: string; name: string };
  branding: { primaryColor: string; secondaryColor: string; accentColor: string; heroTitle: string; heroSubtitle: string; ctaLabel: string; ctaUrl: string; heroImageUrl: string; aboutText: string; supportEmail: string };
}) {
  const displayName = general.displayName || general.name || 'Organization';
  return (
    <div className="p-6">
      <div className="rounded-lg border overflow-hidden">
        {/* Preview Header */}
        <div className="p-4 flex items-center justify-between" style={{ backgroundColor: branding.primaryColor }}>
          {general.logoUrl ? (
            <img src={general.logoUrl} alt="" className="h-8 object-contain" />
          ) : (
            <span className="text-white font-semibold">{displayName}</span>
          )}
          <div className="flex gap-2">
            <div className="h-8 w-16 rounded bg-white/20" />
            <div className="h-8 w-16 rounded bg-white/20" />
          </div>
        </div>

        {/* Preview Hero */}
        <div
          className="p-8 text-center relative"
          style={branding.heroImageUrl ? { backgroundImage: `url(${branding.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${branding.primaryColor}22, ${branding.secondaryColor}22)` }}
        >
          <h1 className="text-2xl font-semibold mb-2">{branding.heroTitle || `Welcome to ${displayName}`}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{branding.heroSubtitle || 'Connect with founders, mentors, and investors in our ecosystem.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: branding.primaryColor }}>
              {branding.ctaLabel || 'Get Started'}
            </button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}>
              <BilingualText en="Learn More" el="Μάθετε περισσότερα" compact />
            </button>
          </div>
        </div>

        {/* About section */}
        {branding.aboutText && (
          <div className="p-6 bg-muted/20">
            <h2 className="text-lg font-semibold mb-2"><BilingualText en="About" el="Σχετικά" compact /></h2>
            <p className="text-sm text-muted-foreground">{branding.aboutText}</p>
          </div>
        )}

        {/* Preview Footer */}
        <div className="p-4 border-t bg-muted/30 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {displayName}. All rights reserved.</p>
          {branding.supportEmail && <p className="mt-1">Contact: {branding.supportEmail}</p>}
        </div>
      </div>
    </div>
  );
}
