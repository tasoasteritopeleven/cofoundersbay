'use client';


import { PROMOTED_COPY, readNaturalSearch, splitPromoted, type NaturalFilter } from '@cofounderbay/shared';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useIsAuthenticated } from '@/hooks/useIsAuthenticated';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { defaultDiscoverFilters as defaultFilters, readDiscoverUrl, writeDiscoverUrl, type DiscoverRole as RoleFilter, type DiscoverTab } from '@/lib/discover-url';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid,
  List,
  TrendingUp,
  Users,
  ArrowRight,
  Rocket,
  GraduationCap,
  DollarSign,
  Briefcase,
  Star,
  Bookmark,
  Search,
} from 'lucide-react';
import {
  searchProfiles, getRecommendations, getDashboardStats, getMeProfile, recordMatchFeedback, restoreMatchFeedback, sendConnectionRequest, saveToShortlist, createSavedSearch, type SearchHit
} from '@/lib/api';
import { createPassLedger } from '@/lib/match-pass';
import { explainMatch, viewerFacts } from '@/lib/match-explain';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { bilingualInline } from '@/lib/i18n/format';
import { RailPeople } from '@/components/layout/RailPeople';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { AnimatedList } from '@/components/common/AnimatedList';
import { SearchFilters, type SearchFiltersValues } from '@/components/discover/SearchFilters';
import { DiscoverCurated } from '@/components/discover/DiscoverCurated';
import { ProfileCard, ProfileCardSkeleton, type ProfileCardData } from '@/components/discover/ProfileCard';
import { InfoHint } from '@/components/common/InfoHint';
import { FailedLine } from '@/components/dashboard/SectionCard';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { discoverEn, discoverEl } from '@/lib/i18n/strings-discover';
import { cn } from '@/lib/utils';
import { queryKeys, qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList, ROW_GONE, type PageControlRunResult } from '@/lib/page-controls';
import { statusEl } from '@/components/common/StatusText';
import { namedFilters, namedQuery, type NamedFilter } from '@/components/common/EmptyStates';
import { ASK } from '@/lib/page-questions';
import { useConnectionActions } from '@/hooks/useConnectionWith';
import { elWord } from '@/lib/rows-el';

const MatchCard = dynamic(() => import('@/components/common/MatchCard').then((m) => ({ default: m.MatchCard })), { ssr: false });
const ConnectionRequestDialog = dynamic(() => import('@/components/common/ConnectionRequest').then((m) => ({ default: m.ConnectionRequestDialog })), { ssr: false });

type ViewMode = 'grid' | 'list' | 'match';

/**
 * Cards at least 24rem wide (as /events), as many as fit: three in the full column, two
 * beside a pinned page rail, where three cut "Elena Papadopoulos" over two
 * lines (docs §86). A base of one column stays for twMerge to replace.
 */
const PEOPLE_GRID = 'grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))]';
const ROLE_FILTERS: { value: RoleFilter; labelEn: string; labelEl: string; icon: React.ElementType }[] = [
  { value: 'all',              labelEn: discoverEn('all'),              labelEl: discoverEl('all'),              icon: Users         },
  { value: 'founder',         labelEn: discoverEn('founders'),         labelEl: discoverEl('founders'),         icon: Rocket        },
  { value: 'cofounder',       labelEn: discoverEn('cofounders'),       labelEl: discoverEl('cofounders'),       icon: Users         },
  { value: 'mentor',          labelEn: discoverEn('mentors'),          labelEl: discoverEl('mentors'),          icon: GraduationCap },
  { value: 'investor',        labelEn: discoverEn('investors'),        labelEl: discoverEl('investors'),        icon: DollarSign    },
  { value: 'service_provider',labelEn: discoverEn('service_providers'),labelEl: discoverEl('service_providers'),icon: Briefcase     },
];

/*
 * The four figures here were constants in the source: "1,200+", "180+",
 * "450+", "25+". They are counted by the platform now — founders and mentors
 * by role, matches as accepted connections, communities as groups — and a
 * header that cannot reach the count shows a dash rather than a round number
 * that was never true.
 */
const PLATFORM_STAT_SLOTS = [
  { key: 'founders' as const,         labelEn: discoverEn('active_founders'),    labelEl: discoverEl('active_founders'),    icon: Rocket        },
  { key: 'mentors' as const,          labelEn: discoverEn('expert_mentors'),     labelEl: discoverEl('expert_mentors'),     icon: GraduationCap },
  { key: 'successfulMatches' as const,labelEn: discoverEn('successful_matches'), labelEl: discoverEl('successful_matches'), icon: Star          },
  { key: 'communities' as const,      labelEn: discoverEn('communities'),        labelEl: discoverEl('communities'),        icon: Users         },
];

type MatchReasonType = 'skills' | 'location' | 'stage' | 'industry' | 'availability' | 'values';

/*
 * `buildMatchReasons` used to turn one score into a list of specific claims:
 * 80 or above printed "Same location" whether or not the two people were in
 * the same place. The engine returns its own reasons; a card with none shows
 * none.
 */

