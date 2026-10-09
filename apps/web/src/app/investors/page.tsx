'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, TrendingUp, Briefcase,
  Bookmark, UserPlus, Zap, ArrowUpDown, Users, Eye, BadgeCheck, Telescope,
  BarChart3, Layers, X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FactLine } from '@/components/common/FactLine';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  getShortlistIds, removeFromShortlist, saveToShortlist, searchProfiles, type SearchHit,
} from '@/lib/api';
import { bilingualInline } from '@/lib/i18n/format';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { qk } from '@/lib/query-keys';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { AskIntroButton } from '@/components/intros/AskIntroDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * One row of the directory. People come from the profile search (role
 * investor), which knows who they are, where, and which industries they
 * follow; the investor-profile fields (type, check size, stages, track record)
 * are known only for the sample rows, so on a real row they are absent and
 * the card leaves them out rather than showing a zero.
 */
type Investor = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  headline?: string;
  location?: string;
  investorType?: InvestorType;
  firmName?: string;
  firmRole?: string;
  industries: string[];
  stages: string[];
  checkSizeMin?: number;
  checkSizeMax?: number;
  geographies: string[];
  isVerified?: boolean;
  isActivelyScouting?: boolean;
  portfolioCount?: number;
  viewCount?: number;
  dealsThisYear?: number;
  thesisSummary?: string;
  /** A fixture: no account stands behind it, so it has no profile or inbox. */
  sample: boolean;
};

type InvestorType = 'angel_investor' | 'vc' | 'vc_scout' | 'syndicate' | 'cvc' | 'family_office';
type TypeFilter = InvestorType | 'all';
type StageFilter = 'all' | 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'growth';
type ScoutFilter = 'any' | 'scouting';
type SortBy = 'portfolio' | 'views' | 'deals';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function formatCheckSize(min?: number, max?: number) {
  if (!min && !max) return null;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `≤ ${fmt(max!)}`;
}

const TYPE_OPTIONS = [
  { value: 'all', en: 'All types', el: 'Όλοι οι τύποι' },
  { value: 'angel_investor', en: 'Angel', el: 'Angel' },
  { value: 'vc', en: 'VC fund', el: 'Ταμείο VC' },
  { value: 'vc_scout', en: 'VC scout', el: 'Scout VC' },
  { value: 'syndicate', en: 'Syndicate', el: 'Syndicate' },
  { value: 'family_office', en: 'Family office', el: 'Family office' },
  { value: 'cvc', en: 'Corporate VC', el: 'Εταιρικό VC' },
] as const satisfies ReadonlyArray<{ value: TypeFilter; en: string; el: string }>;

const STAGE_OPTIONS = [
  { value: 'all', en: 'All stages', el: 'Όλα τα στάδια' },
  { value: 'pre-seed', en: 'Pre-seed', el: 'Pre-seed' },
  { value: 'seed', en: 'Seed', el: 'Seed' },
  { value: 'series-a', en: 'Series A', el: 'Series A' },
  { value: 'series-b', en: 'Series B', el: 'Series B' },
  { value: 'growth', en: 'Growth', el: 'Ανάπτυξη' },
] as const satisfies ReadonlyArray<{ value: StageFilter; en: string; el: string }>;

const SCOUT_OPTIONS = [
  { value: 'any', en: 'Anyone', el: 'Όλοι', icon: Users },
  { value: 'scouting', en: 'Actively scouting only', el: 'Μόνο όσοι αναζητούν ενεργά', icon: Zap },
] as const satisfies ReadonlyArray<{ value: ScoutFilter; en: string; el: string; icon: unknown }>;

const SORT_OPTIONS = [
  { value: 'portfolio', en: 'Most invested', el: 'Περισσότερες επενδύσεις' },
  { value: 'deals', en: 'Most active', el: 'Πιο ενεργοί' },
  { value: 'views', en: 'Most viewed', el: 'Περισσότερες προβολές' },
] as const satisfies ReadonlyArray<{ value: SortBy; en: string; el: string }>;

