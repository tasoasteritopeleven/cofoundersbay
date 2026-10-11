import io
p = 'src/app/fundraising/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { AppShell } from '@/components/layout/AppShell';"""
new = """import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';"""
assert s.count(old) == 1; s = s.replace(old, new)

# rail definition before `const emptyCta`
old = """  const emptyCta = ("""
new = """  /*
   * The page rail: the pipeline totals and the resource links are about the
   * page, not the pipeline itself. The column keeps the round, the views and
   * the actions that change them.
   */
  const rail: PageRailSection[] = [
    {
      id: 'round',
      glyph: 'chart',
      labelEn: 'Round totals',
      labelEl: 'Σύνολα γύρου',
      badge: stats.active || null,
      content: (
        <div className="space-y-2">
          {[
            { glyph: 'people' as const, label: 'stat_leads' as const, value: stats.total, count: stats.total, tone: 'accent' as const },
            { glyph: 'messages' as const, label: 'stat_active' as const, value: stats.active, count: stats.active, tone: 'warning' as const },
            { glyph: 'award' as const, label: 'stat_committed' as const, value: stats.committed, count: stats.committed, tone: 'success' as const },
            { glyph: 'chart' as const, label: 'stat_conversion' as const, value: stats.total ? `${stats.conversion}%` : '—', count: null, tone: 'info' as const },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className={cn('shrink-0 rounded-xl p-2', STATUS[s.tone].bg)}>
                <CfbGlyph name={s.glyph} className={cn('icon-sm', STATUS[s.tone].icon)} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold tabular-nums">{s.value}</p>
                <p className="text-2xs leading-snug text-muted-foreground">
                  <BilingualText
                    en={fundraisingEn(s.label)}
                    el={fundraisingEl(s.count === 1 ? (`${s.label}_one` as typeof s.label) : s.label)}
                    compact
                    wrap
                  />
                </p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'resources',
      glyph: 'book',
      labelEn: 'Resources',
      labelEl: 'Πόροι',
      content: (
        <div className="space-y-0.5">
          {[
            { title: 'res_playbook' as const, desc: 'res_playbook_desc' as const, href: '/learning', glyph: 'book' as const },
            { title: 'res_find' as const, desc: 'res_find_desc' as const, href: '/investors', glyph: 'discover' as const },
            { title: 'res_ready' as const, desc: 'res_ready_desc' as const, href: '/readiness', glyph: 'chart' as const },
            { title: 'res_deck' as const, desc: 'res_deck_desc' as const, href: '/builder/pitch-deck', glyph: 'builder' as const },
          ].map((r) => (
            <Link key={r.href} href={r.href} className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/70">
              <div className="flex min-w-0 items-center gap-2.5">
                <CfbGlyph name={r.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium transition-colors group-hover:text-primary-accessible">
                    <BilingualText en={fundraisingEn(r.title)} el={fundraisingEl(r.title)} compact wrap />
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    <BilingualText en={fundraisingEn(r.desc)} el={fundraisingEl(r.desc)} compact wrap />
                  </p>
                </div>
              </div>
              <ChevronRight className="icon-sm shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      ),
    },
  ];

  const emptyCta = ("""
assert s.count(old) == 1; s = s.replace(old, new)

# AppShell gains rail
old = """    <AppShell
      showHelp
      askAi="Fundraising is still sample data. Based on my graph, what should I do next toward a real round — profile, matches, or builder?"
      actions={"""
new = """    <AppShell
      showHelp
      rail={rail}
      askAi="Fundraising is still sample data. Based on my graph, what should I do next toward a real round — profile, matches, or builder?"
      actions={"""
assert s.count(old) == 1; s = s.replace(old, new)

# remove the in-column stats grid
start_marker = """        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            // `count` is the number the label has to agree with in Greek;"""
end_marker = """        </div>

        <Tabs defaultValue="pipeline">"""
i0 = s.index(start_marker); i1 = s.index(end_marker)
s = s[:i0] + """        {/* The round totals moved to the page rail ('round' section). */}

        <Tabs defaultValue="pipeline">""" + s[i1 + len(end_marker):]

# remove the duplicated find_investors / add_lead buttons beside the tabs
old = """            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-xl text-xs" asChild>
                <Link href="/investors">
                  <CfbGlyph name="discover" className="icon-sm" />
                  <BilingualText en={fundraisingEn('find_investors')} el={fundraisingEl('find_investors')} compact />
                </Link>
              </Button>
              <Button size="sm" className="h-8 gap-1.5 rounded-xl text-xs" onClick={() => openAdd()}>
                <Plus className="icon-sm" />
                <BilingualText en={fundraisingEn('add_lead')} el={fundraisingEl('add_lead')} compact />
              </Button>
            </div>"""
new = """            {/* Find investors / Add lead live in the page header actions -
                rendering them here again was the same control twice. */}"""
assert s.count(old) == 1; s = s.replace(old, new)

# remove the bottom resources card
start_marker = """        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              <BilingualText en={fundraisingEn('resources')} el={fundraisingEl('resources')} />
            </CardTitle>
          </CardHeader>"""
end_marker = """      </div>

      {addOpen && ("""
i0 = s.index(start_marker); i1 = s.index(end_marker)
s = s[:i0] + """        {/* Resources moved to the page rail ('resources' section). */}
""" + s[i1:]

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
