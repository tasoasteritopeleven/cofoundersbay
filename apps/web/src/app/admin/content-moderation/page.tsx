'use client';

import { useEffect, useState } from 'react';
import { Flag, Search, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { listAdminReports, resolveAdminReport, type AdminReportItem } from '@/lib/api';
import { HelpCallout } from '@/components/common/HelpCallout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { useDemoData } from '@/contexts/DemoDataContext';
import { choiceControl, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';

type Report = {
  id: string;
  type: 'post' | 'profile' | 'message';
  reason: string;
  reporter: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
};

/**
 * The queue's own row from the moderation row.
 *
 * `/api/admin/reports` and `resolveAdminReport` have existed all along; this
 * screen held three rows in `useState` and its Resolve and Dismiss buttons
 * changed that array and raised a toast saying the report was updated.
 *
 * The page's three "types" are a narrower vocabulary than the model's five
 * report reasons, so the mapping is written down rather than a reason being
 * rendered as if it were a content type.
 */
const REPORT_SURFACE: Record<string, Report['type']> = {
  spam: 'post',
  inappropriate: 'post',
  fake: 'profile',
  harassment: 'message',
  other: 'post',
};

function toQueueRow(row: AdminReportItem): Report {
  return {
    id: row.id,
    type: REPORT_SURFACE[row.type] ?? 'post',
    reason: row.reason,
    reporter: row.reporter?.name ?? row.reporter?.email ?? '\u2014',
    status:
      row.status === 'resolved' ? 'resolved' : row.status === 'dismissed' ? 'dismissed' : 'open',
    createdAt: row.createdAt,
  };
}

/** Shown while the queue is empty. */
const REPORTS: Report[] = [
  { id: 'seed-1', type: 'post', reason: 'Spam / promotional', reporter: 'user_42', status: 'open', createdAt: '2026-09-04T08:00:00.000Z' },
  { id: 'seed-2', type: 'profile', reason: 'Misleading credentials', reporter: 'user_88', status: 'open', createdAt: '2026-09-04T05:00:00.000Z' },
  { id: 'seed-3', type: 'message', reason: 'Harassment', reporter: 'user_12', status: 'resolved', createdAt: '2026-09-03T10:00:00.000Z' },
];

export default function ContentModerationPage() {
  const { showDemoData } = useDemoData();
  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Report[]>([]);
  /** True once real rows are in hand; the buttons refuse to act before that. */
  const [isLive, setIsLive] = useState(false);
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: qk('admin', 'reports'),
    queryFn: () => listAdminReports({ limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });

  // Real reports when there are any; the three samples only with sample data
  // on - they used to stand in for an empty queue in every account.
  useEffect(() => {
    const rows = data?.reports ?? [];
    if (rows.length > 0) {
      setItems(rows.map(toQueueRow));
      setIsLive(true);
      return;
    }
    if (!isLive) setItems(showDemoData ? REPORTS : []);
  }, [data, showDemoData, isLive]);

  const filtered = items.filter(
    (r) =>
      (tab === 'all' || r.status === tab) &&
      (!search || r.reason.toLowerCase().includes(search.toLowerCase())),
  );

  const resolve = async (id: string, status: Report['status']): Promise<PageControlRunResult> => {
    if (status === 'open') return { error: 'A report cannot be reopened here.' };
    if (!isLive) {
      error('Nothing to update', 'These rows are illustrative until the queue loads.');
      return { error: 'These rows are illustrative until the queue loads.' };
    }
    // Optimistic, then reconciled from the server.
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await resolveAdminReport(id, status);
      success('Report updated', `Marked as ${status}.`);
    } catch (err) {
      error('Could not update the report', err instanceof Error ? err.message : undefined);
      return { error: err instanceof Error && err.message ? err.message : 'The report did not change.' };
    } finally {
      void qc.invalidateQueries({ queryKey: qk('admin', 'reports') });
    }
  };

  // The queue tab and the two decisions, offered to the assistant. A decision
  // has no undo: the resolve endpoint sets `resolved`/`dismissed` and there is
  // no route that reopens a report.
  const open = filtered.filter((r) => r.status === 'open');
  const decision = (id: string, en: string, el: string, status: 'resolved' | 'dismissed') => ({
    id,
    labelEn: en,
    labelEl: el,
    writes: true,
    options: rowOptions(open, (r) => r.id, (r) => `${r.type} · ${r.reason}`),
    unavailableEn: !isLive ? 'These rows are illustrative until the queue loads.' : open.length === 0 ? 'No open report is shown.' : undefined,
    unavailableEl: !isLive ? 'Οι γραμμές είναι ενδεικτικές μέχρι να φορτώσει η ουρά.' : open.length === 0 ? 'Δεν εμφανίζεται ανοιχτή αναφορά.' : undefined,
    run: (value?: string) => (value ? resolve(value, status) : undefined),
  });
  usePageControls([
    choiceControl('queue_tab', 'Queue', 'Ουρά', [
      { value: 'open', en: 'Open', el: 'Ανοιχτές' },
      { value: 'resolved', en: 'Resolved', el: 'Επιλυμένες' },
      { value: 'dismissed', en: 'Dismissed', el: 'Απορριφθείσες' },
      { value: 'all', en: 'All', el: 'Όλες' },
    ], tab, setTab),
    decision('resolve_report', 'Resolve a report', 'Επίλυση αναφοράς', 'resolved'),
    decision('dismiss_report', 'Dismiss a report', 'Απόρριψη αναφοράς', 'dismissed'),
  ]);
  usePageList([
    {
      id: 'reports',
      labelEn: 'Reports',
      labelEl: 'Αναφορές',
      rows: isLoading ? undefined : filtered.map((r) => `${r.type} · ${r.reason} · reported by ${r.reporter} · ${r.status}`),
      total: items.length,
      sample: !isLive && items.length > 0,
    },
  ]);

  return (
    <AppShell
      title="Content moderation"
      description="Review flagged posts, profiles, and messages. Resolve or dismiss with one action."
      descriptionEl="Ελέγξτε αναρτήσεις, προφίλ και μηνύματα που επισημάνθηκαν. Επιλύστε ή απορρίψτε με μία ενέργεια."
      showHelp
    >
      <HelpCallout id="admin-content-moderation" title="Moderation queue" titleEl="Ουρά εποπτείας">
        <p>
          Open items need a decision: <strong>Resolve</strong> if action was taken (warn/suspend content),
          <strong> Dismiss</strong> if the report was invalid. Resolved items stay in history for audit.
        </p>
        <p lang="el" className="mt-2 text-muted-foreground">
          Οι ανοιχτές αναφορές θέλουν απόφαση: <strong>Επίλυση</strong> αν έγινε ενέργεια (προειδοποίηση/αναστολή),
          <strong> Απόρριψη</strong> αν η αναφορά δεν ίσχυε. Οι επιλυμένες μένουν στο ιστορικό για έλεγχο.
        </p>
      </HelpCallout>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open"><BilingualText en="Open" el="Ανοιχτές" compact /></TabsTrigger>
            <TabsTrigger value="resolved"><BilingualText en="Resolved" el="Επιλυμένες" compact /></TabsTrigger>
            <TabsTrigger value="dismissed"><BilingualText en="Dismissed" el="Απορριφθείσες" compact /></TabsTrigger>
            <TabsTrigger value="all"><BilingualText en="All" el="Όλες" compact /></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports. Αναζήτηση αναφορών"
            placeholder={bilingualInline('Search reports…', 'Αναζήτηση αναφορών…')}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        {filtered.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Flag className="icon-sm shrink-0 text-status-warning" aria-hidden="true" />
            {/* basis-48: the decision buttons wrap under the report on a
                phone instead of squeezing it to one word a line. */}
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium"><span className="capitalize"><StatusText value={r.type} /></span> · {r.reason}</p>
              <p className="text-xs text-muted-foreground">
                <BilingualText en={`Reported by ${r.reporter}`} el={`Αναφορά από ${r.reporter}`} compact /> · <RelativeTime date={r.createdAt} format={formatRelativeTime} />
              </p>
            </div>
            <Badge variant="outline" className="capitalize"><StatusText value={r.status} /></Badge>
            {r.status === 'open' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void resolve(r.id, 'resolved')}>
                  <CheckCircle2 className="icon-sm mr-1" aria-hidden="true" /> <BilingualText en="Resolve" el="Επίλυση" compact />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void resolve(r.id, 'dismissed')}>
                  <XCircle className="icon-sm mr-1" aria-hidden="true" /> <BilingualText en="Dismiss" el="Απόρριψη" compact />
                </Button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="mx-auto icon-lg opacity-40" aria-hidden="true" />
            <p className="mt-2"><BilingualText en="No reports in this queue" el="Καμία αναφορά σε αυτή την ουρά" wrap /></p>
          </CardContent>
        )}
      </Card>
    </AppShell>
  );
}