const TYPE_LABEL: Record<InvestorType, { en: string; el: string }> = Object.fromEntries(
  TYPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => [o.value, { en: o.en, el: o.el }]),
) as Record<InvestorType, { en: string; el: string }>;

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.value, o.en]));

function hitToInvestor(hit: SearchHit): Investor {
  return {
    id: hit.id,
    userId: hit.userId,
    displayName: hit.displayName,
    avatarUrl: hit.avatarUrl ?? undefined,
    headline: hit.headline ?? undefined,
    location: hit.location ?? undefined,
    industries: hit.industries ?? [],
    stages: [],
    geographies: [],
    thesisSummary: hit.bio ?? undefined,
    sample: false,
  };
}

// ── Sample directory ───────────────────────────────────────────────────────────

/*
 * Shown only while sample data is on, beside whoever the real search returns.
 * The people and firms are invented; none names a real fund or company, and
 * none has a profile or an inbox, so their Profile and Intro buttons say so.
 */
const SAMPLE_INVESTORS: Investor[] = [
  {
    id: 'sample-inv-1', userId: 'sample-inv-1', displayName: 'Irini Kosta', investorType: 'angel_investor',
    firmName: 'Kosta Angels', firmRole: 'Founding partner',
    thesisSummary: 'AI-native tools that remove human bottlenecks from B2B workflows.',
    industries: ['AI/ML', 'Developer tools', 'B2B SaaS'], stages: ['pre-seed', 'seed'],
    checkSizeMin: 25_000, checkSizeMax: 150_000, geographies: ['Greece', 'EU'],
    isVerified: true, isActivelyScouting: true, portfolioCount: 24, viewCount: 1842, dealsThisYear: 6, sample: true,
  },
  {
    id: 'sample-inv-2', userId: 'sample-inv-2', displayName: 'Michalis Theodorou', investorType: 'vc',
    firmName: 'Levant Capital', firmRole: 'Principal',
    thesisSummary: 'B2B SaaS with strong net revenue retention and a clear expansion path.',
    industries: ['B2B SaaS', 'FinTech', 'Digital health'], stages: ['seed', 'series-a'],
    checkSizeMin: 500_000, checkSizeMax: 3_000_000, geographies: ['Greece', 'Cyprus', 'UK'],
    isVerified: true, isActivelyScouting: true, portfolioCount: 45, viewCount: 3210, dealsThisYear: 12, sample: true,
  },
  {
    id: 'sample-inv-3', userId: 'sample-inv-3', displayName: 'Helena Brandt', investorType: 'angel_investor',
    firmRole: 'Independent angel',
    thesisSummary: 'Financial infrastructure: payments, embedded finance and access to credit.',
    industries: ['FinTech', 'Payments', 'Embedded finance'], stages: ['pre-seed', 'seed'],
    checkSizeMin: 10_000, checkSizeMax: 75_000, geographies: ['UK', 'EU'],
    isVerified: true, isActivelyScouting: true, portfolioCount: 18, viewCount: 967, dealsThisYear: 5, sample: true,
  },
  {
    id: 'sample-inv-4', userId: 'sample-inv-4', displayName: 'Andreas Papadopoulos', investorType: 'vc',
    firmName: 'Meridian Deep Tech Fund', firmRole: 'Partner',
    thesisSummary: 'Deep tech, climate and biotech from Southern Europe with global ambitions.',
    industries: ['Deep tech', 'Climate', 'Biotech'], stages: ['seed', 'series-a'],
    checkSizeMin: 200_000, checkSizeMax: 1_500_000, geographies: ['Greece', 'SE Europe', 'EU'],
    isVerified: true, isActivelyScouting: false, portfolioCount: 31, viewCount: 2104, dealsThisYear: 8, sample: true,
  },
  {
    id: 'sample-inv-5', userId: 'sample-inv-5', displayName: 'Priya Nair', investorType: 'vc_scout',
    firmName: 'Scout programme', firmRole: 'Scout',
    thesisSummary: 'Consumer health, mental wellness and longevity at pre-seed.',
    industries: ['Health tech', 'Mental health', 'Wellness'], stages: ['pre-seed', 'seed'],
    checkSizeMin: 100_000, checkSizeMax: 500_000, geographies: ['UK', 'India'],
    isVerified: true, isActivelyScouting: true, portfolioCount: 9, viewCount: 712, dealsThisYear: 3, sample: true,
  },
  {
    id: 'sample-inv-6', userId: 'sample-inv-6', displayName: 'Klaus Weber', investorType: 'family_office',
    firmName: 'Weber Family Office', firmRole: 'Investment director',
    thesisSummary: 'Capital-efficient SaaS and marketplaces with €500K+ ARR.',
    industries: ['SaaS', 'Marketplaces', 'E-commerce'], stages: ['series-a', 'series-b'],
    checkSizeMin: 1_000_000, checkSizeMax: 5_000_000, geographies: ['DACH', 'EU'],
    isVerified: false, isActivelyScouting: false, portfolioCount: 14, viewCount: 455, dealsThisYear: 2, sample: true,
  },
];

