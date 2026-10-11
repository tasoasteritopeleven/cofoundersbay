'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  Mail,
  ExternalLink,
  Eye,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Globe,
  Lightbulb,
  BarChart2,
  CheckCircle2,
  ArrowRight,
  Twitter,
  Linkedin,
  Link2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardHead } from '@/components/common/CardAnatomy';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn, initialsOf } from '@/lib/utils';
import { getPublicPitchDeck, recordPitchView, submitPitchContactRequest, type PublicPitchDeck } from '@/lib/api';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { PageContextualHelp } from '@/components/common/PageContextualHelp';
import { MainLandmark } from '@/components/layout/AppShell';
import { bilingualInline } from '@/lib/i18n/format';
import { pitchPost, useSuggestedPost } from '@/lib/share-text';

// ─── Demo data (used when API returns no result or in dev) ────────────────────
const DEMO_DECK: PublicPitchDeck = {
  id: 'demo',
  title: 'TechStart - Series A Pitch',
  companyName: 'TechStart',
  tagline: 'AI-powered co-founder matching for the next generation of founders',
  slides: [
    {
      id: 's1',
      type: 'cover',
      title: 'TechStart',
      order: 0,
      content: {
        tagline: 'AI-powered co-founder matching for the next generation of founders',
        founded: '2024',
        stage: 'Series A',
        raising: '$5M',
      },
    },
    {
      id: 's2',
      type: 'problem',
      title: 'The Problem',
      order: 1,
      content: {
        headline: '90% of startups fail due to team problems',
        points: [
          'Finding the right co-founder takes 6–18 months on average',
          'Existing networks are limited by geography and social circles',
          'No data-driven way to evaluate co-founder compatibility',
        ],
        stat: '$2.3T',
        statLabel: 'lost to failed startups annually',
      },
    },
    {
      id: 's3',
      type: 'solution',
      title: 'Our Solution',
      order: 2,
      content: {
        headline: 'Intelligent matching meets proven methodology',
        points: [
          'AI-powered compatibility scoring across 40+ dimensions',
          'Verified profiles with skill assessments and references',
          'Structured intro process with conversation guides',
        ],
      },
    },
    {
      id: 's4',
      type: 'traction',
      title: 'Traction',
      order: 3,
      content: {
        metrics: [
          { label: 'Registered Users', value: '12,400', growth: '+240%' },
          { label: 'Successful Matches', value: '1,850', growth: '+180%' },
          { label: 'Active Startups', value: '640', growth: '+160%' },
          { label: 'Monthly Revenue', value: '$48K', growth: '+95%' },
        ],
      },
    },
    {
      id: 's5',
      type: 'market',
      title: 'Market Opportunity',
      order: 4,
      content: {
        tam: '$12B',
        sam: '$3.2B',
        som: '$480M',
        tamLabel: 'Total Addressable Market',
        samLabel: 'Serviceable Market',
        somLabel: 'Obtainable Market (5yr)',
      },
    },
    {
      id: 's6',
      type: 'business_model',
      title: 'Business Model',
      order: 5,
      content: {
        streams: [
          { name: 'Premium Subscriptions', percent: 60, amount: '$29–$99/mo' },
          { name: 'Accelerator Partnerships', percent: 25, amount: 'Revenue share' },
          { name: 'Enterprise Licenses', percent: 15, amount: '$5K–$50K/yr' },
        ],
      },
    },
    {
      id: 's7',
      type: 'team',
      title: 'The Team',
      order: 6,
      content: {
        members: [
          { name: 'Elena Papadopoulos', role: 'CEO & Co-founder', background: 'Former product lead, 2x founder' },
          { name: 'Marcus Chen', role: 'CTO & Co-founder', background: 'Ex-Meta, MIT CS' },
          { name: 'Dr. Sarah Kim', role: 'Head of AI', background: 'PhD Stanford, Ex-DeepMind' },
        ],
      },
    },
    {
      id: 's8',
      type: 'ask',
      title: 'The Ask',
      order: 7,
      content: {
        amount: '$5M',
        valuation: '$20M pre-money',
        use: [
          { label: 'Product & Engineering', percent: 45 },
          { label: 'Sales & Marketing', percent: 30 },
          { label: 'Operations', percent: 15 },
          { label: 'Legal & Admin', percent: 10 },
        ],
      },
    },
  ],
  author: {
    id: 'author1',
    name: 'Elena Papadopoulos',
    headline: 'CEO & Co-founder at TechStart',
    avatarUrl: undefined,
  },
  stats: { views: 284, shares: 47, contactRequests: 12 },
  isPublic: true,
  allowContact: true,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-25T14:00:00Z',
};


