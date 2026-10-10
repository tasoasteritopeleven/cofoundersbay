'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAutomationRules,
  setAutomationRuleStatus,
  triggerAutomationRule,
  deleteAutomationRule,
  getTenantAutomationConfig,
  upsertTenantAutomationConfig,
  type AutomationRuleItem,
  type TenantAutomationConfigItem,
} from '@/lib/api';
import { useTenant } from '@/components/providers/TenantContext';
import { useToast } from '@/components/ui/toast';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Zap, Play, Pause, Trash2,
  Settings, Bell, Users, GitMerge, CreditCard, RefreshCw,
} from 'lucide-react';
import { EmptyTenantAutomations } from '@/components/common/EmptyStates';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { EmptyState } from '@/components/common/EmptyState';
import Link from 'next/link';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';

const TRIGGER_LABELS: Record<string, { en: string; el: string }> = {
  user_signup: { en: 'User Signup', el: 'Εγγραφή χρήστη' },
  onboarding_incomplete: { en: 'Onboarding Incomplete', el: 'Ημιτελής ένταξη' },
  profile_incomplete: { en: 'Profile Incomplete', el: 'Ημιτελές προφίλ' },
  match_generated: { en: 'Match Generated', el: 'Νέα αντιστοίχιση' },
  match_not_viewed: { en: 'Match Not Viewed', el: 'Αντιστοίχιση χωρίς προβολή' },
  connection_request_sent: { en: 'Connection Sent', el: 'Αίτημα σύνδεσης εστάλη' },
  connection_not_answered: { en: 'Connection Unanswered', el: 'Αίτημα σύνδεσης χωρίς απάντηση' },
  connection_accepted: { en: 'Connection Accepted', el: 'Σύνδεση έγινε δεκτή' },
  mentor_request_submitted: { en: 'Mentor Request', el: 'Αίτημα καθοδήγησης' },
  mentor_request_accepted: { en: 'Mentor Accepted', el: 'Ο μέντορας αποδέχτηκε' },
  mentor_session_idle: { en: 'Mentor Session Idle', el: 'Αδρανής συνεδρία καθοδήγησης' },
  community_join: { en: 'Community Join', el: 'Είσοδος σε κοινότητα' },
  community_inactive: { en: 'Community Inactive', el: 'Αδρανής κοινότητα' },
  content_reported_threshold: { en: 'Report Threshold', el: 'Όριο αναφορών' },
  tenant_setup_incomplete: { en: 'Tenant Setup Incomplete', el: 'Ημιτελής ρύθμιση οργανισμού' },
  subscription_trial_ending: { en: 'Trial Ending', el: 'Λήξη δοκιμής' },
  subscription_failed_payment: { en: 'Failed Payment', el: 'Αποτυχημένη πληρωμή' },
  subscription_canceled: { en: 'Subscription Canceled', el: 'Ακύρωση συνδρομής' },
  user_inactive: { en: 'User Inactive', el: 'Αδρανής χρήστης' },
  scheduled: { en: 'Scheduled', el: 'Προγραμματισμένο' },
  manual: { en: 'Manual', el: 'Χειροκίνητο' },
};

const TRIGGER_CATEGORY: Record<string, { label: string; labelEl: string; color: string }> = {
  user_signup: { label: 'Onboarding', labelEl: 'Ένταξη', color: 'bg-status-info-bg text-status-info' },
  onboarding_incomplete: { label: 'Onboarding', labelEl: 'Ένταξη', color: 'bg-status-info-bg text-status-info' },
  profile_incomplete: { label: 'Onboarding', labelEl: 'Ένταξη', color: 'bg-status-info-bg text-status-info' },
  connection_not_answered: { label: 'Matching', labelEl: 'Αντιστοιχίσεις', color: 'bg-status-accent-bg text-status-accent' },
  connection_accepted: { label: 'Matching', labelEl: 'Αντιστοιχίσεις', color: 'bg-status-accent-bg text-status-accent' },
  match_not_viewed: { label: 'Matching', labelEl: 'Αντιστοιχίσεις', color: 'bg-status-accent-bg text-status-accent' },
  match_generated: { label: 'Matching', labelEl: 'Αντιστοιχίσεις', color: 'bg-status-accent-bg text-status-accent' },
  mentor_request_submitted: { label: 'Mentorship', labelEl: 'Καθοδήγηση', color: 'bg-status-success-bg text-status-success' },
  mentor_request_accepted: { label: 'Mentorship', labelEl: 'Καθοδήγηση', color: 'bg-status-success-bg text-status-success' },
  mentor_session_idle: { label: 'Mentorship', labelEl: 'Καθοδήγηση', color: 'bg-status-success-bg text-status-success' },
  community_join: { label: 'Community', labelEl: 'Κοινότητα', color: 'bg-status-success-bg text-status-success' },
  community_inactive: { label: 'Community', labelEl: 'Κοινότητα', color: 'bg-status-success-bg text-status-success' },
  subscription_trial_ending: { label: 'Billing', labelEl: 'Χρεώσεις', color: 'bg-status-warning-bg text-status-warning' },
  subscription_failed_payment: { label: 'Billing', labelEl: 'Χρεώσεις', color: 'bg-status-warning-bg text-status-warning' },
  subscription_canceled: { label: 'Billing', labelEl: 'Χρεώσεις', color: 'bg-status-warning-bg text-status-warning' },
  user_inactive: { label: 'Engagement', labelEl: 'Συμμετοχή', color: 'bg-status-danger-bg text-status-danger' },
  content_reported_threshold: { label: 'Moderation', labelEl: 'Εποπτεία', color: 'bg-status-danger-bg text-status-danger' },
  tenant_setup_incomplete: { label: 'Tenant', labelEl: 'Οργανισμός', color: 'bg-status-accent-bg text-status-accent' },
};

