'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Save, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import {
  BuilderStageHeader,
  BUILDER_BTN,
  BUILDER_STAT,
  BUILDER_SUBTAB_LIST,
  BUILDER_SUBTAB_TRIGGER,
  useAskInPlace,
  useBuilderPrimaryText,
} from './BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';
import { useToast } from '@/components/ui/toast';

export interface Competitor {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  marketShare: string;
}

export interface ICP {
  demographics: string;
  psychographics: string;
  painPoints: string[];
  buyingBehavior: string;
  decisionCriteria: string[];
  budget: string;
}

export interface Persona {
  name: string;
  role: string;
  goals: string[];
  frustrations: string[];
  quote: string;
}

export interface MarketTrend {
  trend: string;
  impact: 'positive' | 'negative' | 'neutral';
  timeframe: string;
  confidence: number;
}

export interface MarketData {
  tam: { value: string; description: string; sources: string };
  sam: { value: string; description: string; methodology: string };
  som: { value: string; description: string; assumptions: string };
  directCompetitors: Competitor[];
  indirectCompetitors: Competitor[];
  substitutes: string[];
  idealCustomerProfile: ICP;
  personas: Persona[];
  trends: MarketTrend[];
  entryBarriers: string[];
  regulations: string[];
  positioning: string;
  differentiators: string[];
  competitiveAdvantage: string;
}

interface MarketAnalysisProps {
  onSave?: (data: MarketData) => void | Promise<void>;
  onGenerate?: (data: MarketData) => Promise<Record<string, unknown> | null>;
  initialData?: unknown;
  contentRevision?: string;
}

const EMPTY_COMPETITOR: Competitor = {
  name: '',
  description: '',
  strengths: [],
  weaknesses: [],
  pricing: '',
  marketShare: '',
};

const EMPTY_ICP: ICP = {
  demographics: '',
  psychographics: '',
  painPoints: [],
  buyingBehavior: '',
  decisionCriteria: [],
  budget: '',
};

const EMPTY_PERSONA: Persona = {
  name: '',
  role: '',
  goals: [],
  frustrations: [],
  quote: '',
};

const EMPTY_TREND: MarketTrend = {
  trend: '',
  impact: 'neutral',
  timeframe: '',
  confidence: 50,
};

const EMPTY_MARKET: MarketData = {
  tam: { value: '', description: '', sources: '' },
  sam: { value: '', description: '', methodology: '' },
  som: { value: '', description: '', assumptions: '' },
  directCompetitors: [],
  indirectCompetitors: [],
  substitutes: [],
  idealCustomerProfile: { ...EMPTY_ICP },
  personas: [],
  trends: [],
  entryBarriers: [],
  regulations: [],
  positioning: '',
  differentiators: [],
  competitiveAdvantage: '',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim();
}

function pickSized<K extends 'sources' | 'methodology' | 'assumptions'>(
  raw: unknown,
  extraKey: K,
): { value: string; description: string } & Record<K, string> {
  const rec = asRecord(raw);
  const extra = rec ? str(rec[extraKey]) : '';
  return {
    value: rec ? str(rec.value) : '',
    description: rec ? str(rec.description) : '',
    [extraKey]: extra,
  } as { value: string; description: string } & Record<K, string>;
}

function pickCompetitor(raw: unknown): Competitor {
  const rec = asRecord(raw) ?? {};
  return {
    name: str(rec.name),
    description: str(rec.description),
    strengths: stringList(rec.strengths),
    weaknesses: stringList(rec.weaknesses),
    pricing: str(rec.pricing),
    marketShare: str(rec.marketShare),
  };
}

function competitorFilled(item: Competitor): boolean {
  return [
    item.name,
    item.description,
    item.pricing,
    item.marketShare,
    ...item.strengths,
    ...item.weaknesses,
  ].some((value) => value.trim());
}

function pickPersona(raw: unknown): Persona {
  const rec = asRecord(raw) ?? {};
  return {
    name: str(rec.name),
    role: str(rec.role),
    goals: stringList(rec.goals),
    frustrations: stringList(rec.frustrations),
    quote: str(rec.quote),
  };
}

function personaFilled(item: Persona): boolean {
  return [item.name, item.role, item.quote, ...item.goals, ...item.frustrations].some((value) => value.trim());
}

function pickTrend(raw: unknown): MarketTrend {
  const rec = asRecord(raw) ?? {};
  const impact =
    rec.impact === 'positive' || rec.impact === 'negative' || rec.impact === 'neutral'
      ? rec.impact
      : 'neutral';
  const confidence =
    typeof rec.confidence === 'number' && Number.isFinite(rec.confidence) ? rec.confidence : 50;
  return {
    trend: str(rec.trend),
    impact,
    timeframe: str(rec.timeframe),
    confidence,
  };
}