// ─── Slide content shapes ─────────────────────────────────────────────────────
/**
 * A deck slide's `content` is a JSON blob whose shape depends on `slide.type`.
 * Each renderer used to reach into it through `slide.content as any`, so a
 * renamed field surfaced as a blank slide rather than a build error. These
 * types name the fields each renderer actually reads.
 */
type SlideBase = (typeof DEMO_DECK.slides)[number];

type CoverContent = { tagline: string; founded: string; stage: string; raising: string };
type PointsContent = { headline: string; points: string[]; stat?: string; statLabel?: string };
type TractionContent = { metrics: { value: string; label: string; growth: string }[] };
type MarketContent = {
  tam: string; tamLabel: string;
  sam: string; samLabel: string;
  som: string; somLabel: string;
};
type BusinessModelContent = {
  headline?: string;
  streams: { name: string; percent: number; amount: string }[];
};
type TeamContent = { members: { name: string; role: string; background: string }[] };
type AskContent = {
  amount: string;
  valuation: string;
  use: { label: string; percent: number }[];
};

/** Narrows a slide's `content` to the shape its renderer expects. */
function contentOf<T>(slide: SlideBase): T {
  return slide.content as T;
}

// ─── Slide renderers ──────────────────────────────────────────────────────────
function CoverSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<CoverContent>(slide);
  return (
    // Left-aligned like every card: the round, the name, the line under it.
    <div className="flex flex-col items-start justify-center h-full px-8 py-12 bg-primary/[0.04]">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary-accessible font-medium">
        <BilingualText en={`${c.stage} · Raising ${c.raising}`} el={`${c.stage} · Αντλεί ${c.raising}`} compact />
      </div>
      {/* 48px fixed left roughly six characters per line on a 320px screen. */}
      <h1 className="text-3xl font-semibold text-foreground mb-4 sm:text-4xl lg:text-5xl">{slide.title}</h1>
      <p className="text-lg text-muted-foreground max-w-2xl">{c.tagline}</p>
      <p className="text-sm text-muted-foreground mt-8"><BilingualText en={`Founded ${c.founded}`} el={`Ιδρύθηκε ${c.founded}`} compact /></p>
    </div>
  );
}

function ProblemSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<PointsContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-status-danger-bg ">
          <Target className="icon-lg text-status-danger" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <p className="text-2xl font-semibold text-foreground mb-8">{c.headline}</p>
      <div className="space-y-4 mb-10">
        {c.points.map((point, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-status-danger-bg flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-status-danger">{i + 1}</span>
            </div>
            <p className="text-lg text-muted-foreground">{point}</p>
          </div>
        ))}
      </div>
      {c.stat && (
        <div className="rounded-2xl bg-status-danger-bg border border-status-danger-border p-6 inline-block">
          <p className="text-4xl font-bold text-status-danger">{c.stat}</p>
          <p className="text-muted-foreground mt-1">{c.statLabel}</p>
        </div>
      )}
    </div>
  );
}

function SolutionSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<PointsContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-status-success-bg ">
          <Lightbulb className="icon-lg text-status-success" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <p className="text-2xl font-semibold text-foreground mb-8">{c.headline}</p>
      <div className="space-y-4">
        {(c.points as string[]).map((point, i) => (
          <div key={i} className="flex items-start gap-3">
            <CheckCircle2 className="icon-md text-status-success mt-0.5 flex-shrink-0" />
            <p className="text-lg text-muted-foreground">{point}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TractionSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<TractionContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-status-info-bg ">
          <TrendingUp className="icon-lg text-status-info" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {c.metrics.map((m, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6">
            <p className="text-4xl font-bold text-foreground">{m.value}</p>
            <p className="text-muted-foreground mt-1">{m.label}</p>
            <Badge className="mt-3 bg-status-success-bg text-status-success border-status-success-border">{m.growth} YoY</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<MarketContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-status-accent-bg ">
          <Globe className="icon-lg text-status-accent" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <div className="flex items-end gap-6 justify-center">
        {[
          { val: c.tam, label: c.tamLabel, size: 'h-48', color: 'bg-status-accent-bg dark:bg-status-accent-mark' },
          { val: c.sam, label: c.samLabel, size: 'h-36', color: 'bg-status-accent-mark dark:bg-status-accent-mark' },
          { val: c.som, label: c.somLabel, size: 'h-24', color: 'bg-status-accent-mark dark:bg-status-accent-mark' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <p className="text-3xl font-bold">{item.val}</p>
            <div className={cn('w-full rounded-t-2xl flex items-end justify-center pb-4', item.size, item.color)}>
            </div>
            <p className="text-sm text-muted-foreground text-center">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessModelSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<BusinessModelContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-status-warning-bg ">
          <DollarSign className="icon-lg text-status-warning" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <div className="space-y-5">
        {c.streams.map((stream, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{stream.name}</span>
              <span className="text-muted-foreground text-sm">{stream.amount}</span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={stream.percent} className="flex-1 h-3" />
              <span className="text-sm font-semibold w-10 text-right">{stream.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<TeamContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-status-success-bg ">
          <Users className="icon-lg text-status-success" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {c.members.map((member, i) => (
          <div key={i} data-card="" className="rounded-2xl border bg-card p-4">
            <Avatar className="mb-3 h-10 w-10">
              <AvatarFallback className="text-sm">
                {initialsOf(member.name)}
              </AvatarFallback>
            </Avatar>
            <p className="card-title">{member.name}</p>
            <p className="card-subtitle mt-0.5 text-primary-accessible">{member.role}</p>
            <p className="text-xs text-muted-foreground mt-2">{member.background}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AskSlide({ slide }: { slide: SlideBase }) {
  const c = contentOf<AskContent>(slide);
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-status-accent-bg ">
          <BarChart2 className="icon-lg text-status-accent" />
        </div>
        <h2 className="text-3xl font-semibold">{slide.title}</h2>
      </div>
      <div className="flex items-center gap-8 mb-8">
        <div>
          <p className="text-5xl font-bold text-primary-accessible">{c.amount}</p>
          <p className="text-muted-foreground mt-1"><BilingualText en="Raising" el="Αναζητά" compact /></p>
        </div>
        <ArrowRight className="icon-xl text-muted-foreground" />
        <div>
          <p className="text-2xl font-semibold">{c.valuation}</p>
          <p className="text-muted-foreground mt-1"><BilingualText en="Pre-money valuation" el="Αποτίμηση pre-money" compact /></p>
        </div>
      </div>
      <p className="text-lg font-medium mb-4"><BilingualText en="Use of Funds" el="Χρήση κεφαλαίων" compact /></p>
      <div className="space-y-3">
        {c.use.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span>{item.label}</span>
              <span className="font-medium">{item.percent}%</span>
            </div>
            <Progress value={item.percent} className="h-2" />
          </div>
        ))}
      </div>
      <NonGuaranteeNote className="mt-6" />
    </div>
  );
}

/** Money, equity or percentages in free text: the slide carries the non-guarantee note. */
const MONEY_WORDS = /[€$£%]|\b(?:raise|raising|funding|equity|valuation|investment|revenue)\b|χρηματοδότ|μετοχ|αποτίμησ|επένδυσ|έσοδ/i;

/**
 * A builder slide published as written: free text, its line breaks kept and
 * leading bullets read as a list. The richer renderers above need structured
 * fields the builder does not collect, so the server only uses them where the
 * text fits honestly.
 */
function TextSlide({ slide }: { slide: SlideBase }) {
  const body = typeof (slide.content as { body?: unknown }).body === 'string' ? ((slide.content as { body: string }).body) : '';
  const rows = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = rows.filter((line) => /^(?:[-*•·]|\d+[.)])\s+/.test(line));
  return (
    <div className="flex h-full flex-col justify-center px-6 py-8 sm:px-12">
      <h2 className="mb-6 text-2xl font-semibold sm:text-3xl">{slide.title}</h2>
      {bullets.length === rows.length && rows.length > 1 ? (
        <ul className="space-y-3">
          {rows.map((line, i) => (
            <li key={i} className="flex gap-3 text-lg text-foreground">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>{line.replace(/^(?:[-*•·]|\d+[.)])\s+/, '')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {rows.map((line, i) => (
            <p key={i} className="text-lg leading-relaxed text-foreground">{line}</p>
          ))}
        </div>
      )}
      {MONEY_WORDS.test(body) ? <NonGuaranteeNote className="mt-6" /> : null}
    </div>
  );
}

function GenericSlide({ slide }: { slide: SlideBase }) {
  return (
    <div className="flex flex-col justify-center h-full px-12 py-8">
      <h2 className="text-3xl font-semibold mb-6">{slide.title}</h2>
      <pre className="text-muted-foreground text-sm whitespace-pre-wrap">
        {JSON.stringify(slide.content, null, 2)}
      </pre>
    </div>
  );
}

function SlideRenderer({ slide }: { slide: SlideBase }) {
  switch (slide.type) {
    case 'cover': return <CoverSlide slide={slide} />;
    case 'problem': return <ProblemSlide slide={slide} />;
    case 'solution': return <SolutionSlide slide={slide} />;
    case 'traction': return <TractionSlide slide={slide} />;
    case 'market': return <MarketSlide slide={slide} />;
    case 'business_model': return <BusinessModelSlide slide={slide} />;
    case 'team': return <TeamSlide slide={slide} />;
    case 'ask': return <AskSlide slide={slide} />;
    case 'text': return <TextSlide slide={slide} />;
    default: return <GenericSlide slide={slide} />;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PitchDeckPage() {
  const params = useParams();
  const deckId = params?.id as string;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [copied, setCopied] = useState(false);
  const suggested = useSuggestedPost();
  // The share links quote this page's URL. Read during render it was ''
  // on the server and the real URL in the browser — a hydration mismatch on
  // every visit. Stamped after mount instead.
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => setPageUrl(window.location.href), []);

  // Fetch deck (falls back to demo if API unavailable)
  // A published deck from the API; the preview demo answers without one and
  // shows the sample. A deck that is not public (never published, or
  // withdrawn) is a 404, and the page says so instead of showing the sample.
  const { data, isError, isLoading } = useQuery({
    queryKey: qk('pitch-deck', deckId),
    queryFn: () => getPublicPitchDeck(deckId),
    retry: false,
  });

  const deck: PublicPitchDeck | null = data?.deck ?? (isError || isLoading ? null : DEMO_DECK);
  const slides = deck ? [...deck.slides].sort((a, b) => a.order - b.order) : [];

  // Record one view, once the deck is known to exist.
  const viewMutation = useMutation({ mutationFn: () => recordPitchView(deckId) });
  const viewed = data?.deck?.id;
  useEffect(() => { if (viewed) viewMutation.mutate(); }, [viewed]); // eslint-disable-line react-hooks/exhaustive-deps

  const contactMutation = useMutation({
    mutationFn: (data: { name: string; email: string; message?: string }) =>
      submitPitchContactRequest(deckId, data),
    onSuccess: () => setShowContact(false),
  });

  // Keyboard navigation
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      setCurrentSlide((s) => Math.min(s + 1, slides.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      setCurrentSlide((s) => Math.max(s - 1, 0));
    }
  }, [slides.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!deck) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <MainLandmark className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          {isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              <BilingualText en="Opening the pitch…" el="Άνοιγμα της παρουσίασης…" compact />
            </p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">
                <BilingualText en="This pitch is not public" el="Αυτή η παρουσίαση δεν είναι δημόσια" wrap />
              </h1>
              <p className="text-sm text-muted-foreground">
                <BilingualText
                  en="Its founder has not published it, or has withdrawn it. Ask them for a new link."
                  el="Ο ιδρυτής δεν τη δημοσίευσε ή την απέσυρε. Ζητήστε του νέο σύνδεσμο."
                  wrap
                />
              </p>
              <Button asChild variant="outline">
                <Link href="/"><BilingualText en="Go to CoFounderBay" el="Μετάβαση στο CoFounderBay" compact /></Link>
              </Button>
            </>
          )}
        </MainLandmark>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        {/* At 390px the bar ran 28px past the screen: name, deck badge and
            three labelled buttons in one unshrinkable row. The identity now
            yields (truncates), the deck badge waits for `sm`, and Share keeps
            only its icon on a phone. */}
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {deck.logoUrl ? (
              <img src={deck.logoUrl} alt={deck.companyName} className="h-7 w-auto" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-7 w-7 shrink-0 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {deck.companyName[0]}
              </div>
            )}
            <span className="truncate font-semibold">{deck.companyName}</span>
            <Badge variant="outline" className="hidden max-w-[16rem] truncate text-xs sm:inline-flex">{deck.title}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-2">
              <span className="flex items-center gap-1"><Eye className="icon-sm" />{deck.stats.views}</span>
              <span className="flex items-center gap-1"><Share2 className="icon-sm" />{deck.stats.shares}</span>
            </div>
            {/* No AppShell on the public deck, so the page-registry help mounts here. */}
            <PageContextualHelp compact />
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} aria-label={bilingualAria('Share', 'Κοινοποίηση')}>
              <Share2 className="icon-sm sm:mr-1.5" aria-hidden="true" /><span className="hidden sm:inline"><BilingualText en="Share" el="Κοινοποίηση" compact /></span>
            </Button>
            {deck.allowContact && (
              <Button size="sm" onClick={() => setShowContact(true)}>
                <Mail className="icon-sm mr-1.5" /><BilingualText en="Contact" el="Επικοινωνία" compact />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col xl:flex-row max-w-7xl mx-auto w-full px-4 py-6 gap-6">
        <div className="flex gap-2 overflow-x-auto pb-2 xl:hidden -mx-1 px-1">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                'min-w-[8.5rem] rounded-lg border p-2 text-left text-xs transition-all',
                i === currentSlide
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card',
              )}
            >
              <div className="text-2xs text-muted-foreground mb-0.5">{i + 1}/{slides.length}</div>
              <div className="font-medium truncate">{slide.title}</div>
            </button>
          ))}
        </div>

        {/* Slide thumbnails sidebar */}
        <aside className="hidden xl:flex flex-col gap-2 w-36 flex-shrink-0">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                'rounded-lg border text-left p-2 text-xs transition-all hover:border-primary',
                i === currentSlide
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card'
              )}
            >
              <div className="text-2xs text-muted-foreground mb-0.5">{i + 1}/{slides.length}</div>
              <div className="font-medium truncate">{slide.title}</div>
            </button>
          ))}
        </aside>

        {/* Main slide area */}
        <MainLandmark className="flex-1 flex flex-col">
          <div className="rounded-2xl border bg-card shadow-lg flex-1 min-h-[360px] sm:min-h-[520px] relative overflow-hidden">
            <SlideRenderer slide={slides[currentSlide]} />
          </div>

          {/* Navigation controls */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="icon-sm mr-1" /><BilingualText en="Previous" el="Προηγούμενη" compact />
            </Button>

            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Slide ${i + 1} of ${slides.length}`}
                  aria-current={i === currentSlide ? 'step' : undefined}
                  className={cn(
                    'rounded-full transition-all',
                    i === currentSlide
                      ? 'bg-primary w-6 h-2'
                      : 'bg-muted hover:bg-muted-foreground/30 w-2 h-2'
                  )}
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentSlide((s) => Math.min(s + 1, slides.length - 1))}
              disabled={currentSlide === slides.length - 1}
            >
              <BilingualText en="Next" el="Επόμενη" compact /><ChevronRight className="icon-sm ml-1" />
            </Button>
          </div>

          {/* Slide counter */}
          <p className="text-center text-sm text-muted-foreground mt-2">
            {currentSlide + 1} / {slides.length}
          </p>
        </MainLandmark>

        {/* Author sidebar */}
        <aside className="flex w-full flex-shrink-0 flex-col gap-4 xl:w-72">
          {/* The author, the deck's figures and the share links: cards on
              the Endorsements anatomy (mark, name, headline; then the rows
              on the mark's edge). */}
          <Card>
            <CardContent className="space-y-3">
              <CardHead
                mark={(
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={deck.author.avatarUrl} alt="" />
                    <AvatarFallback>
                      {initialsOf(deck.author.name)}
                    </AvatarFallback>
                  </Avatar>
                )}
                title={deck.author.name}
                subtitle={deck.author.headline}
              />
              {deck.allowContact && (
                <Button size="sm" className="w-full" onClick={() => setShowContact(true)}>
                  <Mail className="icon-sm mr-2" /><BilingualText en="Get in Touch" el="Επικοινωνήστε" compact />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Deck Stats" el="Στατιστικά deck" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground"><BilingualText en="Views" el="Προβολές" compact /></dt><dd className="font-medium tabular-nums">{deck.stats.views}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground"><BilingualText en="Shares" el="Κοινοποιήσεις" compact /></dt><dd className="font-medium tabular-nums">{deck.stats.shares}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground"><BilingualText en="Contacts" el="Επαφές" compact /></dt><dd className="font-medium tabular-nums">{deck.stats.contactRequests}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Share" el="Κοινοποίηση" compact /></CardTitle>
            </CardHeader>
            <CardContent>
            <div className="flex gap-2">
              <Button aria-label={bilingualAria('Share on X', 'Κοινοποίηση στο X')} variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(deck.title)}`} target="_blank" rel="noopener noreferrer">
                  <Twitter className="icon-sm" />
                </a>
              </Button>
              <Button aria-label={bilingualAria('Share on LinkedIn', 'Κοινοποίηση στο LinkedIn')} variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener noreferrer" onClick={() => suggested.copy(pitchPost(deck, pageUrl, suggested.lang))}>
                  <Linkedin className="icon-sm" />
                </a>
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyLink} aria-label={bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}>
                {copied ? <CheckCircle2 className="icon-sm text-status-success" /> : <Link2 className="icon-sm" />}
              </Button>
            </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Contact Dialog */}
      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><BilingualText en={`Contact ${deck.author.name}`} el={`Επικοινωνία με ${deck.author.name}`} wrap /></DialogTitle>
            <DialogDescription className="sr-only"><BilingualText en="Send a message to this deck's author." el="Στείλτε μήνυμα στον δημιουργό αυτού του deck." /></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cname"><BilingualText en="Your Name" el="Το όνομά σας" compact /></Label>
              <Input
                id="cname"
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cemail"><BilingualText en="Email Address" el="Διεύθυνση email" compact /></Label>
              <Input
                id="cemail"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@firm.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cmsg"><BilingualText en="Message (optional)" el="Μήνυμα (προαιρετικά)" compact /></Label>
              <Textarea
                id="cmsg"
                value={contactForm.message}
                onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={bilingualInline("Hi, I'd love to learn more about your company…", "Γεια σας, θα ήθελα να μάθω περισσότερα για την εταιρεία σας…")}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContact(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
            <Button
              onClick={() => contactMutation.mutate(contactForm)}
              disabled={!contactForm.name || !contactForm.email || contactMutation.isPending}
            >
              {contactMutation.isPending ? 'Sending…' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><BilingualText en="Share Pitch Deck" el="Κοινοποίηση pitch deck" compact /></DialogTitle>
            <DialogDescription className="sr-only"><BilingualText en="Copy or share the link to this pitch deck." el="Αντιγράψτε ή κοινοποιήστε τον σύνδεσμο αυτού του pitch deck." /></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="page-f1"><BilingualText en="Link" el="Σύνδεσμος" compact /></Label>
              <div className="flex gap-2 mt-1.5">
                <Input id="page-f1" value={pageUrl} readOnly />
                <Button
                  variant="outline"
                  onClick={copyLink}
                  aria-label={copied ? bilingualAria('Link copied', 'Ο σύνδεσμος αντιγράφηκε') : bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}
                >
                  {copied ? <CheckCircle2 className="icon-sm text-status-success" aria-hidden="true" /> : <Link2 className="icon-sm" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener noreferrer">
                  <Twitter className="icon-sm mr-2" />Twitter
                </a>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener noreferrer" onClick={() => suggested.copy(pitchPost(deck, pageUrl, suggested.lang))}>
                  <Linkedin className="icon-sm mr-2" />LinkedIn
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