// ── Config toggle panel ──────────────────────────────────────────────────────

type ConfigKey = keyof Omit<TenantAutomationConfigItem, 'id' | 'tenantId' | 'maxEmailsPerUserPerDay' | 'maxNotificationsPerDay' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>;

const CONFIG_TOGGLES: { key: ConfigKey; label: string; labelEl: string; description: string; descriptionEl: string; icon: React.ElementType }[] = [
  { key: 'automationsEnabled', label: 'Automation Engine', labelEl: 'Μηχανή αυτοματισμών', description: 'Master switch — enable or disable all automations for this organization', descriptionEl: 'Κεντρικός διακόπτης — ενεργοποιεί ή απενεργοποιεί όλους τους αυτοματισμούς του οργανισμού', icon: Zap },
  { key: 'onboardingAutomation', label: 'Onboarding', labelEl: 'Ένταξη', description: 'Welcome messages, profile nudges, and setup reminders', descriptionEl: 'Μηνύματα καλωσορίσματος, υπενθυμίσεις προφίλ και ρύθμισης', icon: Users },
  { key: 'matchingAutomation', label: 'Matching', labelEl: 'Αντιστοιχίσεις', description: 'Match notifications, connection follow-ups, and nudges', descriptionEl: 'Ειδοποιήσεις αντιστοιχίσεων, συνέχεια συνδέσεων και υπενθυμίσεις', icon: GitMerge },
  { key: 'mentorshipAutomation', label: 'Mentorship', labelEl: 'Καθοδήγηση', description: 'Mentor request notifications and idle session reminders', descriptionEl: 'Ειδοποιήσεις αιτημάτων καθοδήγησης και υπενθυμίσεις αδρανών συνεδριών', icon: Bell },
  { key: 'communityAutomation', label: 'Community', labelEl: 'Κοινότητα', description: 'Group join welcomes and community activity notifications', descriptionEl: 'Καλωσόρισμα σε κοινότητες και ειδοποιήσεις δραστηριότητας', icon: Users },
  { key: 'billingAutomation', label: 'Billing', labelEl: 'Χρεώσεις', description: 'Trial reminders, payment failure notices, renewal alerts', descriptionEl: 'Υπενθυμίσεις δοκιμής, ειδοποιήσεις αποτυχίας πληρωμής, ανανεώσεις', icon: CreditCard },
  { key: 'reEngagementAutomation', label: 'Re-engagement', labelEl: 'Επανενεργοποίηση', description: 'Inactive user prompts (use cautiously to avoid spam)', descriptionEl: 'Υπενθυμίσεις σε αδρανείς χρήστες (με μέτρο, για να μη γίνονται ενοχλητικές)', icon: RefreshCw },
];

