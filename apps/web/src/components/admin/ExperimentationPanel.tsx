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

// ── Helpers ────────────────────────────────────────────────────────────────────

function MetricDiff({
  labelA, labelB, valA, valB, unit = '',
}: {
  labelA: string; labelB: string;
  valA: number; valB: number;
  unit?: string;
}) {
  const diff = valB - valA;
  const pct = valA > 0 ? ((diff / valA) * 100).toFixed(1) : '—';
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-1/3">
        <p className="text-xs text-muted-foreground">{labelA}</p>
        <p className="font-medium text-foreground">{valA.toFixed(1)}{unit}</p>
      </div>
      <div className="w-1/3">
        <p className="text-xs text-muted-foreground">{labelB}</p>
        <p className="font-medium text-foreground">{valB.toFixed(1)}{unit}</p>
      </div>
      <div className="w-1/3 text-right">
        <p className="text-xs text-muted-foreground">Δ</p>
        <p className={`font-semibold ${diff >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}{unit}
          {' '}
          {pct !== '—' && (
            <span className="text-xs opacity-70">({pct}%)</span>
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

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{exp.name}</span>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{exp.key}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                exp.active ? 'bg-status-success-bg text-status-success' : 'bg-muted text-muted-foreground'
              }`}
            >
              {exp.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {exp.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{exp.description}</p>
          )}
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span>Split {Math.round(exp.splitRatio * 100)}% B</span>
            <span>A: {exp.variantACounts} users · B: {exp.variantBCounts} users</span>
            {exp.startedAt && <span>Started {new Date(exp.startedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggle}
            disabled={actLoading}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              exp.active
                ? 'bg-status-danger-bg text-status-danger hover:bg-status-danger-bg'
                : 'bg-status-success-bg text-status-success hover:bg-status-success-bg'
            }`}
          >
            {exp.active ? <Square className="icon-sm" /> : <Play className="icon-sm" />}
            {exp.active ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={async () => {
              setExpanded(!expanded);
              if (!expanded && !metrics) await loadMetrics();
            }}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-muted-foreground px-2"
          >
            <BarChart2 className="icon-sm" />
            {expanded ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
          </button>
          <button aria-label="Delete experiment" onClick={del} className="text-muted-foreground hover:text-status-danger">
            <Trash2 className="icon-sm" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-4 bg-muted">
          {metricsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="icon-sm animate-spin" /> <BilingualText en="Loading metrics…" el="Φόρτωση μετρήσεων…" compact />
            </div>
          ) : metrics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricDiff
                  labelA="Variant A — Avg XP" labelB="Variant B — Avg XP"
                  valA={metrics.variantAXpAvg} valB={metrics.variantBXpAvg}
                />
                <MetricDiff
                  labelA="A Badge Rate" labelB="B Badge Rate"
                  valA={metrics.variantABadgeRate} valB={metrics.variantBBadgeRate}
                  unit="%"
                />
                <MetricDiff
                  labelA="A Retention 7d" labelB="B Retention 7d"
                  valA={metrics.variantARetention7d} valB={metrics.variantBRetention7d}
                  unit="%"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide"><BilingualText en="Variant A Config" el="Ρύθμιση εκδοχής A" compact /></p>
                  <pre className="bg-white border border-border rounded p-2 text-xs overflow-auto max-h-28 font-mono">
                    {JSON.stringify(exp.variantA, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide"><BilingualText en="Variant B Config" el="Ρύθμιση εκδοχής B" compact /></p>
                  <pre className="bg-white border border-border rounded p-2 text-xs overflow-auto max-h-28 font-mono">
                    {JSON.stringify(exp.variantB, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={loadMetrics}
              className="text-sm text-status-accent hover:underline"
            >
              <BilingualText en="Load metrics" el="Φόρτωση μετρήσεων" compact />
            </button>
          )}
        </div>
      )}
    </div>
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await adminListConfigs(category || undefined);
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
          {seedLoading ? 'Seeding…' : 'Seed Defaults'}
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
        <div className="space-y-2">
          {configs.map((cfg) => (
            <div key={cfg.key} className="border border-border rounded-xl p-4 bg-white">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm text-foreground">{cfg.key}</span>
                    {cfg.category && (
                      <span className="text-xs bg-status-accent-bg text-status-accent px-1.5 py-0.5 rounded">
                        {cfg.category}
                      </span>
                    )}
                  </div>
                  {cfg.description && (
                    <p className="text-xs text-muted-foreground mb-2">{cfg.description}</p>
                  )}
                  <textarea
                    value={editValues[cfg.key] ?? ''}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, [cfg.key]: e.target.value }))
                    }
                    rows={2}
                    className="w-full text-xs font-mono border border-border rounded-xl px-3 py-2 focus:outline-none resize-none"
                  />
                </div>
                <button
                  disabled={saving === cfg.key}
                  onClick={() => void save(cfg)}
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-status-accent-bg text-status-accent rounded-lg hover:bg-status-accent-bg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="icon-sm" />
                  {saving === cfg.key ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Updated {new Date(cfg.updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
              </p>
            </div>
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
      setExperiments(res);
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
          <h2 className="text-xl font-semibold text-foreground"><BilingualText en="Experimentation & Tuning" el="Πειράματα & ρυθμίσεις" compact /></h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            <BilingualText en="A/B experiments with sticky variant assignment + live config weight tuning." el="Πειράματα A/B με σταθερή ανάθεση εκδοχής και ζωντανή ρύθμιση βαρών." wrap />
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'experiments', label: 'Experiments', icon: FlaskConical },
          { key: 'config', label: 'System Config', icon: Settings },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-primary-accessible shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="icon-sm" /> {label}
          </button>
        ))}
      </div>

      {tab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{experiments.length} experiment{experiments.length !== 1 ? 's' : ''}</p>
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
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <FlaskConical className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm"><BilingualText en="No experiments yet. Create one to start A/B testing." el="Δεν υπάρχουν πειράματα ακόμα. Δημιουργήστε ένα για δοκιμές A/B." wrap /></p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-sm text-status-accent hover:underline"
              >
                + Create first experiment
              </button>
            </div>
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
