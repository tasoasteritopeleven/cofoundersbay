'use client';

import { StatusText, statusEl } from '@/components/common/StatusText';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAutomationRules,
  listAutomationExecutions,
  setAutomationRuleStatus,
  deleteAutomationRule,
  triggerAutomationRule,
  getAutomationExecutionLogs,
  createAutomationRule,
  updateAutomationRule,
  type AutomationRuleItem,
  type AutomationExecutionItem,
  type AutomationLogItem,
} from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { qk } from '@/lib/query-keys';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import {
  Zap, Play, Pause, Trash2, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, Clock, SkipForward, AlertTriangle,
  Activity, Settings, Layers, ListChecks, Plus, X, Pencil,
} from 'lucide-react';
import { bilingualAria } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

import { pressableProps } from '@/lib/pressable';
const TRIGGER_TYPES = [
  'user_signup','onboarding_incomplete','profile_incomplete','match_generated','match_not_viewed',
  'connection_request_sent','connection_not_answered','connection_accepted',
  'mentor_request_submitted','mentor_request_accepted','mentor_session_idle',
  'community_join','community_inactive','content_reported_threshold',
  'tenant_setup_incomplete','subscription_trial_ending','subscription_failed_payment',
  'subscription_canceled','subscription_seat_limit','user_inactive','scheduled','manual',
] as const;

const ACTION_TYPES = [
  'send_in_app_notification','send_email','generate_matches',
  'flag_for_admin_review','send_admin_alert','update_user_field',
  'webhook_call','trigger_another_rule','log_event',
] as const;