function ConfigPanel({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: config, isLoading } = useQuery({
    queryKey: qk('tenant', 'automation-config', tenantId),
    queryFn: () => getTenantAutomationConfig(tenantId),
    enabled: !!tenantId,
  });

  const update = useMutation({
    mutationFn: (data: Partial<TenantAutomationConfigItem>) => upsertTenantAutomationConfig(tenantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('tenant', 'automation-config', tenantId) });
      success('Automation settings saved');
    },
    onError: () => toastError('Failed to save settings'),
  });

  if (isLoading) return <div className="h-40 rounded-xl bg-muted animate-pulse" />;

  const current = config ?? {
    automationsEnabled: true,
    onboardingAutomation: true,
    matchingAutomation: true,
    mentorshipAutomation: true,
    communityAutomation: true,
    billingAutomation: true,
    reEngagementAutomation: false,
  } as Partial<TenantAutomationConfigItem>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="icon-sm text-muted-foreground" />
          <BilingualText en="Automation Settings" el="Ρυθμίσεις αυτοματισμών" compact />
        </CardTitle>
        <CardDescription>
          <BilingualText en="Control which automation categories are active for your organization." el="Ορίστε ποιες κατηγορίες αυτοματισμών είναι ενεργές για τον οργανισμό σας." wrap />
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/40">
        {CONFIG_TOGGLES.map(({ key, label, labelEl, description, descriptionEl, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Icon className="icon-sm text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium"><BilingualText en={label} el={labelEl} compact wrap /></p>
                <p className="text-xs text-muted-foreground"><BilingualText en={description} el={descriptionEl} wrap /></p>
              </div>
            </div>
            <Switch
              aria-label={bilingualAria(label, labelEl)}
              checked={!!(current as any)[key]}
              disabled={update.isPending || (key !== 'automationsEnabled' && !current.automationsEnabled)}
              onCheckedChange={(val) => update.mutate({ [key]: val })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({ rule, tenantId, onRefresh }: { rule: AutomationRuleItem; tenantId: string; onRefresh: () => void }) {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  const setStatus = useMutation({
    mutationFn: (status: 'active' | 'paused') => setAutomationRuleStatus(rule.id, status),
    onSuccess: (_, status) => { onRefresh(); success(status === 'active' ? 'Rule activated' : 'Rule paused'); },
    onError: () => toastError('Failed to update rule'),
  });

  const trigger = useMutation({
    mutationFn: () => triggerAutomationRule(rule.id),
    onSuccess: () => success('Rule triggered manually'),
    onError: () => toastError('Failed to trigger rule'),
  });

  const remove = useMutation({
    mutationFn: () => deleteAutomationRule(rule.id),
    onSuccess: () => { onRefresh(); success('Rule deleted'); },
    onError: () => toastError('Failed to delete rule'),
  });

  const cat = TRIGGER_CATEGORY[rule.triggerType];

  // The Opportunities card: the rule's mark, its name over its category and
  // trigger, the state at the right; the sentence, then the runs and the
  // controls in the foot.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Zap className="icon-md" aria-hidden="true" />
            </div>
          )}
          title={rule.name}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                cat ? <BilingualText key="cat" en={cat.label} el={cat.labelEl} compact /> : <BilingualText key="cat" en="Other" el="Άλλο" compact />,
                TRIGGER_LABELS[rule.triggerType]
                  ? <BilingualText key="trigger" en={TRIGGER_LABELS[rule.triggerType].en} el={TRIGGER_LABELS[rule.triggerType].el} compact />
                  : <span key="trigger" className="font-mono">{rule.triggerType}</span>,
                rule.tenantId === null ? <BilingualText key="platform" en="Platform" el="Πλατφόρμα" compact /> : null,
              ]}
            />
          )}
          aside={rule.status === 'active'
            ? <Badge variant="outline" className="border-status-success-border bg-status-success-bg text-xs text-status-success"><BilingualText en="Active" el="Ενεργός" compact /></Badge>
            : rule.status === 'paused'
            ? <Badge variant="outline" className="border-status-warning-border bg-status-warning-bg text-xs text-status-warning"><BilingualText en="Paused" el="Σε παύση" compact /></Badge>
            : <Badge variant="outline" className="text-xs"><StatusText value={rule.status} /></Badge>}
        />
        {rule.description && <p className="card-body text-muted-foreground first-letter:uppercase">{rule.description}</p>}
        <CardFoot
          meta={(
            <FactLine
              items={[
                <BilingualText key="runs" en={`${rule.executionCount} runs`} el={`${rule.executionCount} εκτελέσεις`} compact />,
                rule.failureCount > 0 ? (
                  <span key="failures" className="text-status-warning">
                    <BilingualText en={`${rule.failureCount} failures`} el={`${rule.failureCount} αποτυχίες`} compact />
                  </span>
                ) : null,
                rule.lastRunAt ? <span key="last" className="tabular-nums">{new Date(rule.lastRunAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</span> : null,
                rule.delaySeconds > 0 ? <BilingualText key="delay" en={`Delay: ${rule.delaySeconds}s`} el={`Καθυστέρηση: ${rule.delaySeconds}s`} compact /> : null,
              ]}
            />
          )}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Run now" aria-label={`Run ${rule.name} now`} onClick={() => trigger.mutate()} disabled={trigger.isPending}>
            <Play className="icon-sm" />
          </Button>
          {rule.status === 'active' ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Pause" aria-label={`Pause ${rule.name}`} onClick={() => setStatus.mutate('paused')} disabled={setStatus.isPending}>
              <Pause className="icon-sm" />
            </Button>
          ) : rule.status !== 'archived' ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Activate" aria-label={`Activate ${rule.name}`} onClick={() => setStatus.mutate('active')} disabled={setStatus.isPending}>
              <Zap className="icon-sm text-status-success" />
            </Button>
          ) : null}
          {rule.tenantId !== null && (
            <Button aria-label="Delete"
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive-accessible hover:text-destructive-accessible"
              onClick={async () => { if (await confirm(deleteConfirmCopy({ en: 'automation rule', el: 'κανόνα αυτοματισμού' }, rule.name))) remove.mutate(); }}
              disabled={remove.isPending}
            >
              <Trash2 className="icon-sm" />
            </Button>
          )}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TenantAutomationPage() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id ?? '';
  const [activeTab, setActiveTab] = useState<'rules' | 'settings'>('rules');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const { data: rulesData, isLoading, refetch } = useQuery({
    queryKey: qk('automation', 'rules', 'tenant', tenantId, filter),
    queryFn: () => listAutomationRules({ status: filter === 'all' ? undefined : filter, limit: 100 }),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const rules = (rulesData?.rules ?? []).filter(r =>
    r.tenantId === null || r.tenantId === tenantId
  );
  const activeCount = rules.filter(r => r.status === 'active').length;
  const totalRuns = rules.reduce((s, r) => s + r.executionCount, 0);
  const failureRules = rules.filter(r => r.failureCount > 0).length;

  // The rule actions the rows offer, reachable by the assistant with the same
  // endpoints. setRuleStatus writes one field (`status`), so pausing and
  // activating undo each other exactly; running a rule and deleting one have
  // no opposite.
  const { success: toastOk, error: toastFail } = useToast();
  const confirm = useConfirm();
  const ruleRows = (list: typeof rules) => rowOptions(list, (r) => r.id, (r) => r.name);
  const noRules = rules.length === 0 ? 'No rule is listed.' : undefined;
  const noRulesEl = rules.length === 0 ? 'Δεν εμφανίζεται κανένας κανόνας.' : undefined;
  const statusCommand = (id: string, en: string, el: string, next: 'active' | 'paused', from: 'active' | 'paused', back: string) => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: ruleRows(rules.filter((r) => r.status === from)),
    unavailableEn: noRules,
    unavailableEl: noRulesEl,
    undo: (value?: string) => (value ? { control: back, value } : undefined),
    run: async (value?: string): Promise<PageControlRunResult> => {
      if (!value) return;
      try {
        await setAutomationRuleStatus(value, next);
        toastOk(next === 'active' ? 'Rule activated' : 'Rule paused');
      } catch (err) {
        toastFail('Failed to update rule');
        return { error: err instanceof Error && err.message ? err.message : 'The rule did not change.' };
      } finally {
        void refetch();
      }
    },
  });
  usePageControls([
    choiceControl('automation_tab', 'Automation tab', 'Καρτέλα αυτοματισμών', [
      { value: 'rules', en: 'Rules', el: 'Κανόνες' },
      { value: 'settings', en: 'Settings', el: 'Ρυθμίσεις' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    choiceControl('rule_filter', 'Rule status', 'Κατάσταση κανόνα', [
      { value: 'all', en: 'All', el: 'Όλοι' },
      { value: 'active', en: 'Active', el: 'Ενεργοί' },
      { value: 'paused', en: 'Paused', el: 'Σε παύση' },
    ], filter, (v) => setFilter(v as typeof filter)),
    statusCommand('pause_rule', 'Pause a rule', 'Παύση κανόνα', 'paused', 'active', 'activate_rule'),
    statusCommand('activate_rule', 'Activate a rule', 'Ενεργοποίηση κανόνα', 'active', 'paused', 'pause_rule'),
    {
      id: 'run_rule',
      labelEn: 'Run a rule now',
      labelEl: 'Εκτέλεση κανόνα τώρα',
      writes: true,
      options: ruleRows(rules),
      unavailableEn: noRules,
      unavailableEl: noRulesEl,
      run: async (value) => {
        if (!value) return;
        try {
          await triggerAutomationRule(value);
          toastOk('Rule triggered manually');
        } catch (err) {
          toastFail('Failed to trigger rule');
          return { error: err instanceof Error && err.message ? err.message : 'The rule did not run.' };
        }
      },
    },
    {
      id: 'delete_rule',
      labelEn: 'Delete a rule',
      labelEl: 'Διαγραφή κανόνα',
      writes: true,
      options: ruleRows(rules.filter((r) => r.tenantId !== null)),
      unavailableEn: rules.every((r) => r.tenantId === null) ? 'Only platform rules are listed; they cannot be deleted here.' : undefined,
      unavailableEl: rules.every((r) => r.tenantId === null) ? 'Εμφανίζονται μόνο κανόνες πλατφόρμας· δεν διαγράφονται από εδώ.' : undefined,
      run: async (value) => {
        const rule = rules.find((r) => r.id === value);
        if (!rule) return ROW_GONE;
        if (!(await confirm(deleteConfirmCopy({ en: 'automation rule', el: 'κανόνα αυτοματισμού' }, rule.name)))) return CANCELLED;
        try {
          await deleteAutomationRule(rule.id);
          toastOk('Rule deleted');
        } catch (err) {
          toastFail('Failed to delete rule');
          return { error: err instanceof Error && err.message ? err.message : 'The rule was not deleted.' };
        } finally {
          void refetch();
        }
      },
    },
  ]);
  usePageList([
    {
      id: 'rules',
      labelEn: 'Automation rules',
      labelEl: 'Κανόνες αυτοματισμού',
      rows: isLoading ? undefined : rules.map((r) => `${r.name} · ${r.status} · ${TRIGGER_LABELS[r.triggerType]?.en ?? r.triggerType} · ${r.executionCount} runs${r.failureCount ? ` · ${r.failureCount} failures` : ''}${r.tenantId === null ? ' · platform' : ''}`),
      total: rules.length,
    },
  ]);

  if (!tenantId) {
    // This was a dead end: an icon and one sentence, with nothing to act on and
    // no explanation of why. It now uses the same EmptyState the rest of the app
    // does, says what automations are for, and offers a way out.
    return (
      <AppShell title="Automation">
        <EmptyState
          title="No organization selected"
          description="Automations run inside an organization — they react to events like a new member joining or an application being submitted. Pick or create an organization to set them up."
          illustration="rocket"
          askAiPrompt="I opened organization automations without an organization selected. Help me pick or create one and explain what automation rules I should turn on first."
          action={
            <>
              <Button asChild>
                <Link href="/tenant/dashboard"><BilingualText en="Choose an organization" el="Επιλέξτε οργανισμό" compact /></Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/org/dashboard"><BilingualText en="Browse organizations" el="Περιήγηση οργανισμών" compact /></Link>
              </Button>
            </>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Automation"
      description="Event-driven workflows: triggers fire when events happen, conditions filter, actions notify or update data."
      descriptionEl="Ροές εργασιών βάσει συμβάντων: τα εναύσματα ενεργοποιούνται όταν συμβαίνει κάτι, οι συνθήκες φιλτράρουν και οι ενέργειες ειδοποιούν ή ενημερώνουν δεδομένα."
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active Rules', labelEl: 'Ενεργοί κανόνες', value: activeCount, color: 'text-status-success' },
            { label: 'Total Runs', labelEl: 'Σύνολο εκτελέσεων', value: totalRuns, color: 'text-status-info' },
            { label: 'Rules with Failures', labelEl: 'Κανόνες με αποτυχίες', value: failureRules, color: failureRules > 0 ? 'text-status-warning' : 'text-muted-foreground' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground"><BilingualText en={s.label} el={s.labelEl} compact wrap /></p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border gap-1">
          {(['rules', 'settings'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab ? 'border-primary text-primary-accessible' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'rules' ? <BilingualText en="Rules" el="Κανόνες" compact /> : <BilingualText en="Settings" el="Ρυθμίσεις" compact />}
            </button>
          ))}
        </div>

        {/* Rules tab */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-1">
              {(['all', 'active', 'paused'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f === 'all'
                    ? <BilingualText en="All" el="Όλοι" compact />
                    : f === 'active'
                      ? <BilingualText en="Active" el="Ενεργοί" compact />
                      : <BilingualText en="Paused" el="Σε παύση" compact />}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
              </div>
            )}

            {!isLoading && rules.length === 0 && <EmptyTenantAutomations />}

            {rules.map(rule => (
              <RuleRow key={rule.id} rule={rule} tenantId={tenantId} onRefresh={refetch} />
            ))}
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <ConfigPanel tenantId={tenantId} />
        )}
      </div>
    </AppShell>
  );
}