function discoverFilterNames(filters: SearchFiltersValues): NamedFilter[] {
  const word = (value: string): NamedFilter => {
    const greek = statusEl(value);
    const plain = value.replaceAll('_', ' ');
    return { en: plain, el: greek ?? plain };
  };
  return namedFilters(
    namedQuery(filters.q),
    filters.location.trim() ? { en: filters.location.trim(), el: filters.location.trim() } : null,
    ...filters.role.map(word),
    ...filters.skills.map((skill) => ({ en: skill, el: skill })),
    ...filters.industries.map((industry) => ({ en: industry, el: industry })),
    ...filters.stage.map(word),
    ...filters.availability.map(word),
    ...filters.fundingStage.map(word),
    ...filters.languages.map(word),
    filters.remote === true ? { en: 'Remote', el: 'Εξ αποστάσεως' } : null,
    filters.remote === false ? { en: 'On site', el: 'Με παρουσία' } : null,
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();

  const [filters, setFilters] = useState<SearchFiltersValues>(defaultFilters);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  // The first search starts on mount (150ms debounce), so the page opens
  // loading: starting at false showed "No profiles found" until it answered.
  const [loading, setLoading] = useState(true);
  // A search that failed is not "No profiles found": it said so under "0
  // results found", with "Clear filters" for filters nobody had set and a
  // toast that went away (docs §86).
  const [searchFailed, setSearchFailed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  // Two tabs: "For You" and "Top Matches" listed the same eight people
  // from the same read (`getRecommendations`), one as profile cards, one as
  // match cards; they are one tab now (docs §101).
  const [activeTab, setActiveTab] = useState<DiscoverTab>('search');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Connection request dialog
  const [connectionTarget, setConnectionTarget] = useState<ProfileCardData | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  // Save-search dialog (opened from the filters bar, the assistant, or the
  // /saved-searches "New Search" link which lands here as ?saveSearch=true).
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchAlerts, setSaveSearchAlerts] = useState(true);
  const [saveSearchBusy, setSaveSearchBusy] = useState(false);
  const queryClient = useQueryClient();

  // Arriving links carry search state in the URL: /saved-searches "Run" sends
  // the stored query and filters, "New Search" sends saveSearch=true. Both
  // were dead before — apply them once, after mount, then drop the flag so a
  // refresh keeps the filters without reopening the dialog.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const applyUrl = () => {
      if (window.location.pathname !== '/discover') return;
      const p = new URLSearchParams(window.location.search);
      const next = readDiscoverUrl(p);
      setFilters(next.filters);
      setActiveTab(next.tab);
      setRoleFilter(next.roleChip);
      if (p.get('saveSearch') === 'true') {
        setSaveSearchName(next.filters.q);
        setSaveSearchOpen(true);
        p.delete('saveSearch');
        const qs = p.toString();
        window.history.replaceState(null, '', qs ? `/discover?${qs}` : '/discover');
      }
      setUrlReady(true);
    };
    applyUrl();
    window.addEventListener('popstate', applyUrl);
    return () => window.removeEventListener('popstate', applyUrl);
  }, []);

  useEffect(() => {
    if (!urlReady || window.location.pathname !== '/discover') return;
    const current = new URLSearchParams(window.location.search);
    const next = writeDiscoverUrl(current, filters, roleFilter, activeTab);
    if (next.toString() === current.toString()) return;
    const query = next.toString();
    window.history.replaceState(null, '', `/discover${query ? `?${query}` : ''}${window.location.hash}`);
  }, [urlReady, filters, roleFilter, activeTab]);

  const hasToken = useIsAuthenticated();
  const { data: recommendationsData, isLoading: suggestionsLoading, isError: suggestionsFailed, isFetching: suggestionsFetching, refetch: refetchSuggestions } = useQuery({
    queryKey: qk('recommendations', { limit: 8 }),
    queryFn: () => getRecommendations({ limit: 8 }),
    staleTime: 3 * 60_000,
    enabled: hasToken,
  });
  const suggestions = useMemo(() => (recommendationsData?.suggestions ?? []) as SearchHit[], [recommendationsData]);

  // The matches tab explains each person as /matches does (lib/match-explain),
  // from the reader's own profile, on the key the dashboards share.
  const { data: meData } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    enabled: hasToken,
    staleTime: 5 * 60_000,
  });
  const viewer = useMemo(() => viewerFacts(meData?.profile ?? null), [meData]);
  // Where each person's connection stands, as on /matches and the homes:
  // Elena's request waited, and her card here offered a second Connect.
  const { connectionOf, accept } = useConnectionActions(hasToken, meData?.profile?.userId);
  const personActions = (userId: string) => ({ connection: connectionOf(userId), onAccept: () => void accept(userId) });
  // The best four matches, by score: the rail's short list (docs §86).
  const bestMatches = useMemo(
    () => [...((recommendationsData?.suggestions ?? []) as SearchHit[])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, 4),
    [recommendationsData],
  );
  const [nowMs] = useState(() => Date.now());

  // Passing on a match here is passing on /matches: the card leaves, the
  // engine hears it, and the toast's Undo puts both back (lib/match-pass).
  // The button did nothing, and the heart beside it said "Liked!" without
  // sending anything; it opens the connection request now.
  const sayOne = useBilingualString();
  const [passedMatchIds, setPassedMatchIds] = useState<Set<string>>(() => new Set());
  const [passLedger] = useState(() => createPassLedger({
    record: (userId) => recordMatchFeedback({ targetUserId: userId, feedback: 'declined' }),
    restore: (r) => restoreMatchFeedback({ targetUserId: r.userId, previous: r.previous, signalId: r.signalId }),
  }));
  const passMatch = (hit: SearchHit) => {
    setPassedMatchIds((prev) => new Set(prev).add(hit.id));
    passLedger.pass(hit.id, hit.userId);
    success(sayOne('Passed', 'Παραλείφθηκε'), hit.displayName, {
      action: {
        label: sayOne('Undo', 'Αναίρεση'),
        onClick: () => {
          setPassedMatchIds((prev) => {
            const next = new Set(prev);
            next.delete(hit.id);
            return next;
          });
          void passLedger.takeBack(hit.id);
        },
      },
    });
  };

  const { data: platformStats } = useQuery({
    queryKey: qk('dashboard', 'stats', 'discover-header'),
    queryFn: getDashboardStats,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const suggestionsLoaded = !suggestionsLoading;
  // The match cards, best score first: "Top Matches" promised the highest
  // compatibility and listed them in the order they came.
  const matchList = useMemo(
    () => suggestions.filter((hit) => !passedMatchIds.has(hit.id)).sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1)),
    [suggestions, passedMatchIds],
  );

  const searchSequence = useRef(0);
  const runSearch = useCallback(async () => {
    const sequence = ++searchSequence.current;
    setLoading(true);
    try {
      const res = await searchProfiles({
        q: filters.q.trim() || undefined,
        roles: filters.role.length > 0 ? filters.role : undefined,
        skills: filters.skills.length > 0 ? filters.skills : undefined,
        industries: filters.industries.length > 0 ? filters.industries : undefined,
        stage: filters.stage.length > 0 ? filters.stage : undefined,
        location: filters.location.trim() || undefined,
        languages: filters.languages.length > 0 ? filters.languages : undefined,
        commitment: filters.availability.length > 0 ? filters.availability : undefined,
        investmentStages: filters.fundingStage.length > 0 ? filters.fundingStage : undefined,
        sortBy: filters.sortBy,
        limit: 30,
      });
      if (sequence !== searchSequence.current) return;
      if (!Array.isArray(res?.hits)) throw new Error('Missing search results');
      setHits(res.hits);
      setPromotedIds(Array.isArray(res?.promotedUserIds) ? res.promotedUserIds.filter((id): id is string => typeof id === 'string') : []);
      setTotal(typeof res?.total === 'number' ? res.total : res.hits.length);
      setSearchFailed(false);
    } catch {
      if (sequence !== searchSequence.current) return;
      setHits([]);
      setPromotedIds([]);
      setTotal(0);
      setSearchFailed(true);
    } finally {
      if (sequence === searchSequence.current) setLoading(false);
    }
  }, [filters]);

  // Debounced auto-search on filter changes when on search tab
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!urlReady || activeTab !== 'search') return;
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = filters.q.length > 0 ? 500 : 150;
    debounceRef.current = setTimeout(() => { void runSearch(); }, delay);
    return () => {
      searchSequence.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, activeTab, runSearch, urlReady]);

  /*
   * Plain-language search. Enter in the field reads the words it knows
   * ("συνιδρυτής fintech Θεσσαλονίκη part-time") into the same filters the
   * sheet sets and leaves the rest as text; the strip under the field says
   * what was read and puts the words back as typed in one click.
   */
  const [interpreted, setInterpreted] = useState<{ typed: string; before: SearchFiltersValues; understood: NaturalFilter[] } | null>(null);
  const searchFromField = useCallback(() => {
    const read = readNaturalSearch(filters.q);
    if (!read.understood.length) {
      void runSearch();
      return;
    }
    const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
    setInterpreted({ typed: filters.q, before: filters, understood: read.understood });
    setFilters((f) => ({
      ...f,
      q: read.rest,
      role: union(f.role, read.roles),
      industries: union(f.industries, read.industries),
      stage: union(f.stage, read.stage),
      availability: union(f.availability, read.availability),
      fundingStage: union(f.fundingStage, read.fundingStage),
      languages: union(f.languages, read.languages),
      skills: union(f.skills, read.skills),
      location: read.location ?? f.location,
    }));
  }, [filters, runSearch]);
  const searchAsTyped = useCallback(() => {
    if (!interpreted) return;
    setFilters({ ...interpreted.before, q: interpreted.typed });
    setInterpreted(null);
  }, [interpreted]);
  const changeFilters = useCallback((next: SearchFiltersValues) => {
    // Typing again starts a new request; the old reading no longer applies.
    if (next.q !== filters.q) setInterpreted(null);
    setFilters(next);
  }, [filters.q]);

  // Convert SearchHit to ProfileCardData
  const hitToProfile = (hit: SearchHit): ProfileCardData => ({
    id: hit.id,
    userId: hit.userId,
    displayName: hit.displayName,
    headline: hit.headline,
    bio: hit.bio,
    avatarUrl: hit.avatarUrl,
    role: hit.role,
    location: hit.location,
    skills: hit.skillNames || [],
    matchScore: hit.matchScore,
    lookingFor: hit.lookingFor,
    availability: hit.availability,
  });

  // Handle connect
  const handleConnect = (profile: ProfileCardData) => {
    setConnectionTarget(profile);
    setShowConnectionDialog(true);
  };

  // Handle send connection request
  const handleSendConnection = async (message: string) => {
    if (!connectionTarget) return;
    try {
      await sendConnectionRequest({ receiverId: connectionTarget.userId, message: message || undefined });
      success('Connection request sent!', `Your request to ${connectionTarget.displayName} has been sent.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.connections });
    } catch (err) {
      showError('Could not send request', err instanceof Error ? err.message : 'Please try again');
    }
  };

  // Handle message
  const handleMessage = (profile: ProfileCardData) => {
    router.push(`/messages?to=${profile.userId}`);
  };

  // Handle bookmark
  const handleBookmark = async (profile: ProfileCardData): Promise<PageControlRunResult> => {
    try {
      await saveToShortlist(profile.userId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.shortlist });
      void queryClient.invalidateQueries({ queryKey: queryKeys.shortlistIds });
      success('Saved to shortlist', `${profile.displayName} is on your saved profiles`);
    } catch (err) {
      showError('Could not save', err instanceof Error ? err.message : 'Try again from the profile page');
      return { error: err instanceof Error && err.message ? err.message : 'The profile was not saved.' };
    }
  };

  const openSaveSearch = () => {
    setSaveSearchName((n) => n || filters.q.trim());
    setSaveSearchOpen(true);
  };

  const handleSaveSearch = async () => {
    const name = saveSearchName.trim();
    if (!name || saveSearchBusy) return;
    setSaveSearchBusy(true);
    try {
      await createSavedSearch({
        name,
        query: filters.q.trim(),
        filters: {
          roles: filters.role.length ? filters.role : undefined,
          skills: filters.skills.length ? filters.skills : undefined,
          industries: filters.industries.length ? filters.industries : undefined,
          locations: filters.location.trim() ? [filters.location.trim()] : undefined,
          stage: filters.stage.length ? filters.stage : undefined,
        },
        alertsEnabled: saveSearchAlerts,
        alertFrequency: 'daily',
      });
      void queryClient.invalidateQueries({ queryKey: qk('saved-searches') });
      success('Search saved', 'It will appear under Saved Searches and watch for new matches.');
      setSaveSearchOpen(false);
      setSaveSearchName('');
    } catch (err) {
      showError('Could not save', err instanceof Error && err.message ? err.message : 'Try again from Saved Searches');
    } finally {
      setSaveSearchBusy(false);
    }
  };

  // Apply role filter to hits
  const hasRole = (h: SearchHit, role: RoleFilter) => role === 'all' ||
    h.role?.toLowerCase().includes(role.replace('_', ' ')) ||
    h.role?.toLowerCase() === role;
  const roleHits = roleFilter === 'all' ? hits : hits.filter((h) => hasRole(h, roleFilter));
  // How many of the results each role chip finds; a role with none is not
  // offered, unless it is the one chosen (docs §62.5, §111).
  const roleChips = ROLE_FILTERS
    .map((r) => ({ ...r, count: hits.filter((h) => hasRole(h, r.value)).length }))
    .filter((r) => r.value === 'all' || r.count > 0 || r.value === roleFilter);
  // Paid placement sits in its own labelled slot; the organic list keeps its order.
  const { promoted: promotedHits, organic: filteredHits } = splitPromoted(roleHits, activeTab === 'search' ? promotedIds : []);

  const askAi = {
    en: `Discover (${activeTab === 'matches' ? 'Top Matches' : 'Search'}): ${roleHits.length} search results${roleFilter !== 'all' ? `, role filter ${roleFilter.replace('_', ' ')}` : ''}, ${suggestions.length} recommendations. Who should I shortlist or message next, and which filters would find a complementary technical cofounder?`,
    el: `Ανακάλυψη (${activeTab === 'matches' ? 'Κορυφαίες αντιστοιχίσεις' : 'Αναζήτηση'}): ${roleHits.length} αποτελέσματα αναζήτησης${roleFilter !== 'all' ? `, φίλτρο ρόλου ${statusEl(roleFilter) ?? roleFilter.replace('_', ' ')}` : ''}, ${suggestions.length} προτάσεις. Ποιον να κρατήσω ή σε ποιον να γράψω μετά, και ποια φίλτρα θα έβρισκαν συμπληρωματικό τεχνικό συνιδρυτή;`,
  };


  // Offered to the assistant: the tab, role, sort, layout and reset, and
  // each result's Connect (which opens the same request dialog), Message
  // and Save - over the people on the tab that is showing.
  const rowsUnread = activeTab === 'search' ? loading || searchFailed : suggestionsLoading || (suggestionsFailed && !recommendationsData);
  const shown = rowsUnread ? [] : activeTab === 'search' ? roleHits : matchList;
  const byName = (list: SearchHit[]) => rowOptions(list, (h) => h.id, (h) => h.displayName);
  const hitById = (id?: string) => shown.find((h) => h.id === id);
  usePageList([
    {
      id: 'people',
      labelEn: activeTab === 'search' ? 'Search results' : 'Top matches',
      labelEl: activeTab === 'search' ? 'Αποτελέσματα αναζήτησης' : 'Κορυφαίες αντιστοιχίσεις',
      rows: rowsUnread ? undefined : shown.map((h) =>
        `${h.displayName}${h.role ? ` · ${h.role}` : ''}${h.headline ? ` · ${h.headline}` : ''}${h.location ? ` · ${h.location}` : ''}${h.matchScore != null ? ` · match ${h.matchScore}%` : ''}`,
      ),
      rowsEl: rowsUnread ? undefined : shown.map((h) =>
        `${h.displayName}${h.role ? ` · ${elWord(h.role)}` : ''}${h.headline ? ` · ${h.headline}` : ''}${h.location ? ` · ${h.location}` : ''}${h.matchScore != null ? ` · ταίριασμα ${h.matchScore}%` : ''}`,
      ),
      ...(!rowsUnread && activeTab === 'search' ? { total } : {}),
    },
  ]);
  usePageControls([
    choiceControl('discover_tab', 'Discover section', 'Ενότητα ανακάλυψης', [
      { value: 'search', en: 'Search', el: 'Αναζήτηση' },
      { value: 'matches', en: 'Top matches', el: 'Κορυφαίες αντιστοιχίσεις' },
    ], activeTab, (v) => { setActiveTab(v === 'search' ? 'search' : 'matches'); setRoleFilter('all'); }),
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', ROLE_FILTERS.map((r) => ({ value: r.value, en: r.labelEn, el: r.labelEl })), roleFilter, (v) => setRoleFilter(v as RoleFilter)),
    choiceControl('sort', 'Sort results', 'Ταξινόμηση αποτελεσμάτων', [
      { value: 'relevance', en: 'Most relevant', el: 'Πιο σχετικά' },
      { value: 'recent', en: 'Newest', el: 'Νεότερα' },
      { value: 'active', en: 'Recently active', el: 'Πρόσφατα ενεργά' },
    ], filters.sortBy, (v) => setFilters((f) => ({ ...f, sortBy: v as SearchFiltersValues['sortBy'] }))),
    choiceControl('view', 'Results layout', 'Διάταξη αποτελεσμάτων', [
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
      { value: 'list', en: 'List', el: 'Λίστα' },
    ], viewMode, (v) => setViewMode(v as ViewMode)),
    { id: 'reset_filters', labelEn: 'Reset the search filters', labelEl: 'Επαναφορά φίλτρων αναζήτησης', writes: false, run: () => { setInterpreted(null); setFilters(defaultFilters); } },
    {
      id: 'search_as_typed',
      labelEn: 'Search the words as typed, without reading them into filters',
      labelEl: 'Αναζήτηση των λέξεων όπως γράφτηκαν, χωρίς φίλτρα',
      writes: false,
      ...(interpreted ? {} : { unavailableEn: 'The last search was not read into filters.', unavailableEl: 'Η τελευταία αναζήτηση δεν μετατράπηκε σε φίλτρα.' }),
      run: () => searchAsTyped(),
    },
    { id: 'save_search', labelEn: 'Save the current search', labelEl: 'Αποθήκευση τρέχουσας αναζήτησης', writes: false, run: () => openSaveSearch() },
    { id: 'connect_with', labelEn: 'Open a connection request to', labelEl: 'Άνοιγμα αιτήματος σύνδεσης προς', writes: false, options: byName(shown), run: (v) => { const h = hitById(v); if (h) handleConnect(hitToProfile(h)); } },
    { id: 'message_person', labelEn: 'Message', labelEl: 'Μήνυμα σε', writes: false, options: byName(shown), run: (v) => { const h = hitById(v); if (h) handleMessage(hitToProfile(h)); } },
    { id: 'save_person', labelEn: 'Save to shortlist', labelEl: 'Αποθήκευση στη λίστα', writes: true, options: byName(shown), run: (v) => { const h = hitById(v); return h ? handleBookmark(hitToProfile(h)) : ROW_GONE; } },
  ]);

  const rail: PageRailSection[] = [
    // First: the best matches as a short list beside the search. In the column, a
    // "Featured profiles · Top matches for your profile" strip listed the
    // first four search results, the same four cards drawn right under it
    // (docs §86).
    ...(bestMatches.length && activeTab === 'search' ? [{
      id: 'best',
      glyph: 'matches' as const,
      labelEn: 'Best matches',
      labelEl: 'Καλύτερες αντιστοιχίσεις',
      content: (
        <div className="space-y-1">
          <RailPeople people={bestMatches} />
          <RailAction icon={TrendingUp} en="See every match" el="Όλες οι αντιστοιχίσεις" onClick={() => { setActiveTab('matches'); setRoleFilter('all'); }} />
        </div>
      ),
    } satisfies PageRailSection] : []),
    {
      id: 'summary',
      glyph: 'discover',
      labelEn: 'Platform',
      labelEl: 'Πλατφόρμα',
      content: (
        <RailStats
          items={PLATFORM_STAT_SLOTS.map((s) => {
            const count = platformStats?.[s.key];
            return {
              key: s.key,
              label: s.labelEn,
              labelEl: s.labelEl,
              value: count == null ? '—' : count.toLocaleString('en-GB'),
              icon: s.icon,
              tone: 'bg-primary/10 text-primary-accessible',
            };
          })}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters & view',
      labelEl: 'Φίλτρα & προβολή',
      badge: (viewMode !== 'grid' ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          {/* The role is chosen on the page, under the search: the main
              filter was out of sight in a panel (docs §62.5, §111). */}
          <RailOptions
            title="Layout"
            titleEl="Διάταξη"
            options={[
              { value: 'grid' as ViewMode, en: 'Grid', el: 'Πλέγμα', icon: LayoutGrid },
              { value: 'list' as ViewMode, en: 'List', el: 'Λίστα', icon: List },
            ]}
            value={viewMode === 'match' ? 'grid' : viewMode}
            onChange={setViewMode}
          />
        </div>
      ),
    },
    {
      id: 'next',
      glyph: 'matches',
      labelEn: 'Where to go next',
      labelEl: 'Πού να πάτε μετά',
      content: (
        <div className="space-y-1">
          <RailAction icon={Bookmark} en="Open shortlist" el="Άνοιγμα λίστας" onClick={() => router.push('/shortlist')} />
          <RailAction icon={Search} en={discoverEn('saved_searches_link')} el={discoverEl('saved_searches_link')} onClick={() => router.push('/saved-searches')} />
          <RailAction icon={Users} en="Open connections" el="Άνοιγμα συνδέσεων" onClick={() => router.push('/connections')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title={discoverEn('page_title')}
      titleEl={discoverEl('page_title')}
      description={discoverEn('page_description')}
      descriptionEl={discoverEl('page_description')}
      showHelp
      askAi={askAi}
      contentClassName="overflow-x-clip"
      rail={rail}
    >
      <div className="min-w-0 space-y-6 overflow-x-clip pb-10">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setRoleFilter('all'); }}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <TabsList className="h-auto min-h-10 w-full min-w-0 sm:w-auto">
              <TabsTrigger value="search" className="min-h-10 flex-1 gap-1.5 px-2.5 text-xs sm:flex-none sm:gap-2 sm:px-3 sm:text-sm">
                <Users className="icon-sm hidden sm:block" />
                <BilingualText en={discoverEn('search')} el={discoverEl('search')} compact />
              </TabsTrigger>
              <TabsTrigger value="matches" className="min-h-10 flex-1 gap-1.5 px-2.5 text-xs sm:flex-none sm:gap-2 sm:px-3 sm:text-sm">
                <TrendingUp className="icon-sm hidden sm:block" />
                <BilingualText en={discoverEn('top_matches')} el={discoverEl('top_matches')} compact />
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-8 mt-6">
          {/* Filters */}
          <SearchFilters
            filters={filters}
            onFiltersChange={changeFilters}
            onSearch={searchFromField}
            interpreted={interpreted?.understood}
            onSearchAsTyped={searchAsTyped}
            loading={loading}
            resultCount={searchFailed ? undefined : total}
            onSaveSearch={openSaveSearch}
          />

          {/* Who: the role is how a person is looked for, so its chips sit in
              view with how many of the results each finds (the mentors page
              does the same with expertise; docs §62.5, §111). */}
          {!loading && !searchFailed && hits.length > 0 ? (
            <div className="-mt-4 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={bilingualInline('Role', 'Ρόλος')}>
              {roleChips.map((r) => {
                const on = roleFilter === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRoleFilter(r.value)}
                    className={cn(
                      'tap-target-y inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      on ? 'border-primary bg-primary/10 text-primary-accessible' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    <BilingualText en={r.labelEn} el={r.labelEl} compact />
                    <span className="tabular-nums opacity-70">{r.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Results */}
          {loading && (
            <div className={cn('grid grid-cols-1 gap-4', viewMode === 'grid' && PEOPLE_GRID)}>
              {[...Array(6)].map((_, i) => (
                <ProfileCardSkeleton key={i} variant={viewMode === 'list' ? 'compact' : 'default'} />
              ))}
            </div>
          )}

          {!loading && searchFailed && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p role="alert" className="text-sm text-muted-foreground">
                  <BilingualText en="Profiles could not be searched just now." el="Η αναζήτηση προφίλ δεν έγινε αυτή τη στιγμή." wrap />
                </p>
                <Button variant="outline" size="sm" onClick={() => void runSearch()}>
                  <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && roleHits.length === 0 && hits.length > 0 && roleFilter !== 'all' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                <BilingualText
                  en={`No ${roleFilter.replace('_', ' ')}s in these results.`}
                  el="Κανένα αποτέλεσμα με αυτόν τον ρόλο."
                  wrap
                />
              </p>
              <button onClick={() => setRoleFilter('all')} className="text-xs text-primary-accessible hover:underline"><BilingualText en="Show all roles" el="Όλοι οι ρόλοι" compact /></button>
            </div>
          )}

          {!loading && !searchFailed && hits.length === 0 && (
            <EmptyState
              title={<BilingualText en="No profiles found" el="Δεν βρέθηκαν προφίλ" compact wrap />}
              description={(() => {
                const names = discoverFilterNames(filters);
                if (names.length === 0) return undefined;
                return (
                  <BilingualText
                    en={`Nothing matched ${names.map((item) => item.en).join(', ')}. Clear them to see every profile.`}
                    el={`Τίποτα δεν ταιριάζει με ${names.map((item) => item.el).join(', ')}. Καθαρίστε τα για να δείτε όλα τα προφίλ.`}
                    wrap
                  />
                );
              })()}
              illustration="search"
              className="py-12"
              askAiPrompt={ASK.discoverNobody}
              // Only with something to clear: it was offered with no filter set.
              action={discoverFilterNames(filters).length ? (
                <Button onClick={() => setFilters(defaultFilters)}>
                  <BilingualText en="Clear filters" el="Καθαρισμός φίλτρων" compact />
                </Button>
              ) : undefined}
            />
          )}

          {!loading && promotedHits.length > 0 && (
            <section aria-label="Promoted · Προώθηση" className="space-y-3 border-b border-border pb-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                  <BilingualText en={PROMOTED_COPY.label.en} el={PROMOTED_COPY.label.el} compact />
                </span>
                {/* The label stays in view: a paid place is always said. What it means is one press away. */}
                <InfoHint title={{ en: 'What this means', el: 'Τι σημαίνει' }} className="flex-1">
                  <BilingualText en={PROMOTED_COPY.disclosure.en} el={PROMOTED_COPY.disclosure.el} wrap />
                </InfoHint>
              </div>
              {/* The same columns as the results under it: the promoted card
                  was half the row wide beside cards a third wide. */}
              <div className={cn('grid grid-cols-1 gap-4', viewMode === 'grid' && PEOPLE_GRID)}>
                {promotedHits.map((hit) => {
                  const profile = hitToProfile(hit);
                  return (
                    <ProfileCard
                      key={hit.id}
                      profile={profile}
                      variant={viewMode === 'list' ? 'compact' : 'default'}
                      onConnect={() => handleConnect(profile)}
                      onMessage={() => handleMessage(profile)}
                      onBookmark={() => handleBookmark(profile)}
                      {...personActions(profile.userId)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {!loading && filteredHits.length > 0 && (
            <AnimatedList
              animation="fade-in-up"
              staggerDelay={50}
              className={cn('grid grid-cols-1 gap-4', viewMode === 'grid' && PEOPLE_GRID)}
            >
              {filteredHits.map((hit) => {
                const profile = hitToProfile(hit);
                return (
                  <ProfileCard
                    key={hit.id}
                    profile={profile}
                    variant={viewMode === 'list' ? 'compact' : 'default'}
                    onConnect={() => handleConnect(profile)}
                    onMessage={() => handleMessage(profile)}
                    onBookmark={() => handleBookmark(profile)}
                    {...personActions(profile.userId)}
                  />
                );
              })}
            </AnimatedList>
          )}

          {/* For someone browsing: once there is a search, the results are the page. */}
          {!filters.q.trim() ? <DiscoverCurated /> : null}
        </TabsContent>

        {/* Top Matches: the people the engine suggests, best score first,
            each with its reasons, Pass and the person's one action. */}
        <TabsContent value="matches" className="space-y-6 mt-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  <BilingualText en="Your top matches" el="Οι κορυφαίες αντιστοιχίσεις σας" compact />
                </h2>
                <p className="text-xs text-muted-foreground">
                  <BilingualText en="From your profile and preferences, highest compatibility first" el="Από το προφίλ και τις προτιμήσεις σας, πρώτα η υψηλότερη συμβατότητα" wrap />
                </p>
              </div>
              {matchList.length > 0 ? (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                  <Link href="/matches">
                    <BilingualText en="All matches" el="Όλες οι αντιστοιχίσεις" compact />
                    <ArrowRight className="icon-sm" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
          </div>

          {!suggestionsLoaded && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <ProfileCardSkeleton key={i} variant="featured" />
              ))}
            </div>
          )}

          {suggestionsLoaded && suggestionsFailed && !recommendationsData && (
            <FailedLine
              en="Your matches could not be read just now."
              el="Οι αντιστοιχίσεις σας δεν διαβάστηκαν αυτή τη στιγμή."
              busy={suggestionsFetching}
              onRetry={() => void refetchSuggestions()}
            />
          )}

          {suggestionsLoaded && !suggestionsFailed && matchList.length === 0 && (
            <EmptyState
              title={<BilingualText en={suggestions.length ? 'You passed on every match' : 'No matches yet'} el={suggestions.length ? 'Παραλείψατε όλες τις αντιστοιχίσεις' : 'Καμία αντιστοίχιση ακόμη'} compact wrap />}
              description={
                <BilingualText
                  en="Matches come from your profile: what you build, what you look for, your stage and commitment. The more it says, the better they are; Search finds anyone meanwhile."
                  el="Οι αντιστοιχίσεις βγαίνουν από το προφίλ σας: τι φτιάχνετε, τι ψάχνετε, το στάδιο και τη δέσμευσή σας. Όσο περισσότερα λέει, τόσο καλύτερες· η Αναζήτηση βρίσκει οποιονδήποτε στο μεταξύ."
                  wrap
                />
              }
              illustration="connection"
              askAiPrompt={ASK.discoverNoSuggestions}
              action={
                <Button className="gap-2" asChild>
                  <Link href="/profile/edit">
                    <BilingualText en="Complete profile" el="Συμπλήρωση προφίλ" compact />
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
              }
            />
          )}

          {suggestionsLoaded && matchList.length > 0 && (
            <AnimatedList
              animation="scale-in"
              staggerDelay={100}
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
            >
              {matchList.map((hit) => {
                const profile = hitToProfile(hit);
                const matchReasons = (hit.matchReasons ?? [])
                  .map((text) => ({ type: 'skills' as MatchReasonType, text, score: 0 }));
                return (
                  <MatchCard
                    key={hit.id}
                    id={hit.id}
                    userId={hit.userId}
                    displayName={hit.displayName}
                    headline={hit.headline}
                    bio={hit.bio}
                    avatarUrl={hit.avatarUrl}
                    role={hit.role}
                    location={hit.location}
                    skills={hit.skillNames || []}
                    compatibilityScore={typeof hit.matchScore === 'number' ? hit.matchScore : null}
                    matchReasons={matchReasons}
                    reasons={explainMatch(hit, viewer, { nowMs })}
                    onLike={() => handleConnect(profile)}
                    connection={connectionOf(hit.userId)}
                    onAccept={() => void accept(hit.userId)}
                    onPass={() => passMatch(hit)}
                    onMessage={() => handleMessage(profile)}
                    onBookmark={() => handleBookmark(profile)}
                  />
                );
              })}
            </AnimatedList>
          )}
        </TabsContent>
      </Tabs>

      {/* Connection Request Dialog */}
      {connectionTarget && (
        <ConnectionRequestDialog
          open={showConnectionDialog}
          onOpenChange={setShowConnectionDialog}
          recipient={{
            id: connectionTarget.userId,
            displayName: connectionTarget.displayName,
            avatarUrl: connectionTarget.avatarUrl,
            role: connectionTarget.role,
            headline: connectionTarget.headline,
          }}
          onSend={handleSendConnection}
        />
      )}

      {/* Save search — keeps the current query and filters under a name so
          it can re-run from /saved-searches and raise alerts. */}
      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><BilingualText en={discoverEn('save_search_title')} el={discoverEl('save_search_title')} compact /></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DialogDescription>
              <BilingualText en={discoverEn('save_search_desc')} el={discoverEl('save_search_desc')} />
            </DialogDescription>
            <div className="space-y-2">
              <Label htmlFor="save-search-name"><BilingualText en={discoverEn('save_name_label')} el={discoverEl('save_name_label')} compact /></Label>
              <Input
                id="save-search-name"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder={discoverEn('save_name_placeholder')}
                autoFocus
              />
            </div>
            <label htmlFor="save-search-alerts" className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
              <input
                id="save-search-alerts"
                type="checkbox"
                checked={saveSearchAlerts}
                onChange={(e) => setSaveSearchAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary"
              />
              <BilingualText en={discoverEn('save_alerts')} el={discoverEl('save_alerts')} compact />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSearchOpen(false)}>
              <BilingualText en={discoverEn('save_cancel')} el={discoverEl('save_cancel')} compact />
            </Button>
            <Button onClick={() => void handleSaveSearch()} disabled={!saveSearchName.trim() || saveSearchBusy}>
              <BilingualText en={saveSearchBusy ? discoverEn('saving') : discoverEn('save_confirm')} el={saveSearchBusy ? discoverEl('saving') : discoverEl('save_confirm')} compact />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
    </AppShell>
  );
}