function trendFilled(item: MarketTrend): boolean {
  return Boolean(item.trend.trim() || item.timeframe.trim());
}

function pickIcp(raw: unknown): ICP {
  const rec = asRecord(raw);
  if (!rec) return { ...EMPTY_ICP };
  return {
    demographics: str(rec.demographics),
    psychographics: str(rec.psychographics),
    painPoints: stringList(rec.painPoints),
    buyingBehavior: str(rec.buyingBehavior),
    decisionCriteria: stringList(rec.decisionCriteria),
    budget: str(rec.budget),
  };
}

function looksLikeMarket(record: Record<string, unknown>): boolean {
  return Boolean(
    asRecord(record.tam)
    || asRecord(record.sam)
    || asRecord(record.som)
    || Array.isArray(record.directCompetitors)
    || Array.isArray(record.indirectCompetitors)
    || asRecord(record.idealCustomerProfile)
    || Array.isArray(record.personas)
    || Array.isArray(record.trends)
    || typeof record.positioning === 'string'
    || typeof record.competitiveAdvantage === 'string'
    || Array.isArray(record.differentiators)
    || Array.isArray(record.substitutes)
    || Array.isArray(record.entryBarriers)
    || Array.isArray(record.regulations),
  );
}

/** Preview stores Market flat; a save nests the same fields under `marketAnalysis`. */
export function pickMarket(raw: unknown): Partial<MarketData> {
  const root = asRecord(raw);
  if (!root) return {};
  const nested = asRecord(root.marketAnalysis);
  const source = nested && looksLikeMarket(nested) ? nested : root;
  const next: Partial<MarketData> = {};
  if (asRecord(source.tam)) next.tam = pickSized(source.tam, 'sources');
  if (asRecord(source.sam)) next.sam = pickSized(source.sam, 'methodology');
  if (asRecord(source.som)) next.som = pickSized(source.som, 'assumptions');
  if (Array.isArray(source.directCompetitors)) next.directCompetitors = source.directCompetitors.map(pickCompetitor);
  if (Array.isArray(source.indirectCompetitors)) next.indirectCompetitors = source.indirectCompetitors.map(pickCompetitor);
  if (Array.isArray(source.substitutes)) next.substitutes = stringList(source.substitutes);
  if (asRecord(source.idealCustomerProfile)) next.idealCustomerProfile = pickIcp(source.idealCustomerProfile);
  if (Array.isArray(source.personas)) next.personas = source.personas.map(pickPersona);
  if (Array.isArray(source.trends)) next.trends = source.trends.map(pickTrend);
  if (Array.isArray(source.entryBarriers)) next.entryBarriers = stringList(source.entryBarriers);
  if (Array.isArray(source.regulations)) next.regulations = stringList(source.regulations);
  if (typeof source.positioning === 'string') next.positioning = source.positioning;
  if (Array.isArray(source.differentiators)) next.differentiators = stringList(source.differentiators);
  if (typeof source.competitiveAdvantage === 'string') next.competitiveAdvantage = source.competitiveAdvantage;
  return next;
}

function hydrateMarket(raw: unknown): MarketData {
  const picked = pickMarket(raw);
  return {
    ...EMPTY_MARKET,
    ...picked,
    tam: { ...EMPTY_MARKET.tam, ...picked.tam },
    sam: { ...EMPTY_MARKET.sam, ...picked.sam },
    som: { ...EMPTY_MARKET.som, ...picked.som },
    idealCustomerProfile: { ...EMPTY_ICP, ...picked.idealCustomerProfile },
    directCompetitors: picked.directCompetitors ?? [],
    indirectCompetitors: picked.indirectCompetitors ?? [],
    substitutes: picked.substitutes ?? [],
    personas: picked.personas ?? [],
    trends: picked.trends ?? [],
    entryBarriers: picked.entryBarriers ?? [],
    regulations: picked.regulations ?? [],
    differentiators: picked.differentiators ?? [],
  };
}

function mergeSized<T extends Record<string, string>>(current: T, incoming: T | undefined): T {
  if (!incoming) return current;
  const next = { ...current };
  for (const key of Object.keys(current) as (keyof T)[]) {
    const value = incoming[key];
    if (typeof value === 'string' && isBlank(current[key] as string) && value.trim()) {
      next[key] = value;
    }
  }
  return next;
}

function mergeList<T>(current: T[], incoming: T[] | undefined, filled: (item: T) => boolean): T[] {
  if (!incoming?.some(filled)) return current;
  if (current.some(filled)) return current;
  return incoming;
}

function mergeStringList(current: string[], incoming: string[] | undefined): string[] {
  return mergeList(current, incoming, (item) => item.trim().length > 0);
}

