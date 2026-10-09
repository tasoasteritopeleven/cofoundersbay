'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Users,
  Search,
  Grid3x3,
  List,
  MapPin,
  Briefcase,
  X,
  UserPlus,
  MessageCircle,
  Star,
  Zap,
  TrendingUp,
  Sparkles,
  Activity,
  Circle,
  Award,
  Compass,
  Target,
} from 'lucide-react';
import { searchProfiles, sendConnectionRequest, getOrCreateDirectConversation, type SearchHit } from '@/lib/api';
import { useHydrated } from '@/components/common/RelativeTime';
import { useToast } from '@/components/ui/toast';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, initialsOf } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';

type ViewMode = 'grid' | 'list';
type SortBy = 'relevance' | 'recent' | 'active';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles', labelEl: 'Όλοι οι ρόλοι' },
  { value: 'founder', label: 'Founder', labelEl: 'Ιδρυτής' },
  { value: 'mentor', label: 'Mentor', labelEl: 'Μέντορας' },
  { value: 'investor', label: 'Investor', labelEl: 'Επενδυτής' },
  { value: 'org', label: 'Organization', labelEl: 'Οργανισμός' },
] as const;
const INDUSTRIES = ['All Industries', 'Technology', 'Healthcare', 'Finance', 'E-commerce', 'Education', 'Real Estate', 'SaaS', 'AI/ML', 'Blockchain'];
const INDUSTRY_EL: Record<string, string> = {
  'All Industries': 'Όλοι οι κλάδοι', Technology: 'Τεχνολογία', Healthcare: 'Υγεία', Finance: 'Χρηματοοικονομικά',
  'E-commerce': 'Ηλεκτρονικό εμπόριο', Education: 'Εκπαίδευση', 'Real Estate': 'Ακίνητα',
};
// The demo world lives in Greece and Cyprus; its cities come first, the
// existing ones stay.
const LOCATIONS = ['All Locations', 'Remote', 'Athens', 'Thessaloniki', 'Limassol', 'San Francisco', 'New York', 'London', 'Berlin', 'Singapore', 'Austin', 'Seattle', 'Boston'];
const LOCATION_EL: Record<string, string> = {
  'All Locations': 'Όλες οι τοποθεσίες', Remote: 'Εξ αποστάσεως', Athens: 'Αθήνα', Thessaloniki: 'Θεσσαλονίκη', Limassol: 'Λεμεσός',
  'New York': 'Νέα Υόρκη', London: 'Λονδίνο', Berlin: 'Βερολίνο', Singapore: 'Σιγκαπούρη',
};
const AVAILABILITY_OPTIONS = [
  { value: 'all', label: 'All', labelEl: 'Όλες' },
  { value: 'full-time', label: 'Full-time', labelEl: 'Πλήρης απασχόληση' },
  { value: 'part-time', label: 'Part-time', labelEl: 'Μερική απασχόληση' },
  { value: 'weekends', label: 'Weekends only', labelEl: 'Μόνο Σαββατοκύριακα' },
  { value: 'flexible', label: 'Flexible', labelEl: 'Ευέλικτα' },
] as const;

const SKILL_PILLS = [
  'All Skills', 'React', 'Node.js', 'Python', 'Fundraising',
  'Product', 'Growth', 'Design', 'AI/ML', 'Sales', 'Legal',
];

function scoreColor(score: number) {
  if (score >= 80) return 'text-status-success';
  if (score >= 50) return 'text-status-warning';
  return 'text-muted-foreground';
}

/**
 * "Online" is a five-minute window on `lastSeenAt` — the only presence the
 * schema records, and the same window the directory counts server-side. A
 * member whose activity was never recorded has no dot rather than a guessed
 * one.
 */
const ONLINE_WINDOW_SECONDS = 5 * 60;

function isRecentlyActive(lastSeenAt: number | null | undefined): boolean {
  if (lastSeenAt == null) return false;
  return Date.now() / 1000 - lastSeenAt <= ONLINE_WINDOW_SECONDS;
}

/**
 * How much of the profile is filled in, as a percentage of eight signals that
 * are all present on a search hit. This replaces a "contribution score" that
 * was `Math.random()`: it changed on every render, differed between the server
 * and the client, and described nothing. Completeness is a smaller claim, but
 * it is one the row in front of you can actually support.
 */