function CreateRuleSlideOver({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(open, onClose);
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState(TRIGGER_TYPES[0] as string);
  const [actionType, setActionType] = useState(ACTION_TYPES[0] as string);
  const [actionParamsRaw, setActionParamsRaw] = useState('{"title":"Notification","body":"Message body"}');
  const [delaySeconds, setDelaySeconds] = useState('0');
  const [priority, setPriority] = useState('100');
  const [paramsError, setParamsError] = useState('');

  const create = useMutation({
    mutationFn: () => {
      let params: Record<string, unknown>;
      try { params = JSON.parse(actionParamsRaw); } catch { throw new Error('Action params must be valid JSON'); }
      return createAutomationRule({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        actionDef: { type: actionType, params },
        delaySeconds: parseInt(delaySeconds, 10) || 0,
        priority: parseInt(priority, 10) || 100,
      });
    },
    onSuccess: () => {
      success('Rule created');
      onCreated();
      onClose();
      setName(''); setDescription(''); setActionParamsRaw('{"title":"Notification","body":"Message body"}');
    },
    onError: (e: Error) => toastError(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* A slide-over is a dialog: `useModalA11y` gives it the semantics, the
          focus move, the Tab trap, Escape and the scroll lock it had none of. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="automation-rule-title"
        tabIndex={-1}
        className="w-full max-w-lg bg-background shadow-modal flex flex-col overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h2 id="automation-rule-title" className="text-lg font-semibold"><BilingualText en="Create Automation Rule" el="Δημιουργία κανόνα αυτοματισμού" compact /></h2>
          <button type="button" aria-label={bilingualAria('Close dialog', 'Κλείσιμο παραθύρου')} onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-ring sm:h-9 sm:w-9"><X className="icon-sm" aria-hidden="true" /></button>
        </div>
        <div className="p-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label htmlFor="auto-a-ruleName" className="text-sm font-medium">Rule Name *</label>
            <Input id="auto-a-ruleName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome New User" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-a-description" className="text-sm font-medium"><BilingualText en="Description" el="Περιγραφή" compact /></label>
            <Input id="auto-a-description" value={description} onChange={e => setDescription(e.target.value)} placeholder={bilingualInline("What does this rule do?", "Τι κάνει αυτός ο κανόνας;")} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f1" className="text-sm font-medium"><BilingualText en="Trigger" el="Έναυσμα" compact /></label>
            <select id="auto-f1"
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
            >
              {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f2" className="text-sm font-medium"><BilingualText en="Action Type" el="Τύπος ενέργειας" compact /></label>
            <select id="auto-f2"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
            >
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f3" className="text-sm font-medium"><BilingualText en="Action Params (JSON)" el="Παράμετροι ενέργειας (JSON)" compact /></label>
            <textarea id="auto-f3"
              value={actionParamsRaw}
              onChange={e => { setActionParamsRaw(e.target.value); setParamsError(''); }}
              rows={5}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none resize-none"
              placeholder='{"title": "Hello", "body": "Message"}'
            />
            {paramsError && <p className="text-xs text-destructive-accessible">{paramsError}</p>}
            <p className="text-xs text-muted-foreground">
              Keys depend on action type: <code>title</code>/<code>body</code> for notifications, <code>subject</code>/<code>bodyHtml</code> for emails, <code>url</code>/<code>method</code> for webhooks.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="auto-f4" className="text-sm font-medium"><BilingualText en="Delay (seconds)" el="Καθυστέρηση (δευτερόλεπτα)" compact /></label>
              <Input id="auto-f4" type="number" min="0" value={delaySeconds} onChange={e => setDelaySeconds(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auto-f5" className="text-sm font-medium"><BilingualText en="Priority (lower = first)" el="Προτεραιότητα (μικρότερη = πρώτα)" compact /></label>
              <Input id="auto-f5" type="number" min="1" value={priority} onChange={e => setPriority(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending ? 'Creating…' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditRuleSlideOver({ rule, onClose, onSaved }: { rule: AutomationRuleItem; onClose: () => void; onSaved: () => void }) {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description ?? '');
  const [triggerType, setTriggerType] = useState(rule.triggerType);
  const [actionType, setActionType] = useState((rule.actionDef as any)?.type ?? ACTION_TYPES[0]);
  const [actionParamsRaw, setActionParamsRaw] = useState(JSON.stringify((rule.actionDef as any)?.params ?? {}, null, 2));
  const [delaySeconds, setDelaySeconds] = useState(String(rule.delaySeconds ?? 0));
  const [priority, setPriority] = useState(String(rule.priority ?? 100));

  const save = useMutation({
    mutationFn: () => {
      let params: Record<string, unknown>;
      try { params = JSON.parse(actionParamsRaw); } catch { throw new Error('Action params must be valid JSON'); }
      return updateAutomationRule(rule.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        actionDef: { type: actionType, params },
        delaySeconds: parseInt(delaySeconds, 10) || 0,
        priority: parseInt(priority, 10) || 100,
      });
    },
    onSuccess: () => { success('Rule updated'); onSaved(); onClose(); },
    onError: (e: Error) => toastError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-background shadow-modal flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold"><BilingualText en="Edit Rule" el="Επεξεργασία κανόνα" compact /></h2>
          <button type="button" aria-label={bilingualAria('Close dialog', 'Κλείσιμο παραθύρου')} onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-ring sm:h-9 sm:w-9"><X className="icon-sm" aria-hidden="true" /></button>
        </div>
        <div className="p-5 space-y-4 flex-1">
          <div className="space-y-1.5">
            <label htmlFor="auto-a-ruleName" className="text-sm font-medium">Rule Name *</label>
            <Input id="auto-a-ruleName" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-a-description" className="text-sm font-medium"><BilingualText en="Description" el="Περιγραφή" compact /></label>
            <Input id="auto-a-description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f6" className="text-sm font-medium"><BilingualText en="Trigger" el="Έναυσμα" compact /></label>
            <select id="auto-f6"
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
            >
              {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f7" className="text-sm font-medium"><BilingualText en="Action Type" el="Τύπος ενέργειας" compact /></label>
            <select id="auto-f7"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
            >
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auto-f8" className="text-sm font-medium"><BilingualText en="Action Params (JSON)" el="Παράμετροι ενέργειας (JSON)" compact /></label>
            <textarea id="auto-f8"
              value={actionParamsRaw}
              onChange={e => setActionParamsRaw(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="auto-f9" className="text-sm font-medium"><BilingualText en="Delay (seconds)" el="Καθυστέρηση (δευτερόλεπτα)" compact /></label>
              <Input id="auto-f9" type="number" min="0" value={delaySeconds} onChange={e => setDelaySeconds(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auto-a-priority" className="text-sm font-medium"><BilingualText en="Priority" el="Προτεραιότητα" compact /></label>
              <Input id="auto-a-priority" type="number" min="1" value={priority} onChange={e => setPriority(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TRIGGER_LABELS: Record<string, string> = {
  user_signup: 'User Signup',
  onboarding_incomplete: 'Onboarding Incomplete',
  profile_incomplete: 'Profile Incomplete',
  match_generated: 'Match Generated',
  match_not_viewed: 'Match Not Viewed',
  connection_request_sent: 'Connection Sent',
  connection_not_answered: 'Connection Unanswered',
  connection_accepted: 'Connection Accepted',
  mentor_request_submitted: 'Mentor Request',
  mentor_request_accepted: 'Mentor Accepted',
  mentor_session_idle: 'Mentor Session Idle',
  community_join: 'Community Join',
  community_inactive: 'Community Inactive',
  content_reported_threshold: 'Report Threshold',
  tenant_setup_incomplete: 'Tenant Setup Incomplete',
  subscription_trial_ending: 'Trial Ending',
  subscription_failed_payment: 'Failed Payment',
  subscription_canceled: 'Subscription Canceled',
  user_inactive: 'User Inactive',
  scheduled: 'Scheduled',
  manual: 'Manual',
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-status-success-bg text-status-success ',
    paused: 'bg-status-warning-bg text-status-warning ',
    draft: 'bg-muted text-muted-foreground',
    archived: 'bg-muted text-muted-foreground line-through',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      <StatusText value={status} />
    </span>
  );
}

function execStatusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 className="icon-sm text-status-success" />;
  if (status === 'failed') return <XCircle className="icon-sm text-destructive-accessible" />;
  if (status === 'running') return <RefreshCw className="icon-sm text-status-info animate-spin" />;
  if (status === 'skipped') return <SkipForward className="icon-sm text-muted-foreground" />;
  return <Clock className="icon-sm text-muted-foreground" />;
}

function LogPanel({ executionId }: { executionId: string }) {
  const { data: logs = [], isLoading } = useQuery<AutomationLogItem[]>({
    queryKey: qk('automation', 'logs', executionId),
    queryFn: () => getAutomationExecutionLogs(executionId),
    enabled: !!executionId,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground animate-pulse"><BilingualText en="Loading logs…" el="Φόρτωση αρχείου…" compact /></p>;

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
      {logs.length === 0 && <p className="text-muted-foreground"><BilingualText en="No logs" el="Δεν υπάρχουν εγγραφές" compact /></p>}
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-2">
          {log.level === 'error' && <AlertTriangle className="icon-sm text-destructive-accessible mt-0.5 shrink-0" />}
          {log.level === 'warn' && <AlertTriangle className="icon-sm text-status-warning mt-0.5 shrink-0" />}
          {log.level === 'info' && <CheckCircle2 className="icon-sm text-status-success mt-0.5 shrink-0" />}
          <span className={log.level === 'error' ? 'text-destructive-accessible' : log.level === 'warn' ? 'text-status-warning' : 'text-muted-foreground'}>
            [{new Date(log.createdAt).toLocaleTimeString()}] {log.message}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const fmtDate = useDateFormat();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const { apiAvailable, pollInterval } = usePollingGuards();
  const [activeTab, setActiveTab] = useState<'rules' | 'executions'>('rules');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRuleItem | null>(null);

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: qk('automation', 'rules'),
    queryFn: () => listAutomationRules({ limit: 100 }),
  });

  const { data: executions = [], isLoading: execLoading } = useQuery<AutomationExecutionItem[]>({
    queryKey: qk('automation', 'executions'),
    queryFn: () => listAutomationExecutions({ limit: 50 }),
    enabled: activeTab === 'executions' && apiAvailable,
    refetchInterval: pollInterval(10_000),
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' | 'archived' }) =>
      setAutomationRuleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('automation', 'rules') });
      success('Rule status updated');
    },
    onError: () => showError('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomationRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('automation', 'rules') });
      success('Rule deleted');
    },
    onError: () => showError('Failed to delete rule'),
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => triggerAutomationRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('automation', 'executions') });
      success('Rule triggered manually');
    },
    onError: () => showError('Failed to trigger rule'),
  });

  const rules = rulesData?.rules ?? [];
  const total = rulesData?.total ?? 0;
  const activeCount = rules.filter(r => r.status === 'active').length;
  const failureCount = rules.filter(r => r.failureCount > 0).length;

  // Offered to the assistant: the tab, New Rule, and each rule's own
  // buttons - edit, run now, pause, activate, delete (which still asks).
  const ruleRows = (list: AutomationRuleItem[]) => rowOptions(list, (r) => r.id, (r) => r.name);
  const ruleById = (id?: string) => rules.find((r) => r.id === id);
  // One handler for the row button and the assistant, so both ask the same
  // question and both report the same answer - including "no".
  const deleteRule = async (rule: AutomationRuleItem): Promise<PageControlRunResult> => {
    if (!(await confirm(deleteConfirmCopy({ en: 'automation rule', el: 'κανόνα αυτοματισμού' }, rule.name)))) return CANCELLED;
    return settle(() => deleteMutation.mutateAsync(rule.id));
  };
  usePageList([
    {
      id: 'rules',
      labelEn: 'Automation rules',
      labelEl: 'Κανόνες αυτοματισμού',
      rows: rulesLoading ? undefined : rules.map((r) => `${r.name} · ${r.status} · on ${r.triggerType}${r.failureCount ? ` · ${r.failureCount} failures` : ''}`),
      total,
    },
  ]);
  usePageControls([
    choiceControl('automation_tab', 'Automation view', 'Προβολή αυτοματισμών', [
      { value: 'rules', en: 'Rules', el: 'Κανόνες' },
      { value: 'executions', en: 'Executions', el: 'Εκτελέσεις' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    { id: 'new_rule', labelEn: 'Open the new rule form', labelEl: 'Άνοιγμα φόρμας νέου κανόνα', writes: false, run: () => setShowCreate(true) },
    { id: 'edit_rule', labelEn: 'Edit automation rule', labelEl: 'Επεξεργασία κανόνα', writes: false, options: ruleRows(rules), run: (v) => { const r = ruleById(v); if (r) setEditRule(r); } },
    { id: 'trigger_rule', labelEn: 'Run automation rule now', labelEl: 'Εκτέλεση κανόνα τώρα', writes: true, options: ruleRows(rules.filter((r) => r.status === 'active')), run: async (v) => { if (v) await triggerMutation.mutateAsync(v); } },
    // setRuleStatus writes `status` and nothing else (automation.service), so
    // pausing an active rule is undone by activating it, and the reverse.
    { id: 'pause_rule', labelEn: 'Pause automation rule', labelEl: 'Παύση κανόνα', writes: true, options: ruleRows(rules.filter((r) => r.status === 'active')), undo: (v) => ({ control: 'activate_rule', value: v }), run: async (v) => { if (v) await setStatusMutation.mutateAsync({ id: v, status: 'paused' }); } },
    { id: 'activate_rule', labelEn: 'Activate automation rule', labelEl: 'Ενεργοποίηση κανόνα', writes: true, options: ruleRows(rules.filter((r) => r.status !== 'active')), undo: (v) => (ruleById(v)?.status === 'paused' ? { control: 'pause_rule', value: v } : undefined), run: async (v) => { if (v) await setStatusMutation.mutateAsync({ id: v, status: 'active' }); } },
    { id: 'delete_rule', labelEn: 'Delete automation rule', labelEl: 'Διαγραφή κανόνα', writes: true, options: ruleRows(rules), run: (v) => { const r = ruleById(v); return r ? deleteRule(r) : ROW_GONE; } },
  ]);

  return (
    <AppShell
      actions={
        <>
          <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="icon-sm" /><BilingualText en="New Rule" el="Νέος κανόνας" compact />
          </Button>
        </>
      }
    >
      <div className="max-w-[84rem] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <CreateRuleSlideOver
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: qk('automation', 'rules') })}
        />
        {editRule && (
          <EditRuleSlideOver
            rule={editRule}
            onClose={() => setEditRule(null)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: qk('automation', 'rules') })}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: ListChecks, label: 'Total Rules', labelEl: 'Σύνολο κανόνων', value: total, color: 'text-foreground' },
            { icon: Zap, label: 'Active', labelEl: 'Ενεργοί', value: activeCount, color: 'text-status-success' },
            { icon: Activity, label: 'Executions (recent)', labelEl: 'Εκτελέσεις (πρόσφατες)', value: executions.length, color: 'text-status-info' },
            { icon: AlertTriangle, label: 'Rules with Failures', labelEl: 'Κανόνες με αποτυχίες', value: failureCount, color: 'text-status-warning' },
          ].map(stat => (
            <Card key={stat.label} className="p-4 flex items-center gap-3">
              <stat.icon className={`icon-md ${stat.color}`} />
              <div>
                <p className="text-xs text-muted-foreground"><BilingualText en={stat.label} el={stat.labelEl} compact wrap /></p>
                <p className="page-stat text-xl font-bold">{stat.value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-border gap-1">
          {(['rules', 'executions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary-accessible'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'rules' ? <BilingualText en="Rules" el="Κανόνες" compact /> : <BilingualText en="Execution Log" el="Αρχείο εκτελέσεων" compact />}
            </button>
          ))}
        </div>

        {/* Rules tab */}
        {activeTab === 'rules' && (
          <div className="space-y-3">
            {rulesLoading && <p className="text-muted-foreground text-sm animate-pulse"><BilingualText en="Loading rules…" el="Φόρτωση κανόνων…" compact /></p>}
            {!rulesLoading && rules.length === 0 && (
              <Card>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm"><BilingualText en="No automation rules defined yet." el="Δεν έχουν οριστεί κανόνες αυτοματισμού ακόμα." compact wrap /></p>
                  <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
                    <Plus className="icon-sm" /><BilingualText en="New Rule" el="Νέος κανόνας" compact />
                  </Button>
                </CardContent>
              </Card>
            )}
            {rules.map(rule => (
              // The Endorsements card's anatomy: the rule's name over its
              // trigger, its state at the right, the sentence and the facts
              // on one axis, the actions in the foot.
              <Card key={rule.id} className="transition-all hover:border-primary/20">
                <CardContent className="space-y-3">
                  <CardHead
                    title={rule.name}
                    subtitle={(
                      <FactLine
                        className="text-sm"
                        items={[
                          TRIGGER_LABELS[rule.triggerType]
                            ? <BilingualText key="trigger" en={TRIGGER_LABELS[rule.triggerType]} el={statusEl(rule.triggerType) ?? TRIGGER_LABELS[rule.triggerType]} compact />
                            : <StatusText key="trigger" value={rule.triggerType} />,
                          rule.tenantId ? <BilingualText key="tenant" en="Tenant" el="Οργανισμός" compact /> : null,
                        ]}
                      />
                    )}
                    aside={statusBadge(rule.status)}
                  />
                  {rule.description && (
                    <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{rule.description}</p>
                  )}
                  <FactLine
                    items={[
                      <BilingualText key="priority" en={`Priority ${rule.priority}`} el={`Προτεραιότητα ${rule.priority}`} compact />,
                      <BilingualText key="runs" en={`Runs ${rule.executionCount}`} el={`Εκτελέσεις ${rule.executionCount}`} compact />,
                      rule.failureCount > 0 ? (
                        <span key="fail" className="font-medium text-status-warning">
                          <BilingualText en={`${rule.failureCount} failures`} el={`${rule.failureCount} αποτυχίες`} compact />
                        </span>
                      ) : null,
                      rule.lastRunAt ? (
                        <BilingualText
                          key="last"
                          en={`Last run ${fmtDate(rule.lastRunAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          el={`Τελευταία εκτέλεση ${fmtDate(rule.lastRunAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          compact
                        />
                      ) : null,
                      rule.delaySeconds > 0 ? <BilingualText key="delay" en={`Delay ${rule.delaySeconds}s`} el={`Καθυστέρηση ${rule.delaySeconds}s`} compact /> : null,
                    ]}
                  />
                  <CardFoot>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit rule"
                      aria-label={`Edit rule ${rule.name}`}
                      onClick={() => setEditRule(rule)}
                    >
                      <Pencil className="icon-sm" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Manual trigger"
                      aria-label={`Manually trigger ${rule.name}`}
                      onClick={() => triggerMutation.mutate(rule.id)}
                      disabled={triggerMutation.isPending}
                    >
                      <Play className="icon-sm" />
                    </Button>
                    {rule.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Pause"
                        aria-label={`Pause ${rule.name}`}
                        onClick={() => setStatusMutation.mutate({ id: rule.id, status: 'paused' })}
                      >
                        <Pause className="icon-sm" />
                      </Button>
                    ) : rule.status === 'paused' || rule.status === 'draft' ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Activate"
                        aria-label={`Activate ${rule.name}`}
                        onClick={() => setStatusMutation.mutate({ id: rule.id, status: 'active' })}
                      >
                        <Zap className="icon-sm text-status-success" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive-accessible hover:text-destructive-accessible"
                      title="Delete"
                      aria-label={`Delete ${rule.name}`}
                      onClick={async () => {
                        await deleteRule(rule);
                      }}
                    >
                      <Trash2 className="icon-sm" />
                    </Button>
                  </CardFoot>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Executions tab */}
        {activeTab === 'executions' && (
          <div className="space-y-2">
            {execLoading && <p className="text-muted-foreground text-sm animate-pulse"><BilingualText en="Loading executions…" el="Φόρτωση εκτελέσεων…" compact /></p>}
            {!execLoading && executions.length === 0 && (
              <Card>
                <CardContent>
                  <p className="text-muted-foreground text-sm"><BilingualText en="No executions yet." el="Δεν υπάρχουν εκτελέσεις ακόμα." compact wrap /></p>
                </CardContent>
              </Card>
            )}
            {executions.map(exec => (
              // An execution's card: its outcome's mark, the run over the
              // rule, the state and the time, the logs opening under a
              // hairline on the mark's edge. Only the head toggles them.
              <Card key={exec.id} className="transition-colors hover:border-primary/20">
                <CardContent className="space-y-3">
                  <div
                    className="cursor-pointer"
                    onClick={() => setSelectedExecution(selectedExecution === exec.id ? null : exec.id)}
                    {...pressableProps({ expanded: selectedExecution === exec.id })}
                  >
                    <CardHead
                      titleAs="p"
                      mark={(
                        <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                          {execStatusIcon(exec.status)}
                        </div>
                      )}
                      title={<span className="font-mono" translate="no">{exec.id.slice(0, 8)}…</span>}
                      subtitle={(
                        <FactLine
                          className="text-sm"
                          items={[
                            <StatusText key="status" value={exec.status} />,
                            <BilingualText key="rule" en={`Rule ${exec.ruleId.slice(0, 8)}…`} el={`Κανόνας ${exec.ruleId.slice(0, 8)}…`} compact />,
                            exec.targetUserId ? <BilingualText key="user" en={`User ${exec.targetUserId.slice(0, 6)}`} el={`Χρήστης ${exec.targetUserId.slice(0, 6)}`} compact /> : null,
                          ]}
                        />
                      )}
                      meta={(
                        <FactLine
                          items={[
                            fmtDate(exec.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                            <BilingualText key="logs" en={`${exec._count?.logs ?? 0} logs`} el={`${exec._count?.logs ?? 0} εγγραφές`} compact />,
                          ]}
                        />
                      )}
                      asideStays
                      aside={<ChevronRight className={`icon-sm text-muted-foreground transition-transform ${selectedExecution === exec.id ? 'rotate-90' : ''}`} aria-hidden="true" />}
                    />
                  </div>
                  {selectedExecution === exec.id && (
                    <div className="space-y-2 border-t border-border pt-3">
                      {exec.errorMessage && (
                        <p className="text-xs text-destructive-accessible font-mono">{exec.errorMessage}</p>
                      )}
                      <LogPanel executionId={exec.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
