'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Bell, BellOff, Trash2, Play, Clock, Filter,
  Plus, Edit2, MoreHorizontal, CheckCircle, AlertCircle,
  Sparkles, Users, Briefcase, MapPin, Target, Loader2,
} from 'lucide-react';
import {
  listSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
  runSavedSearch,
  type SavedSearch,
} from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailStats } from '@/components/layout/RailParts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { SAVED_SEARCHES_STRINGS, savedSearchesEn, savedSearchesEl } from '@/lib/i18n/strings-saved-searches';
import { useRouter } from 'next/navigation';
import { qk } from '@/lib/query-keys';
import { CANCELLED, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { savedFiltersToParams } from '@/lib/need-card-wall';
import { FactLine } from '@/components/common/FactLine';

function SearchCard({
  search,
  onRun,
  onToggleAlerts,
  onEdit,
  onDelete,
}: {
  search: SavedSearch;
  onRun: () => void;
  onToggleAlerts: (current: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const filterCount = Object.values(search.filters).filter((v) => v && v.length > 0).length;
  const lastRunDate = search.lastRun ? new Date(search.lastRun) : null;
  const timeAgo = lastRunDate ? formatTimeAgo(lastRunDate) : fill('never_run');

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{search.name}</h3>
              {search.newResults && search.newResults > 0 && (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  <BilingualText {...fill('new_badge', { n: search.newResults })} compact />
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Search className="icon-sm" aria-hidden="true" />
              <span className="truncate">{search.query}</span>
            </p>

            {/* Filters: what the search holds, as one fact line (they were
                up to seven badges, each with its own glyph). */}
            <FactLine
              className="mt-3"
              label={bilingualAria('Filters', 'Φίλτρα')}
              items={[
                search.scope === 'need_cards' ? <BilingualText key="scope" en="Need cards" el="Κάρτες ανάγκης" compact /> : null,
                ...(search.filters?.kinds ?? []).map((k) => <StatusText key={`kind-${k}`} value={k} />),
                search.filters?.remote?.length ? <BilingualText key="remote" en="Remote" el="Εξ αποστάσεως" compact /> : null,
                ...(search.filters?.roles ?? []),
                ...(search.filters?.industries ?? []).slice(0, 2),
                ...(search.filters?.locations ?? []).slice(0, 1),
                filterCount > 3 ? <BilingualText key="more" {...fill('more_filters', { n: filterCount - 3 })} compact /> : null,
              ]}
            />

            {/* Stats */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1">
                <Target className="icon-sm shrink-0" aria-hidden="true" />
                <BilingualText {...fill('results_count', { n: search.resultCount ?? 0 })} compact wrap />
              </span>
              <span className="flex min-w-0 items-center gap-1">
                <Clock className="icon-sm shrink-0" aria-hidden="true" />
                {lastRunDate ? (
                  <RelativeTime
                    date={lastRunDate}
                    format={(d) => {
                      const ago = formatTimeAgo(d);
                      return (
                        <BilingualText
                          en={fill('last_run', { when: ago.en }).en}
                          el={fill('last_run', { when: ago.el }).el}
                          compact
                          wrap
                        />
                      );
                    }}
                  />
                ) : (
                  <BilingualText
                    en={fill('last_run', { when: timeAgo.en }).en}
                    el={fill('last_run', { when: timeAgo.el }).el}
                    compact
                    wrap
                  />
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={search.alertsEnabled}
                onCheckedChange={() => onToggleAlerts(search.alertsEnabled)}
                aria-label={bilingualAria(savedSearchesEn('toggle_alerts'), savedSearchesEl('toggle_alerts'))}
              />
              {search.alertsEnabled ? (
                <Bell className="icon-sm text-muted-foreground" />
              ) : (
                <BellOff className="icon-sm text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            <Button variant="outline" size="sm" onClick={onRun}>
              <Play className="icon-sm mr-1 shrink-0" aria-hidden="true" />
              <BilingualText en={savedSearchesEn('run')} el={savedSearchesEl('run')} compact wrap />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={bilingualAria(savedSearchesEn('more_actions'), savedSearchesEl('more_actions'))}
                >
                  <MoreHorizontal className="icon-sm" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="icon-sm mr-2 shrink-0" aria-hidden="true" />
                  <BilingualText en={savedSearchesEn('edit')} el={savedSearchesEl('edit')} compact />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive-accessible">
                  <Trash2 className="icon-sm mr-2 shrink-0" aria-hidden="true" />
                  <BilingualText en={savedSearchesEn('delete')} el={savedSearchesEl('delete')} compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SavedKey = keyof typeof SAVED_SEARCHES_STRINGS;

/** One key, both languages, with its placeholders filled. */
function fill(key: SavedKey, vars: Record<string, string | number> = {}): { en: string; el: string } {
  let en = savedSearchesEn(key);
  let el = savedSearchesEl(key);
  for (const [k, v] of Object.entries(vars)) {
    en = en.replace(`{${k}}`, String(v));
    el = el.replace(`{${k}}`, String(v));
  }
  return { en, el };
}

function formatTimeAgo(date: Date): { en: string; el: string } {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return fill('time_minutes', { n: diffMins });
  if (diffHours < 24) return fill('time_hours', { n: diffHours });
  if (diffDays < 7) return fill('time_days', { n: diffDays });
  /* Past a week it is a date. UTC on both sides, as everywhere else here. */
  return {
    en: date.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    el: date.toLocaleDateString('el-GR', { timeZone: 'UTC' }),
  };
}

function EditSearchDialog({
  search,
  open,
  onClose,
  onSave,
}: {
  search: SavedSearch | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<SavedSearch>) => void;
}) {
  const [name, setName] = useState(search?.name || '');
  const [alertFrequency, setAlertFrequency] = useState(search?.alertFrequency || 'daily');
  const { primary } = useLanguagePreference();
  const t = (key: SavedKey) => (primary === 'el' ? savedSearchesEl(key) : savedSearchesEn(key));

  const handleSave = () => {
    onSave({ name, alertFrequency });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><BilingualText en={savedSearchesEn('edit_title')} el={savedSearchesEl('edit_title')} compact wrap /></DialogTitle>
          <DialogDescription className="sr-only"><BilingualText en="Rename the search or change how often it alerts you." el="Μετονομάστε την αναζήτηση ή αλλάξτε τη συχνότητα ειδοποιήσεων." /></DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name"><BilingualText en={savedSearchesEn('name_label')} el={savedSearchesEl('name_label')} compact /></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              /* A placeholder is read inside its own box, so it takes the
                 reader's language rather than both at once. */
              placeholder={t('name_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <p id="page-cap1-cap" className="text-sm font-medium leading-tight"><BilingualText en={savedSearchesEn('frequency_label')} el={savedSearchesEl('frequency_label')} compact /></p>
            <div role="group" aria-labelledby="page-cap1-cap" className="flex gap-2">
              {/* `capitalize` on a raw value was doing the labelling; each
                  cadence has its own pair now, and Greek answers "how often"
                  with an adverb where English uses an adjective. */}
              {([
                { value: 'instant' as const, key: 'freq_instant' as const },
                { value: 'daily' as const, key: 'freq_daily' as const },
                { value: 'weekly' as const, key: 'freq_weekly' as const },
              ]).map(({ value, key }) => (
                <Button
                  key={value}
                  variant={alertFrequency === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAlertFrequency(value)}
                >
                  <BilingualText en={savedSearchesEn(key)} el={savedSearchesEl(key)} compact wrap />
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <BilingualText en={savedSearchesEn('cancel')} el={savedSearchesEl('cancel')} compact />
          </Button>
          <Button onClick={handleSave}><BilingualText en={savedSearchesEn('save_changes')} el={savedSearchesEl('save_changes')} compact wrap /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { primary } = useLanguagePreference();
  /* Toasts and the empty state's title/description are single strings passed to
     components that render text, not nodes, so they take the reader's language
     rather than a bilingual join. */
  const t = (key: SavedKey) => (primary === 'el' ? savedSearchesEl(key) : savedSearchesEn(key));

  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: qk('saved-searches'),
    queryFn: () => listSavedSearches(),
  });

  const searches = data?.searches ?? [];

  const toggleAlertsMutation = useMutation({
    mutationFn: ({ id, alertsEnabled }: { id: string; alertsEnabled: boolean }) =>
      updateSavedSearch(id, { alertsEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('saved-searches') });
      success(t('alerts_updated'));
    },
    onError: () => showError(t('alerts_failed')),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<SavedSearch, 'name' | 'alertsEnabled' | 'alertFrequency'>> }) =>
      updateSavedSearch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('saved-searches') });
      success(t('search_updated'));
    },
    onError: () => showError(t('search_update_failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('saved-searches') });
      success(t('search_deleted'));
    },
    onError: () => showError(t('search_delete_failed')),
  });

  const handleRun = (search: SavedSearch) => {
    if (search.scope === 'need_cards') {
      // A need-card search opens the need cards in Opportunities with its filters.
      const kinds = search.filters?.kinds ?? [];
      const type = kinds.length === 1 ? ({ cofounder: 'cofounder', investor_intro: 'investment', equity_role: 'job' } as Record<string, string>)[kinds[0]] ?? 'all' : 'all';
      const params = new URLSearchParams({ type });
      if (search.query) params.set('q', search.query);
      if (search.filters?.remote?.length) params.set('remote', '1');
      // The wall's chips (category, place, stage, commitment) open as they were saved.
      savedFiltersToParams(search.filters as Partial<Record<string, string[]>> | undefined, params);
      void runSavedSearch(search.id)
        .then(() => queryClient.invalidateQueries({ queryKey: qk('saved-searches') }))
        .catch(() => undefined);
      router.push(`/opportunities?${params.toString()}`);
      return;
    }
    const params = new URLSearchParams();
    params.set('q', search.query);
    if (search.filters.roles?.length) params.set('roles', search.filters.roles.join(','));
    if (search.filters.skills?.length) params.set('skills', search.filters.skills.join(','));
    if (search.filters.industries?.length) params.set('industries', search.filters.industries.join(','));
    if (search.filters.locations?.length) params.set('locations', search.filters.locations.join(','));
    if (search.filters.stage?.length) params.set('stage', search.filters.stage.join(','));
    // Records the run (last run, result count) and clears the "new" badge;
    // the results themselves are read on /discover, so this is not awaited.
    void runSavedSearch(search.id)
      .then(() => queryClient.invalidateQueries({ queryKey: qk('saved-searches') }))
      .catch(() => undefined);
    router.push(`/discover?${params.toString()}`);
  };

  const handleToggleAlerts = (id: string, current: boolean): Promise<PageControlRunResult> =>
    settle(() => toggleAlertsMutation.mutateAsync({ id, alertsEnabled: !current }));

  const handleSaveEdit = (data: Partial<SavedSearch>) => {
    if (!editingSearch) return;
    editMutation.mutate({ id: editingSearch.id, data });
    setEditingSearch(null);
  };

  // The row's delete and the assistant ask in the app's one confirm dialog.
  // The command used to open a page-local dialog and report done while the
  // question was still on screen.
  const handleDelete = async (id: string): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en={savedSearchesEn('delete_title')} el={savedSearchesEl('delete_title')} />,
      description: <BilingualText en={savedSearchesEn('delete_body')} el={savedSearchesEl('delete_body')} />,
      confirmLabel: <BilingualText en={savedSearchesEn('delete')} el={savedSearchesEl('delete')} compact secondaryClassName="text-destructive-foreground" />,
      variant: 'destructive',
    });
    if (!ok) return CANCELLED;
    return settle(() => deleteMutation.mutateAsync(id));
  };

  const handleCreateNew = () => {
    router.push('/discover?saveSearch=true');
  };

  const totalNewResults = searches.reduce((sum, s) => sum + (s.newResults || 0), 0);

  // Offered to the assistant: New Search and each card's Run, alerts on /
  // off, Edit and Delete (which opens the same confirmation).
  const byName = (list: SavedSearch[]) => rowOptions(list, (x) => x.id, (x) => x.name);
  const searchById = (id?: string) => searches.find((x) => x.id === id);
  usePageList([
    {
      id: 'saved_searches',
      labelEn: 'Saved searches',
      labelEl: 'Αποθηκευμένες αναζητήσεις',
      rows: isLoading ? undefined : searches.map((x) => `${x.name} · "${x.query}"${x.newResults ? ` · ${x.newResults} new results` : ''} · alerts ${x.alertsEnabled ? x.alertFrequency : 'off'}`),
    },
  ]);
  usePageControls([
    { id: 'new_search', labelEn: 'Start a new saved search', labelEl: 'Νέα αποθηκευμένη αναζήτηση', writes: false, run: handleCreateNew },
    { id: 'run_search', labelEn: 'Run saved search', labelEl: 'Εκτέλεση αποθηκευμένης αναζήτησης', writes: false, options: byName(searches), run: (v) => { const x = searchById(v); if (x) handleRun(x); } },
    // updateSavedSearch sends `alertsEnabled` alone; on and off are opposites.
    { id: 'alerts_on', labelEn: 'Turn search alerts on', labelEl: 'Ενεργοποίηση ειδοποιήσεων αναζήτησης', writes: true, options: byName(searches.filter((x) => !x.alertsEnabled)), undo: (v) => ({ control: 'alerts_off', value: v }), run: (v) => { const x = searchById(v); return x ? handleToggleAlerts(x.id, false) : ROW_GONE; } },
    { id: 'alerts_off', labelEn: 'Turn search alerts off', labelEl: 'Απενεργοποίηση ειδοποιήσεων αναζήτησης', writes: true, options: byName(searches.filter((x) => x.alertsEnabled)), undo: (v) => ({ control: 'alerts_on', value: v }), run: (v) => { const x = searchById(v); return x ? handleToggleAlerts(x.id, true) : ROW_GONE; } },
    { id: 'edit_search', labelEn: 'Edit saved search', labelEl: 'Επεξεργασία αποθηκευμένης αναζήτησης', writes: false, options: byName(searches), run: (v) => { const x = searchById(v); if (x) setEditingSearch(x); } },
    { id: 'delete_search', labelEn: 'Delete saved search', labelEl: 'Διαγραφή αποθηκευμένης αναζήτησης', writes: true, options: byName(searches), run: (v) => (v ? handleDelete(v) : undefined) },
  ]);

  /*
   * The three counts describe the list rather than being the list, so they
   * live in the rail. New Search stays in the header: it is this page's create.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'discover',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'searches', label: savedSearchesEn('stat_searches'), labelEl: savedSearchesEl('stat_searches'), value: searches.length, icon: Search, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'alerts', label: savedSearchesEn('stat_alerts'), labelEl: savedSearchesEl('stat_alerts'), value: searches.filter((s) => s.alertsEnabled).length, icon: Bell, tone: 'bg-status-success-bg text-status-success' },
            { key: 'new', label: savedSearchesEn('stat_new'), labelEl: savedSearchesEl('stat_new'), value: totalNewResults, icon: Sparkles, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Search} en="Open search" el="Άνοιγμα αναζήτησης" onClick={() => router.push('/search')} />
          <RailAction icon={Target} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
          <RailAction icon={Users} en="Open discover" el="Άνοιγμα ανακάλυψης" onClick={() => router.push('/discover')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      rail={rail}
      actions={
        <Button onClick={handleCreateNew}>
          <Plus className="icon-sm mr-2 shrink-0" aria-hidden="true" />
          <BilingualText en={savedSearchesEn('new_search')} el={savedSearchesEl('new_search')} compact wrap />
        </Button>
      }
    >
      <div className="space-y-6 pb-10">
        {/* The count line that stood here repeated the first card below
            ("0 saved searches" twice), and its new-results suffix the third.
            The page's action joins the others in the header. The three
            figures now live in the rail. */}
        {/* Search List */}
        {searches.length === 0 ? (
          <EmptyState
            illustration="search"
            /* Both take a ReactNode, so the empty state reads bilingually
               like the rest of the page rather than in one language. */
            title={<BilingualText en={savedSearchesEn('empty_title')} el={savedSearchesEl('empty_title')} compact wrap />}
            description={<BilingualText en={savedSearchesEn('empty_description')} el={savedSearchesEl('empty_description')} />}
            askAiPrompt="I have no saved searches. Suggest a search I should save for a technical cofounder in my city."
            action={
              <Button onClick={handleCreateNew}>
                <Plus className="icon-sm mr-2 shrink-0" aria-hidden="true" />
                <BilingualText en={savedSearchesEn('empty_action')} el={savedSearchesEl('empty_action')} compact wrap />
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {searches.map((search) => (
              <SearchCard
                key={search.id}
                search={search}
                onRun={() => handleRun(search)}
                onToggleAlerts={(current) => void handleToggleAlerts(search.id, current)}
                onEdit={() => setEditingSearch(search)}
                onDelete={() => void handleDelete(search.id)}
              />
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <EditSearchDialog
          search={editingSearch}
          open={!!editingSearch}
          onClose={() => setEditingSearch(null)}
          onSave={handleSaveEdit}
        />

      </div>
    </AppShell>
  );
}
