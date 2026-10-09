'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Search, X, Users, Briefcase, Calendar,
  GraduationCap, Building2, FileText, Sparkles,
  MapPin, Clock, ArrowRight, History,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import {
  searchEn,
  searchEl,
  categoryLabelEn,
  categoryLabelEl,
  resultTypeEn,
  resultTypeEl,
  noMatchMessageEn,
  noMatchMessageEl,
  resultsSummaryEn,
  resultsSummaryEl,
  type SearchCategoryKey,
  type SearchResultTypeKey,
} from '@/lib/i18n/strings-search';
import { cn } from '@/lib/utils';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { SanitizedHtml } from '@/components/common/SanitizedHtml';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { FactLine } from '@/components/common/FactLine';

type SearchCategory = SearchCategoryKey;

type SearchResult = {
  id: string;
  type: 'user' | 'job' | 'event' | 'group' | 'opportunity';
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  href: string;
  meta?: Record<string, string>;
  tags?: string[];
  highlight?: string;
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
  categories: {
    people: number;
    jobs: number;
    events: number;
    groups: number;
    mentors: number;
    opportunities: number;
  };
};

const RECENT_SEARCHES_KEY = 'cfb:recent-searches';
const MAX_RECENT_SEARCHES = 6;

const EMPTY_CATEGORIES = {
  people: 0,
  jobs: 0,
  events: 0,
  groups: 0,
  mentors: 0,
  opportunities: 0,
};

function normalizeHit(raw: unknown): SearchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.href === 'string' && typeof row.title === 'string') {
    return {
      id: String(row.id ?? row.href),
      type: (row.type as SearchResult['type']) || 'user',
      title: row.title,
      subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined,
      description: typeof row.description === 'string' ? row.description : undefined,
      imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : undefined,
      href: row.href,
      meta: (row.meta as SearchResult['meta']) ?? undefined,
      tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : undefined,
      highlight: typeof row.highlight === 'string' ? row.highlight : undefined,
    };
  }
  if (typeof row.displayName === 'string') {
    const userId = String(row.userId ?? row.id ?? '');
    if (!userId) return null;
    return {
      id: userId,
      type: 'user',
      title: row.displayName,
      subtitle: typeof row.headline === 'string' ? row.headline : undefined,
      description: typeof row.bio === 'string' ? row.bio : undefined,
      imageUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : undefined,
      href: `/profiles/${userId}`,
      meta: typeof row.location === 'string' ? { location: row.location } : undefined,
      tags: Array.isArray(row.skillNames)
        ? row.skillNames.filter((t): t is string => typeof t === 'string')
        : undefined,
    };
  }
  return null;
}

async function performSearch(
  query: string,
  category: SearchCategory,
  page: number = 1
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    category,
    page: String(page),
    limit: '20',
  });
  const payload = await apiRequest<SearchResponse & { hits?: unknown[] }>(`/api/search?${params}`);
  const raw = (payload.results?.length ? payload.results : payload.hits) ?? [];
  const results = raw.map(normalizeHit).filter((row): row is SearchResult => Boolean(row?.href));
  return {
    results,
    total: payload.total ?? results.length,
    categories: payload.categories ?? EMPTY_CATEGORIES,
  };
}

const CATEGORY_CONFIG: Record<
  SearchCategory,
  { labelEn: string; labelEl: string; icon: React.ElementType }
> = {
  all: { labelEn: categoryLabelEn('all'), labelEl: categoryLabelEl('all'), icon: Sparkles },
  people: { labelEn: categoryLabelEn('people'), labelEl: categoryLabelEl('people'), icon: Users },
  jobs: { labelEn: categoryLabelEn('jobs'), labelEl: categoryLabelEl('jobs'), icon: Briefcase },
  events: { labelEn: categoryLabelEn('events'), labelEl: categoryLabelEl('events'), icon: Calendar },
  groups: { labelEn: categoryLabelEn('groups'), labelEl: categoryLabelEl('groups'), icon: Building2 },
  mentors: { labelEn: categoryLabelEn('mentors'), labelEl: categoryLabelEl('mentors'), icon: GraduationCap },
  opportunities: {
    labelEn: categoryLabelEn('opportunities'),
    labelEl: categoryLabelEl('opportunities'),
    icon: FileText,
  },
};

function SearchResultSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-border">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    user: { icon: Users, color: 'text-status-info' },
    job: { icon: Briefcase, color: 'text-status-success' },
    event: { icon: Calendar, color: 'text-status-accent' },
    group: { icon: Building2, color: 'text-status-warning' },
    opportunity: { icon: FileText, color: 'text-status-info' },
  };

  const config = typeConfig[result.type] || typeConfig.user;
  const Icon = config.icon;

  return (
    <Link
      href={result.href}
      className="block rounded-xl focus-visible:outline-none"
    >
      <Card className="group hover:border-primary/50 transition-all duration-150">
        <CardContent>
          <div className="flex items-start gap-4">
            {result.imageUrl ? (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={result.imageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary-accessible">
                  {result.title[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                'bg-muted'
              )}>
                <Icon className={cn('icon-md', config.color)} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground group-hover:text-primary-accessible transition-colors truncate">
                  {result.title}
                </h3>
                <Badge variant="secondary" className="text-2xs shrink-0">
                  <BilingualText
                    en={resultTypeEn(result.type as SearchResultTypeKey)}
                    el={resultTypeEl(result.type as SearchResultTypeKey)}
                    compact
                    secondaryFrom="lg"
                  />
                </Badge>
              </div>

              {result.subtitle && (
                <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
              )}

              {result.description && (
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mt-1">
                  {result.highlight ? (
                    <SanitizedHtml as="span" profile="highlight" html={result.highlight} />
                  ) : (
                    result.description
                  )}
                </p>
              )}

              {result.meta && Object.keys(result.meta).length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  {result.meta.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="icon-sm" />
                      {result.meta.location}
                    </span>
                  )}
                  {result.meta.date && (
                    <span className="flex items-center gap-1">
                      <Clock className="icon-sm" />
                      {result.meta.date}
                    </span>
                  )}
                </div>
              )}

              {result.tags && result.tags.length > 0 && (
                <FactLine className="mt-2" items={[...result.tags.slice(0, 3), result.tags.length > 3 ? `+${result.tags.length - 3}` : null]} />
              )}
            </div>

            <ArrowRight className="icon-sm text-muted-foreground opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ query, category }: { query: string; category: SearchCategory }) {
  const idle = !query;
  const { ask } = usePopupChat();
  const askPrompt = query
    ? `No search results for "${query}" in ${category}. Suggest better people, jobs, or events to look for.`
    : 'Help me search the network for a complementary cofounder.';
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center sm:py-12">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="icon-lg text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        <BilingualText
          en={idle ? searchEn('idle_title') : searchEn('empty_title')}
          el={idle ? searchEl('idle_title') : searchEl('empty_title')}
          stacked
          wrap
          secondaryFrom="lg"
        />
      </h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {query ? (
          <BilingualText
            en={noMatchMessageEn(query, category)}
            el={noMatchMessageEl(query, category)}
            stacked
            wrap
            secondaryFrom="lg"
          />
        ) : (
          <BilingualText
            en={searchEn('empty_hint')}
            el={searchEl('empty_hint')}
            stacked
            wrap
            secondaryFrom="lg"
          />
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/discover">
            <Users className="icon-sm" />
            <BilingualText en={searchEn('browse_people')} el={searchEl('browse_people')} compact secondaryFrom="lg" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/jobs">
            <Briefcase className="icon-sm" />
            <BilingualText en={searchEn('browse_jobs')} el={searchEl('browse_jobs')} compact secondaryFrom="lg" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/events">
            <Calendar className="icon-sm" />
            <BilingualText en={searchEn('browse_events')} el={searchEl('browse_events')} compact secondaryFrom="lg" />
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => ask(askPrompt)}>
          <CfbGlyph name="spark" className="icon-sm text-muted-foreground" />
          <BilingualText en={searchEn('ask_ai')} el={searchEl('ask_ai')} compact secondaryFrom="lg" />
        </Button>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const { ask } = usePopupChat();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';
  const initialCategory = (searchParams?.get('category') as SearchCategory) || 'all';

  const [query, setQuery] = useState(initialQuery);

  // Visible text, so one language — not both joined by a dot.

  const sayOne = useBilingualString();
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>(initialCategory);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored) as string[]);
    } catch {}
  }, []);

  // `/` focuses the field. Ctrl+K is the command palette — this page must not steal it.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (category !== 'all') params.set('category', category);
    
    const newUrl = params.toString() ? `/search?${params}` : '/search';
    router.replace(newUrl, { scroll: false });
  }, [debouncedQuery, category, router]);

  const { data, isLoading, isError } = useQuery({
    queryKey: qk('search', debouncedQuery, category),
    queryFn: () => performSearch(debouncedQuery, category),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Save successful searches to localStorage
  useEffect(() => {
    if (debouncedQuery.length >= 2 && data?.total) {
      setRecentSearches(prev => {
        const updated = [debouncedQuery, ...prev.filter((s) => s !== debouncedQuery)].slice(0, MAX_RECENT_SEARCHES);
        try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }, [debouncedQuery, data?.total]);

  const results = data?.results || [];
  const total = data?.total || 0;
  const categories = data?.categories || {
    people: 0,
    jobs: 0,
    events: 0,
    groups: 0,
    mentors: 0,
    opportunities: 0,
  };

  // The category, a recent search, and opening a result, for the assistant;
  // the results on screen go out as a list.
  const CATEGORY_VALUES: SearchCategory[] = ['all', 'people', 'jobs', 'events', 'groups', 'mentors', 'opportunities'];
  usePageControls([
    choiceControl('category', 'Search category', 'Κατηγορία αναζήτησης', CATEGORY_VALUES.map((c) => ({ value: c, en: categoryLabelEn(c), el: categoryLabelEl(c) })), category, (v) => setCategory(v as SearchCategory)),
    {
      id: 'recent_search',
      labelEn: 'Run a recent search',
      labelEl: 'Επανάληψη πρόσφατης αναζήτησης',
      writes: false,
      options: recentSearches.map((q) => ({ value: q, labelEn: q, labelEl: q })),
      unavailableEn: recentSearches.length === 0 ? 'There are no recent searches on this device.' : undefined,
      unavailableEl: recentSearches.length === 0 ? 'Δεν υπάρχουν πρόσφατες αναζητήσεις σε αυτή τη συσκευή.' : undefined,
      run: (q) => { if (q) { setQuery(q); setDebouncedQuery(q); } },
    },
    {
      id: 'open_result',
      labelEn: 'Open a search result',
      labelEl: 'Άνοιγμα αποτελέσματος αναζήτησης',
      writes: false,
      options: rowOptions(results, (r) => r.href, (r) => r.title),
      unavailableEn: results.length === 0 ? 'No result is shown.' : undefined,
      unavailableEl: results.length === 0 ? 'Δεν εμφανίζεται αποτέλεσμα.' : undefined,
      run: (href) => { if (href) router.push(href); },
    },
    {
      id: 'ask_search_ai',
      labelEn: 'Ask AI about this search',
      labelEl: 'Ρώτησε την AI για αυτή την αναζήτηση',
      writes: false,
      run: () => ask(query
        ? `No search results for "${query}" in ${category}. Suggest better people, jobs, or events to look for.`
        : 'Help me search the network for a complementary cofounder.'),
    },
  ]);
  usePageList([
    {
      id: 'results',
      labelEn: 'Search results',
      labelEl: 'Αποτελέσματα αναζήτησης',
      rows: debouncedQuery.length < 2 ? [] : isLoading ? undefined : results.map((r) => [r.title, r.subtitle, r.type].filter(Boolean).join(' · ')),
      total,
    },
  ]);

  return (
    <AppShell showHelp>
      <div className="">
        {/* Search Input */}
        <div
          className="sticky z-10 -mx-4 bg-background/95 px-4 pb-4 pt-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 top-[calc(var(--banner-network,0px)+var(--banner-demo,0px)+3rem)] sm:top-[calc(var(--banner-network,0px)+var(--banner-demo,0px))]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              aria-label={sayOne('Search the platform', 'Αναζήτηση στην πλατφόρμα')}
              placeholder={sayOne(searchEn('input_placeholder'), searchEl('input_placeholder'))}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 150)}
              className="h-11 pl-10 pr-16"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {!query && (
                <kbd className="hidden items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:flex">
                  /
                </kbd>
              )}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={bilingualAria(searchEn('clear_search'), searchEl('clear_search'))}
                >
                  <X className="icon-sm" />
                </button>
              )}
            </div>

          {/* Recent searches dropdown */}
          {inputFocused && !query && recentSearches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <History className="icon-sm" />
                  <BilingualText en={searchEn('recent_searches')} el={searchEl('recent_searches')} />
                </span>
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch {}
                  }}
                  className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BilingualText en={searchEn('clear')} el={searchEl('clear')} />
                </button>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => { setQuery(term); inputRef.current?.blur(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-secondary/60 transition-colors text-left"
                >
                  <History className="icon-sm text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{term}</span>
                  <X
                    className="h-3 w-3 text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={bilingualAria(searchEn('remove_recent'), searchEl('remove_recent'))}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecentSearches(prev => {
                        const updated = prev.filter((s) => s !== term);
                        try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
                        return updated;
                      });
                    }} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          </div>

          {/* Category Tabs */}
          <div className="mt-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 min-w-max">
              {(Object.entries(CATEGORY_CONFIG) as [SearchCategory, typeof CATEGORY_CONFIG[SearchCategory]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  const count = key === 'all' ? total : categories[key as keyof typeof categories] || 0;
                  const isActive = category === key;

                  return (
                    <Button
                      key={key}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCategory(key)}
                      className={cn(
                        'gap-1.5 text-xs',
                        !isActive && 'border-border'
                      )}
                    >
                      <Icon className="icon-sm" />
                      <BilingualText
                        en={config.labelEn}
                        el={config.labelEl}
                        compact
                        secondaryFrom="lg"
                      />
                      {debouncedQuery.length >= 2 && count > 0 && (
                        <Badge
                          variant={isActive ? 'secondary' : 'outline'}
                          className="ml-1 h-4 px-1 text-2xs"
                        >
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-4">
          {debouncedQuery.length < 2 ? (
            <EmptyState query="" category={category} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <SearchResultSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <X className="h-7 w-7 text-destructive-accessible" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                <BilingualText en={searchEn('search_failed_title')} el={searchEl('search_failed_title')} />
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <BilingualText en={searchEn('search_failed_body')} el={searchEl('search_failed_body')} />
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                <BilingualText en={searchEn('retry')} el={searchEl('retry')} />
              </Button>
            </div>
          ) : results.length === 0 ? (
            <EmptyState query={debouncedQuery} category={category} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  <BilingualText
                    en={resultsSummaryEn(total, debouncedQuery)}
                    el={resultsSummaryEl(total, debouncedQuery)}
                  />
                </p>
              </div>
              <div className="space-y-3">
                {results.filter((result) => Boolean(result?.href)).map((result) => (
                  <ResultCard key={`${result.type}-${result.id}`} result={result} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick Links */}
        {debouncedQuery.length < 2 && (
          <div className="mt-8">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              <BilingualText
                en={searchEn('quick_links')}
                el={searchEl('quick_links')}
                stacked
                wrap
                secondaryFrom="lg"
              />
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link href="/discover" className="group">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-info-bg">
                      <Users className="icon-md text-status-info" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary-accessible transition-colors">
                        <BilingualText
                          en={searchEn('discover_people_title')}
                          el={searchEl('discover_people_title')}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <BilingualText
                          en={searchEn('discover_people_desc')}
                          el={searchEl('discover_people_desc')}
                        />
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/mentoring" className="group">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-accent-bg">
                      <GraduationCap className="icon-md text-status-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary-accessible transition-colors">
                        <BilingualText
                          en={searchEn('find_mentors_title')}
                          el={searchEl('find_mentors_title')}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <BilingualText
                          en={searchEn('find_mentors_desc')}
                          el={searchEl('find_mentors_desc')}
                        />
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/jobs" className="group">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success-bg">
                      <Briefcase className="icon-md text-status-success" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary-accessible transition-colors">
                        <BilingualText
                          en={searchEn('browse_jobs_title')}
                          el={searchEl('browse_jobs_title')}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <BilingualText
                          en={searchEn('browse_jobs_desc')}
                          el={searchEl('browse_jobs_desc')}
                        />
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/events" className="group">
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning-bg">
                      <Calendar className="icon-md text-status-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary-accessible transition-colors">
                        <BilingualText
                          en={searchEn('upcoming_events_title')}
                          el={searchEl('upcoming_events_title')}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <BilingualText
                          en={searchEn('upcoming_events_desc')}
                          el={searchEl('upcoming_events_desc')}
                        />
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
