'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { READINESS_BAR, STATUS, readinessClasses } from '@/lib/semantic-colors';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BuilderStageHeader, BUILDER_BTN, BUILDER_STAT } from './BuilderStageChrome';
import { builderEn, builderEl, BUILDER_PREVIEW_HINT_EL } from '@/lib/i18n/strings-builder';
import { assessReadiness, pickReadinessDimensions, updateReadinessCriterion, type ReadinessScore } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

import { pressableProps } from '@/lib/pressable';
interface ReadinessDimension {
  id: string;
  name: string;
  glyph: CfbGlyphName;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'needs-work' | 'critical';
  criteria: ReadinessCriterion[];
  recommendations: string[];
}

interface ReadinessCriterion {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  weight: number;
  evidence?: string;
}

interface ReadinessData {
  overallScore: number;
  overallStatus: 'excellent' | 'good' | 'needs-work' | 'critical';
  dimensions: ReadinessDimension[];
  readinessLevel: 'idea' | 'validation' | 'mvp' | 'growth' | 'scale';
  nextMilestones: string[];
  blockers: string[];
}

interface ReadinessScoringProps {
  workspaceData?: any;
  /**
   * The workspace whose readiness this is. Without it the component can only
   * show the empty checklist: the scores live on the server, keyed by
   * workspace, and the assistant's `readiness_tick_criterion` writes to the
   * same rows.
   */
  workspaceId?: string;
  onRefresh?: () => void;
}

function statusFromPercent(pct: number): ReadinessDimension['status'] {
  if (pct >= 80) return 'excellent';
  if (pct >= 60) return 'good';
  if (pct >= 40) return 'needs-work';
  return 'critical';
}

/** Server dimension -> the local shape the cards render. */
function mergeServerDimension(
  base: Omit<ReadinessDimension, 'score' | 'status' | 'recommendations'>,
  scored: ReadinessScore | undefined,
): ReadinessDimension {
  const byId = new Map((scored?.criteria ?? []).map((c) => [c.id, c]));
  const criteria = base.criteria.map((c) => {
    const server = byId.get(c.id);
    return {
      ...c,
      completed: server?.completed ?? false,
      weight: server?.weight ?? c.weight,
      evidence: server?.notes || undefined,
    };
  });
  const max = scored && scored.maxScore > 0 ? scored.maxScore : base.maxScore;
  const pct = scored ? (scored.score / max) * 100 : 0;
  return {
    ...base,
    criteria,
    score: scored?.score ?? 0,
    status: statusFromPercent(pct),
    recommendations: scored?.recommendations ?? [],
  };
}

