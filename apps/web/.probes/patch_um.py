import io
p = 'src/app/admin/user-management/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = "import { AppShell } from '@/components/layout/AppShell';"
new = """import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';"""
assert s.count(old) == 1; s = s.replace(old, new)

old = "  const bulkAction = async (action: 'activate' | 'suspend' | 'ban') => {"
new = """  /** The filtered list, as a CSV - the header button never had a handler. */
  const exportCsv = () => {
    if (!filtered.length) return;
    const header = 'Name,Email,Role,Status,Created,Last Active\\n';
    const body = filtered
      .map((u) => [u.name, u.email, u.role, u.status, u.createdAt, u.lastActive].join(','))
      .join('\\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkAction = async (action: 'activate' | 'suspend' | 'ban') => {"""
assert s.count(old) == 1; s = s.replace(old, new)

old = """  return (
    <AppShell
      title="User Management"
      description="Search, filter, verify, and moderate platform accounts. Bulk actions apply to selected rows."
      showHelp
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setUsers(MOCK_USERS)}>
            <RefreshCw className="icon-sm mr-1.5" />
            Reset demo data
          </Button>
          <Button variant="outline" size="sm">
            <Download className="icon-sm mr-1.5" />
            Export CSV
          </Button>
        </div>
      }
    >"""
new = """  const activeFilters =
    (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

  /*
   * The page rail: the old left column (filters, sort, bulk actions), the
   * totals and the header utilities, as four families. The column keeps the
   * work - search and the table. The bulk badge counts the selection, so a
   * row ticked on the page is visible on the collapsed strip.
   */
  const rail: PageRailSection[] = [
    {
      id: 'totals',
      glyph: 'chart',
      labelEn: 'User totals',
      labelEl: 'Σύνολα χρηστών',
      badge: stats.pending || null,
      content: (
        <div className="space-y-2">
          {[
            { label: 'Total users', value: stats.total, icon: Users },
            { label: 'Active', value: stats.active, icon: CheckCircle2, className: 'text-status-success' },
            { label: 'Pending', value: stats.pending, icon: Clock, className: 'text-status-warning' },
            { label: 'Suspended', value: stats.suspended, icon: Ban, className: 'text-status-danger' },
          ].map(({ label, value, icon: Icon, className }) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={cn('text-2xl font-bold', className)}>{value}</p>
                </div>
                <Icon className={cn('icon-lg text-muted-foreground', className)} />
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: activeFilters || null,
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="founder">Founder</SelectItem>
                <SelectItem value="co-founder">Co-founder</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</p>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="createdAt">Created date</SelectItem>
                <SelectItem value="lastActive">Last active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: 'bulk',
      glyph: 'shield',
      labelEn: 'Bulk actions',
      labelEl: 'Μαζικές ενέργειες',
      badge: selectedIds.length || null,
      content: (
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            <BilingualText en="Apply to the rows ticked in the table." el="Εφαρμογή στις επιλεγμένες γραμμές του πίνακα." compact wrap />
          </p>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void bulkAction('activate')}>
            <CheckCircle2 className="icon-sm mr-2" /> Activate selected
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void bulkAction('suspend')}>
            <Ban className="icon-sm mr-2" /> Suspend selected
          </Button>
          {/*
            * "Delete selected" removed rows from a local array and said so
            * in a toast. There is no delete-user endpoint, and there should
            * not be one behind a bulk button — banning is the reversible
            * action the platform actually records.
            */}
          <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => void bulkAction('ban')}>
            <Ban className="icon-sm mr-2" /> Ban selected
          </Button>
        </div>
      ),
    },
    {
      id: 'tools',
      glyph: 'sliders',
      labelEn: 'Data tools',
      labelEl: 'Εργαλεία δεδομένων',
      content: (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setUsers(MOCK_USERS)}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
          >
            <RefreshCw className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Reset demo data" el="Επαναφορά δείγματος" compact wrap /></span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70 disabled:opacity-50"
          >
            <Download className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Export filtered list (CSV)" el="Εξαγωγή φιλτραρισμένης λίστας (CSV)" compact wrap /></span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="User Management"
      description="Search, filter, verify, and moderate platform accounts. Bulk actions apply to selected rows."
      showHelp
      rail={rail}
    >"""
assert s.count(old) == 1; s = s.replace(old, new)

s = s.replace(
  "Use the <strong>filters</strong> on the left to narrow by role or status.",
  "Use the <strong>filters in the page tools</strong> on the right to narrow by role or status.")

old = """      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4 rounded-xl border border-border/60 bg-card p-4">"""
end_marker = """        </aside>

        <div className="space-y-4">"""
start = s.index(old)
end = s.index(end_marker, start) + len(end_marker)
s = s[:start] + '      <div className="space-y-4">' + s[end:]

old = """          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total users', value: stats.total, icon: Users },
              { label: 'Active', value: stats.active, icon: CheckCircle2, className: 'text-status-success' },
              { label: 'Pending', value: stats.pending, icon: Clock, className: 'text-status-warning' },
              { label: 'Suspended', value: stats.suspended, icon: Ban, className: 'text-status-danger' },
            ].map(({ label, value, icon: Icon, className }) => (
              <Card key={label}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={cn('text-2xl font-bold', className)}>{value}</p>
                  </div>
                  <Icon className={cn('icon-lg text-muted-foreground', className)} />
                </CardContent>
              </Card>
            ))}
          </div>

"""
assert s.count(old) == 1; s = s.replace(old, "")

# Honesty: illustrative rows say so until the directory answers.
old = """      <div className="space-y-4">
          <div className="relative">"""
new = """      <div className="space-y-4">
          {!isLive && (
            <SampleDataNotice
              surface="User management"
              detail="These accounts are illustrative until the directory responds; moderation actions are disabled on them."
              askAiPrompt="Why does admin user management show sample accounts?"
            />
          )}

          <div className="relative">"""
assert s.count(old) == 1, s.count(old); s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
