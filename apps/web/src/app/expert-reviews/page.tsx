'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  listExpertReviews,
  listExperts,
  type ExpertReviewItem,
  type ExpertDirectoryItem,
} from '@/lib/api';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  DollarSign,
  Eye,
  FileText,
  Lightbulb,
  MessageCircle,
  Palette,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Star,
  Target,
  TrendingUp,
  XCircle,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS, scoreTenPointClass, type StatusTone } from '@/lib/semantic-colors';
import Link from 'next/link';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { bilingualInline } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';

/** Why the one disabled control is disabled, in both languages. */
const MESSAGE_HINT = bilingualAria(
  'A conversation opens once expert reviews are live',
  'Η συνομιλία θα είναι διαθέσιμη όταν ενεργοποιηθούν οι αξιολογήσεις ειδικών',
);

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewStatus = 'requested' | 'accepted' | 'in_progress' | 'submitted' | 'declined' | 'expired';
type ReviewType =
  | 'pitch_deck' | 'business_model' | 'financial_model' | 'legal_structure'
  | 'market_analysis' | 'go_to_market' | 'technical_architecture' | 'product_strategy' | 'general';

interface ExpertReview {
  id: string;
  expertName: string;
  expertTitle: string;
  expertAvatar?: string;
  reviewType: ReviewType;
  status: ReviewStatus;
  requestMessage?: string;
  dueDate?: string;
  submittedAt?: string;
  scoreOverall?: number;
  summaryFeedback?: string;
  strengthsJson?: { area: string; comment: string }[];
  improvementsJson?: { area: string; recommendation: string }[];
  scoresByArea?: Record<string, number>;
  isPaid: boolean;
  agreedFee?: number;
  rating?: number;
}

