'use client';

import { useEffect, useMemo, useState } from 'react';
import { EndorsementBasisLine } from '@/components/endorsements/EndorsementBasisLine';
import { isEndorsementBasis, type EndorsementBasis } from '@cofounderbay/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  getMeProfile,
  getEndorsementsForUser,
  getGivenEndorsements,
  getEndorsementStats,
  approveEndorsement,
  declineEndorsement,
  listConnectionRequests,
  type EndorsementItem,
} from '@/lib/api';
import { queryKeys, qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { MessageButton } from '@/components/common/PersonActions';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { bilingualInline, formatDate } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { GiveEndorsementDialog } from '@/components/endorsements/GiveEndorsementDialog';
import {
  Handshake, Plus, Star, CheckCircle2, Clock, Award, BadgeCheck,
  ThumbsUp, ThumbsDown, Search, Users, UserPlus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailStats } from '@/components/layout/RailParts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useStoredUser } from '@/hooks/useStoredUser';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { cn, initialsOf } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Endorsement = {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  fromUserRole?: string;
  toUserId: string;
  toUserName: string;
  toUserAvatar?: string;
  toUserRole?: string;
  skill?: string;
  content: string;
  relationship?: string;
  /** What the platform can see behind it: agreed terms, a mentoring session, a shared cohort. */
  basis?: EndorsementBasis[];
  isApproved: boolean;
  /** ISO timestamp, or null for a sample before the page knows today's date. */
  createdAt: string | null;
};

type SkillEndorsement = {
  skill: string;
  count: number;
  endorsers: { name: string; avatar?: string }[];
};

// ── Sample data ────────────────────────────────────────────────────────────────

/*
 * Shown while sample data is on. The people are the demo world's own - the
 * mentor, co-founder, investor and founder the rest of the showcase shows -
 * in the roles it gives them, and each date is an age in days, so the samples
 * stay recent whenever the page is opened.
 */
type SampleEndorsement = Omit<Endorsement, 'createdAt'> & { ageDays: number };

const SAMPLE_RECEIVED: SampleEndorsement[] = [
  {
    id: 'sample-end-1', fromUserId: 'user-elena', fromUserName: 'Elena Papadopoulos', fromUserRole: 'Founder & CEO at Harbor',
    toUserId: 'me', toUserName: 'Alex Demo', skill: 'Go-to-market', relationship: 'Peer founder',
    content: 'Alex shared their outbound playbook with our team without being asked. Two of our first five customers came from it.',
    isApproved: false, ageDays: 1,
  },
  {
    id: 'sample-end-2', fromUserId: 'user-marcus', fromUserName: 'Marcus Chen', fromUserRole: 'Technical cofounder · Full-stack',
    toUserId: 'me', toUserName: 'Alex Demo', skill: 'Customer discovery', relationship: 'Trial project',
    content: 'We spent two weeks on a trial project. Alex ran twelve customer interviews in that time and came back with the one feature we should cut.',
    isApproved: false, ageDays: 3,
  },
  {
    id: 'sample-end-3', fromUserId: 'user-sarah', fromUserName: 'Dr. Sarah Kim', fromUserRole: 'Startup mentor',
    toUserId: 'me', toUserName: 'Alex Demo', skill: 'Product strategy', relationship: 'Mentor', basis: ['mentoring'],
    content: 'Alex takes feedback on Monday and ships the change by Friday. Over six sessions the onboarding went from nine steps to three.',
    isApproved: true, ageDays: 12,
  },
  {
    id: 'sample-end-4', fromUserId: 'user-nikos', fromUserName: 'Nikos Andreou', fromUserRole: 'Angel investor · Seed',
    toUserId: 'me', toUserName: 'Alex Demo', skill: 'Fundraising', relationship: 'Investor',
    content: 'A well-prepared founder: knows the numbers, answers the hard question first, and follows up when promised.',
    isApproved: true, ageDays: 30,
  },
];

