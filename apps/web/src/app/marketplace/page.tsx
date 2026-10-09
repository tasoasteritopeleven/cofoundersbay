'use client';

import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Star, ExternalLink, Package, TrendingUp, DollarSign,
  CheckCircle, MessageCircle, Bookmark, Filter, ArrowUpDown,
  Clock, MapPin, Users, Zap, ChevronRight, ShieldCheck, Plus,
  Scale, Calculator, Megaphone, Code2, Brush, BrainCircuit, GraduationCap,
  Globe, BadgeCheck, Store, Handshake, Briefcase,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction } from '@/components/layout/RailParts';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { listMarketplaceServices, type MarketplaceCategory } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { qk } from '@/lib/query-keys';
import { useDemoData } from '@/contexts/DemoDataContext';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceProvider = {
  id: string;
  providerName: string;
  providerAvatar?: string;
  providerTitle: string;
  title: string;
  description: string;
  category: string;
  specialties: string[];
  pricing: string;
  pricingTier: 'free' | 'paid' | 'custom';
  avgRating: number;
  reviewCount: number;
  clientCount: number;
  responseTime: string;
  location: string;
  isVerified: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  websiteUrl?: string;
  contactUrl?: string;
};

// ── Category Config ────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { label: string; labelEl: string; icon: React.ElementType; color: string }> = {
  All: { label: 'All Services', labelEl: 'Όλες οι υπηρεσίες', icon: Store, color: 'text-foreground' },
  legal: { label: 'Legal', labelEl: 'Νομικά', icon: Scale, color: 'text-status-info' },
  finance: { label: 'Finance', labelEl: 'Οικονομικά', icon: Calculator, color: 'text-status-success' },
  marketing: { label: 'Marketing', labelEl: 'Μάρκετινγκ', icon: Megaphone, color: 'text-status-warning' },
  development: { label: 'Development', labelEl: 'Ανάπτυξη λογισμικού', icon: Code2, color: 'text-status-accent' },
  design: { label: 'Design', labelEl: 'Σχεδιασμός', icon: Brush, color: 'text-status-accent' },
  consulting: { label: 'Consulting', labelEl: 'Συμβουλευτική', icon: BrainCircuit, color: 'text-status-warning' },
  coaching: { label: 'Coaching', labelEl: 'Coaching', icon: GraduationCap, color: 'text-status-success' },
  other: { label: 'Other', labelEl: 'Άλλο', icon: Globe, color: 'text-muted-foreground' },
};

