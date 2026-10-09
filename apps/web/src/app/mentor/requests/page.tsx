'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Calendar,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, initialsOf } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { formatDate } from '@/lib/i18n/format';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import {
  getMyReceivedMentorRequests,
  respondToMentorRequest,
  type MentorRequestItem,
} from '@/lib/api';
import { FactLine } from '@/components/common/FactLine';

type RequestCardProps = {
  request: MentorRequestItem;
  onAccept?: () => void;
  onDecline?: () => void;
  isResponding?: boolean;
};

const STATUS_LABEL: Record<string, { en: string; el: string }> = {
  pending: { en: 'Pending', el: 'Σε αναμονή' },
  accepted: { en: 'Accepted', el: 'Αποδεκτό' },
  declined: { en: 'Declined', el: 'Απορρίφθηκε' },
};

function RequestCard({ request, onAccept, onDecline, isResponding }: RequestCardProps) {
  const displayName = request.requester?.displayName || 'Unknown';
  const initials = initialsOf(displayName);

  const statusColors: Record<string, string> = {
    pending: 'bg-status-warning-bg text-status-warning border-status-warning-border',
    accepted: 'bg-status-success-bg text-status-success border-status-success-border',
    declined: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  };

  const formattedDate = formatDate(request.createdAt, 'en', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedDateEl = formatDate(request.createdAt, 'el', { day: 'numeric', month: 'short', year: 'numeric' });
  const statusLabel = STATUS_LABEL[request.status];

  return (
    <Card className={cn(
      'transition-all',
      request.status === 'pending' && 'border-status-warning-border'
    )}>
      <CardContent>
        <div className="flex gap-4">
          <Link href={`/profiles/${request.requesterId}`} aria-label={`${displayName}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.requester?.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary-accessible font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/profiles/${request.requesterId}`} className="font-medium hover:text-primary-accessible transition-colors">
                  {displayName}
                </Link>
                {request.requester?.headline && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {request.requester.headline}
                  </p>
                )}
              </div>
              <Badge variant="outline" className={cn('text-xs', statusColors[request.status])}>
                {request.status === 'pending' && <Clock className="icon-sm mr-1" aria-hidden="true" />}
                {request.status === 'accepted' && <CheckCircle2 className="icon-sm mr-1" aria-hidden="true" />}
                {request.status === 'declined' && <XCircle className="icon-sm mr-1" aria-hidden="true" />}
                {statusLabel ? <BilingualText en={statusLabel.en} el={statusLabel.el} compact /> : request.status}
              </Badge>
            </div>

            <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
              "{request.message}"
            </p>

            <FactLine className="mt-2" items={request.focusAreas ?? []} />

            {/* Wraps: at 390px the date and three buttons were 15px wider
                than the card, and the page scrolled sideways. */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                <BilingualText en={formattedDate} el={formattedDateEl} compact />
              </span>
              {request.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="h-7 text-xs" 
                    onClick={onAccept}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <Loader2 className="icon-sm mr-1 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="icon-sm mr-1" aria-hidden="true" />
                    )}
                    <BilingualText en="Accept" el="Αποδοχή" compact />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs" 
                    onClick={onDecline}
                    disabled={isResponding}
                  >
                    <BilingualText en="Decline" el="Απόρριψη" compact />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                    <Link href={`/messages?to=${request.requesterId}`}>
                      <MessageCircle className="icon-sm mr-1" aria-hidden="true" />
                      <BilingualText en="Message" el="Μήνυμα" compact />
                    </Link>
                  </Button>
                </div>
              )}
              {request.status === 'accepted' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <Link href={`/mentor/sessions?new=1&mentee=${request.requesterId}`}>
                    <Calendar className="icon-sm mr-1" aria-hidden="true" />
                    <BilingualText en="Schedule a session" el="Προγραμματισμός συνεδρίας" compact />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MentorRequestsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const { hasSession, mounted } = useSession();
  const queryClient = useQueryClient();
  const { error: toastError } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk('mentorships', 'requests-received'),
    queryFn: getMyReceivedMentorRequests,
    enabled: hasSession && mounted,
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      respondToMentorRequest(requestId, { accept }),
    onMutate: ({ requestId }) => {
      setRespondingId(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('mentorships', 'requests-received') });
      queryClient.invalidateQueries({ queryKey: qk('mentorships') });
    },
    // A failed answer used to vanish: the buttons came back and nothing said
    // the request was still waiting.
    onError: (e: unknown) => toastError('Could not answer the request', e instanceof Error ? e.message : undefined),
    onSettled: () => {
      setRespondingId(null);
    },
  });

  const requests = data?.requests || [];
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const acceptedRequests = requests.filter((r) => r.status === 'accepted');
  const declinedRequests = requests.filter((r) => r.status === 'declined');

  // Offered to the assistant, above the loading and error returns: the tab
  // and Accept / Decline on a pending request - the card's own mutation.
  const byRequester = (list: typeof requests) => rowOptions(list, (r) => r.id, (r) => r.requester?.displayName || 'Request');
  usePageList([
    {
      id: 'requests',
      labelEn: 'Mentorship requests',
      labelEl: 'Αιτήματα καθοδήγησης',
      rows: isLoading ? undefined : requests.map((r) => `${r.requester?.displayName || 'Unknown'}${r.requester?.headline ? ` · ${r.requester.headline}` : ''} · ${r.status}${r.focusAreas?.length ? ` · ${r.focusAreas.join(', ')}` : ''}`),
    },
  ]);
  usePageControls([
    choiceControl('request_tab', 'Request filter', 'Φίλτρο αιτημάτων', [
      { value: 'pending', en: 'Pending', el: 'Σε αναμονή' },
      { value: 'accepted', en: 'Accepted', el: 'Αποδεκτά' },
      { value: 'declined', en: 'Declined', el: 'Απορριφθέντα' },
    ], activeTab, setActiveTab),
    { id: 'accept_request', labelEn: 'Accept mentorship request', labelEl: 'Αποδοχή αιτήματος καθοδήγησης', writes: true, options: byRequester(pendingRequests), unavailableEn: pendingRequests.length ? undefined : 'No request is waiting.', unavailableEl: pendingRequests.length ? undefined : 'Κανένα αίτημα δεν περιμένει.', run: async (v) => { if (v) await respondMutation.mutateAsync({ requestId: v, accept: true }); } },
    { id: 'decline_request', labelEn: 'Decline mentorship request', labelEl: 'Απόρριψη αιτήματος καθοδήγησης', writes: true, options: byRequester(pendingRequests), unavailableEn: pendingRequests.length ? undefined : 'No request is waiting.', unavailableEl: pendingRequests.length ? undefined : 'Κανένα αίτημα δεν περιμένει.', run: async (v) => { if (v) await respondMutation.mutateAsync({ requestId: v, accept: false }); } },
  ]);

  if (!mounted) {
    return (
      <AppShell showHelp>
        <div className="py-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="icon-xl animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell showHelp>
        <div className="py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive-accessible mb-4" />
              <h3 className="font-medium"><BilingualText en="Requests could not be loaded" el="Δεν ήταν δυνατή η φόρτωση των αιτημάτων" /></h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : <BilingualText en="An error occurred" el="Παρουσιάστηκε σφάλμα" compact />}
              </p>
              <Button className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showHelp
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('icon-sm mr-2', isLoading && 'animate-spin')} aria-hidden="true" />
            <BilingualText en="Refresh" el="Ανανέωση" compact />
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 kpi-odd-span-md gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-warning-bg p-2">
                <Clock className="icon-md text-status-warning" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Pending" el="Σε αναμονή" compact wrap /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-success-bg p-2">
                <CheckCircle2 className="icon-md text-status-success" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{acceptedRequests.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Accepted" el="Αποδεκτά" compact wrap /></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-status-danger-bg p-2">
                <XCircle className="icon-md text-status-danger" />
              </div>
              <div>
                <p className="page-stat text-xl font-bold">{declinedRequests.length}</p>
                <p className="text-sm text-muted-foreground"><BilingualText en="Declined" el="Απορριφθέντα" compact wrap /></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <BilingualText en="Pending" el="Σε αναμονή" compact />
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted"><BilingualText en="Accepted" el="Αποδεκτά" compact /></TabsTrigger>
            <TabsTrigger value="declined"><BilingualText en="Declined" el="Απορριφθέντα" compact /></TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-xl animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequests.length > 0 ? (
              pendingRequests.map((request) => (
                <RequestCard 
                  key={request.id} 
                  request={request}
                  onAccept={() => respondMutation.mutate({ requestId: request.id, accept: true })}
                  onDecline={() => respondMutation.mutate({ requestId: request.id, accept: false })}
                  isResponding={respondingId === request.id}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No pending requests" el="Δεν υπάρχουν αιτήματα σε αναμονή" /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="New mentorship requests will appear here." el="Τα νέα αιτήματα καθοδήγησης θα εμφανίζονται εδώ." wrap />
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-3 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-xl animate-spin text-muted-foreground" />
              </div>
            ) : acceptedRequests.length > 0 ? (
              acceptedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No accepted requests" el="Δεν υπάρχουν αποδεκτά αιτήματα" /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="Accepted requests will appear here." el="Τα αποδεκτά αιτήματα θα εμφανίζονται εδώ." wrap />
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="declined" className="space-y-3 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-xl animate-spin text-muted-foreground" />
              </div>
            ) : declinedRequests.length > 0 ? (
              declinedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <h3 className="font-medium"><BilingualText en="No declined requests" el="Δεν υπάρχουν απορριφθέντα αιτήματα" /></h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <BilingualText en="Declined requests will appear here." el="Τα απορριφθέντα αιτήματα θα εμφανίζονται εδώ." wrap />
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