const READINESS_DIMENSIONS: Omit<ReadinessDimension, 'score' | 'status' | 'recommendations'>[] = [
  {
    id: 'team',
    name: 'Team Readiness',
    glyph: 'people',
    maxScore: 100,
    criteria: [
      { id: 't1', name: 'Co-founder identified', description: 'Have you found a co-founder or core team?', completed: false, weight: 25 },
      { id: 't2', name: 'Complementary skills', description: 'Does your team have complementary skills?', completed: false, weight: 20 },
      { id: 't3', name: 'Full-time commitment', description: 'Is at least one founder full-time?', completed: false, weight: 20 },
      { id: 't4', name: 'Equity agreement', description: 'Have you agreed on equity split?', completed: false, weight: 15 },
      { id: 't5', name: 'Advisors/mentors', description: 'Do you have advisors or mentors?', completed: false, weight: 10 },
      { id: 't6', name: 'Hiring plan', description: 'Do you have a hiring plan?', completed: false, weight: 10 }
    ]
  },
  {
    id: 'market',
    name: 'Market Validation',
    glyph: 'chart',
    maxScore: 100,
    criteria: [
      { id: 'm1', name: 'Problem validated', description: 'Have you validated the problem exists?', completed: false, weight: 25 },
      { id: 'm2', name: 'Customer interviews', description: 'Have you conducted 20+ customer interviews?', completed: false, weight: 20 },
      { id: 'm3', name: 'Market size defined', description: 'Have you defined TAM/SAM/SOM?', completed: false, weight: 15 },
      { id: 'm4', name: 'ICP defined', description: 'Have you defined your ideal customer profile?', completed: false, weight: 15 },
      { id: 'm5', name: 'Competitive analysis', description: 'Have you analyzed competitors?', completed: false, weight: 15 },
      { id: 'm6', name: 'Pricing validated', description: 'Have you validated pricing with customers?', completed: false, weight: 10 }
    ]
  },
  {
    id: 'product',
    name: 'Product Readiness',
    glyph: 'sliders',
    maxScore: 100,
    criteria: [
      { id: 'p1', name: 'MVP defined', description: 'Have you defined your MVP scope?', completed: false, weight: 20 },
      { id: 'p2', name: 'Core features built', description: 'Are core features built or in progress?', completed: false, weight: 25 },
      { id: 'p3', name: 'User testing', description: 'Have you conducted user testing?', completed: false, weight: 20 },
      { id: 'p4', name: 'Technical architecture', description: 'Is technical architecture defined?', completed: false, weight: 15 },
      { id: 'p5', name: 'Launch plan', description: 'Do you have a launch plan?', completed: false, weight: 10 },
      { id: 'p6', name: 'Metrics defined', description: 'Have you defined success metrics?', completed: false, weight: 10 }
    ]
  },
  {
    id: 'business',
    name: 'Business Model',
    glyph: 'wallet',
    maxScore: 100,
    criteria: [
      { id: 'b1', name: 'Revenue model defined', description: 'Have you defined your revenue model?', completed: false, weight: 25 },
      { id: 'b2', name: 'Unit economics', description: 'Do you understand your unit economics?', completed: false, weight: 20 },
      { id: 'b3', name: 'BMC completed', description: 'Have you completed a Business Model Canvas?', completed: false, weight: 15 },
      { id: 'b4', name: 'Financial projections', description: 'Do you have financial projections?', completed: false, weight: 15 },
      { id: 'b5', name: 'Go-to-market strategy', description: 'Do you have a go-to-market strategy?', completed: false, weight: 15 },
      { id: 'b6', name: 'Partnerships identified', description: 'Have you identified key partnerships?', completed: false, weight: 10 }
    ]
  },
  {
    id: 'funding',
    name: 'Funding Readiness',
    glyph: 'award',
    maxScore: 100,
    criteria: [
      { id: 'f1', name: 'Pitch deck ready', description: 'Do you have an investor-ready pitch deck?', completed: false, weight: 25 },
      { id: 'f2', name: 'Funding strategy', description: 'Have you defined your funding strategy?', completed: false, weight: 20 },
      { id: 'f3', name: 'Investor list', description: 'Do you have a target investor list?', completed: false, weight: 15 },
      { id: 'f4', name: 'Legal structure', description: 'Is your legal structure in place?', completed: false, weight: 15 },
      { id: 'f5', name: 'Data room', description: 'Do you have a data room prepared?', completed: false, weight: 15 },
      { id: 'f6', name: 'Runway calculated', description: 'Have you calculated your runway needs?', completed: false, weight: 10 }
    ]
  },
  {
    id: 'execution',
    name: 'Execution Capability',
    glyph: 'flag',
    maxScore: 100,
    criteria: [
      { id: 'e1', name: 'Milestones defined', description: 'Have you defined clear milestones?', completed: false, weight: 20 },
      { id: 'e2', name: 'Sprint planning', description: 'Do you have a sprint/iteration process?', completed: false, weight: 15 },
      { id: 'e3', name: 'Tools & infrastructure', description: 'Are your tools and infrastructure set up?', completed: false, weight: 15 },
      { id: 'e4', name: 'Communication cadence', description: 'Do you have regular team communication?', completed: false, weight: 15 },
      { id: 'e5', name: 'Decision-making process', description: 'Is your decision-making process clear?', completed: false, weight: 15 },
      { id: 'e6', name: 'Risk management', description: 'Have you identified and planned for risks?', completed: false, weight: 20 }
    ]
  }
];

const DIM_LABEL: Record<string, { en: string; el: string }> = {
  team: { en: 'Team Readiness', el: 'Ετοιμότητα ομάδας' },
  market: { en: 'Market Validation', el: 'Επικύρωση αγοράς' },
  product: { en: 'Product Readiness', el: 'Ετοιμότητα προϊόντος' },
  business: { en: 'Business Model', el: 'Επιχειρηματικό μοντέλο' },
  funding: { en: 'Funding Readiness', el: 'Ετοιμότητα χρηματοδότησης' },
  execution: { en: 'Execution Capability', el: 'Ικανότητα εκτέλεσης' },
};

const STAGE_LABEL: Record<string, { en: string; el: string }> = {
  idea: { en: 'Idea', el: 'Ιδέα' },
  validation: { en: 'Validation', el: 'Επικύρωση' },
  mvp: { en: 'MVP', el: 'MVP' },
  growth: { en: 'Growth', el: 'Ανάπτυξη' },
  scale: { en: 'Scale', el: 'Κλίμακα' },
};