const SAMPLE_GIVEN: SampleEndorsement[] = [
  {
    id: 'sample-end-5', fromUserId: 'me', fromUserName: 'Alex Demo',
    toUserId: 'user-marcus', toUserName: 'Marcus Chen', toUserRole: 'Technical cofounder · Full-stack',
    skill: 'Full-stack engineering', relationship: 'Trial project',
    content: 'Marcus shipped a working prototype in nine days, with tests, and wrote down every shortcut he took.',
    isApproved: false, ageDays: 5,
  },
  {
    id: 'sample-end-6', fromUserId: 'me', fromUserName: 'Alex Demo',
    toUserId: 'user-elena', toUserName: 'Elena Papadopoulos', toUserRole: 'Founder & CEO at Harbor',
    skill: 'Product', relationship: 'Peer founder',
    content: "Elena sees the product from the customer's chair. Her teardown of our onboarding was the most useful hour of the quarter.",
    isApproved: true, ageDays: 20,
  },
];

const SAMPLE_CONNECTIONS = [
  { id: 'user-sarah', name: 'Dr. Sarah Kim', role: 'Mentor' },
  { id: 'user-marcus', name: 'Marcus Chen', role: 'Co-founder' },
  { id: 'user-nikos', name: 'Nikos Andreou', role: 'Investor' },
  { id: 'user-elena', name: 'Elena Papadopoulos', role: 'Founder' },
];

function stampSample(rows: SampleEndorsement[], now: number | null): Endorsement[] {
  return rows.map(({ ageDays, ...row }) => ({
    ...row,
    createdAt: now == null ? null : new Date(now - ageDays * 86_400_000).toISOString(),
  }));
}

// ── Endorsement card ───────────────────────────────────────────────────────────