interface ExpertProfile {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  domains: ReviewType[];
  completedReviews: number;
  /* Null until somebody has rated a review this expert delivered. Zero would
     read as a bad expert rather than a new one. */
  rating: number | null;
  bio: string;
  feeFrom?: number;
  currency?: string;
  /* Nothing records how fast an expert replies. */
  responseTime?: string;
  isVerified: boolean;
  badges?: string[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const REVIEW_TYPE_TONE: Record<ReviewType, StatusTone> = {
  pitch_deck: 'info',
  business_model: 'accent',
  financial_model: 'success',
  legal_structure: 'warning',
  market_analysis: 'info',
  go_to_market: 'warning',
  technical_architecture: 'accent',
  product_strategy: 'accent',
  general: 'neutral',
};

const REVIEW_TYPE_CONFIG: Record<ReviewType, { label: string; labelEl: string; icon: React.ElementType; tone: StatusTone }> = {
  pitch_deck:             { label: 'Pitch Deck',        labelEl: 'Pitch deck',                icon: FileText,    tone: 'info' },
  business_model:         { label: 'Business Model',    labelEl: 'Επιχειρηματικό μοντέλο',    icon: Target,      tone: 'accent' },
  financial_model:        { label: 'Financial Model',   labelEl: 'Οικονομικό μοντέλο',        icon: DollarSign,  tone: 'success' },
  legal_structure:        { label: 'Legal Structure',   labelEl: 'Νομική δομή',               icon: Scale,       tone: 'warning' },
  market_analysis:        { label: 'Market Analysis',   labelEl: 'Ανάλυση αγοράς',            icon: BarChart3,   tone: 'info' },
  go_to_market:           { label: 'Go-to-Market',      labelEl: 'Είσοδος στην αγορά',        icon: TrendingUp,  tone: 'warning' },
  technical_architecture: { label: 'Tech Architecture', labelEl: 'Τεχνική αρχιτεκτονική',     icon: Code2,       tone: 'accent' },
  product_strategy:       { label: 'Product Strategy',  labelEl: 'Στρατηγική προϊόντος',      icon: Lightbulb,   tone: 'accent' },
  general:                { label: 'General Review',    labelEl: 'Γενική αξιολόγηση',         icon: Eye,         tone: 'neutral' },
};

const REVIEW_STATUS_TONE: Record<ReviewStatus, StatusTone> = {
  requested: 'info',
  accepted: 'success',
  in_progress: 'warning',
  submitted: 'success',
  declined: 'danger',
  expired: 'neutral',
};

const STATUS_CONFIG: Record<ReviewStatus, { label: string; labelEl: string; tone: StatusTone; icon: React.ElementType }> = {
  requested:   { label: 'Requested', labelEl: 'Ζητήθηκε',   tone: 'info',    icon: Clock },
  accepted:    { label: 'Accepted', labelEl: 'Αποδεκτή',    tone: 'success', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', labelEl: 'Σε εξέλιξη', tone: 'warning', icon: RefreshCw },
  submitted:   { label: 'Submitted', labelEl: 'Υποβλήθηκε',   tone: 'success', icon: CheckCircle2 },
  declined:    { label: 'Declined', labelEl: 'Απορρίφθηκε',    tone: 'danger',  icon: XCircle },
  expired:     { label: 'Expired', labelEl: 'Έληξε',     tone: 'neutral', icon: AlertTriangle },
};

// ── Mock Data ─────────────────────────────────────────────────────────────────

const DEMO_REVIEWS: ExpertReview[] = [
  {
    id: '1',
    expertName: 'Stavros Nikolaou',
    expertTitle: 'Serial Founder & Pitch Coach',
    reviewType: 'pitch_deck',
    status: 'submitted',
    requestMessage: 'Looking for feedback on our Series A deck before approaching investors.',
    submittedAt: '2026-03-20T11:00:00Z',
    scoreOverall: 7,
    summaryFeedback: 'Strong team slide and clear market opportunity. The financial projections need more realistic assumptions and the problem slide should be sharper. The "ask" slide needs more specific use of funds.',
    strengthsJson: [
      { area: 'Team', comment: 'Clear credibility signals, strong domain expertise shown.' },
      { area: 'Market Size', comment: 'Well-researched TAM/SAM/SOM breakdown with credible sources.' },
    ],
    improvementsJson: [
      { area: 'Problem Statement', recommendation: 'Lead with a single, specific customer pain — avoid generic statements.' },
      { area: 'Financial Projections', recommendation: 'Add explicit assumption breakdown: CAC, LTV, churn rate, unit economics.' },
      { area: 'Use of Funds', recommendation: 'Break down the €500K ask into milestones, not just categories.' },
    ],
    scoresByArea: { storytelling: 8, market: 9, financials: 5, team: 9, design: 7, ask: 6 },
    isPaid: true,
    agreedFee: 200,
    rating: 5,
  },
  {
    id: '2',
    expertName: 'Katerina Vassiliou',
    expertTitle: 'CFO Advisor & Financial Modelling Expert',
    reviewType: 'financial_model',
    status: 'in_progress',
    requestMessage: 'Please review our 3-year financial model for our SaaS product.',
    dueDate: '2026-03-28T23:59:00Z',
    isPaid: true,
    agreedFee: 350,
  },
  {
    id: '3',
    expertName: 'Nikos Papadakis',
    expertTitle: 'GTM Strategist',
    reviewType: 'go_to_market',
    status: 'requested',
    requestMessage: 'We need feedback on our go-to-market strategy for EU market expansion.',
    isPaid: false,
  },
];

const DEMO_EXPERTS: ExpertProfile[] = [
  {
    id: 'e1',
    name: 'Stavros Nikolaou',
    title: 'Serial Founder & Pitch Coach',
    domains: ['pitch_deck', 'business_model', 'go_to_market'],
    completedReviews: 89,
    rating: 4.9,
    bio: '3× founder, 2 exits. Has reviewed 89+ decks across pre-seed to Series B. Former pitch coach at Athens Startup Weekend.',
    feeFrom: 180,
    responseTime: '48 hrs',
    isVerified: true,
    badges: ['Top Reviewer', 'Pitch Specialist'],
  },
  {
    id: 'e2',
    name: 'Katerina Vassiliou',
    title: 'CFO Advisor & Financial Modelling Expert',
    domains: ['financial_model', 'legal_structure'],
    completedReviews: 54,
    rating: 4.8,
    bio: 'Chartered accountant with 12 years in startup finance. Specializes in SaaS unit economics, fundraising models, and financial due diligence readiness.',
    feeFrom: 300,
    responseTime: '24 hrs',
    isVerified: true,
    badges: ['Finance Expert'],
  },
  {
    id: 'e3',
    name: 'Nikos Papadakis',
    title: 'GTM Strategist & Growth Advisor',
    domains: ['go_to_market', 'market_analysis', 'product_strategy'],
    completedReviews: 37,
    rating: 4.7,
    bio: 'Former VP Growth at 2 B2B SaaS companies. Advises early-stage startups on positioning, channel strategy, and EU market expansion.',
    feeFrom: 120,
    responseTime: '72 hrs',
    isVerified: false,
    badges: [],
  },
  {
    id: 'e4',
    name: 'Alexis Petridis',
    title: 'CTO & Technical Architecture Reviewer',
    domains: ['technical_architecture', 'product_strategy'],
    completedReviews: 28,
    rating: 4.6,
    bio: 'Ex-CTO of Series A fintech. Reviews technical architecture, scalability plans, and build-vs-buy decisions for early-stage startups.',
    feeFrom: 200,
    responseTime: '48 hrs',
    isVerified: true,
    badges: ['Tech Expert'],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ExpertReview }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[review.status];
  const type = REVIEW_TYPE_CONFIG[review.reviewType];
  const StatusIcon = status.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
                {initialsOf(review.expertName)}
              </AvatarFallback>
            </Avatar>
          )}
          title={review.expertName}
          subtitle={review.expertTitle}
          aside={(
            <Badge variant="outline" className="gap-1 text-xs">
              <StatusIcon className={cn('icon-sm', STATUS[status.tone].icon)} aria-hidden="true" />
              <BilingualText en={status.label} el={status.labelEl} compact />
            </Badge>
          )}
        />

        {/* What was asked, what it costs and when it is due: facts on the
            avatar's edge, one muted line. The kind was a tinted pill. */}
        <FactLine
          items={[
            <BilingualText key="type" en={type.label} el={type.labelEl} compact />,
            review.isPaid && review.agreedFee ? <span key="fee" className="tabular-nums">€{review.agreedFee}</span> : null,
            !review.isPaid ? <BilingualText key="free" en="Free" el="Δωρεάν" compact /> : null,
            review.dueDate && review.status !== 'submitted' ? (
              <span key="due" className={STATUS.warning.icon}>
                {/* Pinned to UTC on both sides so the server pass and
                    hydration agree on the day. */}
                <BilingualText
                  en={`Due ${new Date(review.dueDate).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })}`}
                  el={`Προθεσμία ${new Date(review.dueDate).toLocaleDateString('el-GR', { timeZone: 'UTC', day: 'numeric', month: 'short' })}`}
                  compact
                />
              </span>
            ) : null,
          ]}
        />

        {/* Score: a figure in the body's step, never louder than the name. */}
        {review.scoreOverall && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-muted-foreground">
              <BilingualText en="Overall score:" el="Συνολική βαθμολογία:" compact />{' '}
              <span className={cn('card-body font-semibold tabular-nums', scoreTenPointClass(review.scoreOverall))}>
                {review.scoreOverall}/10
              </span>
            </p>
            {review.rating && (
              <div data-keep-icon="" className="flex items-center gap-0.5" role="img" aria-label={bilingualAria(`Rated ${review.rating} of 5`, `Βαθμολογία ${review.rating} από 5`)}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn('icon-sm', i < review.rating! ? cn('fill-current', STATUS.warning.icon) : 'text-muted-foreground/30')} aria-hidden="true" />
                ))}
              </div>
            )}
          </div>
        )}

        {review.summaryFeedback && (
          <p className="card-body line-clamp-2 italic text-muted-foreground">
            “{review.summaryFeedback}”
          </p>
        )}

        <CardFoot>
          {/* A review carries the expert's name but no user id, so there
              is no conversation to open. Disabled and labelled beats a
              button that looks live. */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled
            title={MESSAGE_HINT}
            aria-label={MESSAGE_HINT}
          >
            <MessageCircle className="icon-sm" aria-hidden="true" />
            <BilingualText en="Message expert" el="Μήνυμα στον ειδικό" compact wrap />
          </Button>
          {/* "View full review" is gone rather than wired: "See feedback"
              already expands the full review in place, and did so while
              that one did nothing. Two buttons for one action is the defect. */}
          {review.strengthsJson || review.improvementsJson ? (
            <Button size="sm" variant="ghost" className="gap-0.5" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              <BilingualText
                en={expanded ? 'Collapse' : 'See feedback'}
                el={expanded ? 'Σύμπτυξη' : 'Δείτε την ανατροφοδότηση'}
                compact
              />
              <ChevronRight className={cn('icon-sm transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
            </Button>
          ) : null}
        </CardFoot>
      </CardContent>

      {/* Expanded feedback */}
      {expanded && (review.strengthsJson || review.improvementsJson || review.scoresByArea) && (
        <div className="space-y-4 border-t border-border bg-muted/30 p-4 sm:p-6">
          {/* Scores by area */}
          {review.scoresByArea && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><BilingualText en="Scores by Area" el="Βαθμοί ανά τομέα" compact /></p>
              <div className="space-y-1.5">
                {Object.entries(review.scoresByArea).map(([area, score]) => (
                  <div key={area} className="flex items-center gap-2">
                    <span className="text-2xs text-muted-foreground capitalize w-24 shrink-0">{area}</span>
                    <Progress value={score * 10} className="flex-1 h-1.5" />
                    <span className={cn('text-xs font-semibold w-8 text-right', scoreTenPointClass(score))}>
                      {score}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {review.strengthsJson && review.strengthsJson.length > 0 && (
            <div>
              <p className={cn('mb-2 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider', STATUS.success.icon)}><CheckCircle2 className="h-3 w-3" aria-hidden="true" /><BilingualText en="Strengths" el="Δυνατά σημεία" compact /></p>
              <ul className="space-y-2">
                {review.strengthsJson.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="font-semibold text-foreground shrink-0">{s.area}:</span>
                    <span className="text-muted-foreground">{s.comment}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {review.improvementsJson && review.improvementsJson.length > 0 && (
            <div>
              <p className={cn('mb-2 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider', STATUS.warning.icon)}><Lightbulb className="h-3 w-3" aria-hidden="true" /><BilingualText en="Recommendations" el="Προτάσεις" compact /></p>
              <ul className="space-y-2">
                {review.improvementsJson.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="font-semibold text-foreground shrink-0">{s.area}:</span>
                    <span className="text-muted-foreground">{s.recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ExpertCard({ expert }: { expert: ExpertProfile }) {
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
                {initialsOf(expert.name)}
              </AvatarFallback>
            </Avatar>
          )}
          title={(
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>{expert.name}</span>
              {expert.isVerified && (
                <Badge size="sm" className="rounded-full border-primary/20 bg-primary/10 px-1.5 text-primary-accessible">
                  <BilingualText en="Verified" el="Επαληθευμένος" compact />
                </Badge>
              )}
            </span>
          )}
          subtitle={expert.title}
          meta={expert.badges?.length ? <FactLine items={expert.badges} /> : undefined}
          aside={expert.feeFrom != null ? (
            <span className="font-semibold tabular-nums text-foreground">
              {/* The euro sign used to be written in, whatever the expert
                  charges in. */}
              <BilingualText en="From" el="Από" compact />{' '}
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: expert.currency || 'USD',
                maximumFractionDigits: 0,
              }).format(expert.feeFrom)}
            </span>
          ) : undefined}
        />

        <p className="card-body line-clamp-2 text-muted-foreground">{expert.bio}</p>

        {/* What they review, then how they are rated and how fast: facts,
            not tinted pills. */}
        <div className="space-y-1">
          <FactLine
            items={(expert.domains ?? []).slice(0, 3).map((d) => {
              const cfg = REVIEW_TYPE_CONFIG[d];
              return <BilingualText key={d} en={cfg.label} el={cfg.labelEl} compact />;
            })}
          />
          <FactLine
            items={[
              <span key="rating" data-keep-icon="" className="inline-flex items-center gap-1">
                <Star className={cn('icon-sm fill-current', STATUS.warning.icon)} aria-hidden="true" />
                {expert.rating ?? '—'}{' '}
                <BilingualText
                  en={`(${expert.completedReviews} ${expert.completedReviews === 1 ? 'review' : 'reviews'})`}
                  el={`(${expert.completedReviews} ${expert.completedReviews === 1 ? 'αξιολόγηση' : 'αξιολογήσεις'})`}
                  compact
                />
              </span>,
              expert.responseTime ? (
                <span key="turnaround">
                  <BilingualText en="Turnaround:" el="Χρόνος παράδοσης:" compact /> {expert.responseTime}
                </span>
              ) : null,
            ]}
          />
        </div>

        {/* These experts are constants. Mentors are real, bookable and
            messageable, and a structured review is one of the things they
            do — so that is where both buttons lead. */}
        <CardFoot>
          <Button size="sm" className="gap-1" asChild>
            <Link href="/mentoring">
              <Plus className="icon-sm shrink-0" aria-hidden="true" />
              <BilingualText en="Request a review" el="Αίτημα αξιολόγησης" compact wrap />
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1" asChild>
            <Link href="/mentoring">
              <MessageCircle className="icon-sm shrink-0" aria-hidden="true" />
              <BilingualText en="Browse" el="Περιήγηση" compact wrap />
            </Link>
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/**
 * Which review domains a free-text list of skills names.
 *
 * An expert records the words they typed; this page files them under nine
 * review types. Matching is the honest join, and no match means no chip rather
 * than filing everyone under "general".
 */
const DOMAIN_KEYWORDS: Record<ReviewType, string[]> = {
  pitch_deck: ['pitch', 'deck', 'storytelling', 'narrative'],
  business_model: ['business model', 'bmc', 'monetisation', 'monetization', 'pricing'],
  financial_model: ['financial', 'finance', 'unit economics', 'cfo', 'accounting'],
  legal_structure: ['legal', 'counsel', 'incorporation', 'contract', 'compliance'],
  market_analysis: ['market', 'research', 'tam', 'competitive', 'analysis'],
  go_to_market: ['go-to-market', 'gtm', 'growth', 'sales', 'marketing', 'demand'],
  technical_architecture: ['architecture', 'engineering', 'infrastructure', 'cto', 'platform'],
  product_strategy: ['product', 'roadmap', 'discovery', 'ux', 'design'],
  general: [],
};

function domainsFrom(words: readonly string[]): ReviewType[] {
  /*
   * Whole words, not substrings.
   *
   * Plain `includes` filed a mentor under Legal Structure because the
   * keyword "ip" sits inside "Leadership". Every non-letter becomes a
   * space and both sides are padded, so a keyword matches only where a word
   * actually starts and ends - and a multi-word keyword like
   * "go-to-market" still matches, because it is normalised the same way.
   */
  const normalise = (text: string) => ` ${text.toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;
  const haystack = normalise(words.join(' '));
  return (Object.keys(DOMAIN_KEYWORDS) as ReviewType[]).filter(
    (type) =>
      DOMAIN_KEYWORDS[type].length > 0 &&
      DOMAIN_KEYWORDS[type].some((keyword) => haystack.includes(normalise(keyword))),
  );
}

/** `[{ area, comment }]` out of a free JSON column, defensively. */
function notes(raw: Record<string, unknown>[], key: 'comment' | 'recommendation') {
  return raw
    .map((entry) => ({
      area: typeof entry?.area === 'string' ? entry.area : '',
      [key]: typeof entry?.[key] === 'string' ? (entry[key] as string) : '',
    }))
    .filter((entry) => entry.area.length > 0) as never;
}

/**
 * One review, from the ExpertReview row it already is.
 *
 * This page is the requester's side, so the person named on every card is the
 * expert - the requester is whoever is reading.
 */
function toPageReview(row: ExpertReviewItem): ExpertReview {
  return {
    id: row.id,
    expertName: row.expert?.displayName ?? 'An expert',
    expertTitle: row.expert?.headline ?? '',
    expertAvatar: row.expert?.avatarUrl ?? undefined,
    reviewType: row.reviewType,
    status: row.status,
    requestMessage: row.requestMessage ?? undefined,
    dueDate: row.dueDate ?? undefined,
    submittedAt: row.submittedAt ?? undefined,
    scoreOverall: row.scoreOverall ?? undefined,
    summaryFeedback: row.summaryFeedback ?? undefined,
    strengthsJson: notes(row.strengths, 'comment'),
    improvementsJson: notes(row.improvements, 'recommendation'),
    scoresByArea: Object.keys(row.scoresByArea).length > 0 ? row.scoresByArea : undefined,
    isPaid: row.isPaid,
    agreedFee: row.agreedFee ?? undefined,
    rating: row.rating ?? undefined,
  };
}

/** One expert, from the directory the module serves. */
function toPageExpert(row: ExpertDirectoryItem): ExpertProfile {
  return {
    id: row.userId,
    name: row.displayName ?? 'An expert',
    title: row.headline ?? '',
    avatar: row.avatarUrl ?? undefined,
    domains: domainsFrom([...row.specializations, ...row.skills, ...row.industries]),
    completedReviews: row.completedReviews,
    rating: row.rating,
    bio: row.bio ?? '',
    feeFrom: row.isFree ? undefined : (row.feeFrom ?? undefined),
    currency: row.currency,
    // No column records a turnaround, and none records a verification badge
    // beyond the one the mentor profile already carries.
    responseTime: undefined,
    isVerified: row.isVerified,
  };
}

export default function ExpertReviewsPage() {
  const [activeTab, setActiveTab] = useState('my-reviews');
  const [searchExperts, setSearchExperts] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<ReviewType | 'all'>('all');
  const { showDemoData } = useDemoData();
  const router = useRouter();
  const { openRailSection } = usePageRail();

  /*
   * The founder's own reviews, from the module that now reads ExpertReview.
   * `side: 'requester'` is what keeps an expert's own requests out of the
   * queue of requests made of them.
   */
  const { data: reviewData, isLoading: reviewsLoading } = useQuery({
    queryKey: qk('expert-reviews', 'requester'),
    queryFn: () => listExpertReviews({ side: 'requester', limit: 50 }),
    staleTime: 60_000,
    retry: 0,
  });

  const liveReviews = useMemo(
    () => (reviewData?.reviews ?? []).map(toPageReview),
    [reviewData],
  );

  const myReviews =
    liveReviews.length > 0
      ? liveReviews
      : reviewsLoading
        ? []
        : showDemoData
          ? DEMO_REVIEWS
          : [];

  /*
   * The expert directory. This list used to render unconditionally, so a real
   * founder browsed four experts who do not exist.
   */
  const { data: expertData, isLoading: expertsLoading } = useQuery({
    queryKey: qk('expert-reviews', 'experts'),
    queryFn: () => listExperts({ limit: 24 }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const liveExperts = useMemo(
    () => (expertData?.experts ?? []).map(toPageExpert),
    [expertData],
  );

  const experts =
    liveExperts.length > 0
      ? liveExperts
      : expertsLoading
        ? []
        : showDemoData
          ? DEMO_EXPERTS
          : [];
  const submitted = myReviews.filter((r) => r.status === 'submitted');
  const pending = myReviews.filter((r) => r.status !== 'submitted' && r.status !== 'declined');

  const filteredExperts = experts.filter((e) => {
    const q = searchExperts.toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.bio.toLowerCase().includes(q);
    const matchesDomain = selectedDomain === 'all' || e.domains.includes(selectedDomain);
    return matchesSearch && matchesDomain;
  });

  // Offered to the assistant: the tab and the expertise filter; the reviews
  // and the experts on screen go out as lists.
  usePageList([
    { id: 'my_reviews', labelEn: 'My reviews', labelEl: 'Οι αξιολογήσεις μου', rows: reviewsLoading ? undefined : myReviews.map((r) => `${r.expertName} · ${REVIEW_TYPE_CONFIG[r.reviewType]?.label ?? r.reviewType} · ${r.status}${r.scoreOverall != null ? ` · score ${r.scoreOverall}` : ''}${r.dueDate ? ` · due ${r.dueDate.slice(0, 10)}` : ''}`), sample: liveReviews.length === 0 },
    { id: 'experts', labelEn: 'Experts', labelEl: 'Ειδικοί', rows: expertsLoading ? undefined : filteredExperts.map((e) => `${e.name} · ${e.title} · ${e.domains.map((d) => REVIEW_TYPE_CONFIG[d]?.label ?? d).join(', ')} · ${e.completedReviews} reviews${e.rating != null ? ` · ${e.rating.toFixed(1)}★` : ''}`), total: experts.length, sample: liveExperts.length === 0 },
  ]);
  usePageControls([
    choiceControl('expert_tab', 'Expert reviews section', 'Ενότητα αξιολογήσεων', [
      { value: 'my-reviews', en: 'My reviews', el: 'Οι αξιολογήσεις μου' },
      { value: 'find-experts', en: 'Find experts', el: 'Εύρεση ειδικών' },
      { value: 'insights', en: 'Insights', el: 'Αναλύσεις' },
    ], activeTab, setActiveTab),
    choiceControl('expertise', 'Expertise filter', 'Φίλτρο ειδίκευσης', [
      { value: 'all', en: 'All areas', el: 'Όλοι οι τομείς' },
      ...(Object.entries(REVIEW_TYPE_CONFIG) as [ReviewType, (typeof REVIEW_TYPE_CONFIG)[ReviewType]][]).map(([key, cfg]) => ({ value: key, en: cfg.label, el: cfg.labelEl })),
    ], selectedDomain, (v) => { setSelectedDomain(v as ReviewType | 'all'); setActiveTab('find-experts'); }),
  ]);

  const avgScore = submitted.length
    ? (submitted.filter((r) => r.scoreOverall).reduce((acc, r) => acc + (r.scoreOverall ?? 0), 0) / submitted.filter((r) => r.scoreOverall).length)
    : null;

  /*
   * The column leads with the tabs and the reviews. The four counts and the
   * domain chips sat above the first card; they live in the rail now. Request
   * review stays: it is this page's next step, not another surface.
   */
  const listingFilters = selectedDomain !== 'all' ? 1 : 0;
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'award',
      labelEn: 'At a glance',
      labelEl: 'Με μια ματιά',
      content: (
        <RailStats
          items={[
            { key: 'total', label: 'Total reviews', labelEl: 'Συνολικές αξιολογήσεις', value: myReviews.length, icon: FileText, tone: 'bg-status-accent-bg text-status-accent' },
            { key: 'pending', label: 'In progress', labelEl: 'Σε εξέλιξη', value: pending.length, icon: Clock, tone: 'bg-status-warning-bg text-status-warning' },
            { key: 'done', label: 'Completed', labelEl: 'Ολοκληρωμένες', value: submitted.length, icon: CheckCircle2, tone: 'bg-status-success-bg text-status-success' },
            { key: 'avg', label: 'Avg score', labelEl: 'Μέση βαθμολογία', value: avgScore ? `${avgScore.toFixed(1)}/10` : '—', icon: BarChart3, tone: 'bg-status-info-bg text-status-info' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Expertise',
      labelEl: 'Εξειδίκευση',
      badge: listingFilters || null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Domain"
            titleEl="Τομέας"
            options={[
              { value: 'all', en: 'All areas', el: 'Όλοι οι τομείς' },
              ...(Object.entries(REVIEW_TYPE_CONFIG) as [ReviewType, (typeof REVIEW_TYPE_CONFIG)[ReviewType]][]).map(([key, cfg]) => ({
                value: key,
                en: cfg.label,
                el: cfg.labelEl,
                icon: cfg.icon,
              })),
            ]}
            value={selectedDomain}
            onChange={(v) => { setSelectedDomain(v as ReviewType | 'all'); setActiveTab('find-experts'); }}
          />
          {listingFilters > 0 && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => setSelectedDomain('all')} />
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
          <RailAction icon={Target} en="Open readiness" el="Άνοιγμα ετοιμότητας" onClick={() => router.push('/readiness')} />
          <RailAction icon={FileText} en="Open pitch deck" el="Άνοιγμα pitch deck" onClick={() => router.push('/builder/pitch-deck')} />
          <RailAction icon={DollarSign} en="Open fundraising" el="Άνοιγμα χρηματοδότησης" onClick={() => router.push('/fundraising')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell showHelp rail={rail} askAi="Which expert review should I request first — pitch deck, financial model, or go-to-market — given my current readiness gaps?">
      <div className="space-y-6 pb-10">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-9">
              <TabsTrigger value="my-reviews" className="text-xs">
                <BilingualText en="My Reviews" el="Οι αξιολογήσεις μου" compact />
              </TabsTrigger>
              <TabsTrigger value="find-experts" className="text-xs">
                <BilingualText en="Find Experts" el="Εύρεση ειδικών" compact />
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs">
                <BilingualText en="Insights" el="Αναλύσεις" compact />
              </TabsTrigger>
            </TabsList>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setActiveTab('find-experts')}>
              <Plus className="icon-sm" />{' '}
              <BilingualText en="Request review" el="Αίτημα αξιολόγησης" compact wrap />
            </Button>
          </div>

          {/* My Reviews */}
          <TabsContent value="my-reviews" className="mt-4 space-y-3">
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <BilingualText en="Active Requests" el="Ενεργά αιτήματα" compact />
                </p>
                <div className="space-y-3">{pending.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
              </div>
            )}
            {submitted.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <BilingualText en="Completed Reviews" el="Ολοκληρωμένες αξιολογήσεις" compact />
                </p>
                <div className="space-y-3">{submitted.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
              </div>
            )}
            {myReviews.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Award className="h-7 w-7 text-primary-accessible" />
                </div>
                <div>
                  <p className="font-medium text-foreground"><BilingualText en="No reviews yet" el="Δεν υπάρχουν κριτικές ακόμα" compact /></p>
                  <p className="mt-1 text-sm text-muted-foreground"><BilingualText en="Request expert feedback on your pitch, financials, or strategy." el="Ζητήστε γνώμη ειδικού για το pitch, τα οικονομικά ή τη στρατηγική σας." wrap /></p>
                </div>
                <Button size="sm" onClick={() => setActiveTab('find-experts')}><BilingualText en="Find an expert" el="Βρείτε ειδικό" compact /></Button>
              </div>
            )}
          </TabsContent>

          {/* Find Experts */}
          <TabsContent value="find-experts" className="mt-4 space-y-4">
            {/* Search — domain lives in the rail. */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <Input placeholder={bilingualInline("Search experts…", "Αναζήτηση ειδικών…")} value={searchExperts} onChange={(e) => setSearchExperts(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>

            <div className="space-y-3">
              {filteredExperts.map((e) => <ExpertCard key={e.id} expert={e} />)}
              {filteredExperts.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <BilingualText en="No experts match your search." el="Κανένας ειδικός δεν ταιριάζει με την αναζήτηση." compact wrap />{' '}
                  {listingFilters > 0 ? (
                    <button className="text-primary-accessible hover:underline" onClick={() => openRailSection('filters')}>
                      <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                    </button>
                  ) : (
                    <button className="text-primary-accessible hover:underline" onClick={() => setSearchExperts('')}>
                      <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* CTA for becoming an expert */}
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
              <Award className="icon-xl text-muted-foreground/50 mx-auto mb-3" />
              <p className="mb-1 text-sm font-medium text-foreground">
                <BilingualText en="Are you a domain expert?" el="Είστε ειδικός στον τομέα σας;" />
              </p>
              <p className="mb-3 text-xs leading-snug text-muted-foreground">
                <BilingualText
                  en="Join as an expert reviewer and earn while helping founders."
                  el="Γίνετε αξιολογητής και κερδίστε βοηθώντας ιδρυτές."
                />
              </p>
              {/* Mentor signup is the form that exists and is wired. */}
              <Button variant="outline" size="sm" asChild>
                <Link href="/mentor/profile">
                  <BilingualText en="Apply as expert" el="Αίτηση ως ειδικός" compact wrap />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* Insights */}
          <TabsContent value="insights" className="mt-4 space-y-4">
            {submitted.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <BilingualText en="Complete your first review to see insights." el="Ολοκληρώστε την πρώτη σας αξιολόγηση για να δείτε στοιχεία." wrap />
              </div>
            ) : (
              <>
                {/* Score breakdown from completed reviews */}
                {submitted.filter((r) => r.scoresByArea).map((r) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="icon-sm text-muted-foreground" />
                        <BilingualText
                          en={`${REVIEW_TYPE_CONFIG[r.reviewType].label} — Detailed Scores`}
                          el={`${REVIEW_TYPE_CONFIG[r.reviewType].labelEl} — Αναλυτικές βαθμολογίες`}
                          compact
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(r.scoresByArea!).map(([area, score]) => (
                        <div key={area} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground capitalize w-28 shrink-0">{area}</span>
                          <Progress value={score * 10} className="flex-1 h-2" />
                          <span className={cn(
                            'w-8 text-right text-xs font-bold tabular-nums',
                            scoreTenPointClass(score),
                          )}>
                            {score}/10
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                {/* Summary recommendations */}
                {submitted.filter((r) => r.improvementsJson?.length).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className={cn('icon-sm', STATUS.warning.icon)} /> <BilingualText en="Top Recommendations" el="Κορυφαίες προτάσεις" compact />
                      </CardTitle>
                    </CardHeader>
                    {/* One row per recommendation, hairlines between them: each
                        was a warning-tinted box inside the card. */}
                    <CardContent className="card-rows">
                      {submitted.flatMap((r) => (r.improvementsJson ?? []).slice(0, 2).map((imp, i) => (
                        <div key={`${r.id}-${i}`} className="flex gap-2">
                          <AlertTriangle className={cn('icon-sm shrink-0 mt-0.5', STATUS.warning.icon)} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{imp.area}</p>
                            <p className="text-xs text-muted-foreground">{imp.recommendation}</p>
                          </div>
                        </div>
                      )))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