const CRITERION_EL: Record<string, { name: string; description: string }> = {
  t1: { name: 'Συνιδρυτής εντοπισμένος', description: 'Έχετε βρει συνιδρυτή ή βασική ομάδα;' },
  t2: { name: 'Συμπληρωματικές δεξιότητες', description: 'Η ομάδα έχει συμπληρωματικές δεξιότητες;' },
  t3: { name: 'Πλήρης απασχόληση', description: 'Ένας τουλάχιστον ιδρυτής είναι πλήρους απασχόλησης;' },
  t4: { name: 'Συμφωνία μετοχών', description: 'Έχετε συμφωνήσει στον διαμοιρασμό μετοχών;' },
  t5: { name: 'Σύμβουλοι / μέντορες', description: 'Έχετε συμβούλους ή μέντορες;' },
  t6: { name: 'Πλάνο προσλήψεων', description: 'Έχετε πλάνο προσλήψεων;' },
  m1: { name: 'Πρόβλημα επικυρωμένο', description: 'Έχετε επικυρώσει ότι το πρόβλημα υπάρχει;' },
  m2: { name: 'Συνεντεύξεις πελατών', description: 'Έχετε κάνει 20+ συνεντεύξεις πελατών;' },
  m3: { name: 'Μέγεθος αγοράς', description: 'Έχετε ορίσει TAM/SAM/SOM;' },
  m4: { name: 'ICP ορισμένο', description: 'Έχετε ορίσει το ιδανικό προφίλ πελάτη;' },
  m5: { name: 'Ανάλυση ανταγωνισμού', description: 'Έχετε αναλύσει ανταγωνιστές;' },
  m6: { name: 'Τιμολόγηση επικυρωμένη', description: 'Έχετε επικυρώσει τιμές με πελάτες;' },
  p1: { name: 'MVP ορισμένο', description: 'Έχετε ορίσει το εύρος του MVP;' },
  p2: { name: 'Βασικά χαρακτηριστικά', description: 'Τα βασικά χαρακτηριστικά χτίζονται ή υπάρχουν;' },
  p3: { name: 'Δοκιμές χρηστών', description: 'Έχετε κάνει user testing;' },
  p4: { name: 'Τεχνική αρχιτεκτονική', description: 'Η τεχνική αρχιτεκτονική είναι ορισμένη;' },
  p5: { name: 'Πλάνο λανσαρίσματος', description: 'Έχετε πλάνο λανσαρίσματος;' },
  p6: { name: 'Μετρήσεις ορισμένες', description: 'Έχετε ορίσει μετρήσεις επιτυχίας;' },
  b1: { name: 'Μοντέλο εσόδων', description: 'Έχετε ορίσει το μοντέλο εσόδων;' },
  b2: { name: 'Unit economics', description: 'Κατανοείτε τα unit economics;' },
  b3: { name: 'BMC ολοκληρωμένο', description: 'Έχετε συμπληρώσει Business Model Canvas;' },
  b4: { name: 'Οικονομικές προβλέψεις', description: 'Έχετε οικονομικές προβλέψεις;' },
  b5: { name: 'Go-to-market', description: 'Έχετε στρατηγική go-to-market;' },
  b6: { name: 'Συνεργασίες', description: 'Έχετε εντοπίσει βασικές συνεργασίες;' },
  f1: { name: 'Pitch deck έτοιμο', description: 'Έχετε pitch deck για επενδυτές;' },
  f2: { name: 'Στρατηγική χρηματοδότησης', description: 'Έχετε ορίσει στρατηγική χρηματοδότησης;' },
  f3: { name: 'Λίστα επενδυτών', description: 'Έχετε λίστα στόχων επενδυτών;' },
  f4: { name: 'Νομική δομή', description: 'Η νομική δομή είναι στη θέση της;' },
  f5: { name: 'Data room', description: 'Έχετε προετοιμάσει data room;' },
  f6: { name: 'Runway υπολογισμένο', description: 'Έχετε υπολογίσει τις ανάγκες runway;' },
  e1: { name: 'Ορόσημα ορισμένα', description: 'Έχετε σαφή ορόσημα;' },
  e2: { name: 'Sprint planning', description: 'Έχετε διαδικασία sprint/επανάληψης;' },
  e3: { name: 'Εργαλεία και υποδομή', description: 'Τα εργαλεία και η υποδομή είναι έτοιμα;' },
  e4: { name: 'Ρυθμός επικοινωνίας', description: 'Υπάρχει τακτική επικοινωνία ομάδας;' },
  e5: { name: 'Λήψη αποφάσεων', description: 'Η διαδικασία αποφάσεων είναι σαφής;' },
  e6: { name: 'Διαχείριση κινδύνου', description: 'Έχετε εντοπίσει και σχεδιάσει για κινδύνους;' },
};

