'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import {
  adminListAbuseFlags, adminGetAbuseStats,
  adminResolveAbuseFlag, AbuseFlagRecord, AbuseStats,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-status-warning-bg text-status-warning',
  reviewed: 'bg-status-info-bg text-status-info',
  actioned: 'bg-status-danger-bg text-status-danger',
  dismissed: 'bg-muted text-muted-foreground',
};

const TYPE_LABELS: Record<string, string> = {
  burst_spam: 'Burst Spam',
  low_quality_repetition: 'Low Quality Repeat',
  fake_collaboration: 'Fake Collab',
  streak_manipulation: 'Streak Manip.',
  empty_node_spam: 'Empty Node Spam',
  self_link_abuse: 'Self-Link Abuse',
  mutual_endorsement_ring: 'Endorsement Ring',
};

function SeverityBar({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const color = pct >= 70 ? 'bg-status-danger-mark' : pct >= 40 ? 'bg-status-warning-mark' : 'bg-status-success-mark';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-muted rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function AbuseMonitorPanel() {
  const [flags, setFlags] = useState<AbuseFlagRecord[]>([]);
  const [stats, setStats] = useState<AbuseStats | null>(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        adminListAbuseFlags({ status: statusFilter || undefined, type: typeFilter || undefined, limit: 50 }),
        adminGetAbuseStats(),
      ]);
      setFlags(res.flags);
      setTotal(res.total);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (flagId: string, action: string, status: 'actioned' | 'dismissed') => {
    setActionLoading(flagId);
    try {
      await adminResolveAbuseFlag(flagId, action, status);
      setOpenAction(null);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground"><BilingualText en="Abuse Monitor" el="Παρακολούθηση κατάχρησης" compact /></h2>
          <p className="text-sm text-muted-foreground mt-0.5"><BilingualText en="Review and action detected anti-gaming signals." el="Ελέγξτε και χειριστείτε τα σήματα κατάχρησης που εντοπίστηκαν." wrap /></p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-status-accent">
          <RefreshCw className={`icon-sm ${loading ? 'animate-spin' : ''}`} /> <BilingualText en="Refresh" el="Ανανέωση" compact />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Flags', value: stats.totalFlags, color: 'text-foreground' },
            { label: 'Pending', value: stats.pendingFlags, color: 'text-status-warning' },
            { label: 'Actioned', value: stats.actionedFlags, color: 'text-status-danger' },
            { label: 'Dismissed', value: stats.dismissedFlags, color: 'text-muted-foreground' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none"
        >
          <option value="">{bilingualInline("All statuses", "Όλες οι καταστάσεις")}</option>
          {['pending', 'reviewed', 'actioned', 'dismissed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none"
        >
          <option value="">{bilingualInline("All types", "Όλοι οι τύποι")}</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Flags table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="icon-sm text-status-warning" /> {total} flag{total !== 1 ? 's' : ''}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <RefreshCw className="icon-md animate-spin mr-2" /> <BilingualText en="Loading…" el="Φόρτωση…" compact />
          </div>
        ) : flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Shield className="icon-xl mb-2 opacity-30" />
            <p className="text-sm"><BilingualText en="No flags found." el="Δεν βρέθηκαν επισημάνσεις." compact /></p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {flags.map((f) => (
              <div key={f.id} className="px-5 py-3.5 hover:bg-muted">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[f.type] ?? f.type}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[f.status] ?? ''}`}>
                        {f.status}
                      </span>
                      {f.actionTaken && (
                        <span className="text-xs text-muted-foreground">→ {f.actionTaken}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-0.5">
                      <span className="font-medium">{f.displayName ?? f.email}</span>
                      <span className="text-muted-foreground text-xs ml-1">({f.userId.slice(0, 8)}…)</span>
                    </p>
                    {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                    <div className="mt-1">
                      <SeverityBar v={f.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(f.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
                    </p>
                  </div>
                  {f.status === 'pending' && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenAction(openAction === f.id ? null : f.id)}
                        className="flex items-center gap-1 text-xs border border-border rounded-xl px-2.5 py-1.5 hover:bg-muted"
                      >
                        <BilingualText en="Action" el="Ενέργεια" compact /> <ChevronDown className="icon-sm" />
                      </button>
                      {openAction === f.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white border border-border rounded-xl shadow-lg min-w-[170px] py-1">
                          {[
                            { action: 'warning', label: 'Send Warning', icon: AlertTriangle },
                            { action: 'reduced_xp', label: 'Reduce XP', icon: XCircle },
                            { action: 'streak_freeze', label: 'Freeze Streak', icon: XCircle },
                            { action: 'safe', label: 'Mark Safe', icon: CheckCircle },
                          ].map(({ action, label, icon: Icon }) => (
                            <button
                              key={action}
                              disabled={actionLoading === f.id}
                              onClick={() => void resolve(f.id, action, action === 'safe' ? 'dismissed' : 'actioned')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                            >
                              <Icon className="icon-sm text-muted-foreground" /> {label}
                            </button>
                          ))}
                          <div className="border-t border-border mt-1 pt-1">
                            <button
                              disabled={actionLoading === f.id}
                              onClick={() => void resolve(f.id, 'safe', 'dismissed')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-muted-foreground text-left"
                            >
                              <XCircle className="icon-sm" /> <BilingualText en="Dismiss" el="Απόρριψη" compact />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && stats.topOffenders.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3"><BilingualText en="Top Offenders" el="Συχνότεροι παραβάτες" compact /></h3>
          <div className="space-y-2">
            {stats.topOffenders.slice(0, 10).map((o) => (
              <div key={o.userId} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-foreground">{o.displayName ?? o.email}</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">{o.userId.slice(0, 8)}…</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{o.flagCount} flags</span>
                  <SeverityBar v={o.maxSeverity} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