function mergeIcp(current: ICP, incoming: ICP | undefined): ICP {
  if (!incoming) return current;
  return {
    demographics: isBlank(current.demographics) && incoming.demographics.trim() ? incoming.demographics : current.demographics,
    psychographics: isBlank(current.psychographics) && incoming.psychographics.trim() ? incoming.psychographics : current.psychographics,
    buyingBehavior: isBlank(current.buyingBehavior) && incoming.buyingBehavior.trim() ? incoming.buyingBehavior : current.buyingBehavior,
    budget: isBlank(current.budget) && incoming.budget.trim() ? incoming.budget : current.budget,
    painPoints: mergeStringList(current.painPoints, incoming.painPoints),
    decisionCriteria: mergeStringList(current.decisionCriteria, incoming.decisionCriteria),
  };
}

function mergeEmptyOnly(current: MarketData, incoming: Partial<MarketData>): MarketData {
  return {
    tam: mergeSized(current.tam, incoming.tam),
    sam: mergeSized(current.sam, incoming.sam),
    som: mergeSized(current.som, incoming.som),
    directCompetitors: mergeList(current.directCompetitors, incoming.directCompetitors, competitorFilled),
    indirectCompetitors: mergeList(current.indirectCompetitors, incoming.indirectCompetitors, competitorFilled),
    substitutes: mergeStringList(current.substitutes, incoming.substitutes),
    idealCustomerProfile: mergeIcp(current.idealCustomerProfile, incoming.idealCustomerProfile),
    personas: mergeList(current.personas, incoming.personas, personaFilled),
    trends: mergeList(current.trends, incoming.trends, trendFilled),
    entryBarriers: mergeStringList(current.entryBarriers, incoming.entryBarriers),
    regulations: mergeStringList(current.regulations, incoming.regulations),
    positioning: isBlank(current.positioning) && incoming.positioning?.trim() ? incoming.positioning : current.positioning,
    differentiators: mergeStringList(current.differentiators, incoming.differentiators),
    competitiveAdvantage:
      isBlank(current.competitiveAdvantage) && incoming.competitiveAdvantage?.trim()
        ? incoming.competitiveAdvantage
        : current.competitiveAdvantage,
  };
}

function marketEquals(a: MarketData, b: MarketData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function completionPercent(data: MarketData): number {
  const filled = [
    data.tam.value.trim(),
    data.sam.value.trim(),
    data.som.value.trim(),
    data.directCompetitors.some(competitorFilled) || data.indirectCompetitors.some(competitorFilled) ? 'yes' : '',
    data.idealCustomerProfile.demographics.trim(),
    data.personas.some(personaFilled) ? 'yes' : '',
    data.trends.some(trendFilled) ? 'yes' : '',
    data.positioning.trim(),
    data.differentiators.some((item) => item.trim()) ? 'yes' : '',
    data.competitiveAdvantage.trim(),
  ].filter((field) => field.length > 0).length;
  return (filled / 10) * 100;
}

/** The figure the stage header shows, stored on the document when it saves. */
export function marketCompletion(data: MarketData): number {
  return Math.round(completionPercent(data));
}

function assistPrompt(data: MarketData): string {
  const empty: string[] = [];
  if (isBlank(data.tam.value)) empty.push('TAM value');
  if (isBlank(data.sam.value)) empty.push('SAM value');
  if (isBlank(data.som.value)) empty.push('SOM value');
  if (!data.directCompetitors.some(competitorFilled)) empty.push('direct competitors');
  if (!data.indirectCompetitors.some(competitorFilled)) empty.push('indirect competitors');
  if (isBlank(data.idealCustomerProfile.demographics)) empty.push('ICP demographics');
  if (!data.personas.some(personaFilled)) empty.push('personas');
  if (!data.trends.some(trendFilled)) empty.push('trends');
  if (isBlank(data.positioning)) empty.push('positioning');
  if (!data.differentiators.some((item) => item.trim())) empty.push('differentiators');
  if (isBlank(data.competitiveAdvantage)) empty.push('competitive advantage');
  const focus = empty.length ? empty.join(', ') : 'the weakest line';
  return [
    'Help me complete Market Analysis in Startup Builder. Draft only empty fields; keep what I already wrote.',
    `Empty first: ${focus}.`,
    `TAM: ${data.tam?.value || '(empty)'} — ${data.tam?.description || '(no description)'}`,
    `SAM: ${data.sam?.value || '(empty)'} — ${data.sam?.description || '(no description)'}`,
    `SOM: ${data.som?.value || '(empty)'} — ${data.som?.description || '(no description)'}`,
    `Direct competitors: ${data.directCompetitors.filter(competitorFilled).map((item) => item.name).join('; ') || '(empty)'}`,
    `Indirect competitors: ${data.indirectCompetitors.filter(competitorFilled).map((item) => item.name).join('; ') || '(empty)'}`,
    `ICP: ${data.idealCustomerProfile?.demographics || '(empty)'}`,
    `Positioning: ${data.positioning || '(empty)'}`,
  ].join('\n');
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0 rounded-xl"
      onClick={onClick}
      aria-label={bilingualAria(builderEn('remove'), builderEl('remove'))}
    >
      <X className="icon-sm" />
    </Button>
  );
}

