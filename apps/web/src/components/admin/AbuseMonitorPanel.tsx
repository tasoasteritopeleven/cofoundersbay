'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import {
  adminListAbuseFlags, adminGetAbuseStats,
  adminResolveAbuseFlag, AbuseFlagRecord, AbuseStats,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FactLine } from '@/components/common/FactLine';
import { StatusText, statusEl } from '@/components/common/StatusText';
import { RowHead } from '@/components/dashboard/SectionCard';

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
    // The figure first, on the row's axis, then its bar.
    <div className="flex items-center gap-2">
      <span className="text-xs tabular-nums text-muted-foreground">
        <BilingualText en={`Severity ${pct}%`} el={`Σοβαρότητα ${pct}%`} compact />
      </span>
      <div className="w-20 bg-muted rounded-full h-1.5" aria-hidden="true">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
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
  const fmtDateTime = useDateFormat();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        adminListAbuseFlags({ status: statusFilter || undefined, type: typeFilter || undefined, limit: 50 }),
        adminGetAbuseStats(),
      ]);
      setFlags(Array.isArray(res?.flags) ? res.flags : []);
      setTotal(res?.total ?? 0);
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

  const ACTIONS = [
    { action: 'warning', label: 'Send Warning', labelEl: 'Αποστολή προειδοποίησης', icon: AlertTriangle },
    { action: 'reduced_xp', label: 'Reduce XP', labelEl: 'Μείωση XP', icon: XCircle },
    { action: 'streak_freeze', label: 'Freeze Streak', labelEl: 'Πάγωμα σερί', icon: XCircle },
    { action: 'safe', label: 'Mark Safe', labelEl: 'Σήμανση ως ασφαλές', icon: CheckCircle },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground"><BilingualText en="Abuse Monitor" el="Παρακολούθηση κατάχρησης" compact /></h2>
          <p className="mt-0.5 text-xs text-muted-foreground"><BilingualText en="Review and action detected anti-gaming signals." el="Ελέγξτε και χειριστείτε τα σήματα κατάχρησης που εντοπίστηκαν." wrap /></p>
        </div>
        <button type="button" onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-status-accent">
          <RefreshCw className={`icon-sm ${loading ? 'animate-spin' : ''}`} /> <BilingualText en="Refresh" el="Ανανέωση" compact />
        </button>
      </div>

      {/* Stats: stat cards, a figure under its label */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Flags', labelEl: 'Σύνολο επισημάνσεων', value: stats.totalFlags, color: 'text-foreground' },
            { label: 'Pending', labelEl: 'Σε αναμονή', value: stats.pendingFlags, color: 'text-status-warning' },
            { label: 'Actioned', labelEl: 'Με ενέργεια', value: stats.actionedFlags, color: 'text-status-danger' },
            { label: 'Dismissed', labelEl: 'Απορρίφθηκαν', value: stats.dismissedFlags, color: 'text-muted-foreground' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent>
                <p className="text-xs text-muted-foreground"><BilingualText en={s.label} el={s.labelEl} compact wrap /></p>
                <p className={`page-stat text-2xl font-bold tabular-nums ${s.color}`}>{s.value ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          aria-label={bilingualInline('Status', 'Κατάσταση')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-input bg-background rounded-md px-3 py-2 focus:outline-none"
        >
          <option value="">{bilingualInline("All statuses", "Όλες οι καταστάσεις")}</option>
          {['pending', 'reviewed', 'actioned', 'dismissed'].map((s) => (
            <option key={s} value={s}>{bilingualInline(s.charAt(0).toUpperCase() + s.slice(1), statusEl(s) ?? s)}</option>
          ))}
        </select>
        <select
          aria-label={bilingualInline('Type', 'Τύπος')}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-input bg-background rounded-md px-3 py-2 focus:outline-none"
        >
          <option value="">{bilingualInline("All types", "Όλοι οι τύποι")}</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Flags: a section card, one row per flag */}
      <Card>
        <CardHeader>
          <CardTitle>
            <BilingualText en={`${total} flag${total !== 1 ? 's' : ''}`} el={`${total} ${total !== 1 ? 'επισημάνσεις' : 'επισήμανση'}`} compact />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
            <RefreshCw className="icon-sm animate-spin" aria-hidden="true" /> <BilingualText en="Loading…" el="Φόρτωση…" compact />
          </div>
        ) : flags.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6"><BilingualText en="No flags found." el="Δεν βρέθηκαν επισημάνσεις." compact wrap /></p>
        ) : (
          <div className="divide-y divide-border">
            {flags.map((f) => (
              <div key={f.id} className="space-y-2 px-4 py-3 hover:bg-muted/40 sm:px-6">
                <RowHead
                  title={f.displayName ?? <span translate="no">{f.email}</span>}
                  subtitle={(
                    <FactLine
                      items={[
                        <span key="type">{TYPE_LABELS[f.type] ?? f.type}</span>,
                        <span key="id" className="font-mono" translate="no">{f.userId?.slice(0, 8)}…</span>,
                        fmtDateTime(f.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                      ]}
                    />
                  )}
                  asideStays
                  aside={(
                    <>
                      <span className={`rounded-md px-1.5 py-0.5 text-xs ${STATUS_STYLE[f.status] ?? ''}`}>
                        <StatusText value={f.status} />
                      </span>
                      {f.status === 'pending' && (
                        <div className="relative">
                          <button
                            type="button"
                            aria-expanded={openAction === f.id}
                            onClick={() => setOpenAction(openAction === f.id ? null : f.id)}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                          >
                            <BilingualText en="Action" el="Ενέργεια" compact /> <ChevronDown className="icon-sm" aria-hidden="true" />
                          </button>
                          {openAction === f.id && (
                            <div className="absolute right-0 top-8 z-10 min-w-[170px] rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
                              {ACTIONS.map(({ action, label, labelEl, icon: Icon }) => (
                                <button
                                  type="button"
                                  key={action}
                                  disabled={actionLoading === f.id}
                                  onClick={() => void resolve(f.id, action, action === 'safe' ? 'dismissed' : 'actioned')}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                                >
                                  <Icon className="icon-sm text-muted-foreground" aria-hidden="true" /> <BilingualText en={label} el={labelEl} compact />
                                </button>
                              ))}
                              <div className="border-t border-border mt-1 pt-1">
                                <button
                                  type="button"
                                  disabled={actionLoading === f.id}
                                  onClick={() => void resolve(f.id, 'safe', 'dismissed')}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-muted-foreground text-left"
                                >
                                  <XCircle className="icon-sm" aria-hidden="true" /> <BilingualText en="Dismiss" el="Απόρριψη" compact />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                />
                {f.description && <p className="text-sm text-muted-foreground first-letter:uppercase">{f.description}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <SeverityBar v={f.severity} />
                  {f.actionTaken && (
                    <span className="text-xs text-muted-foreground">→ <StatusText value={f.actionTaken} /></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {stats && (stats.topOffenders ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle><BilingualText en="Top Offenders" el="Συχνότεροι παραβάτες" compact /></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(stats.topOffenders ?? []).slice(0, 10).map((o) => (
                <div key={o.userId} className="px-4 py-3 sm:px-6">
                  <RowHead
                    title={o.displayName ?? <span translate="no">{o.email}</span>}
                    subtitle={(
                      <FactLine
                        items={[
                          <span key="id" className="font-mono" translate="no">{o.userId?.slice(0, 8)}…</span>,
                          <BilingualText key="n" en={`${o.flagCount} flags`} el={`${o.flagCount} επισημάνσεις`} compact />,
                        ]}
                      />
                    )}
                    aside={<SeverityBar v={o.maxSeverity} />}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