// ── Investor card ──────────────────────────────────────────────────────────────

function InvestorCard({
  investor,
  saved,
  onToggleSave,
}: {
  investor: Investor;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const initials = initialsOf(investor.displayName);
  const checkSize = formatCheckSize(investor.checkSizeMin, investor.checkSizeMax);
  const type = investor.investorType ? TYPE_LABEL[investor.investorType] : null;
  const place = investor.geographies.length ? investor.geographies.slice(0, 2).join(', ') : investor.location;
  const sampleReason = bilingualInline('Sample investor: there is no profile or inbox behind it', 'Δείγμα επενδυτή: δεν υπάρχει προφίλ ή εισερχόμενα');
  const facts = [
    investor.portfolioCount != null && { key: 'portfolio', icon: Briefcase, en: `${investor.portfolioCount} investments`, el: `${investor.portfolioCount} επενδύσεις` },
    investor.dealsThisYear != null && { key: 'deals', icon: BarChart3, en: `${investor.dealsThisYear} deals this year`, el: `${investor.dealsThisYear} συμφωνίες φέτος` },
    investor.viewCount != null && { key: 'views', icon: Eye, en: `${investor.viewCount.toLocaleString('en-GB')} views`, el: `${investor.viewCount.toLocaleString('el-GR')} προβολές` },
  ].filter(Boolean) as { key: string; icon: typeof Briefcase; en: string; el: string }[];

  return (
    <Card className="group transition-all hover:border-primary/30">
      <CardContent>
        <div className="flex items-start gap-4">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={investor.avatarUrl} alt="" />
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary-accessible">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Wraps on a phone, where the type badge and bookmark leave
                      the name ~120px; truncates from `sm` up. */}
                  <h3 className="break-words font-semibold sm:truncate">{investor.displayName}</h3>
                  {investor.isVerified && (
                    <BadgeCheck
                      className={cn('icon-sm shrink-0', STATUS.info.icon)}
                      aria-label={bilingualInline('Verified', 'Επαληθευμένος')}
                    />
                  )}
                  {investor.isActivelyScouting && (
                    <Badge className={cn('border text-2xs', STATUS.success.chip)}>
                      <Zap className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
                      <BilingualText en="Actively scouting" el="Αναζητά ενεργά" compact />
                    </Badge>
                  )}
                </div>
                {/* One text run, never cut: the investor type, then firm and
                    role (as separate flex items they broke into ragged
                    columns, "Horizon / Capital · Principal"). The type was a
                    pill beside the bookmark; it is a fact about the person. */}
                {type || investor.firmName || investor.firmRole || investor.headline ? (
                  <p className="mt-0.5 min-w-0 text-sm text-muted-foreground">
                    {type ? <BilingualText en={type.en} el={type.el} compact /> : null}
                    {type && (investor.firmName || investor.firmRole || investor.headline) ? ' · ' : null}
                    {investor.firmName || investor.firmRole
                      ? [investor.firmName, investor.firmRole].filter(Boolean).join(' · ')
                      : investor.headline}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  aria-label={saved
                    ? bilingualInline(`Remove ${investor.displayName} from your shortlist`, `Αφαίρεση ${investor.displayName} από τη λίστα σας`)
                    : bilingualInline(`Save ${investor.displayName} to your shortlist`, `Αποθήκευση ${investor.displayName} στη λίστα σας`)}
                  aria-pressed={saved}
                  type="button"
                  onClick={onToggleSave}
                  className="tap-target flex items-center gap-1 rounded-md p-1 transition-colors hover:bg-muted sm:px-1.5"
                >
                  <Bookmark className={cn('icon-sm', saved ? 'fill-primary text-primary-accessible' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className="hidden sm:inline text-xs"><BilingualText en={saved ? 'Saved' : 'Save'} el={saved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact /></span>
                </button>
              </div>
            </div>

            {investor.thesisSummary && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{investor.thesisSummary}</p>
            )}

            {/* What they invest in, then in which sectors: two fact lines,
                dot-separated, where stages, cheque, place and sectors were up
                to eight tinted pills. */}
            <FactLine
              className="mt-2.5"
              label={bilingualInline('Stages, cheque size and place', 'Στάδια, εύρος επένδυσης και τόπος')}
              items={[
                ...investor.stages.map((s) => STAGE_LABEL[s] ?? s),
                checkSize,
                place,
              ]}
            />
            <FactLine
              className="mt-1"
              label={bilingualInline('Sectors', 'Τομείς')}
              items={investor.industries}
            />

            <div className="mt-3 flex flex-col items-start gap-2 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {facts.map(({ key, icon: Icon, en, el }) => (
                  <span key={key} className="flex items-center gap-1">
                    <Icon className="icon-sm" aria-hidden="true" />
                    <BilingualText en={en} el={el} compact />
                  </span>
                ))}
              </div>
              {/* Three actions wrap on a phone instead of widening the page,
                  from the card's left edge (right-aligned they stacked into a
                  ragged column). */}
              <div className="flex min-w-0 max-w-full flex-wrap gap-2 sm:ml-auto sm:justify-end">
                {investor.sample ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled title={sampleReason}>
                      <Eye className="icon-sm" aria-hidden="true" />
                      <BilingualText en="Profile" el="Προφίλ" compact />
                    </Button>
                    <Button size="sm" className="h-7 gap-1 text-xs" disabled title={sampleReason}>
                      <UserPlus className="icon-sm" aria-hidden="true" />
                      <BilingualText en="Message directly" el="Απευθείας μήνυμα" compact />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                      <Link href={`/profiles/${investor.userId}`}>
                        <Eye className="icon-sm" aria-hidden="true" />
                        <BilingualText en="Profile" el="Προφίλ" compact />
                      </Link>
                    </Button>
                    {/* A warm path first: who you know who knows them (the
                        intermediary decides whether to forward). The direct
                        message stays beside it, named for what it is. */}
                    <AskIntroButton targetId={investor.userId} targetName={investor.displayName} className="h-7 gap-1 text-xs" />
                    <Button size="sm" className="h-7 gap-1 text-xs" asChild>
                      <Link href={`/messages?to=${investor.userId}`}>
                        <UserPlus className="icon-sm" aria-hidden="true" />
                        <BilingualText en="Message directly" el="Απευθείας μήνυμα" compact />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InvestorsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { showDemoData } = useDemoData();
  const { openRailSection } = usePageRail();
  const [search, setSearch] = useState('');
  const [investorType, setInvestorType] = useState<TypeFilter>('all');
  const [stage, setStage] = useState<StageFilter>('all');
  const [scout, setScout] = useState<ScoutFilter>('any');
  const [sortBy, setSortBy] = useState<SortBy>('portfolio');
  const [sampleSaved, setSampleSaved] = useState<Set<string>>(() => new Set());

  const query = search.trim();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('members', 'investors', query, stage),
    queryFn: () => searchProfiles({
      q: query || undefined,
      roles: ['investor'],
      investmentStages: stage !== 'all' ? [stage] : undefined,
      limit: 50,
    }),
    staleTime: 60_000,
    retry: 1,
  });
  const { data: shortlistData } = useQuery({
    queryKey: qk('shortlist', 'ids'),
    queryFn: getShortlistIds,
    staleTime: 60_000,
  });
  const shortlisted = useMemo(() => new Set(shortlistData?.ids ?? []), [shortlistData]);

  const realInvestors = useMemo(
    () => (Array.isArray(data?.hits) ? data.hits : []).map(hitToInvestor),
    [data],
  );
  const directory = useMemo(
    () => (showDemoData ? [...realInvestors, ...SAMPLE_INVESTORS] : realInvestors),
    [realInvestors, showDemoData],
  );

  /*
   * The search and the stage reach the API for real rows. Type and scouting
   * are investor-profile fields the directory search does not return, so a
   * row that does not carry them drops out when one is chosen, rather than
   * being claimed to match.
   */
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return directory
      .filter((inv) => {
        if (!inv.sample) return (investorType === 'all' || inv.investorType === investorType) && (scout === 'any' || inv.isActivelyScouting === true);
        const matchSearch = !q
          || inv.displayName.toLowerCase().includes(q)
          || (inv.firmName?.toLowerCase().includes(q) ?? false)
          || inv.industries.some((i) => i.toLowerCase().includes(q));
        const matchType = investorType === 'all' || inv.investorType === investorType;
        const matchStage = stage === 'all' || inv.stages.includes(stage);
        const matchScout = scout === 'any' || inv.isActivelyScouting === true;
        return matchSearch && matchType && matchStage && matchScout;
      })
      .sort((a, b) => {
        // People who are really here come before the samples, in the
        // search's own order; the sort ranks the samples by their figures.
        if (a.sample !== b.sample) return a.sample ? 1 : -1;
        const pick = (i: Investor) => (sortBy === 'portfolio' ? i.portfolioCount : sortBy === 'views' ? i.viewCount : i.dealsThisYear);
        return (pick(b) ?? -1) - (pick(a) ?? -1);
      });
  }, [directory, query, investorType, stage, scout, sortBy]);

  const scoutingCount = directory.filter((i) => i.isActivelyScouting).length;
  const knownPortfolio = directory.filter((i) => i.portfolioCount != null);
  const totalPortfolio = knownPortfolio.reduce((s, i) => s + (i.portfolioCount ?? 0), 0);
  const industriesCovered = new Set(directory.flatMap((i) => i.industries)).size;
  const activeFilters = (investorType !== 'all' ? 1 : 0) + (stage !== 'all' ? 1 : 0) + (scout !== 'any' ? 1 : 0);
  const clearFilters = () => { setInvestorType('all'); setStage('all'); setScout('any'); };

  const isSaved = (inv: Investor) => (inv.sample ? sampleSaved.has(inv.userId) : shortlisted.has(inv.userId));
  const toggleSave = async (inv: Investor) => {
    const next = !isSaved(inv);
    if (inv.sample) {
      // A sample has no account to shortlist; the mark lasts for this visit.
      setSampleSaved((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(inv.userId); else copy.delete(inv.userId);
        return copy;
      });
      return;
    }
    try {
      if (next) await saveToShortlist(inv.userId);
      else await removeFromShortlist(inv.userId);
      await queryClient.invalidateQueries({ queryKey: qk('shortlist') });
      success(next
        ? bilingualInline('Saved to your shortlist', 'Αποθηκεύτηκε στη λίστα σας')
        : bilingualInline('Removed from your shortlist', 'Αφαιρέθηκε από τη λίστα σας'));
    } catch {
      toastError(bilingualInline('Could not update your shortlist', 'Δεν ήταν δυνατή η ενημέρωση της λίστας σας'));
    }
  };

  // Offered to the assistant: the rail's filters and the sort, through the
  // same setters. Saving a person is a shortlist write of its own.
  usePageControls([
    choiceControl('investor_type', 'Investor type', 'Τύπος επενδυτή', [...TYPE_OPTIONS], investorType, (v) => setInvestorType(v as TypeFilter)),
    choiceControl('investor_stage', 'Investment stage', 'Στάδιο επένδυσης', [...STAGE_OPTIONS], stage, (v) => setStage(v as StageFilter)),
    choiceControl('investor_scouting', 'Scouting', 'Αναζήτηση', SCOUT_OPTIONS.map(({ value, en, el }) => ({ value, en, el })), scout, (v) => setScout(v as ScoutFilter)),
    choiceControl('investor_sort', 'Sort investors', 'Ταξινόμηση επενδυτών', [...SORT_OPTIONS], sortBy, (v) => setSortBy(v as SortBy)),
  ]);
  usePageList([
    {
      id: 'investors',
      labelEn: 'Investors',
      labelEl: 'Επενδυτές',
      rows: isLoading ? undefined : filtered.filter((i) => !i.sample).map((i) =>
        `${i.displayName}${i.headline ? ` · ${i.headline}` : ''}${i.location ? ` · ${i.location}` : ''}${i.industries.length ? ` · ${i.industries.join(', ')}` : ''}${shortlisted.has(i.userId) ? ' · on your shortlist' : ''}`,
      ),
    },
    {
      id: 'sample-investors',
      labelEn: 'Sample investors',
      labelEl: 'Δείγματα επενδυτών',
      rows: showDemoData ? filtered.filter((i) => i.sample).map((i) =>
        `${i.displayName}${i.firmName ? ` · ${i.firmName}` : ''} · ${i.investorType ? TYPE_LABEL[i.investorType].en : 'investor'} · ${i.stages.join('/')} · ${formatCheckSize(i.checkSizeMin, i.checkSizeMax) ?? 'check size undisclosed'}`,
      ) : [],
      sample: true,
    },
  ]);

  /*
   * The column leads with the search and the people. The four directory
   * figures and the type, stage and scouting filters are auxiliary, so they
   * live in the rail; the sort stays beside the count it orders.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'discover',
      labelEn: 'Directory at a glance',
      labelEl: 'Ο κατάλογος με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'investors', label: 'Investors', labelEl: 'Επενδυτές', value: isLoading ? '—' : directory.length, icon: Users, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'scouting', label: 'Actively scouting', labelEl: 'Αναζητούν ενεργά', value: scoutingCount, icon: Zap, tone: 'bg-status-success-bg text-status-success' },
            ...(knownPortfolio.length ? [{ key: 'portfolio', label: 'Investments on record', labelEl: 'Καταγεγραμμένες επενδύσεις', value: totalPortfolio, icon: Briefcase, tone: 'bg-status-info-bg text-status-info' }] : []),
            { key: 'industries', label: 'Industries covered', labelEl: 'Κλάδοι που καλύπτονται', value: industriesCovered, icon: Telescope, tone: 'bg-status-warning-bg text-status-warning' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: activeFilters || null,
      content: (
        <div className="space-y-4">
          <RailOptions title="Investor type" titleEl="Τύπος επενδυτή" options={TYPE_OPTIONS} value={investorType} onChange={setInvestorType} />
          <RailOptions title="Stage" titleEl="Στάδιο" options={STAGE_OPTIONS} value={stage} onChange={setStage} />
          <RailOptions title="Availability" titleEl="Διαθεσιμότητα" options={SCOUT_OPTIONS} value={scout} onChange={setScout} />
          {activeFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={clearFilters} />
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
          <RailAction icon={TrendingUp} en="Open fundraising" el="Άνοιγμα χρηματοδότησης" onClick={() => router.push('/fundraising')} />
          <RailAction icon={Zap} en="Open matches" el="Άνοιγμα αντιστοιχίσεων" onClick={() => router.push('/matches')} />
          <RailAction icon={Telescope} en="Open discover" el="Άνοιγμα ανακάλυψης" onClick={() => router.push('/discover')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell showHelp rail={rail}>
      <div className="space-y-6 pb-10">
        {showDemoData && (
          <SampleDataNotice
            surface="Investors"
            detail="The directory lists people whose role is investor. The six cards with a firm, check size and track record are sample profiles that show what a complete investor profile looks like; they have no profile page or inbox."
            askAiPrompt="Some investors here are samples. Which kind of investor fits my stage and industry, and how should I ask for an intro?"
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={bilingualInline('Search by name, firm or focus area…', 'Αναζήτηση με όνομα, εταιρεία ή πεδίο…')}
            aria-label={bilingualInline('Search investors', 'Αναζήτηση επενδυτών')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? (
              <BilingualText en="Loading investors…" el="Φόρτωση επενδυτών…" compact />
            ) : (
              <BilingualText
                en={`${filtered.length} of ${directory.length} investors`}
                el={`${filtered.length} από ${directory.length} επενδυτές`}
                compact
              />
            )}
          </p>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger aria-label={bilingualInline('Sort investors', 'Ταξινόμηση επενδυτών')} className="h-9 w-full sm:w-auto sm:min-w-[17rem]">
              <ArrowUpDown className="mr-2 icon-sm text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <BilingualText en={o.en} el={o.el} compact />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {isError && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  <BilingualText en="The investor directory could not be loaded." el="Δεν ήταν δυνατή η φόρτωση του καταλόγου επενδυτών." wrap />
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
                </Button>
              </CardContent>
            </Card>
          )}
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex gap-4">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : filtered.map((inv) => (
                <InvestorCard key={inv.id} investor={inv} saved={isSaved(inv)} onToggleSave={() => void toggleSave(inv)} />
              ))}
          {!isLoading && filtered.length === 0 && (
            <Card>
              <CardContent className="py-14 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
                <p className="font-medium">
                  {directory.length === 0 && !query
                    ? <BilingualText en="No investors have joined yet" el="Δεν έχουν εγγραφεί ακόμα επενδυτές" />
                    : <BilingualText en="No investors match" el="Κανένας επενδυτής δεν ταιριάζει" />}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeFilters > 0
                    ? <BilingualText en="The filters in the side panel may be hiding people. Type and scouting are known only for complete investor profiles." el="Τα φίλτρα του πλευρικού πάνελ ίσως κρύβουν άτομα. Ο τύπος και η αναζήτηση είναι γνωστά μόνο για πλήρη προφίλ επενδυτών." wrap />
                    : query
                      ? <BilingualText en="Try a different name, firm or industry." el="Δοκιμάστε άλλο όνομα, εταιρεία ή κλάδο." wrap />
                      : <BilingualText en="Investors appear here once they join with the investor role." el="Οι επενδυτές εμφανίζονται εδώ όταν εγγραφούν με τον ρόλο του επενδυτή." wrap />}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {activeFilters > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => openRailSection('filters')}>
                      <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                    </Button>
                  )}
                  {query && (
                    <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                      <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
                    </Button>
                  )}
                  {!query && activeFilters === 0 && (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/fundraising">
                        <Layers className="mr-1.5 icon-sm" aria-hidden="true" />
                        <BilingualText en="Plan your round" el="Σχεδιάστε τον γύρο σας" compact />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