function profileCompleteness(member: SearchHit): number {
  const signals = [
    Boolean(member.headline),
    Boolean(member.bio),
    Boolean(member.location),
    Boolean(member.avatarUrl),
    (member.skillNames?.length ?? 0) > 0,
    (member.industries?.length ?? 0) > 0,
    Boolean(member.lookingFor),
    Boolean(member.availability),
  ];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}

interface MemberCardProps {
  member: SearchHit;
  viewMode: ViewMode;
  onConnect: () => void;
  onMessage: () => void;
}

function MemberCard({ member, viewMode, onConnect, onMessage }: MemberCardProps) {
  const isGridView = viewMode === 'grid';
  const completeness = profileCompleteness(member);
  // Reading the clock during render would differ between the server pass and
  // hydration, so the dot appears one frame after mount instead.
  const hydrated = useHydrated();
  const isOnline = hydrated && isRecentlyActive(member.lastSeenAt);

  if (isGridView) {
    return (
      <Card className="card-interactive hover-lift group transition-all duration-300">
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center text-center">
            <Link href={`/profiles/${member.userId}`} className="relative inline-block">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20 mb-3">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold text-base">
                  {initialsOf(member.displayName)}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-3 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-success-mark ring-1 ring-background" />
                </span>
              )}
            </Link>

            <Link
              href={`/profiles/${member.userId}`}
              className="font-display text-base font-semibold text-foreground hover:text-primary-accessible transition-colors mb-1"
            >
              {member.displayName}
            </Link>

            {member.role && (
              <Badge variant="secondary" className="mb-2">
                {member.role}
              </Badge>
            )}

            {member.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {member.bio}
              </p>
            )}

            <FactLine
              className="mb-3 justify-center"
              items={[...(member.skills ?? []).slice(0, 3), (member.skills?.length ?? 0) > 3 ? `+${(member.skills?.length ?? 0) - 3}` : null]}
            />

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              {member.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="icon-sm" />
                  {member.location}
                </div>
              )}
              {isOnline && (
                <span className="flex items-center gap-1 text-status-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-success-mark" />
                  <BilingualText en="Online" el="Σε σύνδεση" compact />
                </span>
              )}
            </div>

            {/* Contribution score */}
            <div className="w-full mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground"><BilingualText en="Profile completeness" el="Πληρότητα προφίλ" compact /></span>
                <span className={cn('font-semibold', scoreColor(completeness))}>{completeness}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', completeness >= 80 ? 'bg-status-success-mark' : completeness >= 50 ? 'bg-status-warning-mark' : 'bg-primary/60')}
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <Button size="sm" onClick={onConnect} className="flex-1 gap-1.5">
                <UserPlus className="icon-sm" />
                <BilingualText en="Connect" el="Σύνδεση" compact />
              </Button>
              <Button aria-label={`Message ${member.displayName}`} size="sm" variant="outline" onClick={onMessage} className="gap-1.5">
                <MessageCircle className="icon-sm" />
                <span className="hidden sm:inline"><BilingualText en="Message" el="Μήνυμα" compact /></span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-interactive hover-lift group transition-all duration-300">
      <CardContent>
        <div className="flex items-start gap-4">
          <Link href={`/profiles/${member.userId}`} className="relative shrink-0">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20">
              <AvatarImage src={member.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold text-sm">
                {initialsOf(member.displayName)}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background">
                <span className="h-2.5 w-2.5 rounded-full bg-status-success-mark ring-1 ring-background" />
              </span>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <Link
                  href={`/profiles/${member.userId}`}
                  className="font-display text-base font-semibold text-foreground hover:text-primary-accessible transition-colors"
                >
                  {member.displayName}
                </Link>
                {member.role && (
                  <Badge variant="secondary" className="ml-2">
                    {member.role}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={onConnect} className="gap-1.5">
                  <UserPlus className="icon-sm" />
                  <BilingualText en="Connect" el="Σύνδεση" compact />
                </Button>
                <Button aria-label={`Message ${member.displayName}`} size="sm" variant="outline" onClick={onMessage} className="gap-1.5">
                  <MessageCircle className="icon-sm" />
                  <span className="hidden sm:inline"><BilingualText en="Message" el="Μήνυμα" compact /></span>
                </Button>
              </div>
            </div>

            {member.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {member.bio}
              </p>
            )}

            <FactLine
              className="mb-3"
              items={[...(member.skills ?? []).slice(0, 5), (member.skills?.length ?? 0) > 5 ? `+${(member.skills?.length ?? 0) - 5}` : null]}
            />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {member.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="icon-sm" />
                  {member.location}
                </div>
              )}
              {member.industries && member.industries.length > 0 && (
                <div className="flex items-center gap-1">
                  <Briefcase className="icon-sm" />
                  {member.industries.slice(0, 2).join(', ')}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Activity className="icon-sm" />
                <span className={scoreColor(completeness)}>{completeness}% complete</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'grid') {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-24 w-24 rounded-full mb-3" />
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-12 w-full mb-3" />
            <div className="flex gap-2 w-full">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MembersPageClient() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<(typeof ROLE_OPTIONS)[number]['value']>('all');
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedAvailability, setSelectedAvailability] = useState<(typeof AVAILABILITY_OPTIONS)[number]['value']>('all');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [activeSkill, setActiveSkill] = useState('All Skills');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('members', searchQuery, selectedRole, selectedIndustry, selectedLocation, selectedAvailability, sortBy),
    queryFn: () => searchProfiles({
      q: searchQuery.trim() || undefined,
      roles: selectedRole !== 'all' ? [selectedRole] : undefined,
      industries: selectedIndustry !== 'All Industries' ? [selectedIndustry] : undefined,
      location: selectedLocation !== 'All Locations' ? selectedLocation : undefined,
      commitment: selectedAvailability !== 'all' ? [selectedAvailability] : undefined,
      sortBy,
      limit: 50,
    }),
    staleTime: 30_000,
  });

  const members = data?.hits ?? [];
  const total = data?.total ?? 0;
  /*
   * Counted server-side over the same filter as the results. They used to be
   * `total * 0.08`, `* 0.05` and `* 0.1` with invented fallbacks, which put
   * three numbers that no one had counted beside one that had been. An API
   * that does not send them yet shows a dash rather than a plausible guess.
   */
  const stats = data?.stats;
  const dash = '—';

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedRole !== 'all') count++;
    if (selectedIndustry !== 'All Industries') count++;
    if (selectedLocation !== 'All Locations') count++;
    if (selectedAvailability !== 'all') count++;
    return count;
  }, [selectedRole, selectedIndustry, selectedLocation, selectedAvailability]);

  const clearFilters = () => {
    setSelectedRole('all');
    setSelectedIndustry('All Industries');
    setSelectedLocation('All Locations');
    setSelectedAvailability('all');
    setSearchQuery('');
  };

  const { success, error: showError } = useToast();

  const connectMutation = useMutation({
    mutationFn: (userId: string) => sendConnectionRequest({ receiverId: userId }),
    onSuccess: () => success('Request sent', 'Connection request sent successfully'),
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Could not send request'),
  });

  const messageMutation = useMutation({
    mutationFn: (userId: string) => getOrCreateDirectConversation(userId),
    onSuccess: (data) => router.push(`/messages?c=${data.conversationId}`),
    onError: (err) => showError('Failed', err instanceof Error ? err.message : 'Could not open conversation'),
  });

  const handleConnect = (memberId: string) => connectMutation.mutate(memberId);
  const handleMessage = (memberId: string) => messageMutation.mutate(memberId);

  const featuredMembers = members.slice(0, 3);

  usePageControls([
    choiceControl('role', 'Role filter', 'Φίλτρο ρόλου', ROLE_OPTIONS.map((r) => ({ value: r.value, en: r.label, el: r.labelEl })), selectedRole, (v) => setSelectedRole(v as typeof selectedRole)),
    choiceControl('view', 'Members layout', 'Διάταξη μελών', [
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
      { value: 'list', en: 'List', el: 'Λίστα' },
    ], viewMode, (v) => setViewMode(v as ViewMode)),
    choiceControl('sort', 'Sort members', 'Ταξινόμηση μελών', [
      { value: 'relevance', en: 'Most Relevant', el: 'Πιο σχετικά' },
      { value: 'recent', en: 'Newest First', el: 'Νεότερα πρώτα' },
      { value: 'active', en: 'Most Active', el: 'Πιο ενεργά' },
    ], sortBy, (v) => setSortBy(v as SortBy)),
    // Every filter the rail offers, so the assistant can set any of them.
    choiceControl('industry', 'Industry filter', 'Φίλτρο κλάδου', INDUSTRIES.map((i) => ({ value: i, en: i, el: INDUSTRY_EL[i] ?? i })), selectedIndustry, setSelectedIndustry),
    choiceControl('location', 'Location filter', 'Φίλτρο τοποθεσίας', LOCATIONS.map((l) => ({ value: l, en: l, el: LOCATION_EL[l] ?? l })), selectedLocation, setSelectedLocation),
    choiceControl('availability', 'Availability filter', 'Φίλτρο διαθεσιμότητας', AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, en: a.label, el: a.labelEl })), selectedAvailability, (v) => setSelectedAvailability(v as typeof selectedAvailability)),
    choiceControl('skill', 'Skill filter', 'Φίλτρο δεξιότητας', SKILL_PILLS.map((s) => ({ value: s, en: s, el: s === 'All Skills' ? 'Όλες οι δεξιότητες' : s })), activeSkill, setActiveSkill),
    { id: 'clear_filters', labelEn: 'Clear member filters', labelEl: 'Καθαρισμός φίλτρων μελών', writes: false, run: clearFilters },
  ]);
  // The assistant sees the members the page shows, as the page shows them.
  usePageList([
    {
      id: 'members',
      labelEn: 'Members',
      labelEl: 'Μέλη',
      rows: isLoading ? undefined : members.map((m) =>
        [m.displayName, m.headline, m.role, m.location].filter(Boolean).join(' · '),
      ),
      total,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'people',
      labelEn: 'Directory',
      labelEl: 'Κατάλογος',
      content: (
        <RailStats
          items={[
            { key: 'total', label: 'Total members', labelEl: 'Σύνολο μελών', value: total.toLocaleString('en-GB'), icon: Users, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'online', label: 'Online now', labelEl: 'Σε σύνδεση τώρα', value: stats ? stats.onlineNow : dash, icon: Activity, tone: 'bg-status-success-bg text-status-success' },
            { key: 'new', label: 'New this week', labelEl: 'Νέα αυτή την εβδομάδα', value: stats ? stats.newThisWeek : dash, icon: TrendingUp, tone: 'bg-status-info-bg text-status-info' },
            { key: 'mentors', label: 'Mentors', labelEl: 'Μέντορες', value: stats ? stats.mentors : dash, icon: Award, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters & view',
      labelEl: 'Φίλτρα & προβολή',
      badge: activeFiltersCount + (activeSkill !== 'All Skills' ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Role"
            titleEl="Ρόλος"
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, en: r.label, el: r.labelEl }))}
            value={selectedRole}
            onChange={(v) => setSelectedRole(v)}
          />
          <RailOptions
            title="Industry"
            titleEl="Κλάδος"
            options={INDUSTRIES.map((industry) => ({ value: industry, en: industry, el: INDUSTRY_EL[industry] ?? industry }))}
            value={selectedIndustry}
            onChange={setSelectedIndustry}
          />
          <RailOptions
            title="Location"
            titleEl="Τοποθεσία"
            options={LOCATIONS.map((location) => ({ value: location, en: location, el: LOCATION_EL[location] ?? location }))}
            value={selectedLocation}
            onChange={setSelectedLocation}
          />
          <RailOptions
            title="Availability"
            titleEl="Διαθεσιμότητα"
            options={AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, en: a.label, el: a.labelEl }))}
            value={selectedAvailability}
            onChange={(v) => setSelectedAvailability(v)}
          />
          <RailOptions
            title="Skill"
            titleEl="Δεξιότητα"
            options={SKILL_PILLS.map((skill) => ({ value: skill, en: skill, el: skill }))}
            value={activeSkill}
            onChange={setActiveSkill}
          />
          <RailOptions
            title="Layout"
            titleEl="Διάταξη"
            options={[
              { value: 'grid' as ViewMode, en: 'Grid', el: 'Πλέγμα', icon: Grid3x3 },
              { value: 'list' as ViewMode, en: 'List', el: 'Λίστα', icon: List },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <RailOptions
            title="Sort"
            titleEl="Ταξινόμηση"
            options={[
              { value: 'relevance' as SortBy, en: 'Most Relevant', el: 'Πιο σχετικά' },
              { value: 'recent' as SortBy, en: 'Newest First', el: 'Νεότερα πρώτα' },
              { value: 'active' as SortBy, en: 'Most Active', el: 'Πιο ενεργά' },
            ]}
            value={sortBy}
            onChange={setSortBy}
          />
          {activeFiltersCount > 0 && (
            <RailAction icon={X} en="Clear all filters" el="Καθαρισμός όλων των φίλτρων" onClick={clearFilters} />
          )}
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Compass} en="Open discover" el="Άνοιγμα ανακάλυψης" onClick={() => router.push('/discover')} />
          <RailAction icon={Target} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
          <RailAction icon={UserPlus} en="Open connections" el="Άνοιγμα συνδέσεων" onClick={() => router.push('/connections')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      /* The count belongs in both halves. Leaving `descriptionEl` to the
         registry would pair "…with 1,240 members" against a Greek line with no
         number in it, which reads as two different sentences rather than one
         sentence twice. */
      title="Member Directory"
      description={`Discover and connect with ${total.toLocaleString('en-GB')} members`}
      descriptionEl={`Ανακαλύψτε και συνδεθείτε με ${total.toLocaleString('el-GR')} μέλη`}
      rail={rail}
    >
      <div className="space-y-4 pb-10">

        {/* Featured spotlight */}
        {!isLoading && featuredMembers.length > 0 && !searchQuery && activeFiltersCount === 0 && activeSkill === 'All Skills' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="icon-sm text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"><BilingualText en="Featured Members" el="Προτεινόμενα μέλη" compact /></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {featuredMembers.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
                  <Link href={`/profiles/${member.userId}`} className="relative shrink-0">
                    <Avatar className="h-10 w-10 ring-1 ring-primary/30">
                      <AvatarImage src={member.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary-accessible text-sm">{initialsOf(member.displayName)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    {/* The badge wraps under the name rather than clipping it. */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Link href={`/profiles/${member.userId}`} className="text-sm font-semibold text-foreground hover:text-primary-accessible transition-colors line-clamp-1">{member.displayName}</Link>
                      <PersonVerifiedBadge userId={member.userId} />
                    </div>
                    <p className="line-clamp-2 text-2xs leading-snug text-muted-foreground">{member.headline ?? member.role ?? 'Member'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search — filters and layout live in the rail. */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={bilingualInline("Search members by name, skills, or bio", "Αναζήτηση μελών με όνομα, δεξιότητες ή βιογραφικό")}
            placeholder={bilingualInline("Search members by name, skills, or bio…", "Αναζήτηση μελών με όνομα, δεξιότητες ή βιογραφικό…")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? <BilingualText en="Loading…" el="Φόρτωση…" compact />
              : <BilingualText en={`${total.toLocaleString('en-GB')} member${total !== 1 ? 's' : ''} found`} el={`${total.toLocaleString('el-GR')} ${total !== 1 ? 'μέλη' : 'μέλος'}`} compact />}
          </p>
        </div>

        {/* Members Grid/List */}
        {isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Users className="icon-xl text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground"><BilingualText en="Failed to load members. Please check your connection." el="Δεν ήταν δυνατή η φόρτωση των μελών. Ελέγξτε τη σύνδεσή σας." wrap /></p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}><BilingualText en="Try again" el="Δοκιμάστε ξανά" compact /></Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className={cn(
            'grid grid-cols-1 gap-4',
            viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1'
          )}>
            {Array.from({ length: 8 }).map((_, i) => (
              <MemberSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2"><BilingualText en="No members found" el="Δεν βρέθηκαν μέλη" compact /></h3>
              <p className="text-sm text-muted-foreground mb-4">
                <BilingualText en="Try adjusting your search or filters" el="Δοκιμάστε άλλη αναζήτηση ή φίλτρα" wrap />
              </p>
              {activeFiltersCount > 0 && (
                <Button variant="secondary" onClick={clearFilters}>
                  <BilingualText en="Clear filters" el="Καθαρισμός φίλτρων" compact />
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            'grid grid-cols-1 gap-4',
            viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1'
          )}>
            {members.map((member) => (
              <MemberCard
                key={member.userId}
                member={member}
                viewMode={viewMode}
                onConnect={() => handleConnect(member.userId)}
                onMessage={() => handleMessage(member.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