function EndorsementCard({
  endorsement,
  type,
  sample,
  onApprove,
  onDecline,
}: {
  endorsement: Endorsement;
  type: 'received' | 'given';
  sample: boolean;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  const { primary } = useLanguagePreference();
  const user = type === 'received'
    ? { name: endorsement.fromUserName, avatar: endorsement.fromUserAvatar, role: endorsement.fromUserRole, id: endorsement.fromUserId }
    : { name: endorsement.toUserName, avatar: endorsement.toUserAvatar, role: endorsement.toUserRole, id: endorsement.toUserId };
  const initials = initialsOf(user.name);
  const waitingOnMe = !endorsement.isApproved && type === 'received';
  const waitingOnThem = !endorsement.isApproved && type === 'given';

  return (
    <Card className={cn(
      'transition-all hover:border-primary/20',
      // Waiting on the reader: a warning edge, not an amber-filled card.
      waitingOnMe && 'border-l-2 border-l-status-warning',
    )}>
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/profiles/${user.id}`} aria-label={bilingualInline(`Open ${user.name}'s profile`, `Άνοιγμα προφίλ: ${user.name}`)}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} alt="" />
                <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{initials}</AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <Link href={`/profiles/${user.id}`} className="transition-colors hover:text-primary-accessible">
              {user.name}
            </Link>
          )}
          subtitle={user.role || undefined}
          meta={endorsement.relationship ? (
            <BilingualText en={`Relationship: ${endorsement.relationship}`} el={`Σχέση: ${endorsement.relationship}`} compact wrap />
          ) : undefined}
          aside={waitingOnMe ? (
            <Badge variant="outline" className="border-status-warning-border text-xs text-status-warning">
              <Clock className="mr-1 icon-sm" aria-hidden="true" />
              <BilingualText en="Waiting for you" el="Περιμένει εσάς" compact />
            </Badge>
          ) : waitingOnThem ? (
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 icon-sm" aria-hidden="true" />
              <BilingualText en="Not yet approved" el="Δεν έχει εγκριθεί" compact />
            </Badge>
          ) : endorsement.isApproved ? (
            <BadgeCheck className="icon-sm text-status-info" aria-label={bilingualInline('Approved and shown on the profile', 'Εγκρίθηκε και εμφανίζεται στο προφίλ')} />
          ) : undefined}
        />
        {/* The skill, the quote and what the platform saw of the work all
            start on the avatar's edge, like every card's content. */}
        <div className="space-y-1.5">
          {endorsement.skill ? <p className="text-xs font-medium text-muted-foreground">{endorsement.skill}</p> : null}
          <blockquote className="card-body italic text-muted-foreground">{endorsement.content}</blockquote>
          <EndorsementBasisLine basis={endorsement.basis} />
        </div>

        <CardFoot
          meta={endorsement.createdAt ? formatDate(endorsement.createdAt, primary === 'el' ? 'el' : 'en', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined}
        >
          {waitingOnMe && (
            <>
              <Button size="sm" className="gap-1" onClick={() => onApprove?.(endorsement.id)}>
                <ThumbsUp className="icon-sm" aria-hidden="true" />
                <BilingualText en="Approve" el="Έγκριση" compact />
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onDecline?.(endorsement.id)}>
                <ThumbsDown className="icon-sm" aria-hidden="true" />
                <BilingualText en="Decline" el="Απόρριψη" compact />
              </Button>
            </>
          )}
          {/* Endorsements have no reply endpoint; replying to someone is
              opening a thread with them. A sample has no one behind it. */}
          {!waitingOnMe && !sample && (
            <MessageButton userId={user.id} displayName={user.name} variant="ghost" />
          )}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

// ── Skills ─────────────────────────────────────────────────────────────────────

function SkillsList({ skills }: { skills: SkillEndorsement[] }) {
  if (skills.length === 0) {
    return (
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        <BilingualText
          en="Skills appear here once an endorsement that names one is approved."
          el="Οι δεξιότητες εμφανίζονται εδώ όταν εγκριθεί μια σύσταση που αναφέρει μία."
          wrap
        />
      </p>
    );
  }
  const maxCount = Math.max(...skills.map((s) => s.count));
  return (
    <ul className="space-y-3">
      {skills.map((s) => (
        <li key={s.skill} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{s.skill}</span>
              <div className="flex -space-x-1" aria-hidden="true">
                {s.endorsers.slice(0, 3).map((e, i) => (
                  <Avatar key={`${e.name}-${i}`} className="h-5 w-5 rounded-full border border-background">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary-accessible">{e.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
            <span className="text-xs font-semibold tabular-nums text-primary-accessible">{s.count}</span>
          </div>
          <Progress
            value={(s.count / maxCount) * 100}
            className="h-1.5"
            aria-label={bilingualInline(`${s.skill}: ${s.count} endorsements`, `${s.skill}: ${s.count} συστάσεις`)}
          />
        </li>
      ))}
    </ul>
  );
}

// ── Ask for one ────────────────────────────────────────────────────────────────

function RequestPanel({ meId, endorsedIds }: { meId?: string; endorsedIds: Set<string> }) {
  const [search, setSearch] = useState('');

  // The reader's own accepted connections; the sample names stay as the
  // fallback for a session that has none.
  const { data: accepted } = useQuery({
    queryKey: qk('connections', 'accepted', 'for-endorsements'),
    queryFn: () => listConnectionRequests({ type: 'accepted', limit: 50 }),
    enabled: !!meId,
    staleTime: 5 * 60_000,
  });

  const real = (accepted?.connections ?? []).map((c) => {
    const other = c.requesterId === meId ? c.receiver : c.requester;
    return {
      id: other?.id ?? c.id,
      name: other?.displayName ?? '',
      role: other?.role ?? '',
      endorsed: endorsedIds.has(other?.id ?? ''),
      real: true as const,
    };
  }).filter((c) => c.name);

  const people = real.length
    ? real
    : SAMPLE_CONNECTIONS.map((c) => ({ ...c, endorsed: endorsedIds.has(c.id), real: false as const }));
  const filtered = people.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        <BilingualText
          en="Asking is a message: there is no request form, so the thread is the request."
          el="Το αίτημα είναι ένα μήνυμα: δεν υπάρχει φόρμα αιτήματος, η συνομιλία είναι το αίτημα."
          wrap
        />
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder={bilingualInline('Search connections…', 'Αναζήτηση επαφών…')}
          aria-label={bilingualInline('Search connections', 'Αναζήτηση επαφών')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-sm"
        />
      </div>
      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary-accessible">{c.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.role}</p>
              </div>
            </div>
            {c.endorsed ? (
              <Badge variant="secondary" size="sm">
                <CheckCircle2 className="mr-1 icon-sm" aria-hidden="true" />
                <BilingualText en="Endorsed you" el="Σας σύστησε" compact />
              </Badge>
            ) : c.real ? (
              <MessageButton userId={c.id} displayName={c.name} variant="outline" />
            ) : (
              /* A sample name has no thread to open; the control says so
                 rather than looking available. */
              <Button size="sm" variant="outline" disabled title={bilingualInline('Sample connection', 'Ενδεικτική επαφή')}>
                <BilingualText en="Ask" el="Αίτημα" compact />
              </Button>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-1 text-xs text-muted-foreground">
            <BilingualText en="No connection matches." el="Καμία επαφή δεν ταιριάζει." compact />
          </li>
        )}
      </ul>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function mapApiItem(item: EndorsementItem): Endorsement {
  return {
    id: item.id,
    fromUserId: item.fromUserId,
    fromUserName: item.fromUser?.displayName ?? 'Unknown',
    fromUserAvatar: item.fromUser?.avatarUrl ?? undefined,
    fromUserRole: item.fromUser?.headline ?? undefined,
    toUserId: item.toUserId,
    toUserName: item.toUser?.displayName ?? 'Unknown',
    toUserAvatar: item.toUser?.avatarUrl ?? undefined,
    toUserRole: item.toUser?.headline ?? undefined,
    skill: item.skill ?? undefined,
    content: item.content,
    relationship: item.relationship ?? undefined,
    basis: (item.basis ?? []).filter(isEndorsementBasis),
    isApproved: item.isApproved,
    createdAt: item.createdAt,
  };
}

export default function EndorsementsPage() {
  const [giving, setGiving] = useState(false);
  const [tab, setTab] = useState<'received' | 'given'>('received');
  const { showDemoData } = useDemoData();
  const qc = useQueryClient();
  const router = useRouter();
  const storedUser = useStoredUser();

  // Samples carry an age, stamped once the page knows today's date: a date
  // computed during the server pass would disagree with hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const [sampleReceived, setSampleReceived] = useState(SAMPLE_RECEIVED);

  const { data: meData } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    staleTime: 300_000,
    enabled: !showDemoData,
  });
  const meId = meData?.profile?.userId ?? storedUser?.id;

  const { data: receivedData, isLoading: receivedLoading } = useQuery({
    queryKey: qk('endorsements', 'received', meId),
    queryFn: () => getEndorsementsForUser(meId!, { includeUnapproved: true }),
    enabled: !showDemoData && !!meId,
    staleTime: 60_000,
  });
  const { data: givenData, isLoading: givenLoading } = useQuery({
    queryKey: qk('endorsements', 'given'),
    queryFn: getGivenEndorsements,
    enabled: !showDemoData,
    staleTime: 60_000,
  });
  const { data: statsData } = useQuery({
    queryKey: qk('endorsements', 'stats'),
    queryFn: getEndorsementStats,
    enabled: !showDemoData,
    staleTime: 60_000,
  });

  const received: Endorsement[] = useMemo(
    () => (showDemoData ? stampSample(sampleReceived, now) : (receivedData?.endorsements ?? []).map(mapApiItem)),
    [showDemoData, sampleReceived, now, receivedData],
  );
  const given: Endorsement[] = useMemo(
    () => (showDemoData ? stampSample(SAMPLE_GIVEN, now) : (givenData?.endorsements ?? []).map(mapApiItem)),
    [showDemoData, now, givenData],
  );
  // Whoever has already written one is shown as such rather than asked again.
  const endorsedIds = useMemo(
    () => new Set(received.map((e) => e.fromUserId).filter(Boolean)),
    [received],
  );

  // Counted from approved endorsements that name a skill, the same way for
  // samples and real ones: a sample list of four cannot claim eight.
  const mySkills: SkillEndorsement[] = useMemo(() => {
    const skillMap = new Map<string, { count: number; endorsers: { name: string }[] }>();
    for (const e of received.filter((r) => r.isApproved)) {
      if (!e.skill) continue;
      const entry = skillMap.get(e.skill) ?? { count: 0, endorsers: [] };
      entry.count++;
      entry.endorsers.push({ name: e.fromUserName });
      skillMap.set(e.skill, entry);
    }
    return Array.from(skillMap.entries())
      .map(([skill, data]) => ({ skill, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [received]);

  const pendingCount = showDemoData
    ? received.filter((e) => !e.isApproved).length
    : (statsData?.stats?.pending ?? received.filter((e) => !e.isApproved).length);
  const receivedApproved = showDemoData
    ? received.filter((e) => e.isApproved).length
    : (statsData?.stats?.total ?? received.filter((e) => e.isApproved).length);
  const givenCount = showDemoData ? given.length : (statsData?.stats?.given ?? given.length);

  const approveMutation = useMutation({
    mutationFn: approveEndorsement,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk('endorsements') }),
  });
  const declineMutation = useMutation({
    mutationFn: declineEndorsement,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk('endorsements') }),
  });

  const handleApprove = (id: string) => {
    if (showDemoData) {
      setSampleReceived((prev) => prev.map((e) => (e.id === id ? { ...e, isApproved: true } : e)));
    } else {
      approveMutation.mutate(id);
    }
  };
  const handleDecline = (id: string) => {
    if (showDemoData) {
      setSampleReceived((prev) => prev.filter((e) => e.id !== id));
    } else {
      declineMutation.mutate(id);
    }
  };

  // Offered to the assistant: the tab, and Approve / Decline on an
  // endorsement waiting for the reader - the same handlers the card calls.
  // Approval shows it on the profile and declining removes it; neither has an
  // opposite endpoint, so neither offers an undo.
  const waiting = received.filter((e) => !e.isApproved);
  usePageControls([
    choiceControl('endorsements_tab', 'Endorsements tab', 'Καρτέλα συστάσεων', [
      { value: 'received', en: 'Received', el: 'Ληφθείσες' },
      { value: 'given', en: 'Given', el: 'Δοσμένες' },
    ], tab, (v) => setTab(v as typeof tab)),
    {
      id: 'approve_endorsement',
      labelEn: showDemoData ? 'Approve sample endorsement (this screen only)' : 'Approve endorsement',
      labelEl: showDemoData ? 'Έγκριση δείγματος σύστασης (μόνο σε αυτή την οθόνη)' : 'Έγκριση σύστασης',
      writes: !showDemoData,
      options: rowOptions(waiting, (e) => e.id, (e) => `${e.fromUserName}${e.skill ? ` · ${e.skill}` : ''}`),
      unavailableEn: waiting.length ? undefined : 'No endorsement is waiting for approval.',
      unavailableEl: waiting.length ? undefined : 'Καμία σύσταση δεν περιμένει έγκριση.',
      run: (v) => { if (v) handleApprove(v); },
    },
    {
      id: 'decline_endorsement',
      labelEn: showDemoData ? 'Decline sample endorsement (this screen only)' : 'Decline endorsement',
      labelEl: showDemoData ? 'Απόρριψη δείγματος σύστασης (μόνο σε αυτή την οθόνη)' : 'Απόρριψη σύστασης',
      writes: !showDemoData,
      options: rowOptions(waiting, (e) => e.id, (e) => `${e.fromUserName}${e.skill ? ` · ${e.skill}` : ''}`),
      unavailableEn: waiting.length ? undefined : 'No endorsement is waiting for approval.',
      unavailableEl: waiting.length ? undefined : 'Καμία σύσταση δεν περιμένει έγκριση.',
      run: (v) => { if (v) handleDecline(v); },
    },
    { id: 'give_endorsement', labelEn: 'Open the endorsement form', labelEl: 'Άνοιγμα φόρμας σύστασης', writes: false, run: () => setGiving(true) },
  ]);
  usePageList([
    {
      id: 'received',
      labelEn: 'Endorsements received',
      labelEl: 'Συστάσεις που λάβατε',
      rows: !showDemoData && receivedLoading ? undefined : received.map((e) =>
        `${e.fromUserName}${e.skill ? ` · ${e.skill}` : ''}${e.relationship ? ` · ${e.relationship}` : ''} · ${e.isApproved ? 'approved' : 'waiting for your approval'}`,
      ),
      sample: showDemoData,
    },
    {
      id: 'given',
      labelEn: 'Endorsements given',
      labelEl: 'Συστάσεις που δώσατε',
      rows: !showDemoData && givenLoading ? undefined : given.map((e) =>
        `${e.toUserName}${e.skill ? ` · ${e.skill}` : ''} · ${e.isApproved ? 'approved' : 'not yet approved by them'}`,
      ),
      sample: showDemoData,
    },
  ]);

  /*
   * The column leads with the endorsements themselves. The figures, the
   * skills they add up to and the ask-for-one list were a second column
   * inside the page; they are the rail's now.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'award',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'received', label: 'Received and shown', labelEl: 'Ληφθείσες και ορατές', value: receivedApproved, icon: Star, tone: 'bg-primary/10 text-primary-accessible' },
            { key: 'pending', label: 'Waiting for your approval', labelEl: 'Περιμένουν την έγκρισή σας', value: pendingCount, icon: Clock, tone: 'bg-status-warning-bg text-status-warning' },
            { key: 'given', label: 'Endorsements you gave', labelEl: 'Συστάσεις που δώσατε', value: givenCount, icon: Handshake, tone: 'bg-status-success-bg text-status-success' },
          ]}
        />
      ),
      badge: pendingCount || null,
    },
    {
      id: 'skills',
      glyph: 'target',
      labelEn: 'Endorsed skills',
      labelEl: 'Δεξιότητες με συστάσεις',
      content: <SkillsList skills={mySkills} />,
    },
    {
      id: 'ask',
      glyph: 'messages',
      labelEn: 'Ask for an endorsement',
      labelEl: 'Ζητήστε σύσταση',
      content: <RequestPanel meId={meId} endorsedIds={endorsedIds} />,
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Users} en="Open members" el="Άνοιγμα μελών" onClick={() => router.push('/members')} />
          <RailAction icon={UserPlus} en="Open connections" el="Άνοιγμα συνδέσεων" onClick={() => router.push('/connections')} />
          <RailAction icon={Handshake} en="Open mentoring" el="Άνοιγμα καταλόγου μεντόρων" onClick={() => router.push('/mentoring')} />
        </div>
      ),
    },
  ];

  const loadingList = !showDemoData && (tab === 'received' ? receivedLoading : givenLoading);

  return (
    <AppShell rail={rail}>
      <div className="space-y-6 pb-10">
        {showDemoData && (
          <SampleDataNotice
            surface="Endorsements"
            detail="These endorsements are samples written by the demo's own people. Approve and Decline change this screen only."
            askAiPrompt="These endorsements are samples. Who should I ask for an endorsement first, and what should it say?"
          />
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="received" className="gap-1.5">
                <BilingualText en="Received" el="Ληφθείσες" compact />
                {pendingCount > 0 && <Badge variant="secondary" size="sm" className="px-1.5">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="given" className="gap-1.5">
                <BilingualText en="Given" el="Δοσμένες" compact />
                <span className="tabular-nums text-muted-foreground">{givenCount}</span>
              </TabsTrigger>
            </TabsList>
            <Button size="sm" className="gap-1.5" onClick={() => setGiving(true)}>
              <Plus className="icon-sm" aria-hidden="true" />
              <BilingualText en="Give an endorsement" el="Δώστε σύσταση" compact />
            </Button>
          </div>

          <TabsContent value="received" className="mt-4 space-y-3">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border border-l-2 border-l-status-warning bg-card px-3 py-2 text-sm text-status-warning">
                <Clock className="icon-sm shrink-0" aria-hidden="true" />
                <BilingualText
                  en={pendingCount === 1 ? '1 endorsement is waiting for your approval before it shows on your profile.' : `${pendingCount} endorsements are waiting for your approval before they show on your profile.`}
                  el={pendingCount === 1 ? '1 σύσταση περιμένει την έγκρισή σας για να εμφανιστεί στο προφίλ σας.' : `${pendingCount} συστάσεις περιμένουν την έγκρισή σας για να εμφανιστούν στο προφίλ σας.`}
                  wrap
                />
              </div>
            )}
            {loadingList ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                <BilingualText en="Loading endorsements…" el="Φόρτωση συστάσεων…" compact />
              </CardContent></Card>
            ) : received.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <Star className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                <p className="font-medium"><BilingualText en="No endorsements received yet" el="Δεν έχετε λάβει συστάσεις ακόμα" /></p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <BilingualText en="Ask a connection who has worked with you; the side panel lists them." el="Ζητήστε από μια επαφή που έχει συνεργαστεί μαζί σας· το πλευρικό πάνελ τις δείχνει." wrap />
                </p>
              </CardContent></Card>
            ) : (
              received.map((e) => (
                <EndorsementCard key={e.id} endorsement={e} type="received" sample={showDemoData} onApprove={handleApprove} onDecline={handleDecline} />
              ))
            )}
          </TabsContent>

          <TabsContent value="given" className="mt-4 space-y-3">
            {loadingList ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                <BilingualText en="Loading endorsements…" el="Φόρτωση συστάσεων…" compact />
              </CardContent></Card>
            ) : given.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <Handshake className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                <p className="font-medium"><BilingualText en="No endorsements given yet" el="Δεν έχετε δώσει συστάσεις ακόμα" /></p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setGiving(true)}>
                  <Award className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Write your first endorsement" el="Γράψτε την πρώτη σας σύσταση" compact />
                </Button>
              </CardContent></Card>
            ) : (
              given.map((e) => <EndorsementCard key={e.id} endorsement={e} type="given" sample={showDemoData} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      <GiveEndorsementDialog open={giving} onOpenChange={setGiving} />
    </AppShell>
  );
}
