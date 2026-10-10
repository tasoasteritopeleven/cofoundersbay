'use client';

import { useState } from 'react';
import {
  Shield,
  Flag,
  UserX,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  MoreVertical,
  Eye,
  Ban,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { FactLine } from '@/components/common/FactLine';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ListEmptyState, NoFilterResults } from '@/components/common/EmptyStates';
import { cn } from '@/lib/utils';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { STATUS } from '@/lib/semantic-colors';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { useDemoData } from '@/contexts/DemoDataContext';

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

type ModerationReport = {
  id: string;
  type: 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'off-topic';
  contentType: 'post' | 'comment' | 'profile' | 'member';
  contentPreview: string;
  reportedBy: string;
  reportedUser: string;
  groupName: string;
  status: ReportStatus;
  reportedHoursAgo: number;
  priority: 'high' | 'medium' | 'low';
};

const CONTENT_EL: Record<ModerationReport['contentType'], string> = { post: 'ανάρτηση', comment: 'σχόλιο', profile: 'προφίλ', member: 'μέλος' };

const TYPE_CONFIG: Record<ModerationReport['type'], { label: string; labelEl: string; chip: string }> = {
  spam: { label: 'Spam', labelEl: 'Ανεπιθύμητο', chip: STATUS.warning.chip },
  harassment: { label: 'Harassment', labelEl: 'Παρενόχληση', chip: STATUS.danger.chip },
  misinformation: { label: 'Misinformation', labelEl: 'Παραπληροφόρηση', chip: STATUS.warning.chip },
  inappropriate: { label: 'Inappropriate', labelEl: 'Ακατάλληλο', chip: STATUS.accent.chip },
  'off-topic': { label: 'Off-topic', labelEl: 'Εκτός θέματος', chip: STATUS.neutral.chip },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; labelEl: string; chip: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', labelEl: 'Σε αναμονή', chip: STATUS.warning.chip, icon: Clock },
  reviewed: { label: 'Reviewed', labelEl: 'Ελέγχθηκε', chip: STATUS.info.chip, icon: Eye },
  resolved: { label: 'Resolved', labelEl: 'Επιλύθηκε', chip: STATUS.success.chip, icon: CheckCircle },
  dismissed: { label: 'Dismissed', labelEl: 'Απορρίφθηκε', chip: STATUS.neutral.chip, icon: XCircle },
};

// Samples, shown only with sample data on: there is no group-report store.
// Reporters are demo-world members and the groups are the demo world's
// communities; the reported accounts are throwaway handles, not people.
const SAMPLE_REPORTS: ModerationReport[] = [
  { id: '1', type: 'spam', contentType: 'post', contentPreview: 'Guaranteed 10x returns - DM me for a private allocation before Friday...', reportedBy: 'Sofia Alexiou', reportedUser: 'quick-returns-2026', groupName: 'Pre-Seed Fundraising', status: 'pending', reportedHoursAgo: 2, priority: 'high' },
  { id: '2', type: 'harassment', contentType: 'comment', contentPreview: 'Nobody in this room will fund an idea this weak. Quit now...', reportedBy: 'Yannis Petrou', reportedUser: 'anon_founder_77', groupName: 'Athens Founders', status: 'pending', reportedHoursAgo: 4, priority: 'high' },
  { id: '3', type: 'misinformation', contentType: 'post', contentPreview: 'Every eval framework fails in production, so do not bother measuring...', reportedBy: 'Marcus Chen', reportedUser: 'ml-hot-takes', groupName: 'AI Builders EU', status: 'reviewed', reportedHoursAgo: 26, priority: 'medium' },
  { id: '4', type: 'off-topic', contentType: 'post', contentPreview: 'Looking for a flatmate in Pangrati from October...', reportedBy: 'Maria Georgiou', reportedUser: 'new-member-381', groupName: 'SaaS Metrics Circle', status: 'resolved', reportedHoursAgo: 50, priority: 'low' },
  { id: '5', type: 'inappropriate', contentType: 'profile', contentPreview: 'The profile is a block of promotional links...', reportedBy: 'Katerina Nikolaou', reportedUser: 'promo-links-bot', groupName: 'Women Founders Greece', status: 'dismissed', reportedHoursAgo: 75, priority: 'low' },
];

/** "2h ago" / "πριν 2 ώ." from the sample's age; samples carry ages, not dates. */
function ageLabel(hours: number): { en: string; el: string } {
  if (hours < 24) return { en: `${hours}h ago`, el: `πριν ${hours} ώ.` };
  const days = Math.floor(hours / 24);
  return { en: `${days}d ago`, el: `πριν ${days} ημ.` };
}

