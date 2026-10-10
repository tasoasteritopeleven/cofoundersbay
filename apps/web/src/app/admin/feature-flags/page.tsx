'use client';

import { useState } from 'react';
import {
  Zap, Search, Plus, MoreVertical, Percent,
  FlaskConical, CheckCircle2, XCircle, AlertTriangle,
  Edit, Trash2, Copy, RefreshCw, Info,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminListExperiments,
  adminActivateExperiment,
  adminDeactivateExperiment,
  adminUpdateExperiment,
  adminDeleteExperiment,
  adminCreateExperiment,
  type ExperimentRecord,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControl, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { bilingualAria } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';
import { CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';

type FlagStatus = 'enabled' | 'disabled' | 'rollout' | 'experiment';
type FlagTarget = 'all' | 'beta' | 'admins' | 'specific_tenants' | 'percentage';

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: FlagStatus;
  target: FlagTarget;
  rolloutPct?: number;
  affectedUsers?: number;
  category: 'ui' | 'backend' | 'experiment' | 'infra' | 'billing';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

const STATUS_CONFIG: Record<FlagStatus, { label: string; labelEl: string; color: string; icon: React.ElementType }> = {
  enabled:    { label: 'Enabled', labelEl: 'Ενεργή',    color: 'bg-status-success-bg text-status-success border-status-success-border',  icon: CheckCircle2 },
  disabled:   { label: 'Disabled', labelEl: 'Ανενεργή',   color: 'bg-muted text-muted-foreground border-border',     icon: XCircle },
  rollout:    { label: 'Rollout', labelEl: 'Σταδιακή διάθεση',    color: 'bg-status-info-bg text-status-info border-status-info-border',     icon: Percent },
  experiment: { label: 'Experiment', labelEl: 'Πείραμα', color: 'bg-status-accent-bg text-status-accent border-status-accent-border', icon: FlaskConical },
};

const CATEGORY_COLORS: Record<string, string> = {
  ui:         'bg-status-info-bg text-status-info',
  backend:    'bg-status-warning-bg text-status-warning',
  experiment: 'bg-status-accent-bg text-status-accent',
  infra:      'bg-status-danger-bg text-status-danger',
  billing:    'bg-status-success-bg text-status-success',
};

/**
 * The page's own row from an experiment.
 *
 * `/api/admin/experiments` has existed all along with list, activate and
 * deactivate clients, and this screen kept a fixed array in `useState`.
 *
 * An experiment is the platform's only rollout primitive: it carries a key, a
 * split ratio and an active flag, which is what a percentage rollout is. The
 * page's other three categories — ui, backend, infra, billing — have no
 * counterpart, so every real row reads `experiment` rather than being sorted
 * into buckets the model does not have.
 */
function toFeatureFlag(record: ExperimentRecord): FeatureFlag {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: record.description ?? '',
    status: record.active ? (record.splitRatio < 100 ? 'rollout' : 'enabled') : 'disabled',
    target: record.splitRatio < 100 ? 'percentage' : 'all',
    rolloutPct: record.splitRatio,
    affectedUsers: record.assignmentCount,
    category: 'experiment',
    createdAt: record.createdAt,
    updatedAt: record.startedAt ?? record.createdAt,
    // The API returns the creator's id, not their name; showing a raw uuid
    // would read as noise, so the column says what it knows.
    createdBy: record.createdById ? 'Admin' : '\u2014',
  };
}

/** Shown while no experiment is defined. */
const MOCK_FLAGS: FeatureFlag[] = [
  {
    id: '1', key: 'ai_match_v2', name: 'AI Matching v2', description: 'New ML-based co-founder matching algorithm with compatibility scoring.',
    status: 'rollout', target: 'percentage', rolloutPct: 30, affectedUsers: 1420, category: 'backend',
    createdAt: '2025-01-05T09:00:00.000Z', updatedAt: '2025-03-15T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
  {
    id: '2', key: 'investor_data_room', name: 'Investor Data Room', description: 'Secure document sharing room for investor due diligence.',
    status: 'experiment', target: 'beta', affectedUsers: 248, category: 'ui',
    createdAt: '2025-02-12T09:00:00.000Z', updatedAt: '2025-03-20T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
  {
    id: '3', key: 'blockchain_validation', name: 'Blockchain Message Validation', description: 'On-chain validation of key conversation milestones.',
    status: 'experiment', target: 'beta', affectedUsers: 112, category: 'backend',
    createdAt: '2025-02-20T09:00:00.000Z', updatedAt: '2025-03-18T09:00:00.000Z', createdBy: 'ops@cofounderbay.com',
  },
  {
    id: '4', key: 'new_onboarding_flow', name: 'Redesigned Onboarding', description: 'Step-by-step onboarding with role-specific path selection.',
    status: 'enabled', target: 'all', affectedUsers: 4730, category: 'ui',
    createdAt: '2025-01-20T09:00:00.000Z', updatedAt: '2025-02-28T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
  {
    id: '5', key: 'rate_limit_v2', name: 'Enhanced Rate Limiting', description: 'Per-tenant dynamic rate limits with burst allowance.',
    status: 'rollout', target: 'percentage', rolloutPct: 75, affectedUsers: 3550, category: 'infra',
    createdAt: '2025-03-01T09:00:00.000Z', updatedAt: '2025-03-22T09:00:00.000Z', createdBy: 'ops@cofounderbay.com',
  },
  {
    id: '6', key: 'billing_usage_alerts', name: 'Billing Usage Alerts', description: 'Email and in-app alerts when tenant approaches plan limits.',
    status: 'enabled', target: 'all', affectedUsers: 4730, category: 'billing',
    createdAt: '2025-03-10T09:00:00.000Z', updatedAt: '2025-03-10T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
  {
    id: '7', key: 'legacy_search', name: 'Legacy Search Engine', description: 'Old keyword-based search before semantic search rollout.',
    status: 'disabled', target: 'all', affectedUsers: 0, category: 'backend',
    createdAt: '2024-06-01T09:00:00.000Z', updatedAt: '2025-01-15T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
  {
    id: '8', key: 'mentor_video_rooms', name: 'Mentor Video Rooms', description: 'Native video call integration for mentorship sessions.',
    status: 'experiment', target: 'beta', affectedUsers: 87, category: 'ui',
    createdAt: '2025-03-18T09:00:00.000Z', updatedAt: '2025-03-20T09:00:00.000Z', createdBy: 'admin@cofounderbay.com',
  },
];

type FlagActions = {
  onToggle: (id: string, enabled: boolean) => void | Promise<unknown>;
  onEdit: (flag: FeatureFlag, mode: 'details' | 'rollout') => void;
  onCopyKey: (flag: FeatureFlag) => void;
  onDelete: (flag: FeatureFlag) => void;
};

function FlagCard({ flag, onToggle, onEdit, onCopyKey, onDelete }: { flag: FeatureFlag } & FlagActions) {
  const statusCfg = STATUS_CONFIG[flag.status];
  const StatusIcon = statusCfg.icon;
  const isEnabled = flag.status !== 'disabled';

  // The Endorsements card's anatomy: the flag's name over its key and kind,
  // the switch and the menu at the head's right (they stay there on a
  // phone), then the sentence, the rollout and the facts on one left axis.
  return (
    <Card className={cn('transition-all hover:border-primary/20', !isEnabled && 'surface-inactive')}>
      <CardContent className="space-y-3">
        <CardHead
          title={flag.name}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <code key="key" className="font-mono text-xs">{flag.key}</code>,
                <StatusText key="category" value={flag.category} />,
              ]}
            />
          )}
          meta={(
            <Badge variant="outline" className={cn('mt-1 text-xs', statusCfg.color)}>
              <StatusIcon className="mr-1 icon-sm" aria-hidden="true" />
              <BilingualText en={statusCfg.label} el={statusCfg.labelEl} compact />
            </Badge>
          )}
          asideStays
          aside={(
            <>
              <Switch
                checked={isEnabled}
                onCheckedChange={(v) => void onToggle(flag.id, v)}
                aria-label={isEnabled
                  ? bilingualAria(`Disable ${flag.name}`, `Απενεργοποίηση: ${flag.name}`)
                  : bilingualAria(`Enable ${flag.name}`, `Ενεργοποίηση: ${flag.name}`)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="icon-sm" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* None of these four had a handler. The experiments API they
                      map to has PATCH and DELETE (admin.controller.ts). */}
                  <DropdownMenuItem onSelect={() => onEdit(flag, 'details')}><Edit className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Edit Flag" el="Επεξεργασία σημαίας" compact /></DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onEdit(flag, 'rollout')}><Percent className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Set rollout %" el="Ορισμός ποσοστού διάθεσης" compact /></DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onCopyKey(flag)}><Copy className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Copy Key" el="Αντιγραφή κλειδιού" compact /></DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive-accessible" onSelect={() => onDelete(flag)}><Trash2 className="mr-2 icon-sm" aria-hidden="true" /><BilingualText en="Delete" el="Διαγραφή" compact /></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />

        {flag.description ? (
          <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{flag.description}</p>
        ) : null}

        {flag.status === 'rollout' && flag.rolloutPct !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span><BilingualText en="Rollout Progress" el="Πρόοδος διάθεσης" compact /></span>
              <span className="tabular-nums">{flag.rolloutPct}%</span>
            </div>
            <Progress value={flag.rolloutPct} className="h-1.5" aria-label={bilingualAria('Rollout progress', 'Πρόοδος διάθεσης')} />
          </div>
        )}

        <FactLine
          items={[
            <BilingualText
              key="affected"
              en={`${(flag.affectedUsers ?? 0).toLocaleString('en-GB')} affected`}
              el={`${(flag.affectedUsers ?? 0).toLocaleString('el-GR')} επηρεάζονται`}
              compact
            />,
            <span key="updated"><BilingualText en="Updated" el="Ενημερώθηκε" compact /> <RelativeTime date={flag.updatedAt} format={formatRelativeTime} /></span>,
            <BilingualText key="by" en={`By ${flag.createdBy}`} el={`Από ${flag.createdBy}`} compact />,
          ]}
        />
      </CardContent>
    </Card>
  );
}

export default function AdminFeatureFlagsPage() {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const [liveFlags, setFlags] = useState<FeatureFlag[]>([]);
  /** True once real experiments are in hand; the toggles refuse before that. */
  const [isLive, setIsLive] = useState(false);
  // The eight sample flags stood in for an empty experiments table in
  // production as well; they are the showcase's now, and a real platform
  // with no experiments sees the empty state.
  const { showDemoData } = useDemoData();
  const flags = isLive ? liveFlags : showDemoData ? MOCK_FLAGS : [];

  const { data: experiments } = useQuery({
    queryKey: qk('admin', 'experiments'),
    queryFn: adminListExperiments,
    staleTime: 60_000,
    retry: 0,
  });

  useEffect(() => {
    const rows = Array.isArray(experiments) ? experiments : [];
    if (rows.length === 0) return;
    setFlags(rows.map(toFeatureFlag));
    setIsLive(true);
  }, [experiments]);
  const [activeTab, setActiveTab] = useState('all');

  /**
   * Turning a flag on or off wrote to the local array and nothing else — the
   * switch moved and the platform never heard about it. It activates or
   * deactivates the experiment now, and the list refreshes from the server.
   */
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ flag: FeatureFlag; mode: 'details' | 'rollout' } | null>(null);
  const [draft, setDraft] = useState({ name: '', description: '', rollout: 100 });
  const [creating, setCreating] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: '', name: '', description: '', rollout: 100 });

  // "New Flag" had no handler. A flag is an experiment: variant A is "off",
  // variant B is "on", and the rollout is the share that gets B.
  const createFlag = async () => {
    const key = newFlag.key.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_');
    if (!key || !newFlag.name.trim()) return;
    setSaving(true);
    try {
      await adminCreateExperiment({
        key,
        name: newFlag.name.trim(),
        description: newFlag.description.trim() || undefined,
        variantA: { enabled: false },
        variantB: { enabled: true },
        splitRatio: Math.min(100, Math.max(0, Math.round(newFlag.rollout))),
      });
      success('Flag created', `${key} starts inactive - switch it on when ready.`);
      setCreating(false);
      setNewFlag({ key: '', name: '', description: '', rollout: 100 });
    } catch (err) {
      toastError('Could not create the flag', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
      void qc.invalidateQueries({ queryKey: qk('admin', 'experiments') });
    }
  };
  const [saving, setSaving] = useState(false);

  const refuseOnSample = () =>
    toastError('Nothing to change', 'These flags are samples until the experiments API returns rows.');

  const openEdit = (flag: FeatureFlag, mode: 'details' | 'rollout') => {
    if (!isLive) return refuseOnSample();
    setDraft({ name: flag.name, description: flag.description, rollout: flag.rolloutPct ?? 100 });
    setEditing({ flag, mode });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminUpdateExperiment(
        editing.flag.id,
        editing.mode === 'rollout'
          ? { splitRatio: Math.min(100, Math.max(0, Math.round(draft.rollout))) }
          : { name: draft.name.trim(), description: draft.description.trim() },
      );
      success('Flag saved', editing.mode === 'rollout' ? `${editing.flag.key} now rolls out to ${draft.rollout}%.` : `${draft.name} was updated.`);
      setEditing(null);
    } catch (err) {
      toastError('Could not save the flag', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
      void qc.invalidateQueries({ queryKey: qk('admin', 'experiments') });
    }
  };

  const copyKey = async (flag: FeatureFlag) => {
    try {
      await navigator.clipboard.writeText(flag.key);
      success('Key copied', flag.key);
    } catch {
      toastError('Could not copy', 'The browser refused clipboard access.');
    }
  };

  const deleteFlag = async (flag: FeatureFlag): Promise<PageControlRunResult> => {
    if (!isLive) {
      refuseOnSample();
      return { error: 'These flags are samples until the experiments API returns rows.' };
    }
    const ok = await confirm({
      title: <BilingualText en={`Delete ${flag.name}?`} el={`Διαγραφή: ${flag.name};`} />,
      description: <BilingualText en="The experiment and its assignments are removed. Code that reads this key falls back to its default." el="Το πείραμα και οι αναθέσεις του αφαιρούνται. Ο κώδικας που διαβάζει αυτό το κλειδί επιστρέφει στην προεπιλογή." />,
      confirmLabel: <BilingualText en="Delete flag" el="Διαγραφή σημαίας" compact />,
    });
    if (!ok) return CANCELLED;
    try {
      await adminDeleteExperiment(flag.id);
      success('Flag deleted', flag.key);
    } catch (err) {
      toastError('Could not delete the flag', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The flag could not be deleted.' };
    } finally {
      void qc.invalidateQueries({ queryKey: qk('admin', 'experiments') });
    }
  };

  const handleToggle = async (id: string, enabled: boolean): Promise<PageControlRunResult> => {
    if (!isLive) return { error: 'These flags are samples until the experiments API returns rows.' };
    // Optimistic, then reconciled.
    setFlags((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: enabled ? 'enabled' : 'disabled' } : f
      )
    );
    try {
      await (enabled ? adminActivateExperiment(id) : adminDeactivateExperiment(id));
    } catch (err) {
      // The switch used to flip back silently on the refetch; now it says why.
      toastError('Could not change the flag', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The flag could not be changed.' };
    } finally {
      void qc.invalidateQueries({ queryKey: qk('admin', 'experiments') });
    }
  };

  const filtered = flags.filter((f) => {
    const matchesSearch =
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      activeTab === 'all' ||
      activeTab === f.status ||
      activeTab === f.category;
    return matchesSearch && matchesTab;
  });

  // Offered to the assistant: the tabs, New Flag, the switch and every item
  // of the card menu - the same handlers, which refuse the sample flags and
  // still ask before a delete.
  const SAMPLE_EN = isLive ? undefined : 'These flags are samples until the experiments API returns rows.';
  const SAMPLE_EL = isLive ? undefined : 'Οι σημαίες είναι δείγματα μέχρι το API πειραμάτων να επιστρέψει γραμμές.';
  const flagCommand = (id: string, en: string, el: string, writes: boolean, list: FeatureFlag[], run: (f: FeatureFlag) => PageControlRunResult | Promise<PageControlRunResult>, sampleOk = false, opposite?: string): PageControl => ({
    id,
    labelEn: en,
    labelEl: el,
    writes,
    options: rowOptions(list, (f) => f.id, (f) => f.name),
    ...(sampleOk ? {} : { unavailableEn: SAMPLE_EN, unavailableEl: SAMPLE_EL }),
    // activate / deactivate flip the experiment's `active` and stamp the time
    // (experimentation.service); the split and the assignments are untouched,
    // so the other switch restores the flag, with a new start or end time.
    ...(opposite ? { undo: (v?: string) => ({ control: opposite, value: v }) } : {}),
    run: (v) => { const f = flags.find((row) => row.id === v); return f ? run(f) : ROW_GONE; },
  });
  usePageList([
    {
      id: 'flags',
      labelEn: 'Feature flags',
      labelEl: 'Σημαίες λειτουργιών',
      rows: filtered.map((f) => `${f.name} (${f.key}) · ${f.status}${f.rolloutPct != null ? ` · ${f.rolloutPct}% rollout` : ''} · ${f.category}`),
      total: flags.length,
      sample: !isLive,
    },
  ]);
  usePageControls([
    choiceControl('flag_tab', 'Flag filter', 'Φίλτρο σημαιών', [
      { value: 'all', en: 'All', el: 'Όλες' },
      { value: 'enabled', en: 'Enabled', el: 'Ενεργές' },
      { value: 'rollout', en: 'Rollout', el: 'Σταδιακή διάθεση' },
      { value: 'experiment', en: 'Experiments', el: 'Πειράματα' },
      { value: 'disabled', en: 'Disabled', el: 'Ανενεργές' },
    ], activeTab, setActiveTab),
    { id: 'new_flag', labelEn: 'Open the new flag form', labelEl: 'Άνοιγμα φόρμας νέας σημαίας', writes: false, run: () => setCreating(true) },
    flagCommand('enable_flag', 'Turn feature flag on', 'Ενεργοποίηση σημαίας', true, filtered.filter((f) => f.status === 'disabled'), (f) => handleToggle(f.id, true), false, 'disable_flag'),
    flagCommand('disable_flag', 'Turn feature flag off', 'Απενεργοποίηση σημαίας', true, filtered.filter((f) => f.status !== 'disabled'), (f) => handleToggle(f.id, false), false, 'enable_flag'),
    flagCommand('edit_flag', 'Edit feature flag', 'Επεξεργασία σημαίας', false, filtered, (f) => openEdit(f, 'details')),
    flagCommand('set_rollout', 'Set a flag rollout percentage', 'Ορισμός ποσοστού διάθεσης σημαίας', false, filtered, (f) => openEdit(f, 'rollout')),
    flagCommand('copy_flag_key', 'Copy a flag key', 'Αντιγραφή κλειδιού σημαίας', false, filtered, (f) => copyKey(f), true),
    flagCommand('delete_flag', 'Delete feature flag', 'Διαγραφή σημαίας', true, filtered, (f) => deleteFlag(f)),
  ]);

  const stats = {
    enabled:    flags.filter((f) => f.status === 'enabled').length,
    rollout:    flags.filter((f) => f.status === 'rollout').length,
    experiment: flags.filter((f) => f.status === 'experiment').length,
    disabled:   flags.filter((f) => f.status === 'disabled').length,
  };

  return (
    <AppShell
      title="Feature Flags"
      titleEl="Σημαίες λειτουργιών"
      description="Control feature rollouts, experiments, and gradual deployments"
      descriptionEl="Ελέγξτε τη διάθεση λειτουργιών, τα πειράματα και τις σταδιακές αναπτύξεις"
      actions={
        <div className="flex flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="About feature flags" variant="outline" size="sm">
                  <Info className="icon-sm" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  Each flag is an experiment: the switch activates it, the rollout is its split ratio, and every
                  change is saved through the experiments API. Sample flags show until the API returns rows.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 icon-sm" aria-hidden="true" />
            <BilingualText en="New Flag" el="Νέα σημαία" compact />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Enabled', labelEl: 'Ενεργές', value: stats.enabled, icon: CheckCircle2, color: 'text-status-success' },
            { label: 'In Rollout', labelEl: 'Σε σταδιακή διάθεση', value: stats.rollout, icon: Percent, color: 'text-status-info' },
            { label: 'Experiments', labelEl: 'Πειράματα', value: stats.experiment, icon: FlaskConical, color: 'text-status-accent' },
            { label: 'Disabled', labelEl: 'Ανενεργές', value: stats.disabled, icon: XCircle, color: 'text-muted-foreground' },
          ].map(({ label, labelEl, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-secondary">
                  <Icon className={cn('icon-sm', color)} />
                </div>
                <div>
                  <p className="page-stat font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label={bilingualAria("Search flags by name or key", "Αναζήτηση σημαιών με όνομα ή κλειδί")}
            placeholder={bilingualInline("Search flags by name or key…", "Αναζήτηση σημαιών με όνομα ή κλειδί…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all"><BilingualText en={`All (${flags.length})`} el={`Όλες (${flags.length})`} compact /></TabsTrigger>
            <TabsTrigger value="enabled"><BilingualText en="Enabled" el="Ενεργές" compact /></TabsTrigger>
            <TabsTrigger value="rollout"><BilingualText en="Rollout" el="Σταδιακή διάθεση" compact /></TabsTrigger>
            <TabsTrigger value="experiment"><BilingualText en="Experiments" el="Πειράματα" compact /></TabsTrigger>
            <TabsTrigger value="disabled"><BilingualText en="Disabled" el="Ανενεργές" compact /></TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                  <p className="font-medium"><BilingualText en="No flags found" el="Δεν βρέθηκαν σημαίες" compact /></p>
                  <p className="text-sm text-muted-foreground mt-1"><BilingualText en="Try adjusting your search" el="Δοκιμάστε άλλη αναζήτηση" compact /></p>
                </CardContent>
              </Card>
            ) : (
              filtered.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  onCopyKey={copyKey}
                  onDelete={deleteFlag}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.mode === 'rollout' ? 'Set rollout' : 'Edit flag'}</DialogTitle>
            <DialogDescription>
              {editing?.mode === 'rollout'
                ? 'The share of users who get variant B. 100% is fully on; the switch still turns the flag off entirely.'
                : 'Saved to the experiment. The key is fixed, because code reads it.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}
          >
            {editing?.mode === 'rollout' ? (
              <div className="space-y-1.5">
                <Label htmlFor="flag-rollout"><BilingualText en="Rollout (%)" el="Διάθεση (%)" compact /></Label>
                <Input
                  id="flag-rollout"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.rollout}
                  onChange={(e) => setDraft((d) => ({ ...d, rollout: Number(e.target.value) }))}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="flag-name"><BilingualText en="Name" el="Όνομα" compact /></Label>
                  <Input id="flag-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="flag-description"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
                  <Input id="flag-description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
              <Button type="submit" disabled={saving || (editing?.mode === 'details' && !draft.name.trim())}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><BilingualText en="New flag" el="Νέα σημαία" compact /></DialogTitle>
            <DialogDescription><BilingualText en="Created inactive. The key is what code reads, so it cannot change later." el="Δημιουργείται ανενεργή. Το κλειδί είναι αυτό που διαβάζει ο κώδικας, οπότε δεν αλλάζει αργότερα." wrap /></DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void createFlag(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="new-flag-key"><BilingualText en="Key" el="Κλειδί" compact /></Label>
              <Input id="new-flag-key" value={newFlag.key} onChange={(e) => setNewFlag((f) => ({ ...f, key: e.target.value }))} placeholder="e.g. new_onboarding" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-flag-name"><BilingualText en="Name" el="Όνομα" compact /></Label>
              <Input id="new-flag-name" value={newFlag.name} onChange={(e) => setNewFlag((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-flag-description"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
              <Input id="new-flag-description" value={newFlag.description} onChange={(e) => setNewFlag((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-flag-rollout"><BilingualText en="Rollout (%)" el="Διάθεση (%)" compact /></Label>
              <Input id="new-flag-rollout" type="number" min={0} max={100} value={newFlag.rollout} onChange={(e) => setNewFlag((f) => ({ ...f, rollout: Number(e.target.value) }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
              <Button type="submit" disabled={saving || !newFlag.key.trim() || !newFlag.name.trim()}>{saving ? 'Creating…' : 'Create flag'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
