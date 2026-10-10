'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Filter,
  MoreVertical,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Inbox,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatRelativeTime } from '@/lib/utils';
import { listServiceInquiries, updateServiceInquiry, type ServiceInquiryItem } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { choiceControl, ROW_GONE, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { bilingualInline } from '@/lib/i18n/format';
import { StatusText } from '@/components/common/StatusText';

type Inquiry = {
  id: string;
  clientName: string;
  clientAvatar?: string;
  clientCompany?: string;
  service: string;
  message: string;
  receivedAt: string;
  status: 'new' | 'replied' | 'converted' | 'declined';
  budget?: string;
  /** The requester's user id on live rows; Reply and View Profile use it. */
  clientId?: string;
};

function InquiryCard({
  inquiry,
  onStatus,
}: {
  inquiry: Inquiry;
  /** Absent on sample rows: there is no inquiry behind them to update. */
  onStatus?: (inquiry: Inquiry, status: 'in_discussion' | 'accepted' | 'declined') => void;
}) {
  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    new: { color: 'bg-status-info-bg text-status-info border-status-info-border', icon: Mail },
    replied: { color: 'bg-status-warning-bg text-status-warning border-status-warning-border', icon: Clock },
    converted: { color: 'bg-status-success-bg text-status-success border-status-success-border', icon: CheckCircle },
    declined: { color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
  };

  const config = statusConfig[inquiry.status];
  const StatusIcon = config.icon;

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={inquiry.clientAvatar} />
              <AvatarFallback>{inquiry.clientName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          title={(
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{inquiry.clientName}</span>
              <Badge variant="outline" className={cn('text-xs', config.color)}>
                <StatusIcon className="mr-1 icon-sm" />
                <StatusText value={inquiry.status} />
              </Badge>
            </span>
          )}
          subtitle={inquiry.clientCompany || undefined}
          asideStays
          aside={(
            <>
              <span className="whitespace-nowrap">
                <RelativeTime date={inquiry.receivedAt} format={formatRelativeTime} />
              </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open inquiry actions for ${inquiry.clientName}`}>
                      <MoreVertical className="icon-sm" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* All four had no handler. Replying opens a thread with the
                        client and moves the inquiry into discussion; converting
                        accepts it; the statuses are the API's own. */}
                    <DropdownMenuItem
                      disabled={!inquiry.clientId}
                      onSelect={() => {
                        if (!inquiry.clientId) return;
                        onStatus?.(inquiry, 'in_discussion');
                        window.location.assign(`/messages?to=${inquiry.clientId}`);
                      }}
                    >
                      <BilingualText en="Reply" el="Απάντηση" compact />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!onStatus || inquiry.status === 'converted'}
                      onSelect={() => onStatus?.(inquiry, 'accepted')}
                    >
                      <BilingualText en="Mark as Converted" el="Σήμανση ως πελάτη" compact />
                    </DropdownMenuItem>
                    {inquiry.clientId ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/profiles/${inquiry.clientId}`}><BilingualText en="View Profile" el="Προβολή προφίλ" compact /></Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled><BilingualText en="View Profile" el="Προβολή προφίλ" compact /></DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive-accessible"
                      disabled={!onStatus || inquiry.status === 'declined'}
                      onSelect={() => onStatus?.(inquiry, 'declined')}
                    >
                      <BilingualText en="Decline" el="Απόρριψη" compact />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </>
          )}
        />
        {/* The service asked about is a fact, the message the body. */}
        <p className="text-xs font-medium text-muted-foreground">{inquiry.service}</p>
        <p className="card-body text-muted-foreground">{inquiry.message}</p>
            {inquiry.status === 'new' && (
              <div className="flex gap-2 border-t border-border pt-3">
                {/* Both had no handler; they do what the menu's Reply and
                    View Profile do. */}
                <Button
                  size="sm"
                  disabled={!inquiry.clientId}
                  onClick={() => {
                    if (!inquiry.clientId) return;
                    onStatus?.(inquiry, 'in_discussion');
                    window.location.assign(`/messages?to=${inquiry.clientId}`);
                  }}
                >
                  <BilingualText en="Reply" el="Απάντηση" compact />
                </Button>
                {inquiry.clientId ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/profiles/${inquiry.clientId}`}><BilingualText en="View Details" el="Λεπτομέρειες" compact /></Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled><BilingualText en="View Details" el="Λεπτομέρειες" compact /></Button>
                )}
              </div>
            )}
      </CardContent>
    </Card>
  );
}

/**
 * The page's own row from a service inquiry.
 *
 * `ServiceInquiry` has been in the schema all along with no controller over
 * it, so this screen listed a fixed array while the marketplace sent people
 * off-platform through a `contactUrl`.
 *
 * The page speaks in four states and the model in six; `in_discussion` is
 * what "replied" means, and `cancelled` sits with `declined` because both end
 * the conversation without work.
 */
const INQUIRY_STATE: Record<string, Inquiry['status']> = {
  open: 'new',
  in_discussion: 'replied',
  accepted: 'converted',
  completed: 'converted',
  declined: 'declined',
  cancelled: 'declined',
};

function toPageInquiry(row: ServiceInquiryItem): Inquiry {
  return {
    id: row.id,
    clientName: row.client?.displayName ?? 'Someone',
    clientId: row.client?.id,
    clientAvatar: row.client?.avatarUrl ?? undefined,
    service: row.offer.title,
    message: row.message,
    receivedAt: row.createdAt,
    status: INQUIRY_STATE[row.status] ?? 'new',
    budget:
      row.budgetEstimate != null
        ? new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: row.currency,
            maximumFractionDigits: 0,
          }).format(row.budgetEstimate)
        : undefined,
  };
}

/** Shown to a provider with no inquiries yet. */
const MOCK_INQUIRIES: Inquiry[] = [
    {
      id: '1',
      clientName: 'John Doe',
      clientCompany: 'TechStart Inc',
      service: 'Startup Legal Package',
      message: 'Hi, I need help with my startup incorporation documents. We are a team of 3 co-founders and need founder agreements as well.',
      receivedAt: '2026-09-04T08:00:00.000Z',
      status: 'new',
      budget: '€2,000–3,000',
    },
    {
      id: '2',
      clientName: 'Jane Smith',
      clientCompany: 'GreenTech Co',
      service: 'Financial Model Creation',
      message: 'Looking for help with our Series A financial model. We need 5-year projections with multiple scenarios.',
      receivedAt: '2026-09-03T10:00:00.000Z',
      status: 'replied',
      budget: '€3,500–5,000',
    },
    {
      id: '3',
      clientName: 'Mike Johnson',
      clientCompany: 'DataFlow',
      service: 'Contract Review',
      message: 'Need to review our terms of service and privacy policy before launch.',
      receivedAt: '2026-09-02T10:00:00.000Z',
      status: 'converted',
      budget: '€1,500',
    },
    {
      id: '4',
      clientName: 'Sarah Williams',
      clientCompany: 'HealthPulse',
      service: 'Startup Legal Package',
      message: 'Interested in your legal package. Can you provide more details on what is included?',
      receivedAt: '2026-09-01T10:00:00.000Z',
      status: 'new',
      budget: '€2,500',
    },
    {
      id: '5',
      clientName: 'Tom Brown',
      service: 'Pitch Deck Design',
      message: 'Looking for a pitch deck redesign for our upcoming fundraise.',
      receivedAt: '2026-08-28T10:00:00.000Z',
      status: 'declined',
      budget: '€800',
    },
  ];

export default function ProviderInquiriesPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: qk('provider', 'inquiries'),
    queryFn: () => listServiceInquiries({ side: 'provider', limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });

  const live = useMemo(() => (data?.inquiries ?? []).map(toPageInquiry), [data]);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const setStatus = async (inq: Inquiry, status: 'in_discussion' | 'accepted' | 'declined'): Promise<PageControlRunResult> => {
    try {
      await updateServiceInquiry(inq.id, { status });
      if (status !== 'in_discussion') success(status === 'accepted' ? 'Marked as converted' : 'Inquiry declined', inq.clientName);
    } catch (e) {
      toastError('Could not update the inquiry', e instanceof Error ? e.message : undefined);
      return { error: e instanceof Error && e.message ? e.message : 'The inquiry did not change.' };
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk('provider', 'inquiries') });
    }
  };
  const inquiries =
    live.length > 0 ? live : isLoading ? [] : showDemoData ? MOCK_INQUIRIES : [];

  const conversionRate = Math.round((inquiries.filter((i) => i.status === 'converted').length / Math.max(inquiries.length, 1)) * 100);
  const responseRate = Math.round(((inquiries.filter((i) => i.status === 'replied' || i.status === 'converted').length) / Math.max(inquiries.length, 1)) * 100);

  const filteredInquiries = inquiries.filter((i) => {
    const matchesSearch =
      !search ||
      i.clientName.toLowerCase().includes(search.toLowerCase()) ||
      i.service.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || i.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const counts = {
    all: inquiries.length,
    new: inquiries.filter((i) => i.status === 'new').length,
    replied: inquiries.filter((i) => i.status === 'replied').length,
    converted: inquiries.filter((i) => i.status === 'converted').length,
  };

  // Offered to the assistant: the tab and the card menu - reply (which
  // opens the thread and marks the inquiry in discussion), convert, decline.
  // The sample inquiries have no row behind them, as their menus say.
  const sampleEn = live.length > 0 ? undefined : 'These inquiries are samples; there is nothing behind them to update.';
  const sampleEl = live.length > 0 ? undefined : 'Τα αιτήματα είναι δείγματα· δεν υπάρχει κάτι πίσω τους για ενημέρωση.';
  const byClient = (list: Inquiry[]) => rowOptions(list, (i) => i.id, (i) => i.clientName);
  const inquiryById = (id?: string) => inquiries.find((i) => i.id === id);
  usePageList([
    {
      id: 'inquiries',
      labelEn: 'Inquiries',
      labelEl: 'Αιτήματα',
      rows: isLoading ? undefined : filteredInquiries.map((i) => `${i.clientName}${i.clientCompany ? ` (${i.clientCompany})` : ''} · ${i.service} · ${i.status}${i.budget ? ` · budget ${i.budget}` : ''}`),
      total: inquiries.length,
      sample: live.length === 0,
    },
  ]);
  usePageControls([
    choiceControl('inquiry_tab', 'Inquiry filter', 'Φίλτρο αιτημάτων', [
      { value: 'all', en: 'All', el: 'Όλα' },
      { value: 'new', en: 'New', el: 'Νέα' },
      { value: 'replied', en: 'Replied', el: 'Απαντημένα' },
      { value: 'converted', en: 'Converted', el: 'Μετατράπηκαν' },
    ], activeTab, setActiveTab),
    {
      id: 'reply_inquiry',
      labelEn: 'Reply to inquiry',
      labelEl: 'Απάντηση σε αίτημα',
      writes: true,
      options: byClient(filteredInquiries.filter((i) => i.clientId)),
      unavailableEn: sampleEn,
      unavailableEl: sampleEl,
      // The status is stored before the thread opens, and the thread opens
      // in place: a full reload used to cut the request off mid-flight and
      // take the assistant's conversation down with the page.
      run: async (v) => {
        const inq = inquiryById(v);
        if (!inq?.clientId) return ROW_GONE;
        const result = await setStatus(inq, 'in_discussion');
        if (result) return result;
        router.push(`/messages?to=${inq.clientId}`);
      },
    },
    { id: 'convert_inquiry', labelEn: 'Mark inquiry as converted', labelEl: 'Σήμανση αιτήματος ως πελάτη', writes: true, options: byClient(filteredInquiries.filter((i) => i.status !== 'converted')), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const inq = inquiryById(v); return inq ? setStatus(inq, 'accepted') : ROW_GONE; } },
    { id: 'decline_inquiry', labelEn: 'Decline inquiry', labelEl: 'Απόρριψη αιτήματος', writes: true, options: byClient(filteredInquiries.filter((i) => i.status !== 'declined')), unavailableEn: sampleEn, unavailableEl: sampleEl, run: (v) => { const inq = inquiryById(v); return inq ? setStatus(inq, 'declined') : ROW_GONE; } },
  ]);

  return (
    <AppShell
      title="Inquiries"
      titleEl="Αιτήματα"
      description="Manage incoming service inquiries"
      descriptionEl="Διαχειριστείτε τα εισερχόμενα αιτήματα για τις υπηρεσίες σας"
    >
      <div className="space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Inquiries', labelEl: 'Σύνολο αιτημάτων', value: inquiries.length, icon: Inbox, color: 'text-primary-accessible' },
            { label: 'New', labelEl: 'Νέα', value: counts.new, icon: Mail, color: 'text-status-info' },
            { label: 'Response Rate', labelEl: 'Ποσοστό απαντήσεων', value: `${responseRate}%`, icon: TrendingUp, color: 'text-status-success' },
            { label: 'Conversion', labelEl: 'Μετατροπή σε πελάτες', value: `${conversionRate}%`, icon: DollarSign, color: 'text-status-warning' },
          ].map(({ label, labelEl, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-secondary"><Icon className={cn('icon-sm', color)} /></div>
                <div>
                  <p className="page-stat font-bold tabular-nums">{value}</p>
                  <p className="text-2xs text-muted-foreground"><BilingualText en={label} el={labelEl} compact wrap /></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search inquiries", "Αναζήτηση αιτημάτων")}
            placeholder={bilingualInline("Search inquiries…", "Αναζήτηση αιτημάτων…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              <BilingualText en="All" el="Όλα" compact /> <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="new">
              <BilingualText en="New" el="Νέο" compact /> <Badge variant="secondary" className="ml-1">{counts.new}</Badge>
            </TabsTrigger>
            <TabsTrigger value="replied">
              <BilingualText en="Replied" el="Απαντήθηκε" compact /> <Badge variant="secondary" className="ml-1">{counts.replied}</Badge>
            </TabsTrigger>
            <TabsTrigger value="converted">
              <BilingualText en="Converted" el="Έγινε πελάτης" compact /> <Badge variant="secondary" className="ml-1">{counts.converted}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filteredInquiries.map((inquiry) => (
              <InquiryCard key={inquiry.id} inquiry={inquiry} onStatus={live.length > 0 ? (i, st) => void setStatus(i, st) : undefined} />
            ))}
            {filteredInquiries.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No inquiries found" el="Δεν βρέθηκαν ερωτήματα" compact /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === 'all'
                      ? 'You have no inquiries yet'
                      : `No ${activeTab} inquiries`}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
