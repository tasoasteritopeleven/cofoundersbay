import io
p = 'src/app/admin/billing/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { AppShell } from '@/components/layout/AppShell';"""
new = """import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """  const mrr = statsData?.mrrCents ?? 0;
  const arr = mrr * 12;

  return (
    <AppShell>
      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight">Billing Administration</h1>
            <p className="text-sm text-muted-foreground">Subscriptions, invoices, plans, and coupons.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'billing'] })}>
            <RefreshCw className="icon-sm" />
            Refresh
          </Button>
        </div>

        {/* Revenue Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: 'MRR', value: formatCents(mrr), icon: DollarSign, color: 'text-status-success' },
            { label: 'ARR (est.)', value: formatCents(arr), icon: TrendingUp, color: 'text-status-info' },
            { label: 'Active Subs', value: statsData?.activeSubs ?? '—', icon: CheckCircle2, color: 'text-status-accent' },
            { label: 'Past Due', value: statsData?.pastDueSubs ?? '—', icon: AlertTriangle, color: 'text-status-warning' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className={cn('icon-sm', color)} />
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
                <p className="text-xl font-bold mt-1">
                  {statsLoading ? <Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /> : value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>"""
new = """  const mrr = statsData?.mrrCents ?? 0;
  const arr = mrr * 12;

  /*
   * The page rail: revenue figures, the status filter and Refresh are about
   * the lists, not the lists themselves. The column keeps the tabs, the
   * search and the rows.
   */
  const rail: PageRailSection[] = [
    {
      id: 'metrics',
      glyph: 'chart',
      labelEn: 'Revenue metrics',
      labelEl: 'Οικονομικά',
      badge: statsData?.pastDueSubs || null,
      content: (
        <div className="space-y-2">
          {[
            { label: 'MRR', value: formatCents(mrr), icon: DollarSign, color: 'text-status-success' },
            { label: 'ARR (est.)', value: formatCents(arr), icon: TrendingUp, color: 'text-status-info' },
            { label: 'Active Subs', value: statsData?.activeSubs ?? '—', icon: CheckCircle2, color: 'text-status-accent' },
            { label: 'Past Due', value: statsData?.pastDueSubs ?? '—', icon: AlertTriangle, color: 'text-status-warning' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Icon className={cn('icon-sm', color)} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <p className="text-xl font-bold mt-1">
                {statsLoading ? <Loader2 className="icon-md animate-spin text-muted-foreground" aria-hidden="true" /> : value}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Status filter',
      labelEl: 'Φίλτρο κατάστασης',
      badge: statusFilter !== ALL_STATUSES ? 1 : null,
      content: (
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Billing tools',
      labelEl: 'Εργαλεία χρεώσεων',
      content: (
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'billing'] })}
          className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
        >
          <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1"><BilingualText en="Refresh billing data" el="Ανανέωση δεδομένων" compact wrap /></span>
        </button>
      ),
    },
  ];

  return (
    <AppShell rail={rail}>
      <div className="py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight">Billing Administration</h1>
          <p className="text-sm text-muted-foreground">Subscriptions, invoices, plans, and coupons.</p>
        </div>"""
assert s.count(old) == 1; s = s.replace(old, new)

# tabs row: keep tabs + search, drop the status select (it lives in the rail)
old = """            <div className="flex gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 w-48 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>"""
new = """            <div className="flex gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 w-48 text-sm"
                />
              </div>
            </div>"""
assert s.count(old) == 1; s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