export function ReadinessScoring({ workspaceData, workspaceId, onRefresh }: ReadinessScoringProps) {
  const [data, setData] = useState<ReadinessData>({
    overallScore: 0,
    overallStatus: 'critical',
    dimensions: [],
    readinessLevel: 'idea',
    nextMilestones: [],
    blockers: []
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const { error: toastError } = useToast();

  const applyDimensions = useCallback((scored: ReadinessScore[]) => {
    const byDimension = new Map(scored.map((d) => [d.dimension, d]));
    const dimensions = READINESS_DIMENSIONS.map((dim) =>
      mergeServerDimension(dim, byDimension.get(dim.id)),
    );
    const overallScore = dimensions.length
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : 0;
    setData({
      overallScore,
      overallStatus: statusFromPercent(overallScore),
      dimensions,
      readinessLevel:
        overallScore >= 80 ? 'scale'
          : overallScore >= 60 ? 'growth'
            : overallScore >= 40 ? 'mvp'
              : overallScore >= 20 ? 'validation' : 'idea',
      blockers: dimensions
        .filter((d) => d.status === 'critical')
        .map((d) => `${d.name} needs immediate attention`),
      nextMilestones: dimensions.flatMap((d) => d.recommendations).slice(0, 5),
    });
  }, []);

  /*
   * This used to hand out `Math.random() > 0.4` per criterion behind a
   * two-second "analysing" delay, so every press produced a different venture
   * readiness for the same workspace and nothing was saved. The scores are
   * server state (`builderReadinessScore`) — the same rows the assistant's
   * `readiness_tick_criterion` writes — so they are read and written here.
   */
  const analyzeReadiness = useCallback(async () => {
    if (!workspaceId) return;
    setIsAnalyzing(true);
    try {
      const scored = pickReadinessDimensions(await assessReadiness({ workspaceId }));
      if (!scored) {
        toastError('Analysis failed');
        return;
      }
      applyDimensions(scored);
    } catch {
      toastError('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [workspaceId, applyDimensions]);

  useEffect(() => {
    // The empty checklist first, so the page has its shape before the request
    // resolves — and permanently when there is no workspace to score.
    applyDimensions([]);
    if (workspaceId) void analyzeReadiness();
  }, [workspaceId, analyzeReadiness, applyDimensions]);

  const toggleCriterion = (dimensionId: string, criterionId: string) => {
    const dimension = data.dimensions.find((d) => d.id === dimensionId);
    const criterion = dimension?.criteria.find((c) => c.id === criterionId);
    if (!dimension || !criterion) return;
    const completed = !criterion.completed;

    // Optimistic, then reconciled with the score the server computed.
    setData(prev => ({
      ...prev,
      dimensions: prev.dimensions.map(dim => {
        if (dim.id !== dimensionId) return dim;
        const updatedCriteria = dim.criteria.map(c =>
          c.id === criterionId ? { ...c, completed } : c
        );
        const score = updatedCriteria.reduce((sum, c) => sum + (c.completed ? c.weight : 0), 0);
        return {
          ...dim,
          criteria: updatedCriteria,
          score,
          status: statusFromPercent((score / (dim.maxScore || 100)) * 100),
        };
      })
    }));

    if (!workspaceId) return;
    void updateReadinessCriterion(workspaceId, {
      dimension: dimensionId,
      criterionId,
      completed,
    })
      .then(() => analyzeReadiness())
      .catch(() => analyzeReadiness());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-status-success bg-status-success-bg';
      case 'good': return 'text-status-info bg-status-info-bg';
      case 'needs-work': return 'text-status-warning bg-status-warning-bg';
      case 'critical': return 'text-status-danger bg-status-danger-bg';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return CheckCircle2;
      case 'good': return CheckCircle2;
      case 'needs-work': return AlertTriangle;
      case 'critical': return XCircle;
      default: return AlertTriangle;
    }
  };

  const getLevelDescription = (level: string) => {
    switch (level) {
      case 'idea':
        return { en: builderEn('ready_lvl_idea'), el: builderEl('ready_lvl_idea') };
      case 'validation':
        return { en: builderEn('ready_lvl_val'), el: builderEl('ready_lvl_val') };
      case 'mvp':
        return { en: builderEn('ready_lvl_mvp'), el: builderEl('ready_lvl_mvp') };
      case 'growth':
        return { en: builderEn('ready_lvl_growth'), el: builderEl('ready_lvl_growth') };
      case 'scale':
        return { en: builderEn('ready_lvl_scale'), el: builderEl('ready_lvl_scale') };
      default:
        return { en: '', el: '' };
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return { en: builderEn('ready_st_exc'), el: builderEl('ready_st_exc') };
      case 'good':
        return { en: builderEn('ready_st_good'), el: builderEl('ready_st_good') };
      case 'needs-work':
        return { en: builderEn('ready_st_work'), el: builderEl('ready_st_work') };
      case 'critical':
        return { en: builderEn('ready_st_crit'), el: builderEl('ready_st_crit') };
      default:
        return { en: status, el: status };
    }
  };

  return (
    <div className="space-y-6">
      <BuilderStageHeader
        glyph="award"
        titleEn={builderEn('ready_title')}
        titleEl={builderEl('ready_title')}
        subtitleEn={builderEn('ready_sub')}
        subtitleEl={builderEl('ready_sub')}
        askPrompt="Score my Startup Builder readiness. Which dimension is weakest, and what should I complete next in Idea Core, BMC, Market, or Pitch?"
        extraActions={
          <>
            <Button asChild variant="outline" size="sm" className={BUILDER_BTN}>
              <Link href="/readiness">
                <BilingualText en={builderEn('full_readiness_report')} el={builderEl('full_readiness_report')} compact />
              </Link>
            </Button>
            <Button type="button" size="sm" className={BUILDER_BTN} onClick={() => void analyzeReadiness()} disabled={isAnalyzing}>
              {isAnalyzing ? <RefreshCw className="icon-sm mr-2 animate-spin" /> : <CfbGlyph name="spark" className="icon-sm mr-2" />}
              <BilingualText
                en={isAnalyzing ? builderEn('analyzing') : builderEn('ready_analyze')}
                el={isAnalyzing ? builderEl('analyzing') : builderEl('ready_analyze')}
                compact
              />
            </Button>
          </>
        }
      />

      {/* Overall Score */}
      <Card className={cn("border-2", readinessClasses(data.overallStatus).border)}>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Score Circle */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="hsl(var(--ring-gold-track))"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="hsl(var(--ring-gold))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${(data.overallScore / 100) * 352} 352`}
                  />
                </svg>
                {/* `gap-1.5`, as on /readiness: the score and its
                    denominator were sharing a line box with no space between
                    them. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                  <span className={cn(BUILDER_STAT, 'leading-none')}>{data.overallScore}</span>
                  <span className="text-xs leading-none text-muted-foreground">/ 100</span>
                </div>
              </div>
              <Badge className={cn('mt-4', getStatusColor(data.overallStatus))}>
                <BilingualText en={statusLabel(data.overallStatus).en} el={statusLabel(data.overallStatus).el} compact />
              </Badge>
            </div>

            {/* Stage Indicator */}
            <div className="flex flex-col justify-center">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                <BilingualText en={builderEn('ready_stage')} el={builderEl('ready_stage')} compact />
              </h3>
              <div className="mb-2 flex items-center gap-2">
                <CfbGlyph name="flag" className="icon-sm text-muted-foreground" />
                <span className="page-section font-semibold tracking-tight">
                  <BilingualText
                    en={STAGE_LABEL[data.readinessLevel]?.en ?? data.readinessLevel}
                    el={STAGE_LABEL[data.readinessLevel]?.el ?? data.readinessLevel}
                    compact
                  />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <BilingualText en={getLevelDescription(data.readinessLevel).en} el={getLevelDescription(data.readinessLevel).el} />
              </p>
              
              {/* Stage Progress */}
              <div className="flex gap-1 mt-4">
                {['idea', 'validation', 'mvp', 'growth', 'scale'].map((stage, index) => (
                  <div
                    key={stage}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      ['idea', 'validation', 'mvp', 'growth', 'scale'].indexOf(data.readinessLevel) >= index
                        ? 'bg-primary'
                        // `bg-muted` is a fixed light value — on the dark theme the
                        // unreached segments read as a bright bar, inverting the meaning.
                        : 'bg-muted'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3">
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  <BilingualText en={builderEn('ready_dims')} el={builderEl('ready_dims')} compact />
                </h3>
                {data.dimensions.map(dim => (
                  <div key={dim.id} className="flex items-center justify-between text-sm mb-1">
                    <span>
                      <BilingualText
                        en={DIM_LABEL[dim.id]?.en ?? dim.name}
                        el={DIM_LABEL[dim.id]?.el ?? dim.name}
                        compact
                      />
                    </span>
                    <span className={cn(
                      "font-medium",
                      readinessClasses(dim.status).text
                    )}>
                      {dim.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blockers & Next Steps */}
      {(data.blockers.length > 0 || data.nextMilestones.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.blockers.length > 0 && (
            <Card className={STATUS.danger.border}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("flex items-center gap-2", STATUS.danger.text)}>
                  <XCircle className="icon-sm" />
                  <BilingualText en={builderEn('ready_blockers')} el={builderEl('ready_blockers')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.blockers.map((blocker, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="icon-sm text-status-danger mt-0.5 shrink-0" />
                      {BUILDER_PREVIEW_HINT_EL[blocker]
                        ? <BilingualText en={blocker} el={BUILDER_PREVIEW_HINT_EL[blocker]} wrap />
                        : blocker}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          
          {data.nextMilestones.length > 0 && (
            <Card className={STATUS.success.border}>
              <CardHeader className="pb-3">
                <CardTitle className={cn("flex items-center gap-2", STATUS.success.text)}>
                  <CfbGlyph name="spark" className="icon-sm" />
                  <BilingualText en={builderEn('ready_next')} el={builderEl('ready_next')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.nextMilestones.map((milestone, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="icon-sm text-status-success mt-0.5 shrink-0" />
                      {BUILDER_PREVIEW_HINT_EL[milestone]
                        ? <BilingualText en={milestone} el={BUILDER_PREVIEW_HINT_EL[milestone]} wrap />
                        : milestone}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dimension Details */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.dimensions.map((dimension) => {
          const StatusIcon = getStatusIcon(dimension.status);
          const isExpanded = expandedDimension === dimension.id;
          
          return (
            <Card 
              key={dimension.id}
              className={cn(
                "cursor-pointer transition-all",
                isExpanded && "md:col-span-2 lg:col-span-3"
              )}
              onClick={() => setExpandedDimension(isExpanded ? null : dimension.id)}
            >
              {/* The keyboard/ARIA toggle lives on the header: a pressable
                  wrapper around the whole card would flatten the criterion
                  checkboxes it reveals when expanded. */}
              <CardHeader className="pb-3" {...pressableProps({ expanded: isExpanded })}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CfbGlyph name={dimension.glyph} className="icon-sm" />
                    <BilingualText
                      en={DIM_LABEL[dimension.id]?.en ?? dimension.name}
                      el={DIM_LABEL[dimension.id]?.el ?? dimension.name}
                      compact
                    />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(dimension.status)}>
                      {dimension.score}%
                    </Badge>
                    <StatusIcon className={cn(
                      "icon-sm",
                      readinessClasses(dimension.status).text
                    )} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={dimension.score} 
                  className={cn(
                    "h-2 mb-4",
                    READINESS_BAR[dimension.status]
                  )}
                />
                
                {isExpanded && (
                  <div className="space-y-3 mt-4">
                    {dimension.criteria.map(criterion => (
                      <div 
                        key={criterion.id}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCriterion(dimension.id, criterion.id);
                        }}
                        {...pressableProps({ role: 'checkbox', checked: criterion.completed })}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                          criterion.completed 
                            ? "bg-status-success-mark border-status-success" 
                            : "border-border"
                        )}>
                          {criterion.completed && (
                            <CheckCircle2 className="icon-sm text-ink" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "font-medium text-sm",
                              criterion.completed && "text-status-success"
                            )}>
                              <BilingualText
                                en={criterion.name}
                                el={CRITERION_EL[criterion.id]?.name ?? criterion.name}
                                compact
                              />
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {criterion.weight}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <BilingualText
                              en={criterion.description}
                              el={CRITERION_EL[criterion.id]?.description ?? criterion.description}
                              compact
                            />
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isExpanded && (
                  <div className="text-xs text-muted-foreground">
                    {dimension.criteria.filter((c) => c.completed).length} / {dimension.criteria.length}{' '}
                    <BilingualText en={builderEn('ready_criteria')} el={builderEl('ready_criteria')} compact />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