function ReportCard({ report }: { report: ModerationReport }) {
  const typeCfg = TYPE_CONFIG[report.type];
  const statusCfg = STATUS_CONFIG[report.status];
  const StatusIcon = statusCfg.icon;

  // A report reads like every request card: the kind of report as its
  // mark and title, who and where under it, its state and menu at the right,
  // then the quoted content, the facts and the actions on the mark's edge.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <div data-card-mark="" data-keep-icon className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', typeCfg.chip)}>
              <AlertTriangle className="icon-md" aria-hidden="true" />
            </div>
          )}
          title={<BilingualText en={typeCfg.label} el={typeCfg.labelEl} compact />}
          subtitle={(
            <FactLine
              className="text-sm"
              items={[
                <span key="against"><BilingualText en="Against" el="Κατά" compact />: <span className="text-foreground">{report.reportedUser}</span></span>,
                <span key="in"><BilingualText en="In" el="Στην" compact />: {report.groupName}</span>,
              ]}
            />
          )}
          asideStays
          aside={(
            <>
              <Badge variant="outline" className={cn('text-xs border', statusCfg.chip)}>
                <StatusIcon className="mr-1 icon-sm" aria-hidden="true" />
                <BilingualText en={statusCfg.label} el={statusCfg.labelEl} compact />
              </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Report actions. Ενέργειες αναφοράς">
                      <MoreVertical className="icon-sm" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* The queue is sample data (see the notice above the list):
                        there is no group-report store behind it, so none of
                        these can act, and each says so. */}
                    <UnavailableMenuItem icon={<Eye className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="View Content" el="Προβολή περιεχομένου" reasonEn="Sample report - group reports have no queue yet." reasonEl="Δείγμα - οι αναφορές ομάδων δεν έχουν ακόμη ουρά." />
                    <UnavailableMenuItem icon={<CheckCircle className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="Mark Resolved" el="Επίλυση" reasonEn="Sample report - group reports have no queue yet." reasonEl="Δείγμα - οι αναφορές ομάδων δεν έχουν ακόμη ουρά." />
                    <UnavailableMenuItem icon={<XCircle className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="Dismiss" el="Απόρριψη" reasonEn="Sample report - group reports have no queue yet." reasonEl="Δείγμα - οι αναφορές ομάδων δεν έχουν ακόμη ουρά." />
                    <UnavailableMenuItem icon={<UserX className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="Remove Member" el="Αφαίρεση μέλους" reasonEn="Sample report - group reports have no queue yet." reasonEl="Δείγμα - οι αναφορές ομάδων δεν έχουν ακόμη ουρά." />
                    <UnavailableMenuItem className="text-destructive-accessible" icon={<Ban className="mr-2 mt-0.5 icon-sm" aria-hidden="true" />} en="Ban User" el="Αποκλεισμός χρήστη" reasonEn="Sample report - group reports have no queue yet." reasonEl="Δείγμα - οι αναφορές ομάδων δεν έχουν ακόμη ουρά." />
                  </DropdownMenuContent>
                </DropdownMenu>
            </>
          )}
        />
        <p className="card-body line-clamp-2 italic text-muted-foreground">
          &ldquo;{report.contentPreview}&rdquo;
        </p>
        <FactLine
          items={[
            report.priority === 'high' ? (
              <span key="priority" className="font-medium text-destructive-accessible"><BilingualText en="High Priority" el="Υψηλή προτεραιότητα" compact /></span>
            ) : null,
            <span key="content" className="capitalize"><BilingualText en={report.contentType} el={CONTENT_EL[report.contentType]} compact /></span>,
            <span key="by"><BilingualText en="Reported by" el="Αναφορά από" compact />: <span className="font-medium text-foreground">{report.reportedBy}</span></span>,
          ]}
        />
        <CardFoot meta={<BilingualText en={ageLabel(report.reportedHoursAgo).en} el={ageLabel(report.reportedHoursAgo).el} compact />}>
          {report.status === 'pending' && (
            <>
              <Button size="sm" variant="default" disabled title="Sample report - group reports have no queue yet"><CheckCircle className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Resolve" el="Επίλυση" compact /></Button>
              <Button size="sm" variant="outline" disabled title="Sample report - group reports have no queue yet"><XCircle className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Dismiss" el="Απόρριψη" compact /></Button>
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive-accessible" disabled title="Sample report - group reports have no queue yet"><Ban className="mr-1 icon-sm" aria-hidden="true" /><BilingualText en="Ban User" el="Αποκλεισμός χρήστη" compact /></Button>
            </>
          )}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

export default function GroupsModerationPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const { showDemoData } = useDemoData();
  const reports = showDemoData ? SAMPLE_REPORTS : [];
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const highPriority = reports.filter(r => r.priority === 'high' && r.status === 'pending').length;

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = !search || r.reportedUser.toLowerCase().includes(q) || r.groupName.toLowerCase().includes(q) || r.contentPreview.toLowerCase().includes(q);
    const matchesTab = activeTab === 'all' || r.status === activeTab;
    return matchesSearch && matchesTab;
  });

  // Offered to the assistant: the queue tab; the reports go out as a sample
  // list, since there is no group moderation queue behind them yet.
  usePageList([
    {
      id: 'reports',
      labelEn: 'Group reports',
      labelEl: 'Αναφορές κοινοτήτων',
      rows: filtered.map((r) => `${r.type} · ${r.contentType} by ${r.reportedUser} in ${r.groupName} · ${r.status} · ${r.priority} priority · ${ageLabel(r.reportedHoursAgo).en}`),
      total: reports.length,
      sample: reports.length > 0,
    },
  ]);
  usePageControls([
    choiceControl('report_tab', 'Report queue', 'Ουρά αναφορών', [
      { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
      { value: 'reviewed', en: 'Reviewed', el: 'Εξετασμένες' },
      { value: 'resolved', en: 'Resolved', el: 'Επιλυμένες' },
      { value: 'all', en: 'All', el: 'Όλες' },
    ], activeTab, setActiveTab),
  ]);

  return (
    <AppShell
      title="Moderation queue"
      titleEl="Ουρά εποπτείας"
      description="Review and action community reports. High-priority items are flagged first so nothing urgent slips through."
      descriptionEl="Ελέγξτε και χειριστείτε αναφορές κοινοτήτων. Τα επείγοντα εμφανίζονται πρώτα, ώστε να μη χάνεται τίποτα."
    >
      <div className="space-y-6">
        {reports.length > 0 && (
          <SampleDataNotice
            surface="Community moderation"
            detail="These reports are samples - reports filed against people are handled in the platform moderation queue (Admin -> Reports), and group-level reports have no store yet."
            askAiPrompt="Where do I handle reports about a member of my community?"
          />
        )}
        {/* Alert Banner */}
        {highPriority > 0 && (
          <Card className="border-status-danger-border/40 bg-status-danger-bg">
            <CardContent className="flex items-center gap-3">
              <AlertTriangle className={cn('icon-md shrink-0', STATUS.danger.icon)} />
              <p className="text-sm">
                <BilingualText
                  en={`${highPriority} high-priority report${highPriority > 1 ? 's' : ''} need attention now`}
                  el={`${highPriority} ${highPriority > 1 ? 'αναφορές' : 'αναφορά'} υψηλής προτεραιότητας ${highPriority > 1 ? 'χρειάζονται' : 'χρειάζεται'} άμεση προσοχή`}
                  wrap
                />
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-4">
          {[
            { label: 'Pending', labelEl: 'Σε αναμονή', value: pendingCount, color: STATUS.warning.icon },
            { label: 'High Priority', labelEl: 'Υψηλή προτεραιότητα', value: highPriority, color: STATUS.danger.icon },
            { label: 'Resolved', labelEl: 'Επιλυμένες', value: reports.filter(r => r.status === 'resolved').length, color: STATUS.success.icon },
            { label: 'Total Reports', labelEl: 'Σύνολο αναφορών', value: reports.length, color: 'text-foreground' },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent>
                <p className="text-xs text-muted-foreground"><BilingualText en={stat.label} el={stat.labelEl} compact wrap /></p>
                <p className={cn('page-stat text-2xl font-bold', stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input aria-label={bilingualAria("Search reports", "Αναζήτηση αναφορών")} placeholder={bilingualInline("Search reports…", "Αναζήτηση αναφορών…")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending"><BilingualText en={`Pending (${pendingCount})`} el={`Σε αναμονή (${pendingCount})`} compact /></TabsTrigger>
            <TabsTrigger value="reviewed"><BilingualText en="Reviewed" el="Ελεγμένες" compact /></TabsTrigger>
            <TabsTrigger value="resolved"><BilingualText en="Resolved" el="Επιλυμένες" compact /></TabsTrigger>
            <TabsTrigger value="all"><BilingualText en={`All (${reports.length})`} el={`Όλες (${reports.length})`} compact /></TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filtered.map(report => <ReportCard key={report.id} report={report} />)}
            {filtered.length === 0 && (
              search ? (
                <NoFilterResults entity="reports" onClear={() => setSearch('')} />
              ) : activeTab === 'pending' ? (
                <ListEmptyState
                  icon={CheckCircle}
                  tone="success"
                  title={<BilingualText en="All caught up" el="Όλα εντάξει" wrap />}
                  description={reports.length === 0 ? (
                    <BilingualText
                      en="Group reports have no queue yet. Reports about a member are handled in Admin → Reports."
                      el="Οι αναφορές κοινοτήτων δεν έχουν ακόμη ουρά. Οι αναφορές για μέλη χειρίζονται στο Διαχείριση → Αναφορές."
                      wrap
                    />
                  ) : (
                    <BilingualText
                      en="There are no pending reports to review. New community reports will appear here for action."
                      el="Δεν υπάρχουν αναφορές σε αναμονή. Οι νέες αναφορές κοινοτήτων θα εμφανίζονται εδώ."
                      wrap
                    />
                  )}
                />
              ) : (
                <ListEmptyState
                  icon={Shield}
                  tone="neutral"
                  title={<BilingualText en="No reports here" el="Καμία αναφορά εδώ" wrap />}
                  description={<BilingualText en="There are no reports in this view right now." el="Δεν υπάρχουν αναφορές σε αυτή την προβολή αυτή τη στιγμή." wrap />}
                />
              )
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
