'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, Search, Filter, RefreshCw, Download, User,
  Trash2, PenLine, Plus, Eye, LogOut, Settings,
  AlertTriangle, CheckCircle2, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { downloadCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { listAdminAuditLogs, type AdminAuditLogItem } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';

/*
 * The API writes dotted actions - `user.ban`, `report.resolve`,
 * `cohort.create` (AdminAction in admin-audit.service.ts). This page filtered
 * and coloured by bare verbs (`ban`, `create`), so against a real database the
 * action filter matched nothing and every row fell back to the settings icon.
 * The lists below are the API's own, and a row's icon and colour come from the
 * verb after the dot.
 */
const ACTION_ICONS: Record<string, React.ElementType> = {
  create: Plus,
  add_member: Plus,
  update: PenLine,
  delete: Trash2,
  remove: Trash2,
  remove_member: Trash2,
  ban: AlertTriangle,
  suspend: AlertTriangle,
  escalate: AlertTriangle,
  unban: CheckCircle2,
  activate: CheckCircle2,
  resolve: CheckCircle2,
  dismiss: Eye,
  feature: Plus,
  unfeature: LogOut,
  role_change: User,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-status-success-bg text-status-success border-status-success-border',
  add_member: 'bg-status-success-bg text-status-success border-status-success-border',
  update: 'bg-status-info-bg text-status-info border-status-info-border',
  feature: 'bg-status-info-bg text-status-info border-status-info-border',
  delete: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  remove: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  remove_member: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  ban: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  suspend: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  escalate: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  unban: 'bg-status-success-bg text-status-success border-status-success-border',
  activate: 'bg-status-success-bg text-status-success border-status-success-border',
  resolve: 'bg-status-success-bg text-status-success border-status-success-border',
  dismiss: 'bg-muted text-muted-foreground border-border',
  unfeature: 'bg-muted text-muted-foreground border-border',
  role_change: 'bg-status-accent-bg text-status-accent border-status-accent-border',
};

const verbOf = (action: string) => action.toLowerCase().split('.').pop() ?? action;

// The entity types AdminService writes (content actions name the event or job).
const ENTITY_TYPES = ['all', 'user', 'report', 'event', 'job', 'cohort', 'skill'];
const ACTION_TYPES = [
  'all',
  'user.ban', 'user.unban', 'user.suspend', 'user.activate', 'user.role_change', 'user.delete',
  'report.resolve', 'report.dismiss', 'report.escalate',
  'content.feature', 'content.unfeature', 'content.remove',
  'cohort.create', 'cohort.update', 'cohort.delete', 'cohort.add_member', 'cohort.remove_member',
  'settings.update',
  'skill.create', 'skill.update', 'skill.delete',
];

function AuditLogRow({ log }: { log: AdminAuditLogItem }) {
  const ActionIcon = ACTION_ICONS[verbOf(log.action)] ?? Settings;
  const colorClass = ACTION_COLORS[verbOf(log.action)] ?? 'bg-muted text-muted-foreground border-border';

  const metaStr = Object.entries(log.meta ?? {})
    .filter(([k]) => !['actorId'].includes(k))
    .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(v)}`)
    .join(' · ');

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={cn('rounded-lg p-2 border shrink-0 mt-0.5', colorClass)}>
        <ActionIcon className="icon-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* An address and an action name are identifiers: never translated,
              never re-cased. */}
          <span className="font-medium text-sm" translate="no">{log.actorEmail}</span>
          <Badge variant="outline" className={cn('text-xs', colorClass)} translate="no">
            {log.action}
          </Badge>
          <Badge variant="secondary" className="text-xs"><StatusText value={log.entityType} /></Badge>
          {log.entityId && (
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              #{log.entityId}
            </code>
          )}
        </div>
        {metaStr && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{metaStr}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0"><RelativeTime date={log.createdAt} /></span>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function AdminAuditLogPage() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: qk('admin', 'audit-logs', entityType, action, page),
    queryFn: () =>
      listAdminAuditLogs({
        entityType: entityType !== 'all' ? entityType : undefined,
        action: action !== 'all' ? action : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  // Ten invented entries stood in whenever the request failed - in production
  // too - under a header that counted the real total (0). The demo's entries
  // now come from the preview API, and a failure says so.
  const logs = data?.logs ?? [];
  const total = data?.total ?? logs.length;

  const filtered = logs.filter(
    (l) =>
      !search ||
      l.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportCsv = () =>
    downloadCsv(
      'audit-log',
      ['created_at', 'actor', 'action', 'entity_type', 'entity_id', 'meta'],
      filtered.map((l) => [l.createdAt, l.actorEmail, l.action, l.entityType, l.entityId, JSON.stringify(l.meta ?? {})]),
    );
  // The filters, paging, refresh and export, offered to the assistant with
  // the page's own handlers; the entries on screen go out as a list.
  usePageControls([
    choiceControl('entity_type', 'Entity type', 'Τύπος οντότητας', ENTITY_TYPES.map((t) => ({ value: t, en: t === 'all' ? 'All entities' : t, el: t === 'all' ? 'Όλες οι οντότητες' : t })), entityType, (v) => { setEntityType(v); setPage(0); }),
    choiceControl('action_filter', 'Action', 'Ενέργεια', ACTION_TYPES.map((a) => ({ value: a, en: a === 'all' ? 'All actions' : a, el: a === 'all' ? 'Όλες οι ενέργειες' : a })), action, (v) => { setAction(v); setPage(0); }),
    {
      id: 'next_page', labelEn: 'Next page of entries', labelEl: 'Επόμενη σελίδα εγγραφών', writes: false,
      unavailableEn: page >= totalPages - 1 ? 'This is the last page.' : undefined,
      unavailableEl: page >= totalPages - 1 ? 'Αυτή είναι η τελευταία σελίδα.' : undefined,
      run: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    },
    {
      id: 'previous_page', labelEn: 'Previous page of entries', labelEl: 'Προηγούμενη σελίδα εγγραφών', writes: false,
      unavailableEn: page === 0 ? 'This is the first page.' : undefined,
      unavailableEl: page === 0 ? 'Αυτή είναι η πρώτη σελίδα.' : undefined,
      run: () => setPage((p) => Math.max(0, p - 1)),
    },
    { id: 'refresh', labelEn: 'Refresh the audit log', labelEl: 'Ανανέωση αρχείου ελέγχου', writes: false, run: () => void refetch() },
    {
      id: 'export_csv', labelEn: 'Export the entries shown as CSV', labelEl: 'Εξαγωγή των εγγραφών σε CSV', writes: false,
      unavailableEn: filtered.length === 0 ? 'No entry matches the current filters.' : undefined,
      unavailableEl: filtered.length === 0 ? 'Καμία εγγραφή δεν ταιριάζει στα φίλτρα.' : undefined,
      run: exportCsv,
    },
  ]);
  usePageList([
    {
      id: 'entries',
      labelEn: 'Audit entries',
      labelEl: 'Εγγραφές ελέγχου',
      rows: isLoading ? undefined : filtered.map((l) => [String(l.createdAt ?? '').slice(0, 16).replace('T', ' '), l.actorEmail, l.action, [l.entityType, l.entityId].filter(Boolean).join(' ')].filter(Boolean).join(' · ')),
      total,
    },
  ]);

  return (
    <AppShell
      title="Audit log"
      titleEl="Αρχείο ελέγχου"
      description="Every administrative action on the platform: who changed what, and when."
      descriptionEl="Κάθε διαχειριστική ενέργεια στην πλατφόρμα: ποιος άλλαξε τι και πότε."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 icon-sm', isFetching && 'animate-spin')} aria-hidden="true" />
            <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
          {/* Had no handler. Exports the rows the filters show. */}
          <Button
            variant="outline"
            size="sm"
            disabled={filtered.length === 0}
            onClick={exportCsv}
          >
            <Download className="mr-2 icon-sm" aria-hidden="true" />
            <BilingualText en="Export" el="Εξαγωγή" compact />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={bilingualInline("Search audit log by actor, entity, or action", "Αναζήτηση στο αρχείο ελέγχου με χρήστη, οντότητα ή ενέργεια")}
              placeholder={bilingualInline("Search by actor, entity, action…", "Αναζήτηση με χρήστη, οντότητα, ενέργεια…")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
            <SelectTrigger aria-label="Entity type. Τύπος οντότητας" className="w-[160px]">
              <SelectValue placeholder={bilingualInline("Entity type", "Τύπος οντότητας")} />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t === 'all' ? <BilingualText en="All entities" el="Όλες οι οντότητες" compact /> : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
            <SelectTrigger aria-label="Action. Ενέργεια" className="w-[160px]">
              <SelectValue placeholder={bilingualInline("Action", "Ενέργεια")} />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>{a === 'all' ? <BilingualText en="All actions" el="Όλες οι ενέργειες" compact /> : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Log Table */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="icon-sm text-muted-foreground" />
              <BilingualText en="Activity log" el="Καταγραφή δραστηριότητας" compact />
            </CardTitle>
            <span className="ml-auto text-xs text-muted-foreground"><BilingualText en={`${total} total entries`} el={`${total} εγγραφές συνολικά`} compact /></span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            ) : isError && logs.length === 0 ? (
              <div className="py-16 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium">The audit log could not be loaded</p>
                <p className="text-xs text-muted-foreground mt-1">Refresh to try again.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden="true" />
                <p className="text-sm font-medium">No audit log entries</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entityType !== 'all' || action !== 'all' || search ? 'Try adjusting filters' : 'Administrative actions appear here as they happen.'}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map((log) => (
                  <AuditLogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="icon-sm" aria-hidden="true" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
              >
                Next
                <ChevronRight className="icon-sm" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
