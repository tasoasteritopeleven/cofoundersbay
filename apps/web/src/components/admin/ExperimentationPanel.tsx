'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, Play, Square, Trash2, Plus, RefreshCw,
  Settings, ChevronDown, ChevronUp, BarChart2, Save,
} from 'lucide-react';
import {
  adminListExperiments, adminCreateExperiment, adminUpdateExperiment,
  adminActivateExperiment, adminDeactivateExperiment, adminDeleteExperiment,
  adminGetExperimentMetrics, adminListConfigs, adminUpsertConfig, adminSeedDefaultConfigs,
  ExperimentRecord, ExperimentMetrics, SystemConfigRecord,
} from '@/lib/api';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function MetricDiff({
  labelA, labelB, valA, valB, unit = '',
}: {
  labelA: React.ReactNode; labelB: React.ReactNode;
  valA: number; valB: number;
  unit?: string;
}) {
  const diff = valB - valA;
  const pct = valA > 0 ? ((diff / valA) * 100).toFixed(1) : '—';
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-1/3">
        <p className="text-xs text-muted-foreground">{labelA}</p>
        <p className="font-medium tabular-nums text-foreground">{(valA ?? 0).toFixed(1)}{unit}</p>
      </div>
      <div className="w-1/3">
        <p className="text-xs text-muted-foreground">{labelB}</p>
        <p className="font-medium tabular-nums text-foreground">{(valB ?? 0).toFixed(1)}{unit}</p>
      </div>
      <div className="w-1/3 text-right">
        <p className="text-xs text-muted-foreground">Δ</p>
        <p className={`font-semibold ${diff >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}{unit}
          {' '}
          {pct !== '—' && (
            <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Experiment Card ─────────────────────────────────────────────────────────────

function ExperimentCard({
  exp, onRefresh,
}: {
  exp: ExperimentRecord;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState<ExperimentMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [actLoading, setActLoading] = useState(false);
  const confirm = useConfirm();
  const fmtDate = useDateFormat();

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const m = await adminGetExperimentMetrics(exp.id);
      setMetrics(m);
    } finally {
      setMetricsLoading(false);
    }
  };

  const toggle = async () => {
    setActLoading(true);
    try {
      if (exp.active) await adminDeactivateExperiment(exp.id);
      else await adminActivateExperiment(exp.id);
      onRefresh();
    } finally {
      setActLoading(false);
    }
  };

  const del = async () => {
    if (!(await confirm(deleteConfirmCopy({ en: 'experiment', el: 'πειράματος' }, exp.name)))) return;
    await adminDeleteExperiment(exp.id);
    onRefresh();
  };

  // The Endorsements card's anatomy: the experiment's name over its key and
  // split, its state at the right, the sentence and the facts on one left
  // axis, the actions in the foot; the metrics open under a hairline.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          title={exp.name}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <code key="key" className="font-mono text-xs" translate="no">{exp.key}</code>,
                <BilingualText key="split" en={`Split ${Math.round((exp.splitRatio ?? 0) * 100)}% B`} el={`Κατανομή ${Math.round((exp.splitRatio ?? 0) * 100)}% B`} compact />,
              ]}
            />
          )}
          aside={(
            <Badge variant="outline" className={cn('text-xs', exp.active ? 'border-status-success-border bg-status-success-bg text-status-success' : 'bg-muted text-muted-foreground')}>
              {exp.active ? <BilingualText en="Active" el="Ενεργό" compact /> : <BilingualText en="Inactive" el="Ανενεργό" compact />}
            </Badge>
          )}
        />
        {exp.description && (
          <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{exp.description}</p>
        )}
        <FactLine
          items={[
            <BilingualText key="a" en={`A: ${exp.variantACounts ?? 0} users`} el={`A: ${exp.variantACounts ?? 0} χρήστες`} compact />,
            <BilingualText key="b" en={`B: ${exp.variantBCounts ?? 0} users`} el={`B: ${exp.variantBCounts ?? 0} χρήστες`} compact />,
            exp.startedAt ? (
              <BilingualText
                key="started"
                en={`Started ${fmtDate(exp.startedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                el={`Ξεκίνησε ${fmtDate(exp.startedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                compact
              />
            ) : null,
          ]}
        />
        <CardFoot>
          <Button size="sm" variant="outline" className={cn('gap-1.5', exp.active ? 'text-status-danger' : 'text-status-success')} onClick={toggle} disabled={actLoading}>
            {exp.active ? <Square className="icon-sm" aria-hidden="true" /> : <Play className="icon-sm" aria-hidden="true" />}
            {exp.active ? <BilingualText en="Stop" el="Διακοπή" compact /> : <BilingualText en="Start" el="Έναρξη" compact />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            aria-expanded={expanded}
            onClick={async () => {
              setExpanded(!expanded);
              if (!expanded && !metrics) await loadMetrics();
            }}
          >
            <BarChart2 className="icon-sm" aria-hidden="true" />
            <BilingualText en="Metrics" el="Μετρήσεις" compact />
            {expanded ? <ChevronUp className="icon-sm" aria-hidden="true" /> : <ChevronDown className="icon-sm" aria-hidden="true" />}
          </Button>
          <Button aria-label={bilingualInline('Delete experiment', 'Διαγραφή πειράματος')} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-status-danger" onClick={del}>
            <Trash2 className="icon-sm" aria-hidden="true" />
          </Button>
        </CardFoot>

      {expanded && (
        <div className="border-t border-border pt-3">
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="icon-sm animate-spin" /> <BilingualText en="Loading metrics…" el="Φόρτωση μετρήσεων…" compact />
            </div>
          ) : metrics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricDiff
                  labelA={<BilingualText en="Variant A: avg XP" el="Εκδοχή A: μέσο XP" compact wrap />} labelB={<BilingualText en="Variant B: avg XP" el="Εκδοχή B: μέσο XP" compact wrap />}
                  valA={metrics.variantAXpAvg} valB={metrics.variantBXpAvg}
                />
                <MetricDiff
                  labelA={<BilingualText en="A badge rate" el="A ποσοστό διακρίσεων" compact wrap />} labelB={<BilingualText en="B badge rate" el="B ποσοστό διακρίσεων" compact wrap />}
                  valA={metrics.variantABadgeRate} valB={metrics.variantBBadgeRate}
                  unit="%"
                />
                <MetricDiff
                  labelA={<BilingualText en="A retention 7d" el="A διατήρηση 7 ημ." compact wrap />} labelB={<BilingualText en="B retention 7d" el="B διατήρηση 7 ημ." compact wrap />}
                  valA={metrics.variantARetention7d} valB={metrics.variantBRetention7d}
                  unit="%"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground"><BilingualText en="Variant A Config" el="Ρύθμιση εκδοχής A" compact /></p>
                  <pre className="max-h-28 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                    {JSON.stringify(exp.variantA, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground"><BilingualText en="Variant B Config" el="Ρύθμιση εκδοχής B" compact /></p>
                  <pre className="max-h-28 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                    {JSON.stringify(exp.variantB, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={loadMetrics}
              className="text-sm text-status-accent hover:underline"
            >
              <BilingualText en="Load metrics" el="Φόρτωση μετρήσεων" compact />
            </button>
          )}
        </div>
      )}
      </CardContent>
    </Card>
  );
}

// ── Create Experiment Modal ─────────────────────────────────────────────────────

function CreateExperimentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const panelRef = useModalA11y<HTMLDivElement>(true, onClose);
  const [form, setForm] = useState({
    name: '', key: '', description: '',
    variantA: '{}', variantB: '{}', splitRatio: '0.5',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    let vA: Record<string, unknown>, vB: Record<string, unknown>;
    try {
      vA = JSON.parse(form.variantA);
      vB = JSON.parse(form.variantB);
    } catch {
      setError('Variant A/B must be valid JSON objects.');
      return;
    }
    if (!form.name || !form.key) { setError('Name and key are required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await adminCreateExperiment({
        name: form.name, key: form.key,
        description: form.description || undefined,
        variantA: vA, variantB: vB,
        splitRatio: parseFloat(form.splitRatio),
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* `useModalA11y`: focus in on open, Tab trapped, Escape closes,
          scroll locked, focus returned. This was a bare overlay with a
          close handler and nothing else a dialog owes a keyboard user. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-experiment-title"
        tabIndex={-1}
        className="bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
      >
        <h3 id="new-experiment-title" className="text-lg font-semibold text-foreground mb-4"><BilingualText en="New Experiment" el="Νέο πείραμα" compact /></h3>
        <div className="space-y-3">
          {[
            { label: 'Name', key: 'name', placeholder: 'e.g. Higher XP for artifacts' },
            { label: 'Key (slug)', key: 'key', placeholder: 'e.g. xp_artifact_boost_v1' },
            { label: 'Description', key: 'description', placeholder: 'Optional context…' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label htmlFor="exp-f1" className="block text-sm text-muted-foreground mb-1">{label}</label>
              <input id="exp-f1"
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Variant A (control)', key: 'variantA' }, { label: 'Variant B (treatment)', key: 'variantB' }].map(({ label, key }) => (
              <div key={key}>
                <label htmlFor="exp-f2" className="block text-sm text-muted-foreground mb-1">{label}</label>
                <textarea id="exp-f2"
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  rows={4}
                  className="w-full text-xs font-mono border border-border rounded-xl px-3 py-2 focus:outline-none resize-none"
                />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="exp-f3" className="block text-sm text-muted-foreground mb-1">Split Ratio (% assigned to B): {Math.round(parseFloat(form.splitRatio) * 100)}%</label>
            <input id="exp-f3"
              type="range" min="0.1" max="0.9" step="0.05"
              value={form.splitRatio}
              onChange={(e) => setForm((f) => ({ ...f, splitRatio: e.target.value }))}
              className="w-full accent-primary"
            />
          </div>
          {error && <p className="text-sm text-status-danger">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted"
          >
            <BilingualText en="Cancel" el="Ακύρωση" compact />
          </button>
          <button
            onClick={() => void submit()}
            disabled={loading}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── System Config Editor ────────────────────────────────────────────────────────

function ConfigEditor() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [configs, setConfigs] = useState<SystemConfigRecord[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const fmtDateTime = useDateFormat();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListConfigs(category || undefined);
      const c = Array.isArray(res) ? res : [];
      setConfigs(c);
      const vals: Record<string, string> = {};
      c.forEach((cfg) => { vals[cfg.key] = JSON.stringify(cfg.value, null, 2); });
      setEditValues(vals);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { void load(); }, [load]);

  const save = async (cfg: SystemConfigRecord) => {
    let value: unknown;
    try { value = JSON.parse(editValues[cfg.key] ?? ''); }
    catch { toastError('Invalid JSON'); return; }
    setSaving(cfg.key);
    try {
      await adminUpsertConfig(cfg.key, { value, description: cfg.description ?? undefined, category: cfg.category ?? undefined });
      await load();
    } finally {
      setSaving(null);
    }
  };

  const seed = async () => {
    setSeedLoading(true);
    try {
      const res = await adminSeedDefaultConfigs();
      await load();
      toastSuccess(`Seeded ${res.seeded} default config keys.`);
    } finally {
      setSeedLoading(false);
    }
  };

  const CATEGORIES = ['xp_weights', 'streak_config', 'abuse_thresholds', 'readiness_weights'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">{bilingualInline("All categories", "Όλες οι κατηγορίες")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button aria-label="Refresh" onClick={load} className="text-muted-foreground hover:text-status-accent">
            <RefreshCw className={`icon-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button
          onClick={() => void seed()}
          disabled={seedLoading}
          className="text-xs flex items-center gap-1.5 border border-dashed border-status-accent-border text-status-accent px-3 py-1.5 rounded-lg hover:bg-status-accent-bg"
        >
          <Settings className="icon-sm" />
          {seedLoading ? <BilingualText en="Seeding…" el="Φόρτωση προεπιλογών…" compact /> : <BilingualText en="Seed Defaults" el="Φόρτωση προεπιλογών" compact />}
        </button>
      </div>

      {loading && configs.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <RefreshCw className="icon-sm animate-spin mr-2" /> <BilingualText en="Loading…" el="Φόρτωση…" compact />
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <Settings className="icon-xl mb-2 opacity-30" />
          <p className="text-sm"><BilingualText en="No config keys found. Seed defaults to get started." el="Δεν βρέθηκαν κλειδιά ρυθμίσεων. Φορτώστε τις προεπιλογές για να ξεκινήσετε." wrap /></p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            // A form card: the key over its description, the category at
            // the right, the value's field on the key's axis, the save in
            // the foot with when it last changed.
            <Card key={cfg.key}>
              <CardContent className="space-y-3">
                <CardHead
                  title={<span className="font-mono" translate="no">{cfg.key}</span>}
                  subtitle={cfg.description ? <span className="block first-letter:uppercase">{cfg.description}</span> : undefined}
                  aside={cfg.category ? <code className="font-mono" translate="no">{cfg.category}</code> : undefined}
                />
                <textarea
                  aria-label={bilingualInline(`Value of ${cfg.key}`, `Τιμή του ${cfg.key}`)}
                  value={editValues[cfg.key] ?? ''}
                  onChange={(e) =>
                    setEditValues((v) => ({ ...v, [cfg.key]: e.target.value }))
                  }
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none"
                />
                <CardFoot
                  meta={cfg.updatedAt ? (
                    <BilingualText
                      en={`Updated ${fmtDateTime(cfg.updatedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                      el={`Ενημερώθηκε ${fmtDateTime(cfg.updatedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                      compact
                      wrap
                    />
                  ) : undefined}
                >
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={saving === cfg.key} onClick={() => void save(cfg)}>
                    <Save className="icon-sm" aria-hidden="true" />
                    {saving === cfg.key ? <BilingualText en="Saving…" el="Αποθήκευση…" compact /> : <BilingualText en="Save" el="Αποθήκευση" compact />}
                  </Button>
                </CardFoot>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function ExperimentationPanel() {
  const [tab, setTab] = useState<'experiments' | 'config'>('experiments');
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListExperiments();
      // A partial payload (the demo answers with an object) threw on `.map`
      // and blanked the whole console behind its error boundary.
      setExperiments(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'experiments') void loadExperiments();
  }, [tab, loadExperiments]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground"><BilingualText en="Experimentation & Tuning" el="Πειράματα & ρυθμίσεις" compact /></h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <BilingualText en="A/B experiments with sticky variant assignment + live config weight tuning." el="Πειράματα A/B με σταθερή ανάθεση εκδοχής και ζωντανή ρύθμιση βαρών." wrap />
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'experiments', label: 'Experiments', labelEl: 'Πειράματα', icon: FlaskConical },
          { key: 'config', label: 'System Config', labelEl: 'Ρυθμίσεις συστήματος', icon: Settings },
        ] as const).map(({ key, label, labelEl, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-card text-primary-accessible shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="icon-sm" /> <BilingualText en={label} el={labelEl} compact />
          </button>
        ))}
      </div>

      {tab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground"><BilingualText en={`${experiments.length} experiment${experiments.length !== 1 ? 's' : ''}`} el={`${experiments.length} ${experiments.length !== 1 ? 'πειράματα' : 'πείραμα'}`} compact /></p>
            <div className="flex gap-2">
              <button aria-label="Refresh experiments"
                onClick={loadExperiments}
                className="text-muted-foreground hover:text-status-accent"
              >
                <RefreshCw className={`icon-sm ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                <Plus className="icon-sm" /> <BilingualText en="New Experiment" el="Νέο πείραμα" compact />
              </button>
            </div>
          </div>

          {loading && experiments.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <RefreshCw className="icon-md animate-spin mr-2" /> <BilingualText en="Loading…" el="Φόρτωση…" compact />
            </div>
          ) : experiments.length === 0 ? (
            <Card>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground"><BilingualText en="No experiments yet. Create one to start A/B testing." el="Δεν υπάρχουν πειράματα ακόμα. Δημιουργήστε ένα για δοκιμές A/B." wrap /></p>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Create first experiment" el="Δημιουργία πρώτου πειράματος" compact />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {experiments.map((exp) => (
                <ExperimentCard key={exp.id} exp={exp} onRefresh={() => void loadExperiments()} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && <ConfigEditor />}

      {showCreate && (
        <CreateExperimentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadExperiments();
          }}
        />
      )}
    </div>
  );
}