export function MarketAnalysis({ onSave, onGenerate, initialData, contentRevision }: MarketAnalysisProps) {
  const t = useBuilderPrimaryText();
  const askInPlace = useAskInPlace();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<MarketData>(() => hydrateMarket(initialData));
  const [activeTab, setActiveTab] = useState('market-size');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setData(hydrateMarket(initialData));
    // Reload when the document version changes (save / restore), not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRevision]);

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const incoming = await onGenerate?.(data);
      if (incoming) {
        const merged = mergeEmptyOnly(data, pickMarket(incoming));
        if (marketEquals(data, merged)) {
          success('Nothing to change');
        } else {
          setData(merged);
        }
        return;
      }
      askInPlace(assistPrompt(data));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(data);
      success('Saved');
    } catch {
      toastError('Could not save');
    } finally {
      setIsSaving(false);
    }
  };

  const addCompetitor = (type: 'direct' | 'indirect') => {
    const key = type === 'direct' ? 'directCompetitors' : 'indirectCompetitors';
    setData((prev) => ({ ...prev, [key]: [...prev[key], { ...EMPTY_COMPETITOR }] }));
  };

  const updateCompetitor = (
    type: 'direct' | 'indirect',
    index: number,
    field: keyof Competitor,
    value: Competitor[keyof Competitor],
  ) => {
    const key = type === 'direct' ? 'directCompetitors' : 'indirectCompetitors';
    setData((prev) => ({
      ...prev,
      [key]: prev[key].map((comp, i) => (i === index ? { ...comp, [field]: value } : comp)),
    }));
  };

  const removeCompetitor = (type: 'direct' | 'indirect', index: number) => {
    const key = type === 'direct' ? 'directCompetitors' : 'indirectCompetitors';
    setData((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const renderCompetitorList = (
    type: 'direct' | 'indirect',
    items: Competitor[],
    emptyKey: 'mkt_no_comp' | 'mkt_no_indirect',
  ) => (
    <CardContent className="space-y-4">
      {items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <CfbGlyph name="shield" className="icon-xl mx-auto mb-2 opacity-50" />
          <p className="text-xs leading-snug">
            <BilingualText en={builderEn(emptyKey)} el={builderEl(emptyKey)} />
          </p>
        </div>
      ) : (
        items.map((competitor, index) => (
          <Card key={`${type}-${index}`} className="p-4">
            <div className="mb-3 flex justify-end">
              <RemoveButton onClick={() => removeCompetitor(type, index)} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`mkt-${type}-name-${index}`}>
                  <BilingualText en={builderEn('mkt_name')} el={builderEl('mkt_name')} compact />
                </Label>
                <Input
                  id={`mkt-${type}-name-${index}`}
                  value={competitor.name}
                  onChange={(e) => updateCompetitor(type, index, 'name', e.target.value)}
                  placeholder={t(builderEn('mkt_ph_comp_name'), builderEl('mkt_ph_comp_name'))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`mkt-${type}-share-${index}`}>
                  <BilingualText en={builderEn('mkt_share')} el={builderEl('mkt_share')} compact />
                </Label>
                <Input
                  id={`mkt-${type}-share-${index}`}
                  value={competitor.marketShare}
                  onChange={(e) => updateCompetitor(type, index, 'marketShare', e.target.value)}
                  placeholder={t(builderEn('mkt_ph_share'), builderEl('mkt_ph_share'))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`mkt-${type}-desc-${index}`}>
                  <BilingualText en={builderEn('mkt_desc')} el={builderEl('mkt_desc')} compact />
                </Label>
                <Textarea
                  id={`mkt-${type}-desc-${index}`}
                  value={competitor.description}
                  onChange={(e) => updateCompetitor(type, index, 'description', e.target.value)}
                  placeholder={t(builderEn('mkt_ph_desc'), builderEl('mkt_ph_desc'))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`mkt-${type}-pricing-${index}`}>
                  <BilingualText en={builderEn('mkt_pricing')} el={builderEl('mkt_pricing')} compact />
                </Label>
                <Input
                  id={`mkt-${type}-pricing-${index}`}
                  value={competitor.pricing}
                  onChange={(e) => updateCompetitor(type, index, 'pricing', e.target.value)}
                  placeholder={t(builderEn('mkt_ph_pricing'), builderEl('mkt_ph_pricing'))}
                  className="rounded-xl"
                />
              </div>
            </div>
          </Card>
        ))
      )}
    </CardContent>
  );

  return (
    <div className="space-y-6">
      <BuilderStageHeader
        glyph="chart"
        titleEn={builderEn('tab_market')}
        titleEl={builderEl('tab_market')}
        subtitleEn={builderEn('mkt_sub')}
        subtitleEl={builderEl('mkt_sub')}
        hideTitle
        completion={completionPercent(data)}
        askPrompt={assistPrompt(data)}
        extraActions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={BUILDER_BTN}
              onClick={() => void generateWithAI()}
              disabled={isGenerating || isSaving}
            >
              {isGenerating ? (
                <RefreshCw className="icon-sm mr-2 animate-spin" />
              ) : (
                <CfbGlyph name="spark" className="icon-sm mr-2" />
              )}
              <BilingualText
                en={isGenerating ? builderEn('generating') : builderEn('ai_generate')}
                el={isGenerating ? builderEl('generating') : builderEl('ai_generate')}
                compact
              />
            </Button>
            <Button
              type="button"
              size="sm"
              className={BUILDER_BTN}
              onClick={() => void handleSave()}
              disabled={isSaving || isGenerating}
            >
              {isSaving ? (
                <RefreshCw className="icon-sm mr-2 animate-spin" />
              ) : (
                <Save className="icon-sm mr-2" />
              )}
              <BilingualText en={builderEn('save')} el={builderEl('save')} compact />
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={BUILDER_SUBTAB_LIST}>
          <TabsTrigger value="market-size" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="chart" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mkt_tab_size')} el={builderEl('mkt_tab_size')} compact />
          </TabsTrigger>
          <TabsTrigger value="competitors" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="shield" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mkt_tab_comp')} el={builderEl('mkt_tab_comp')} compact />
          </TabsTrigger>
          <TabsTrigger value="customers" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="people" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mkt_tab_cust')} el={builderEl('mkt_tab_cust')} compact />
          </TabsTrigger>
          <TabsTrigger value="trends" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="flag" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mkt_tab_trends')} el={builderEl('mkt_tab_trends')} compact />
          </TabsTrigger>
          <TabsTrigger value="positioning" className={BUILDER_SUBTAB_TRIGGER}>
            <CfbGlyph name="target" className="icon-sm shrink-0" />
            <BilingualText en={builderEn('mkt_tab_pos')} el={builderEl('mkt_tab_pos')} compact />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market-size" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CfbGlyph name="discover" className="icon-sm text-status-info" />
                  <BilingualText en={builderEn('mkt_tam')} el={builderEl('mkt_tam')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-tam-value">
                    <BilingualText en={builderEn('mkt_value')} el={builderEl('mkt_value')} compact />
                  </Label>
                  <Input
                    id="mkt-tam-value"
                    placeholder={t(builderEn('mkt_ph_value'), builderEl('mkt_ph_value'))}
                    value={data.tam.value}
                    onChange={(e) => setData((prev) => ({ ...prev, tam: { ...prev.tam, value: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-tam-desc">
                    <BilingualText en={builderEn('mkt_desc')} el={builderEl('mkt_desc')} compact />
                  </Label>
                  <Textarea
                    id="mkt-tam-desc"
                    placeholder={t(builderEn('mkt_ph_tam'), builderEl('mkt_ph_tam'))}
                    value={data.tam.description}
                    onChange={(e) => setData((prev) => ({ ...prev, tam: { ...prev.tam, description: e.target.value } }))}
                    className="min-h-[80px] rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-tam-sources">
                    <BilingualText en={builderEn('mkt_sources')} el={builderEl('mkt_sources')} compact />
                  </Label>
                  <Input
                    id="mkt-tam-sources"
                    placeholder={t(builderEn('mkt_ph_sources'), builderEl('mkt_ph_sources'))}
                    value={data.tam.sources}
                    onChange={(e) => setData((prev) => ({ ...prev, tam: { ...prev.tam, sources: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CfbGlyph name="target" className="icon-sm text-status-success" />
                  <BilingualText en={builderEn('mkt_sam')} el={builderEl('mkt_sam')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-sam-value">
                    <BilingualText en={builderEn('mkt_value')} el={builderEl('mkt_value')} compact />
                  </Label>
                  <Input
                    id="mkt-sam-value"
                    placeholder={t(builderEn('mkt_ph_value'), builderEl('mkt_ph_value'))}
                    value={data.sam.value}
                    onChange={(e) => setData((prev) => ({ ...prev, sam: { ...prev.sam, value: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-sam-desc">
                    <BilingualText en={builderEn('mkt_desc')} el={builderEl('mkt_desc')} compact />
                  </Label>
                  <Textarea
                    id="mkt-sam-desc"
                    placeholder={t(builderEn('mkt_ph_sam'), builderEl('mkt_ph_sam'))}
                    value={data.sam.description}
                    onChange={(e) => setData((prev) => ({ ...prev, sam: { ...prev.sam, description: e.target.value } }))}
                    className="min-h-[80px] rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-sam-method">
                    <BilingualText en={builderEn('mkt_method')} el={builderEl('mkt_method')} compact />
                  </Label>
                  <Input
                    id="mkt-sam-method"
                    placeholder={t(builderEn('mkt_ph_method'), builderEl('mkt_ph_method'))}
                    value={data.sam.methodology}
                    onChange={(e) => setData((prev) => ({ ...prev, sam: { ...prev.sam, methodology: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CfbGlyph name="flag" className="icon-sm text-status-warning" />
                  <BilingualText en={builderEn('mkt_som')} el={builderEl('mkt_som')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-som-value">
                    <BilingualText en={builderEn('mkt_value')} el={builderEl('mkt_value')} compact />
                  </Label>
                  <Input
                    id="mkt-som-value"
                    placeholder={t(builderEn('mkt_ph_value'), builderEl('mkt_ph_value'))}
                    value={data.som.value}
                    onChange={(e) => setData((prev) => ({ ...prev, som: { ...prev.som, value: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-som-desc">
                    <BilingualText en={builderEn('mkt_desc')} el={builderEl('mkt_desc')} compact />
                  </Label>
                  <Textarea
                    id="mkt-som-desc"
                    placeholder={t(builderEn('mkt_ph_som'), builderEl('mkt_ph_som'))}
                    value={data.som.description}
                    onChange={(e) => setData((prev) => ({ ...prev, som: { ...prev.som, description: e.target.value } }))}
                    className="min-h-[80px] rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-som-assumptions">
                    <BilingualText en={builderEn('mkt_assumptions')} el={builderEl('mkt_assumptions')} compact />
                  </Label>
                  <Input
                    id="mkt-som-assumptions"
                    placeholder={t(builderEn('mkt_ph_assumptions'), builderEl('mkt_ph_assumptions'))}
                    value={data.som.assumptions}
                    onChange={(e) => setData((prev) => ({ ...prev, som: { ...prev.som, assumptions: e.target.value } }))}
                    className="rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {(data.tam?.value || data.sam?.value || data.som?.value) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={builderEn('mkt_overview')} el={builderEl('mkt_overview')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-end justify-center gap-8">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex w-32 items-end justify-center rounded-t-xl border-2 border-status-info bg-status-info-bg"
                      style={{ height: '160px' }}
                    >
                      <span className={cn(BUILDER_STAT, 'mb-2 text-status-info')}>{data.tam?.value || '—'}</span>
                    </div>
                    <span className="mt-2 text-sm font-medium">TAM</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="flex w-32 items-end justify-center rounded-t-xl border-2 border-status-success bg-status-success-bg"
                      style={{ height: '100px' }}
                    >
                      <span className={cn(BUILDER_STAT, 'mb-2 text-status-success')}>{data.sam?.value || '—'}</span>
                    </div>
                    <span className="mt-2 text-sm font-medium">SAM</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="flex w-32 items-end justify-center rounded-t-xl border-2 border-status-warning bg-status-warning-bg"
                      style={{ height: '40px' }}
                    >
                      <span className={cn(BUILDER_STAT, 'mb-2 text-status-warning')}>{data.som?.value || '—'}</span>
                    </div>
                    <span className="mt-2 text-sm font-medium">SOM</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mkt_direct')} el={builderEl('mkt_direct')} compact />
              </CardTitle>
              <Button type="button" variant="outline" size="sm" className={BUILDER_BTN} onClick={() => addCompetitor('direct')}>
                <BilingualText en={builderEn('mkt_add_comp')} el={builderEl('mkt_add_comp')} compact />
              </Button>
            </CardHeader>
            {renderCompetitorList('direct', data.directCompetitors, 'mkt_no_comp')}
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mkt_indirect')} el={builderEl('mkt_indirect')} compact />
              </CardTitle>
              <Button type="button" variant="outline" size="sm" className={BUILDER_BTN} onClick={() => addCompetitor('indirect')}>
                <BilingualText en={builderEn('mkt_add_comp')} el={builderEl('mkt_add_comp')} compact />
              </Button>
            </CardHeader>
            {renderCompetitorList('indirect', data.indirectCompetitors, 'mkt_no_indirect')}
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="people" className="icon-sm" />
                <BilingualText en={builderEn('mkt_icp')} el={builderEl('mkt_icp')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-icp-demo">
                    <BilingualText en={builderEn('mkt_demo')} el={builderEl('mkt_demo')} compact />
                  </Label>
                  <Textarea
                    id="mkt-icp-demo"
                    placeholder={t(builderEn('mkt_ph_demo'), builderEl('mkt_ph_demo'))}
                    value={data.idealCustomerProfile.demographics}
                    onChange={(e) => setData((prev) => ({
                      ...prev,
                      idealCustomerProfile: { ...prev.idealCustomerProfile, demographics: e.target.value },
                    }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-icp-psycho">
                    <BilingualText en={builderEn('mkt_psycho')} el={builderEl('mkt_psycho')} compact />
                  </Label>
                  <Textarea
                    id="mkt-icp-psycho"
                    placeholder={t(builderEn('mkt_ph_psycho'), builderEl('mkt_ph_psycho'))}
                    value={data.idealCustomerProfile.psychographics}
                    onChange={(e) => setData((prev) => ({
                      ...prev,
                      idealCustomerProfile: { ...prev.idealCustomerProfile, psychographics: e.target.value },
                    }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-icp-buying">
                    <BilingualText en={builderEn('mkt_buying')} el={builderEl('mkt_buying')} compact />
                  </Label>
                  <Textarea
                    id="mkt-icp-buying"
                    placeholder={t(builderEn('mkt_ph_buying'), builderEl('mkt_ph_buying'))}
                    value={data.idealCustomerProfile.buyingBehavior}
                    onChange={(e) => setData((prev) => ({
                      ...prev,
                      idealCustomerProfile: { ...prev.idealCustomerProfile, buyingBehavior: e.target.value },
                    }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-icp-budget">
                    <BilingualText en={builderEn('mkt_budget')} el={builderEl('mkt_budget')} compact />
                  </Label>
                  <Input
                    id="mkt-icp-budget"
                    placeholder={t(builderEn('mkt_ph_budget'), builderEl('mkt_ph_budget'))}
                    value={data.idealCustomerProfile.budget}
                    onChange={(e) => setData((prev) => ({
                      ...prev,
                      idealCustomerProfile: { ...prev.idealCustomerProfile, budget: e.target.value },
                    }))}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mkt_personas')} el={builderEl('mkt_personas')} compact />
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={BUILDER_BTN}
                onClick={() => setData((prev) => ({ ...prev, personas: [...prev.personas, { ...EMPTY_PERSONA }] }))}
              >
                <BilingualText en={builderEn('mkt_add_persona')} el={builderEl('mkt_add_persona')} compact />
              </Button>
            </CardHeader>
            <CardContent>
              {data.personas.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CfbGlyph name="people" className="icon-xl mx-auto mb-2 opacity-50" />
                  <p className="text-xs leading-snug">
                    <BilingualText en={builderEn('mkt_no_persona')} el={builderEl('mkt_no_persona')} />
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {data.personas.map((persona, index) => (
                    <Card key={`persona-${index}`} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <RemoveButton
                            onClick={() => setData((prev) => ({
                              ...prev,
                              personas: prev.personas.filter((_, i) => i !== index),
                            }))}
                          />
                        </div>
                        <Input
                          placeholder={t(builderEn('mkt_ph_persona_name'), builderEl('mkt_ph_persona_name'))}
                          value={persona.name}
                          onChange={(e) => {
                            const personas = [...data.personas];
                            personas[index] = { ...persona, name: e.target.value };
                            setData((prev) => ({ ...prev, personas }));
                          }}
                          className="rounded-xl"
                        />
                        <Input
                          placeholder={t(builderEn('mkt_ph_role'), builderEl('mkt_ph_role'))}
                          value={persona.role}
                          onChange={(e) => {
                            const personas = [...data.personas];
                            personas[index] = { ...persona, role: e.target.value };
                            setData((prev) => ({ ...prev, personas }));
                          }}
                          className="rounded-xl"
                        />
                        <Textarea
                          placeholder={t(builderEn('mkt_ph_quote'), builderEl('mkt_ph_quote'))}
                          value={persona.quote}
                          onChange={(e) => {
                            const personas = [...data.personas];
                            personas[index] = { ...persona, quote: e.target.value };
                            setData((prev) => ({ ...prev, personas }));
                          }}
                          className="rounded-xl"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <BilingualText en={builderEn('mkt_trends')} el={builderEl('mkt_trends')} compact />
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={BUILDER_BTN}
                onClick={() => setData((prev) => ({ ...prev, trends: [...prev.trends, { ...EMPTY_TREND }] }))}
              >
                <BilingualText en={builderEn('mkt_add_trend')} el={builderEl('mkt_add_trend')} compact />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.trends.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CfbGlyph name="chart" className="icon-xl mx-auto mb-2 opacity-50" />
                  <p className="text-xs leading-snug">
                    <BilingualText en={builderEn('mkt_no_trend')} el={builderEl('mkt_no_trend')} />
                  </p>
                </div>
              ) : (
                data.trends.map((trend, index) => (
                  <div key={`trend-${index}`} className="flex items-center gap-4 rounded-xl border p-4">
                    <div
                      className={cn(
                        'h-3 w-3 shrink-0 rounded-full',
                        trend.impact === 'positive' ? 'bg-status-success-mark' :
                          trend.impact === 'negative' ? 'bg-status-danger-mark' : 'bg-status-warning-mark',
                      )}
                    />
                    <div className="flex-1">
                      <Input
                        placeholder={t(builderEn('mkt_ph_trend'), builderEl('mkt_ph_trend'))}
                        value={trend.trend}
                        onChange={(e) => {
                          const trends = [...data.trends];
                          trends[index] = { ...trend, trend: e.target.value };
                          setData((prev) => ({ ...prev, trends }));
                        }}
                        className="rounded-xl"
                      />
                    </div>
                    <select
                      value={trend.impact}
                      aria-label={bilingualAria(builderEn('mkt_impact'), builderEl('mkt_impact'))}
                      onChange={(e) => {
                        const trends = [...data.trends];
                        trends[index] = { ...trend, impact: e.target.value as MarketTrend['impact'] };
                        setData((prev) => ({ ...prev, trends }));
                      }}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="positive">{t(builderEn('mkt_positive'), builderEl('mkt_positive'))}</option>
                      <option value="negative">{t(builderEn('mkt_negative'), builderEl('mkt_negative'))}</option>
                      <option value="neutral">{t(builderEn('mkt_neutral'), builderEl('mkt_neutral'))}</option>
                    </select>
                    <Input
                      placeholder={t(builderEn('mkt_timeframe'), builderEl('mkt_timeframe'))}
                      value={trend.timeframe}
                      onChange={(e) => {
                        const trends = [...data.trends];
                        trends[index] = { ...trend, timeframe: e.target.value };
                        setData((prev) => ({ ...prev, trends }));
                      }}
                      className="w-32 rounded-xl"
                    />
                    <RemoveButton
                      onClick={() => setData((prev) => ({
                        ...prev,
                        trends: prev.trends.filter((_, i) => i !== index),
                      }))}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positioning" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={builderEn('mkt_positioning')} el={builderEl('mkt_positioning')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-positioning">
                    <BilingualText en={builderEn('mkt_pos_stmt')} el={builderEl('mkt_pos_stmt')} compact />
                  </Label>
                  <Textarea
                    id="mkt-positioning"
                    placeholder={t(builderEn('mkt_ph_pos'), builderEl('mkt_ph_pos'))}
                    value={data.positioning}
                    onChange={(e) => setData((prev) => ({ ...prev, positioning: e.target.value }))}
                    className="min-h-[120px] rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mkt-advantage">
                    <BilingualText en={builderEn('mkt_advantage')} el={builderEl('mkt_advantage')} compact />
                  </Label>
                  <Textarea
                    id="mkt-advantage"
                    placeholder={t(builderEn('mkt_ph_adv'), builderEl('mkt_ph_adv'))}
                    value={data.competitiveAdvantage}
                    onChange={(e) => setData((prev) => ({ ...prev, competitiveAdvantage: e.target.value }))}
                    className="min-h-[100px] rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={builderEn('mkt_diffs')} el={builderEl('mkt_diffs')} compact />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.differentiators.map((diff, index) => (
                  <div key={`diff-${index}`} className="flex items-center gap-2">
                    <CheckCircle2 className="icon-sm shrink-0 text-status-success" />
                    <Input
                      value={diff}
                      onChange={(e) => {
                        const differentiators = [...data.differentiators];
                        differentiators[index] = e.target.value;
                        setData((prev) => ({ ...prev, differentiators }));
                      }}
                      placeholder={t(builderEn('mkt_ph_diff'), builderEl('mkt_ph_diff'))}
                      className="rounded-xl"
                    />
                    <RemoveButton
                      onClick={() => setData((prev) => ({
                        ...prev,
                        differentiators: prev.differentiators.filter((_, i) => i !== index),
                      }))}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`w-full ${BUILDER_BTN}`}
                  onClick={() => setData((prev) => ({
                    ...prev,
                    differentiators: [...prev.differentiators, ''],
                  }))}
                >
                  <BilingualText en={builderEn('mkt_add_diff')} el={builderEl('mkt_add_diff')} compact />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
