'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, CheckCircle2, Clock, ArrowRight, Edit2, Trash2, RefreshCw, MoreVertical, Search, LayoutGrid, LayoutList, X, Share2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { CANCELLED, choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { useAuthenticatedSession } from '@/hooks/useAuthenticatedSession';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { bilingualAria, formatShortDate } from '@/lib/i18n/format';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { useToast } from '@/components/ui/toast';
import {
  milestoneEn,
  milestoneEl,
  useMilestonePrimaryText,
  MILESTONE_CATEGORY_KEYS,
  MILESTONE_STATUS_ONE_KEYS,
  PREVIEW_MILESTONE_EL,
} from '@/lib/i18n/strings-milestones';
import {
  listMilestones,
  getMilestoneSummary,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  type Milestone,
  type MilestoneStatus,
  type MilestonePriority,
} from '@/lib/api';
import { MilestoneFormModal } from './MilestoneFormModal';
import { qk } from '@/lib/query-keys';

// ── Status config ────────────────────────────────────────────────────────────
// Not the calendar glyph for "in progress": the due date beside it already uses it.
const STATUS_CONFIG: Record<MilestoneStatus, { statusKey: 'status_todo' | 'status_in_progress' | 'status_blocked' | 'status_completed' | 'status_cancelled'; glyph: CfbGlyphName; tone: StatusTone }> = {
  todo:        { statusKey: 'status_todo',        glyph: 'flag',     tone: 'neutral' },
  in_progress: { statusKey: 'status_in_progress', glyph: 'target',   tone: 'info' },
  blocked:     { statusKey: 'status_blocked',     glyph: 'shield',   tone: 'warning' },
  completed:   { statusKey: 'status_completed',   glyph: 'award',    tone: 'success' },
  cancelled:   { statusKey: 'status_cancelled',   glyph: 'more',     tone: 'neutral' },
};

const PRIORITY_CONFIG: Record<MilestonePriority, { priKey: 'pri_low' | 'pri_medium' | 'pri_high'; tone: StatusTone }> = {
  low:    { priKey: 'pri_low',    tone: 'neutral' },
  medium: { priKey: 'pri_medium', tone: 'warning' },
  high:   { priKey: 'pri_high',   tone: 'danger' },
};

const PRIORITY_DOT: Record<StatusTone, string> = {
  success: 'bg-status-success-mark',
  warning: 'bg-status-warning-mark',
  danger: 'bg-status-danger-mark',
  info: 'bg-status-info-mark',
  accent: 'bg-status-accent-mark',
  neutral: 'bg-muted-foreground',
};

const CATEGORY_ORDER = ['all', 'product', 'fundraising', 'hiring', 'partnerships', 'growth', 'other'] as const;

function formatMilestoneDate(iso: string | null, lang: 'en' | 'el'): string {
  if (!iso) return '—';
  return formatShortDate(iso, lang) || '—';
}

