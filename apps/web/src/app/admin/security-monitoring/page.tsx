'use client';

import { useState } from 'react';
import { AlertTriangle, Shield, Lock, Activity, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import {
  adminListAbuseFlags,
  adminGetAbuseStats,
  type AbuseFlagRecord,
} from '@/lib/api';
import { HelpCallout } from '@/components/common/HelpCallout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';
import { useDemoData } from '@/contexts/DemoDataContext';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';

type SecurityEvent = {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  time: string;
};

/**
 * The page's own row from an abuse flag.
 *
 * `/api/admin/abuse` and `/abuse/stats` have existed all along with clients
 * for both, and this screen listed four sentences written into the source.
 *
 * Severity is the model's own 1-5 scale; the page speaks in three levels, so
 * the mapping is stated here rather than a number being rendered as if it
 * were a category.
 */
// `AbuseFlag.severity` is a 0.0-1.0 risk score (schema.prisma). Thresholds of
// 4 and 2 read every real flag as "info"; these match the abuse monitor's bar.
function levelFor(severity: number): SecurityEvent['level'] {
  if (severity >= 0.7) return 'critical';
  if (severity >= 0.4) return 'warning';
  return 'info';
}

function toSecurityEvent(flag: AbuseFlagRecord): SecurityEvent {
  return {
    id: flag.id,
    level: levelFor(flag.severity),
    // The flag type is the category: `rapid_messaging`, `ring_detection`…
    // "burst_spam" reads "Burst spam": a category starts its line.
    category: flag.type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    message: flag.description ?? `${flag.displayName ?? flag.email}: ${flag.type.replace(/_/g, ' ')}`,
    time: flag.createdAt,
  };
}

/** Shown when nothing has been flagged. */
const EVENTS: SecurityEvent[] = [
  { id: '1', level: 'warning', category: 'Auth', message: '5 failed logins from same IP (203.0.113.42)', time: '10m ago' },
  { id: '2', level: 'info', category: 'SSO', message: 'Tenant acme-corp SAML metadata refreshed', time: '1h ago' },
  { id: '3', level: 'critical', category: 'API', message: 'Unusual spike in /api/admin export calls', time: '3h ago' },
  { id: '4', level: 'info', category: 'Session', message: 'User session revoked (password reset)', time: '6h ago' },
];

const LEVEL_TONE: Record<SecurityEvent['level'], StatusTone> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

export default function SecurityMonitoringPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');

  /*
   * Real flags, with the counts taken from the stats endpoint rather than
   * from the page of rows on screen — "pending" over the whole queue and a
   * count over the loaded twenty are different statements.
   */
  const { data: flagsData } = useQuery({
    queryKey: qk('admin', 'abuse', 'flags'),
    queryFn: () => adminListAbuseFlags({ limit: 50 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: abuseStats } = useQuery({
    queryKey: qk('admin', 'abuse', 'stats'),
    queryFn: adminGetAbuseStats,
    staleTime: 30_000,
    retry: 0,
  });

  const live = useMemo(
    () => (flagsData?.flags ?? []).map(toSecurityEvent),
    [flagsData],
  );
  // Samples only with sample data on; an account with no flags sees none.
  const isLive = live.length > 0;
  const events = isLive ? live : showDemoData ? EVENTS : [];

  const filtered = events.filter(
    (e) =>
      (level === 'all' || e.level === level) &&
      (!search || e.message.toLowerCase().includes(search.toLowerCase())),
  );

  const LEVELS = [
    { value: 'all', en: 'All levels', el: 'Όλα τα επίπεδα' },
    { value: 'critical', en: 'Critical', el: 'Κρίσιμο' },
    { value: 'warning', en: 'Warning', el: 'Προειδοποίηση' },
    { value: 'info', en: 'Info', el: 'Πληροφορία' },
  ];
  usePageControls([
    choiceControl('level_filter', 'Severity level', 'Επίπεδο σοβαρότητας', LEVELS, level, setLevel),
    {
      id: 'clear_filters', labelEn: 'Clear the security filters', labelEl: 'Καθαρισμός φίλτρων ασφαλείας', writes: false,
      unavailableEn: level === 'all' && !search ? 'No filter is set.' : undefined,
      unavailableEl: level === 'all' && !search ? 'Δεν υπάρχει φίλτρο.' : undefined,
      run: () => { setLevel('all'); setSearch(''); },
    },
  ]);
  usePageList([
    {
      id: 'security_events',
      labelEn: 'Security events',
      labelEl: 'Συμβάντα ασφαλείας',
      rows: filtered.map((ev) => `${ev.level} · ${ev.category} · ${ev.message}`),
      total: events.length,
      sample: !isLive && events.length > 0,
    },
  ]);

  return (
    <AppShell
      title="Security monitoring"
      description="Authentication anomalies, API abuse signals, and SSO events in real time."
      descriptionEl="Ανωμαλίες ταυτοποίησης, ενδείξεις κατάχρησης API και συμβάντα SSO σε πραγματικό χρόνο."
      showHelp
    >
      <HelpCallout id="admin-security" title="Security events" titleEl="Συμβάντα ασφαλείας">
        <p>
          <strong>Critical</strong> events need immediate review. Failed-login clusters may indicate credential
          stuffing; export spikes may indicate data exfiltration attempts. Cross-check with audit log for context.
        </p>
        <p lang="el" className="mt-2 text-muted-foreground">
          Τα <strong>κρίσιμα</strong> συμβάντα θέλουν άμεσο έλεγχο. Ομάδες αποτυχημένων συνδέσεων μπορεί να δείχνουν
          δοκιμή κλεμμένων κωδικών· αιχμές εξαγωγών μπορεί να δείχνουν απόπειρα διαρροής. Διασταυρώστε με το αρχείο ελέγχου.
        </p>
      </HelpCallout>

      <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
        {[
          // Samples carry no review state, so pending/actioned are only
          // counted for real flags; they used to show critical and Auth rows.
          { label: 'Flags', labelEl: 'Σημάνσεις', value: isLive ? (abuseStats?.totalFlags ?? events.length) : events.length, icon: Activity },
          { label: 'Pending', labelEl: 'Σε αναμονή', value: isLive ? (abuseStats?.pendingFlags ?? 0) : '—', icon: AlertTriangle },
          { label: 'Actioned', labelEl: 'Με ενέργεια', value: isLive ? (abuseStats?.actionedFlags ?? 0) : '—', icon: Lock },
        ].map(({ label, labelEl, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <Icon className="icon-md text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
                <p className="page-stat text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search security events. Αναζήτηση συμβάντων ασφαλείας"
            placeholder={bilingualInline('Search security events…', 'Αναζήτηση συμβάντων ασφαλείας…')}
            className="pl-9"
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger aria-label="Level. Επίπεδο" className="w-full sm:w-[160px]">
            <SelectValue placeholder={bilingualInline("Level", "Επίπεδο")} />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}><BilingualText en={l.en} el={l.el} compact /></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="mt-4">
        {filtered.length === 0 && (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <BilingualText en="No security events match." el="Κανένα συμβάν ασφαλείας δεν ταιριάζει." wrap />
          </CardContent>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="flex flex-wrap items-start gap-3 border-b px-4 py-3 last:border-b-0">
            <Shield className="icon-sm mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.message}</p>
              <p className="text-xs text-muted-foreground">
                {e.category} ·{' '}
                {isLive
                  ? <RelativeTime date={e.time} format={formatRelativeTime} />
                  : e.time}
              </p>
            </div>
            <Badge variant="outline" className={cn('border capitalize', STATUS[LEVEL_TONE[e.level]].chip)}><BilingualText en={e.level} el={LEVELS.find((l) => l.value === e.level)?.el} compact /></Badge>
          </div>
        ))}
      </Card>
    </AppShell>
  );
}