const CATEGORIES = Object.keys(CAT_CONFIG);

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: '1', providerName: 'Alexandra Kosta', providerTitle: 'Startup Legal Counsel',
    title: 'Startup Legal Package', description: 'Full legal coverage for early-stage startups: incorporation, term sheets, SAFE notes, IP protection, NDAs, and co-founder agreements.',
    category: 'legal', specialties: ['Incorporation', 'Term Sheets', 'IP', 'SAFE Notes'],
    pricing: 'From €500', pricingTier: 'paid', avgRating: 4.9, reviewCount: 47, clientCount: 82,
    responseTime: '< 24h', location: 'Athens, GR', isVerified: true, isFeatured: true, isAvailable: true,
  },
  {
    id: '2', providerName: 'Mark Thompson', providerTitle: 'CFO-as-a-Service',
    title: 'Financial Modeling & Fundraising Prep', description: 'Build investor-grade financial models, cap tables, and fundraising narratives. Former accelerator CFO advising early-stage teams.',
    category: 'finance', specialties: ['Financial Modeling', 'Cap Table', 'Pitch Financials', 'Due Diligence'],
    pricing: 'From €800/mo', pricingTier: 'paid', avgRating: 4.8, reviewCount: 34, clientCount: 61,
    responseTime: '< 48h', location: 'London, UK', isVerified: true, isFeatured: true, isAvailable: true,
  },
  {
    id: '3', providerName: 'Sofia Papadaki', providerTitle: 'Growth Marketing Strategist',
    title: 'GTM Strategy & Growth Hacking', description: 'Full-funnel growth strategy for B2B SaaS. SEO, paid acquisition, content, and lifecycle marketing. 3x average ARR growth for clients.',
    category: 'marketing', specialties: ['GTM Strategy', 'SEO', 'Paid Ads', 'B2B SaaS'],
    pricing: 'From €600/mo', pricingTier: 'paid', avgRating: 4.7, reviewCount: 28, clientCount: 40,
    responseTime: '< 12h', location: 'Remote', isVerified: true, isFeatured: false, isAvailable: true,
  },
  {
    id: '4', providerName: 'ByteCraft Studio', providerTitle: 'Full-Stack Development Agency',
    title: 'MVP Development & Technical Architecture', description: 'From zero to deployed MVP in 6-8 weeks. React/Next.js + Node.js. Technical co-founder level quality without the equity.',
    category: 'development', specialties: ['React', 'Node.js', 'MVP', 'Architecture'],
    pricing: 'From €5K', pricingTier: 'paid', avgRating: 4.6, reviewCount: 19, clientCount: 28,
    responseTime: '< 24h', location: 'Berlin, DE', isVerified: true, isFeatured: true, isAvailable: false,
  },
  {
    id: '5', providerName: 'Pavlos Georgiadis', providerTitle: 'Brand & UX Designer',
    title: 'Brand Identity & Product Design', description: 'End-to-end brand and product design. Logo, design system, UI/UX for web and mobile. Previously led design at 2 unicorns.',
    category: 'design', specialties: ['Brand Identity', 'UI/UX', 'Design Systems', 'Figma'],
    pricing: 'From €1.5K', pricingTier: 'paid', avgRating: 4.9, reviewCount: 63, clientCount: 90,
    responseTime: '< 6h', location: 'Thessaloniki, GR', isVerified: true, isFeatured: false, isAvailable: true,
  },
  {
    id: '6', providerName: 'Elena Vasilis', providerTitle: 'Startup Strategy Consultant',
    title: 'Business Model & Investor Readiness', description: 'Validate your business model, refine positioning, and prepare for investor conversations. Former VC turned founder advisor.',
    category: 'consulting', specialties: ['Business Model', 'Investor Readiness', 'Strategy', 'Positioning'],
    pricing: 'From €300/session', pricingTier: 'paid', avgRating: 4.8, reviewCount: 41, clientCount: 55,
    responseTime: '< 24h', location: 'Amsterdam, NL', isVerified: true, isFeatured: false, isAvailable: true,
  },
  {
    id: '7', providerName: 'James Obi', providerTitle: 'Founder & Executive Coach',
    title: 'Founder Coaching & Leadership Development', description: 'ICF-certified executive coach specializing in first-time founders. Clarity, resilience, team leadership, and high-performance habits.',
    category: 'coaching', specialties: ['Executive Coaching', 'Leadership', 'Mindset', 'Team Dynamics'],
    pricing: 'From €150/session', pricingTier: 'paid', avgRating: 5.0, reviewCount: 22, clientCount: 35,
    responseTime: '< 24h', location: 'Remote', isVerified: true, isFeatured: false, isAvailable: true,
  },
  {
    id: '8', providerName: 'Anna Christodoulou', providerTitle: 'Talent & Recruiting Partner',
    title: 'Technical & Startup Recruiting', description: 'Hire your first 10 engineers and product managers faster. Startup-native recruiting methodology with pre-vetted candidate pipeline.',
    category: 'other', specialties: ['Tech Recruiting', 'Talent Strategy', 'Sourcing', 'Interviews'],
    pricing: 'Custom', pricingTier: 'custom', avgRating: 4.7, reviewCount: 15, clientCount: 22,
    responseTime: '< 48h', location: 'Athens, GR', isVerified: false, isFeatured: false, isAvailable: true,
  },
];

// ── Provider Card ──────────────────────────────────────────────────────────────