function isDueSoon(iso: string | null): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function isOverdue(iso: string | null, status: MilestoneStatus): boolean {
  if (!iso || status === 'completed' || status === 'cancelled') return false;
  return new Date(iso).getTime() < Date.now();
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function MilestoneSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-64" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────
function MilestoneCard({
  item,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  item: Milestone;
  onEdit: (m: Milestone) => void;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
  onDelete: (id: string) => void;
}) {
  const { primary } = useLanguagePreference();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const status = STATUS_CONFIG[item.status];
  const statusColors = STATUS[status.tone];
  const priority = PRIORITY_CONFIG[item.priority];
  const overdue = isOverdue(item.dueDate, item.status);
  const dueSoon = isDueSoon(item.dueDate);
  const catKey = item.category ? MILESTONE_CATEGORY_KEYS[item.category] : null;
  const previewEl = PREVIEW_MILESTONE_EL[item.title];

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all hover:shadow-sm',
        // No opacity fade on a completed row. Fading the container fades its text
        // with it: muted text measured 4.35:1 at 0.75 on the card and 4.38:1 at
        // 0.80 on this row's own success tint -- both under AA, and the exact
        // value needed depends on whichever surface the row happens to sit on.
        // Completion is carried by the success border, the chip and the muted
        // title. No strike-through: it cuts through Greek accents and reads as
        // deleted, and a finished milestone is an achievement, not a removal.
        item.status === 'completed' ? cn('border', STATUS.success.border) : 'border-border',
        overdue && cn('border', STATUS.danger.border),
      )}
    >
      {/* Priority stripe */}
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full',
          item.priority === 'high' ? PRIORITY_DOT.danger : item.priority === 'medium' ? PRIORITY_DOT.warning : PRIORITY_DOT.neutral,
        )}
      />

      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', statusColors.bg)}>
            <CfbGlyph name={status.glyph} className={cn('icon-sm', statusColors.icon)} />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  'page-section page-section--row font-semibold leading-snug',
                  item.status === 'completed' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {previewEl ? <BilingualText en={item.title} el={previewEl.title} wrap /> : item.title}
              </h3>
              {/* Actions */}
              <div className="relative shrink-0">
                {/* Hover reveals it; a touch screen has no hover, so it stays visible there. */}
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className={cn(
                    'rounded-xl p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
                    menuOpen && 'opacity-100',
                  )}
                  aria-label={bilingualAria(milestoneEn('more'), milestoneEl('more'))}
                  aria-expanded={menuOpen}
                >
                  <MoreVertical className="icon-sm" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => { setMenuOpen(false); onEdit(item); }}
                      >
                        <Edit2 className="icon-sm text-muted-foreground" />
                        <BilingualText en={milestoneEn('edit')} el={milestoneEl('edit')} compact />
                      </button>
                      {item.status !== 'completed' && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => { setMenuOpen(false); onStatusChange(item.id, 'completed'); }}
                        >
                          <CheckCircle2 className={cn('icon-sm', STATUS.success.icon)} />
                          <BilingualText en={milestoneEn('mark_complete')} el={milestoneEl('mark_complete')} compact />
                        </button>
                      )}
                      {item.status === 'completed' && (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => { setMenuOpen(false); onStatusChange(item.id, 'in_progress'); }}
                        >
                          <Clock className={cn('icon-sm', STATUS.info.icon)} />
                          <BilingualText en={milestoneEn('reopen')} el={milestoneEl('reopen')} compact />
                        </button>
                      )}
                      {item.status === 'completed' && (
                        // Build in public: the composer opens with the milestone as its title.
                        <Link
                          href={`/updates?title=${encodeURIComponent(`${primary === 'el' ? 'Ορόσημο που πετύχαμε' : 'Milestone reached'}: ${item.title}`)}&milestone=${encodeURIComponent(item.id)}`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          <Share2 className="icon-sm text-muted-foreground" />
                          <BilingualText en="Share as an update" el="Κοινοποίηση ως ενημέρωση" compact />
                        </Link>
                      )}
                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive-accessible hover:bg-destructive/10"
                        onClick={() => { setMenuOpen(false); onDelete(item.id); }}
                      >
                        <Trash2 className="icon-sm" />
                        <BilingualText en={milestoneEn('delete')} el={milestoneEl('delete')} compact />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {item.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                {previewEl?.description
                  ? <BilingualText en={item.description} el={previewEl.description} wrap />
                  : item.description}
              </p>
            )}

            {/* Meta row; progress sits at its end instead of a full-width bar of its own. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Badge
                variant="outline"
                className={cn('gap-1 rounded-full px-2 text-2xs font-medium border', statusColors.chip)}
              >
                {/* Singular: this chip describes one milestone, not the set. */}
                <BilingualText
                  en={milestoneEn(MILESTONE_STATUS_ONE_KEYS[item.status] ?? status.statusKey)}
                  el={milestoneEl(MILESTONE_STATUS_ONE_KEYS[item.status] ?? status.statusKey)}
                  compact
                />
              </Badge>

              <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[priority.tone])} />
                <BilingualText en={milestoneEn(priority.priKey)} el={milestoneEl(priority.priKey)} compact />
              </div>

              {item.category && (
                <span className="text-2xs text-muted-foreground">
                  {catKey
                    ? <BilingualText en={milestoneEn(catKey)} el={milestoneEl(catKey)} compact />
                    : item.category}
                </span>
              )}

              {item.dueDate && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-2xs',
                    overdue ? cn('font-medium', STATUS.danger.icon) : dueSoon ? cn('font-medium', STATUS.warning.icon) : 'text-muted-foreground',
                  )}
                >
                  <CfbGlyph name="calendar" className="icon-sm" />
                  {overdue ? <><BilingualText en={milestoneEn('overdue')} el={milestoneEl('overdue')} compact /> · </> : dueSoon ? <><BilingualText en={milestoneEn('due_soon')} el={milestoneEl('due_soon')} compact /> · </> : ''}
                  {formatMilestoneDate(item.dueDate, primary)}
                </div>
              )}

              {item.collaborator && (
                <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <CfbGlyph name="people" className="icon-sm" />
                  {item.collaborator.displayName}
                </div>
              )}

              {item.status !== 'cancelled' && (
                <div className="ml-auto flex items-center gap-2">
                  <div
                    className="h-1 w-16 overflow-hidden rounded-full bg-muted sm:w-20"
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={bilingualAria(milestoneEn('progress_aria'), milestoneEl('progress_aria'))}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        item.status === 'completed' ? 'bg-status-success-mark' : 'bg-primary',
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="min-w-[2.25rem] text-right text-2xs tabular-nums text-muted-foreground">
                    {item.progress}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryBar({ summary }: { summary: { counts?: Record<string, number>; total?: number; overdue?: number; dueSoon?: number; completionRate?: number } | undefined }) {
  const counts = summary?.counts;
  if (!summary || !counts || typeof counts !== 'object') return null;
  const overdue = summary.overdue ?? 0;
  const rate = Math.max(0, Math.min(100, summary.completionRate ?? 0));
  // Overdue is only red when something is: a red "0" reads as an alarm.
  const stats: { labelKey: 'stat_total' | 'stat_in_progress' | 'stat_completed' | 'stat_overdue'; value: number; tone: StatusTone }[] = [
    { labelKey: 'stat_total', value: summary.total ?? 0, tone: 'neutral' },
    { labelKey: 'stat_in_progress', value: counts.in_progress ?? 0, tone: 'info' },
    { labelKey: 'stat_completed', value: counts.completed ?? 0, tone: 'success' },
    { labelKey: 'stat_overdue', value: overdue, tone: overdue > 0 ? 'danger' : 'neutral' },
  ];

  // One row per figure: at rail width a 2×2 tile left ~80px per label, and
  // "Ολοκληρωμένα" alone is wider than that.
  return (
    <div className="rounded-xl border border-border bg-card/80 px-3 py-2.5">
      <dl className="space-y-1">
        {stats.map((s) => (
          <div key={s.labelKey} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 text-muted-foreground">
              <span className="page-stat-label leading-snug">
                <BilingualText en={milestoneEn(s.labelKey)} el={milestoneEl(s.labelKey)} compact wrap />
              </span>
            </dt>
            <dd className={cn('page-stat shrink-0 font-semibold tabular-nums', s.tone === 'neutral' ? 'text-foreground' : STATUS[s.tone].text)}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2.5 border-t border-border pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="page-stat-label font-medium text-foreground">
            <BilingualText en={milestoneEn('stat_rate')} el={milestoneEl('stat_rate')} compact wrap />
          </p>
          <span className="page-stat font-semibold tabular-nums text-foreground">{rate}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={rate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={bilingualAria(milestoneEn('stat_rate'), milestoneEl('stat_rate'))}
        >
          <div className="h-full rounded-full bg-status-success-mark transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MilestonesPage() {
  const qc = useQueryClient();
  const t = useMilestonePrimaryText();
  const { success, error: showError } = useToast();
  const { isAuthenticated, isChecking } = useAuthenticatedSession();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<MilestonePriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [editTarget, setEditTarget] = useState<Milestone | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryKey = qk('milestones', statusFilter, priorityFilter);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      listMilestones({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        limit: 100,
      }),
    staleTime: 30_000,
    enabled: mounted && isAuthenticated && !isChecking,
  });

  const { data: unfilteredData } = useQuery({
    queryKey: qk('milestones', 'all', 'all'),
    queryFn: () => listMilestones({ limit: 100 }),
    staleTime: 30_000,
    enabled: mounted && isAuthenticated && !isChecking,
  });

  const { data: summaryData } = useQuery({
    queryKey: qk('milestones', 'summary'),
    queryFn: getMilestoneSummary,
    staleTime: 60_000,
    enabled: mounted && isAuthenticated && !isChecking,
  });

  const waiting = !mounted || isLoading;

  const allMilestones = data?.milestones ?? [];
  const milestones = allMilestones.filter((m) => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const previewEl = PREVIEW_MILESTONE_EL[m.title];
    return (
      m.title.toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q) ||
      (previewEl?.title ?? '').toLowerCase().includes(q) ||
      (previewEl?.description ?? '').toLowerCase().includes(q)
    );
  });

  const createMut = useMutation({
    mutationFn: createMilestone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('milestones') });
      success(t(milestoneEn('created'), milestoneEl('created')), t(milestoneEn('created_hint'), milestoneEl('created_hint')));
      setCreateOpen(false);
    },
    onError: () => {
      showError(t(milestoneEn('fail_create'), milestoneEl('fail_create')), t(milestoneEn('try_again'), milestoneEl('try_again')));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMilestone>[1] }) =>
      updateMilestone(id, data),
    onSuccess: (_row, variables) => {
      qc.invalidateQueries({ queryKey: qk('milestones') });
      setEditTarget(null);
      const keys = Object.keys(variables.data);
      if (variables.data.status === 'completed') success(t(milestoneEn('toast_completed'), milestoneEl('toast_completed')));
      else if (variables.data.status === 'in_progress' && keys.length === 1) success(t(milestoneEn('toast_reopened'), milestoneEl('toast_reopened')));
      else success(t(milestoneEn('toast_updated'), milestoneEl('toast_updated')));
    },
    onError: () => {
      showError(t(milestoneEn('fail_update'), milestoneEl('fail_update')), t(milestoneEn('try_again'), milestoneEl('try_again')));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteMilestone,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, (old: typeof data) => ({
        ...old,
        milestones: (old?.milestones ?? []).filter((m) => m.id !== id),
      }));
    },
    onSuccess: () => {
      success(t(milestoneEn('toast_deleted'), milestoneEl('toast_deleted')));
    },
    onError: () => {
      showError(t(milestoneEn('fail_delete'), milestoneEl('fail_delete')), t(milestoneEn('try_again'), milestoneEl('try_again')));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk('milestones') }),
  });

  // Both settle with the server, so a status change or a delete run by the
  // assistant is reported only once it is stored - and "no" stays "no".
  const handleStatusChange = useCallback(
    (id: string, status: MilestoneStatus): Promise<PageControlRunResult> =>
      settle(() => updateMut.mutateAsync({ id, data: { status } })),
    [updateMut],
  );

  const handleDelete = useCallback(
    async (id: string): Promise<PageControlRunResult> => {
      if (!(await confirm(deleteConfirmCopy({ en: 'milestone', el: 'οροσήμου' })))) return CANCELLED;
      return settle(() => deleteMut.mutateAsync(id));
    },
    [deleteMut, confirm],
  );

  const statusCounts = (summaryData as { counts?: Record<string, number> } | undefined)?.counts ?? {};
  const statusTabs: Array<{ value: MilestoneStatus | 'all'; labelKey: 'all' | 'status_todo' | 'status_in_progress' | 'status_blocked' | 'status_completed'; count?: number }> = [
    { value: 'all', labelKey: 'all', count: summaryData?.total },
    { value: 'todo', labelKey: 'status_todo', count: statusCounts.todo },
    { value: 'in_progress', labelKey: 'status_in_progress', count: statusCounts.in_progress },
    { value: 'blocked', labelKey: 'status_blocked', count: statusCounts.blocked },
    { value: 'completed', labelKey: 'status_completed', count: statusCounts.completed },
  ];

  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim().length > 0;
  const trackerHasItems = (summaryData?.total ?? 0) > 0 || allMilestones.length > 0;
  const showFilteredEmpty = milestones.length === 0 && (hasActiveFilters || trackerHasItems);

  /*
   * What counts the list and what narrows it.
   *
   * The milestones are the page, and so are the status tabs: those are how
   * you slice the list, not decoration around it. Five tiles counting the
   * same list, a search box with a category filter, and a priority select
   * that shared a row with the tabs and made it wrap - those are not.
   */
  // Offered to the assistant: status, priority, category and layout, through
  // the same setters as the tabs, the rail's select and chips, and the view
  // switch. Creating one is `create_milestone`, a capability of its own.
  usePageControls([
    choiceControl('status_filter', 'Milestone status filter', 'Φίλτρο κατάστασης ορόσημου', statusTabs.map((t) => ({ value: t.value, en: milestoneEn(t.labelKey), el: milestoneEl(t.labelKey) })), statusFilter, (v) => setStatusFilter(v as typeof statusFilter)),
    choiceControl('priority_filter', 'Priority filter', 'Φίλτρο προτεραιότητας', ([['all', 'pri_all'], ['high', 'pri_high'], ['medium', 'pri_medium'], ['low', 'pri_low']] as const).map(([value, key]) => ({ value, en: milestoneEn(key), el: milestoneEl(key) })), priorityFilter, (v) => setPriorityFilter(v as typeof priorityFilter)),
    choiceControl('category_filter', 'Category filter', 'Φίλτρο κατηγορίας', CATEGORY_ORDER.map((cat) => ({ value: cat, en: cat === 'all' ? milestoneEn('all') : milestoneEn(MILESTONE_CATEGORY_KEYS[cat]), el: cat === 'all' ? milestoneEl('all') : milestoneEl(MILESTONE_CATEGORY_KEYS[cat]) })), categoryFilter, setCategoryFilter),
    choiceControl('view', 'Milestone layout', 'Διάταξη ορόσημων', [
      { value: 'list', en: 'List', el: 'Λίστα' },
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
    ], viewMode, (v) => setViewMode(v as 'list' | 'grid')),
    // The row menu's own actions over the rows on screen: set a status
    // (the same update the status menu makes), edit, and delete - which
    // still asks first.
    ...(['todo', 'in_progress', 'blocked', 'completed'] as const).map((status) => {
      const key = STATUS_CONFIG[status].statusKey;
      return {
        id: `mark_${status}`,
        labelEn: `Mark milestone ${milestoneEn(key)}`,
        labelEl: `Σήμανση ορόσημου ως ${milestoneEl(key)}`,
        writes: true,
        options: rowOptions(milestones.filter((m) => m.status !== status), (m) => m.id, (m) => m.title),
        // Between to do, in progress and blocked the update writes `status`
        // alone, so the previous one restores it. Completing also sets
        // progress to 100 and stamps completedAt (milestones.service), which
        // going back does not undo - so no opposite into or out of completed.
        undo: (v?: string) => {
          const prior = milestones.find((m) => m.id === v)?.status;
          return prior && prior !== 'completed' && status !== 'completed' && prior !== status && ['todo', 'in_progress', 'blocked'].includes(prior)
            ? { control: `mark_${prior}`, value: v }
            : undefined;
        },
        run: (v?: string) => (v ? handleStatusChange(v, status) : undefined),
      };
    }),
    {
      id: 'edit_milestone',
      labelEn: 'Edit milestone',
      labelEl: 'Επεξεργασία ορόσημου',
      writes: false,
      options: rowOptions(milestones, (m) => m.id, (m) => m.title),
      run: (v) => { const m = milestones.find((row) => row.id === v); if (m) setEditTarget(m); },
    },
    {
      id: 'delete_milestone',
      labelEn: 'Delete milestone',
      labelEl: 'Διαγραφή ορόσημου',
      writes: true,
      options: rowOptions(milestones, (m) => m.id, (m) => m.title),
      run: (v) => (v ? handleDelete(v) : undefined),
    },
  ]);
  usePageList([
    {
      id: 'milestones',
      labelEn: 'Milestones',
      labelEl: 'Ορόσημα',
      rows: waiting ? undefined : milestones.map((m) => `${m.title} · ${milestoneEn(STATUS_CONFIG[m.status]?.statusKey ?? 'status_todo')} · ${m.priority} priority${m.dueDate ? ` · due ${m.dueDate.slice(0, 10)}` : ''} · ${m.progress}%`),
      total: summaryData?.total,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Summary',
      labelEl: 'Σύνοψη',
      content: (
        <div className="space-y-3">
          {waiting ? (
            <div className="space-y-2 rounded-xl border border-border bg-card/80 px-3 py-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full rounded-md" />
              ))}
              <Skeleton className="mt-3 h-9 w-full rounded-md" />
            </div>
          ) : (
            <SummaryBar summary={summaryData} />
          )}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Narrow the list',
      labelEl: 'Περιορισμός λίστας',
      // Search, category and priority each narrow what is on screen; the
      // reader has to be able to see that without opening the rail.
      badge:
        (searchQuery.trim() ? 1 : 0) +
          (categoryFilter !== 'all' ? 1 : 0) +
          (priorityFilter !== 'all' ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          <div className="relative w-full min-w-0">
            <Search className="icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t(milestoneEn('search_ph'), milestoneEl('search_ph'))}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl pl-8 pr-8 text-sm"
              aria-label={bilingualAria(milestoneEn('search_ph'), milestoneEl('search_ph'))}
            />
            {searchQuery && (
              <button type="button" aria-label={bilingualAria(milestoneEn('clear_search'), milestoneEl('clear_search'))} onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="icon-sm" />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="type-caption font-medium text-muted-foreground">
              <BilingualText en={milestoneEn('field_category')} el={milestoneEl('field_category')} compact />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  aria-pressed={categoryFilter === cat}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                    categoryFilter === cat
                      ? 'border-primary/40 bg-primary/10 text-primary-accessible'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {cat === 'all'
                    ? <BilingualText en={milestoneEn('all')} el={milestoneEl('all')} compact />
                    : <BilingualText en={milestoneEn(MILESTONE_CATEGORY_KEYS[cat])} el={milestoneEl(MILESTONE_CATEGORY_KEYS[cat])} compact />}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="type-caption font-medium text-muted-foreground">
              <BilingualText en={milestoneEn('field_priority')} el={milestoneEl('field_priority')} compact />
            </p>
            {/* Chips like Category above: a native option can only show one language. */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'all', key: 'all' },
                { value: 'high', key: 'pri_high' },
                { value: 'medium', key: 'pri_medium' },
                { value: 'low', key: 'pri_low' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriorityFilter(opt.value)}
                  aria-pressed={priorityFilter === opt.value}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                    priorityFilter === opt.value
                      ? 'border-primary/40 bg-primary/10 text-primary-accessible'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.value !== 'all' && (
                    <span
                      className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[PRIORITY_CONFIG[opt.value].tone])}
                      aria-hidden="true"
                    />
                  )}
                  <BilingualText en={milestoneEn(opt.key)} el={milestoneEl(opt.key)} compact />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="type-caption font-medium text-muted-foreground">
              <BilingualText en={milestoneEn('layout')} el={milestoneEl('layout')} compact />
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-xl border border-border bg-secondary/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn('rounded-xl p-1.5 transition-colors', viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  aria-label={bilingualAria(milestoneEn('view_list'), milestoneEl('view_list'))}
                  aria-pressed={viewMode === 'list'}
                ><LayoutList className="icon-sm" /></button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn('rounded-xl p-1.5 transition-colors', viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  aria-label={bilingualAria(milestoneEn('view_grid'), milestoneEl('view_grid'))}
                  aria-pressed={viewMode === 'grid'}
                ><LayoutGrid className="icon-sm" /></button>
              </div>
              <Button type="button" variant="ghost" size="icon" className={`ml-auto h-8 w-8 ${BUILDER_BTN}`} onClick={() => refetch()} aria-label={bilingualAria(milestoneEn('refresh'), milestoneEl('refresh'))}>
                <RefreshCw className={cn('icon-sm', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder?tab=idea-core', title: 'link_idea' },
            { href: '/builder?tab=pitch-deck', title: 'link_pitch' },
            { href: '/research', title: 'link_research' },
            { href: '/readiness', title: 'link_readiness' },
            { href: '/fundraising', title: 'link_fundraising' },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className="h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={milestoneEn(step.title)} el={milestoneEl(step.title)} wrap />
                </span>
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];
  const harborLive = (unfilteredData?.milestones ?? allMilestones).some(
    (m) => m.title.includes('$750K') || m.id === 'ms-4',
  );
  const askAi = harborLive
    ? 'Propose the next three Harbor milestones from Idea Core, the GTM board, the $750K seed (Athens Tech Angels, $375K committed), and anything overdue.'
    : 'Help me pick the next milestone from Builder, the pitch deck, and what is already overdue.';

  return (
    <AppShell
      rail={rail}
      showHelp
      askAi={askAi}
      contentClassName="builder-copy overflow-x-clip"
      actions={
        <Button type="button" size="sm" className={`gap-1.5 ${BUILDER_BTN}`} onClick={() => setCreateOpen(true)}>
          <Plus className="icon-sm" /> <BilingualText en={milestoneEn('new_milestone')} el={milestoneEl('new_milestone')} compact />
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Status tabs. The priority select and the view toggle shared this
            row and made it wrap; they are in the rail now. Linked pages live
            in the rail too — Ask AI is the header control. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={statusFilter === tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'tap-target-phone inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-primary/10 font-semibold text-primary-accessible'
                    : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <BilingualText en={milestoneEn(tab.labelKey)} el={milestoneEl(tab.labelKey)} compact />
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-2xs',
                    statusFilter === tab.value ? 'bg-primary/10 text-primary-accessible' : 'bg-muted text-muted-foreground',
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
            <CfbGlyph name="target" className="icon-lg text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground"><BilingualText en={milestoneEn('load_fail')} el={milestoneEl('load_fail')} /></p>
            <Button variant="secondary" size="sm" className={BUILDER_BTN} type="button" onClick={() => refetch()}>
              <BilingualText en={milestoneEn('retry')} el={milestoneEl('retry')} compact />
            </Button>
          </div>
        ) : waiting ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <MilestoneSkeleton key={i} />)}
          </div>
        ) : milestones.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
            <CfbGlyph name="flag" className="icon-lg text-muted-foreground/50" />
            <div>
              <p className="page-section font-medium text-foreground">
                {showFilteredEmpty
                  ? <BilingualText en={milestoneEn('empty_filter_title')} el={milestoneEl('empty_filter_title')} />
                  : <BilingualText en={milestoneEn('empty_title')} el={milestoneEl('empty_title')} />}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {showFilteredEmpty
                  ? <BilingualText en={milestoneEn('empty_filter_hint')} el={milestoneEl('empty_filter_hint')} />
                  : <BilingualText en={milestoneEn('empty_hint')} el={milestoneEl('empty_hint')} />}
              </p>
            </div>
            {showFilteredEmpty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`gap-1.5 ${BUILDER_BTN}`}
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
              >
                <BilingualText en={milestoneEn('clear_filters')} el={milestoneEl('clear_filters')} compact />
              </Button>
            ) : (
              <Button type="button" size="sm" className={`gap-1.5 ${BUILDER_BTN}`} onClick={() => setCreateOpen(true)}>
                <Plus className="icon-sm" /> <BilingualText en={milestoneEn('empty_cta')} el={milestoneEl('empty_cta')} compact />
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-3')}>
            {milestones.map((m) => (
              <MilestoneCard
                key={m.id}
                item={m}
                onEdit={setEditTarget}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <MilestoneFormModal
          open
          onClose={() => setCreateOpen(false)}
          onSubmit={(data) => createMut.mutate(data as any)}
          isSubmitting={createMut.isPending}
          error={createMut.error?.message}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <MilestoneFormModal
          open
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => updateMut.mutate({ id: editTarget.id, data: data as any })}
          isSubmitting={updateMut.isPending}
          error={updateMut.error?.message}
        />
      )}
    </AppShell>
  );
}