/**
 * The price as it sits under its "Starting at · Από" label.
 *
 * Providers write their price as free text, and most write it the way the
 * label already reads — "From €500" — so the card said "Από / From €500":
 * the same word twice, once in each language. The leading "From" / "Starting
 * at" is dropped for display only (the stored text and what the assistant
 * reads are untouched), and the common units read in Greek under Greek.
 */
function priceForDisplay(raw: string, lang: 'en' | 'el'): string {
  const value = raw.replace(/^\s*(from|starting at)\s+/i, '');
  if (lang !== 'el') return value;
  return value
    .replace(/\/mo\b/i, '/μήνα')
    .replace(/\/month\b/i, '/μήνα')
    .replace(/\/session\b/i, '/συνεδρία')
    .replace(/\/(hour|hr)\b/i, '/ώρα');
}

function ProviderCard({ provider, featured }: { provider: ServiceProvider; featured?: boolean }) {
  const { primary } = useLanguagePreference();
  const [saved, setSaved] = useState(false);
  const catCfg = CAT_CONFIG[provider.category] ?? CAT_CONFIG['other'];
  const CatIcon = catCfg.icon;

  return (
    <Card className={cn(
      'group flex flex-col transition-all hover:border-primary/30',
      featured && 'border-primary/15 bg-primary/[0.03]',
      !provider.isAvailable && 'surface-inactive',
    )}>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="h-11 w-11 shrink-0 rounded-lg">
              <AvatarImage src={provider.providerAvatar} />
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary-accessible font-semibold">
                {provider.providerName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold leading-snug">{provider.providerName}</p>
                {provider.isVerified && <BadgeCheck className="icon-sm text-status-info shrink-0" />}
                {featured && <Badge className="text-2xs bg-primary/10 text-primary-accessible border-primary/20 border"><BilingualText en="Featured" el="Προτεινόμενο" compact /></Badge>}
              </div>
              {/* "Growth Marketing Strategist" is 170px against the 102px
                  this column gives it at 1024px — the trade an ellipsis makes
                  here is the whole specialism for one line. */}
              <p className="text-xs leading-snug text-muted-foreground">{provider.providerTitle}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="icon-sm fill-status-warning text-status-warning" />
                <span className="text-xs font-medium">{provider.avgRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({provider.reviewCount})</span>
              </div>
            </div>
          </div>
          {/* Their tap target and accessible name (this icon-only button had
              neither), kept with our icon-size and contrast-safe tokens. */}
          <button
            onClick={() => setSaved(!saved)}
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-md hover:bg-muted transition-colors sm:w-auto sm:px-3"
            aria-label={saved ? 'Remove bookmark' : 'Save provider'}
          >
            <Bookmark className={cn('icon-sm', saved ? 'fill-primary text-primary-accessible' : 'text-muted-foreground')} />
            <span className="hidden sm:inline text-sm"><BilingualText en={saved ? 'Saved' : 'Save'} el={saved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact /></span>
          </button>
        </div>

        {/* Service */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <CatIcon className={cn('icon-sm shrink-0', catCfg.color)} />
            <h3 className="font-semibold text-sm">{provider.title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{provider.description}</p>
        </div>

        {/* Specialties */}
        <FactLine items={[...provider.specialties.slice(0, 3), provider.specialties.length > 3 ? `+${provider.specialties.length - 3}` : null]} />

        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><Clock className="icon-sm" />{provider.responseTime}</div>
          <div className="flex items-center gap-1"><Users className="icon-sm" aria-hidden="true" /><BilingualText en={`${provider.clientCount} clients`} el={`${provider.clientCount} πελάτες`} compact /></div>
          <div className="flex items-center gap-1"><MapPin className="icon-sm" />{provider.location}</div>
          <div className="flex items-center gap-1">
            <div className={cn('h-1.5 w-1.5 rounded-full', provider.isAvailable ? 'bg-status-success-mark' : 'bg-muted')} />
            {provider.isAvailable
              ? <BilingualText en="Available" el="Διαθέσιμος" compact />
              : <BilingualText en="Fully booked" el="Πλήρης" compact />}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 border-t border-border">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground"><BilingualText en="Starting at" el="Από" compact /></p>
            <p className="truncate font-semibold text-sm">{priceForDisplay(provider.pricing, primary)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {/* Neither had a handler. A listing carries its provider's own
                contact and website links, so those are what these open. */}
            {provider.contactUrl ? (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                <a href={provider.contactUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="icon-sm" aria-hidden="true" /><BilingualText en="Message" el="Μήνυμα" compact />
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled title={bilingualInline('This provider has not listed a contact link', 'Ο πάροχος δεν έχει δηλώσει σύνδεσμο επικοινωνίας')}>
                <MessageCircle className="icon-sm" aria-hidden="true" /><BilingualText en="Message" el="Μήνυμα" compact />
              </Button>
            )}
            {provider.isAvailable && (provider.websiteUrl || provider.contactUrl) ? (
              <Button size="sm" className="h-8 text-xs" asChild>
                <a href={provider.websiteUrl ?? provider.contactUrl} target="_blank" rel="noopener noreferrer"><BilingualText en="Request" el="Αίτημα" compact /></a>
              </Button>
            ) : (
              <Button size="sm" className="h-8 text-xs" disabled title={provider.isAvailable
                ? bilingualInline('This provider has not listed a request link', 'Ο πάροχος δεν έχει δηλώσει σύνδεσμο αιτήματος')
                : bilingualInline('Not taking new clients', 'Δεν δέχεται νέους πελάτες')}>
                <BilingualText en="Request" el="Αίτημα" compact />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────────

// Counted from the listings on screen. The figures here were constants
// ("120+ verified providers", "500+ startups served") that no data supported.
function marketplaceStats(providers: ServiceProvider[]) {
  const rated = providers.filter((p) => p.reviewCount > 0);
  const avg = rated.length
    ? (rated.reduce((acc, p) => acc + p.avgRating * p.reviewCount, 0) / rated.reduce((acc, p) => acc + p.reviewCount, 0)).toFixed(1)
    : null;
  return [
    { label: 'Listings', labelEl: 'Καταχωρίσεις', value: String(providers.length), icon: Store },
    { label: 'Verified providers', labelEl: 'Επαληθευμένοι πάροχοι', value: String(providers.filter((p) => p.isVerified).length), icon: ShieldCheck },
    { label: 'Average rating', labelEl: 'Μέση βαθμολογία', value: avg ? `${avg} / 5` : '—', icon: Star },
    { label: 'Taking new clients', labelEl: 'Δέχονται νέους πελάτες', value: String(providers.filter((p) => p.isAvailable).length), icon: Zap },
  ];
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  // Illustrative rows are for the showcase; a real account with nothing
  // to list sees the page's empty state, not invented people and records.
  const { showDemoData } = useDemoData();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  // ?q= seeds the search - a provider's "Preview" lands on their listing.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);
  const [sortBy, setSortBy] = useState('rating');
  const [availableOnly, setAvailableOnly] = useState(false);

  const { data: apiData, isLoading } = useQuery({
    queryKey: qk('marketplace', selectedCategory !== 'All' ? selectedCategory : undefined, search || undefined),
    queryFn: () => listMarketplaceServices({
      category: selectedCategory !== 'All' ? selectedCategory.toLowerCase() as MarketplaceCategory : undefined,
      search: search.trim() || undefined,
      limit: 50,
    }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const backendProviders: ServiceProvider[] = (apiData?.services ?? []).map((s) => ({
    id: s.id,
    providerName: s.providerName,
    providerTitle: s.category,
    title: s.title,
    description: s.description ?? '',
    category: s.category,
    specialties: s.tags ?? [],
    pricing: s.pricing ?? 'Contact',
    pricingTier: 'paid' as const,
    avgRating: 0,
    reviewCount: 0,
    clientCount: 0,
    responseTime: 'Contact',
    location: 'Remote',
    isVerified: false,
    isFeatured: s.isFeatured,
    isAvailable: true,
    websiteUrl: s.websiteUrl ?? undefined,
    contactUrl: s.contactUrl ?? undefined,
  }));

  const allProviders = backendProviders.length > 0 ? backendProviders : showDemoData ? MOCK_PROVIDERS : [];

  const filtered = allProviders
    .filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = !search || p.title.toLowerCase().includes(q) || p.providerName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.specialties.some(s => s.toLowerCase().includes(q));
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesAvail = !availableOnly || p.isAvailable;
      return matchesSearch && matchesCat && matchesAvail;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.avgRating - a.avgRating;
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
      if (sortBy === 'clients') return b.clientCount - a.clientCount;
      return 0;
    });

  const featured = filtered.filter(p => p.isFeatured);
  const regular = filtered.filter(p => !p.isFeatured);

  usePageList([
    {
      id: 'services',
      labelEn: 'Services',
      labelEl: 'Υπηρεσίες',
      rows: isLoading ? undefined : filtered.map((p) =>
        `${p.title} · by ${p.providerName} · ${p.category} · ${p.pricing}${p.reviewCount ? ` · ${p.avgRating.toFixed(1)}★ (${p.reviewCount})` : ''}${p.isAvailable ? '' : ' · unavailable'}`,
      ),
      total: allProviders.length,
      sample: backendProviders.length === 0,
    },
  ]);
  // Offered to the assistant: category, sort and the available-only switch,
  // through the same setters the rail and chips use.
  const CATEGORY_EL: Record<string, string> = {
    All: 'Όλες οι υπηρεσίες', legal: 'Νομικά', finance: 'Οικονομικά', marketing: 'Μάρκετινγκ', development: 'Ανάπτυξη',
    design: 'Σχεδιασμός', consulting: 'Συμβουλευτική', coaching: 'Coaching', other: 'Άλλο',
  };
  usePageControls([
    choiceControl('category', 'Service category', 'Κατηγορία υπηρεσίας', CATEGORIES.map((c) => ({ value: c, en: CAT_CONFIG[c].label, el: CATEGORY_EL[c] ?? CAT_CONFIG[c].label })), selectedCategory, setSelectedCategory),
    choiceControl('sort', 'Sort services', 'Ταξινόμηση υπηρεσιών', [
      { value: 'rating', en: 'Top rated', el: 'Κορυφαία βαθμολογία' },
      { value: 'reviews', en: 'Most reviewed', el: 'Περισσότερες κριτικές' },
      { value: 'clients', en: 'Most clients', el: 'Περισσότεροι πελάτες' },
    ], sortBy, setSortBy),
    choiceControl('availability', 'Availability', 'Διαθεσιμότητα', [
      { value: 'any', en: 'Any availability', el: 'Οποιαδήποτε διαθεσιμότητα' },
      { value: 'available', en: 'Available now only', el: 'Μόνο διαθέσιμοι τώρα' },
    ], availableOnly ? 'available' : 'any', (v) => setAvailableOnly(v === 'available')),
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'stats',
      glyph: 'chart',
      labelEn: 'Marketplace stats',
      labelEl: 'Στατιστικά αγοράς',
      content: (
        <div className="space-y-2">
          {marketplaceStats(allProviders).map(s => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-lg border border-border p-3">
              <s.icon className="h-4 w-4 shrink-0 text-primary-accessible" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{s.value}</p>
                <p className="text-2xs text-muted-foreground"><BilingualText en={s.label} el={s.labelEl} compact wrap /></p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Sort & filters',
      labelEl: 'Ταξινόμηση & φίλτρα',
      badge: availableOnly ? 1 : null,
      content: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground"><BilingualText en="Sort by" el="Ταξινόμηση" compact /></p>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort by" className="w-full">
                <ArrowUpDown className="mr-2 icon-sm text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating"><BilingualText en="Highest Rated" el="Υψηλότερη βαθμολογία" compact /></SelectItem>
                <SelectItem value="reviews"><BilingualText en="Most Reviewed" el="Περισσότερες κριτικές" compact /></SelectItem>
                <SelectItem value="clients"><BilingualText en="Most Clients" el="Περισσότεροι πελάτες" compact /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setAvailableOnly(!availableOnly)}
            aria-pressed={availableOnly}
            className={cn(
              'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
              availableOnly ? 'bg-primary/10 text-primary-accessible' : 'hover:bg-muted/70',
            )}
          >
            <CheckCircle className="icon-sm shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en="Available providers only" el="Μόνο διαθέσιμοι πάροχοι" compact /></span>
          </button>
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
          <RailAction icon={Briefcase} en="Open jobs" el="Άνοιγμα θέσεων" onClick={() => router.push('/jobs')} />
          <RailAction icon={Handshake} en="Open opportunities" el="Άνοιγμα ευκαιριών" onClick={() => router.push('/opportunities')} />
          <RailAction icon={GraduationCap} en="Open programs" el="Άνοιγμα προγραμμάτων" onClick={() => router.push('/programs')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell showHelp rail={rail}>
      <div className="space-y-6 pb-10">
        {backendProviders.length === 0 && (
          <SampleDataNotice
            surface="Marketplace"
            detail="Live provider listings are not the source of truth yet. These cards are sample experts so you can browse the layout."
            askAiPrompt="The marketplace is showing sample providers. How should I evaluate legal, finance, and coaching help for an early-stage startup?"
          />
        )}
        {/* Banner CTA for providers */}
        <Card className="border-primary/15 bg-primary/[0.03]">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold"><BilingualText en="Are you a service provider?" el="Είστε πάροχος υπηρεσιών;" compact wrap /></p>
              <p className="text-sm text-muted-foreground"><BilingualText en="List your services where founders on CoFounderBay look for help" el="Καταχωρίστε τις υπηρεσίες σας εκεί όπου οι ιδρυτές του CoFounderBay αναζητούν βοήθεια" wrap /></p>
            </div>
            {/* Theirs turns a dead button into a real link to /provider/services;
                our icon-size token is kept. */}
            <Button size="sm" className="shrink-0" asChild>
              <Link href="/provider/services">
                <Plus className="mr-1.5 icon-sm" /><BilingualText en="List Your Service" el="Καταχώριση υπηρεσίας" compact />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Search — sort and the availability filter live in the rail */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={bilingualInline("Search services, providers, specialties…", "Αναζήτηση υπηρεσιών, παρόχων, ειδικοτήτων…")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search services, providers, specialties. Αναζήτηση υπηρεσιών, παρόχων, ειδικοτήτων"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat];
              const CatIcon = cfg.icon;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1.5 text-xs data-[state=active]:bg-background">
                  <CatIcon className={cn('icon-sm', cfg.color)} aria-hidden="true" />
                  <BilingualText en={cfg.label} el={cfg.labelEl} compact />
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-6 mt-4">
            {isLoading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}><CardContent className="space-y-3">
                    <div className="flex gap-3"><Skeleton className="h-11 w-11 rounded-lg" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div>
                    <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" />
                  </CardContent></Card>
                ))}
              </div>
            )}

            {!isLoading && (
              <>
                {featured.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="icon-sm text-muted-foreground" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"><BilingualText en="Featured Providers" el="Προτεινόμενοι πάροχοι" compact /></h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {featured.map(p => <ProviderCard key={p.id} provider={p} featured />)}
                    </div>
                  </div>
                )}

                {regular.length > 0 && (
                  <div className="space-y-3">
                    {featured.length > 0 && (
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"><BilingualText en="All Providers" el="Όλοι οι πάροχοι" compact /></h2>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {regular.map(p => <ProviderCard key={p.id} provider={p} />)}
                    </div>
                  </div>
                )}

                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="h-12 w-12 mb-4 text-muted-foreground/30" aria-hidden="true" />
                    <p className="font-medium"><BilingualText en="No services found" el="Δεν βρέθηκαν υπηρεσίες" compact /></p>
                    <p className="text-sm text-muted-foreground mt-1"><BilingualText en="Try adjusting your search or filters" el="Δοκιμάστε άλλη αναζήτηση ή φίλτρα" wrap /></p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
