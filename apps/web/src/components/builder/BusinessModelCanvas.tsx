'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BuilderStageHeader, BUILDER_BTN, BUILDER_STAT, BUILDER_STAT_LABEL, useAskInPlace, useBuilderPrimaryText } from './BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';
import { useToast } from '@/components/ui/toast';

interface BMCSection {
  id: keyof BMCData;
  titleKey: 'bmc_partners' | 'bmc_activities' | 'bmc_resources' | 'bmc_value' | 'bmc_rel' | 'bmc_channels' | 'bmc_segments' | 'bmc_costs' | 'bmc_revenue';
  descKey: 'bmc_partners_desc' | 'bmc_activities_desc' | 'bmc_resources_desc' | 'bmc_value_desc' | 'bmc_rel_desc' | 'bmc_channels_desc' | 'bmc_segments_desc' | 'bmc_costs_desc' | 'bmc_revenue_desc';
  glyph: CfbGlyphName;
}

export interface BMCData {
  keyPartners: string;
  keyActivities: string;
  keyResources: string;
  valuePropositions: string;
  customerRelationships: string;
  channels: string;
  customerSegments: string;
  costStructure: string;
  revenueStreams: string;
}

interface BusinessModelCanvasProps {
  onSave?: (data: BMCData) => void | Promise<void>;
  onGenerate?: (data: BMCData) => Promise<Record<string, unknown> | null>;
  initialData?: unknown;
  contentRevision?: string;
}

const BMC_KEYS: (keyof BMCData)[] = [
  'keyPartners',
  'keyActivities',
  'keyResources',
  'valuePropositions',
  'customerRelationships',
  'channels',
  'customerSegments',
  'costStructure',
  'revenueStreams',
];

const BMC_SECTIONS: BMCSection[] = [
  { id: 'keyPartners', titleKey: 'bmc_partners', descKey: 'bmc_partners_desc', glyph: 'people' },
  { id: 'keyActivities', titleKey: 'bmc_activities', descKey: 'bmc_activities_desc', glyph: 'flag' },
  { id: 'keyResources', titleKey: 'bmc_resources', descKey: 'bmc_resources_desc', glyph: 'briefcase' },
  { id: 'valuePropositions', titleKey: 'bmc_value', descKey: 'bmc_value_desc', glyph: 'spark' },
  { id: 'customerRelationships', titleKey: 'bmc_rel', descKey: 'bmc_rel_desc', glyph: 'messages' },
  { id: 'channels', titleKey: 'bmc_channels', descKey: 'bmc_channels_desc', glyph: 'discover' },
  { id: 'customerSegments', titleKey: 'bmc_segments', descKey: 'bmc_segments_desc', glyph: 'profile' },
  { id: 'costStructure', titleKey: 'bmc_costs', descKey: 'bmc_costs_desc', glyph: 'wallet' },
  { id: 'revenueStreams', titleKey: 'bmc_revenue', descKey: 'bmc_revenue_desc', glyph: 'chart' },
];

const EMPTY_BMC: BMCData = {
  keyPartners: '',
  keyActivities: '',
  keyResources: '',
  valuePropositions: '',
  customerRelationships: '',
  channels: '',
  customerSegments: '',
  costStructure: '',
  revenueStreams: '',
};

/** Preview seed uses `valueProposition`; a save nests the form under `bmc`. */
const BMC_ALIASES: Partial<Record<keyof BMCData, string[]>> = {
  valuePropositions: ['valueProposition', 'value_proposition'],
};

/** Classic Osterwalder canvas. Named areas — not three stretched columns
 *  of `h-full` cards, which overlapped the insights strip below. */
const BMC_AREA: Record<keyof BMCData, string> = {
  keyPartners: 'lg:[grid-area:partners]',
  keyActivities: 'lg:[grid-area:activities]',
  keyResources: 'lg:[grid-area:resources]',
  valuePropositions: 'lg:[grid-area:value]',
  customerRelationships: 'lg:[grid-area:rel]',
  channels: 'lg:[grid-area:channels]',
  customerSegments: 'lg:[grid-area:segments]',
  costStructure: 'lg:[grid-area:costs]',
  revenueStreams: 'lg:[grid-area:revenue]',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readField(source: Record<string, unknown>, key: keyof BMCData): string | undefined {
  if (typeof source[key] === 'string') return source[key] as string;
  for (const alias of BMC_ALIASES[key] ?? []) {
    if (typeof source[alias] === 'string') return source[alias] as string;
  }
  return undefined;
}

function looksLikeBmc(record: Record<string, unknown>): boolean {
  return BMC_KEYS.some((key) => typeof record[key] === 'string')
    || typeof record.valueProposition === 'string';
}

export function pickBmc(raw: unknown): Partial<BMCData> {
  const root = asRecord(raw);
  if (!root) return {};
  const nested = asRecord(root.bmc);
  const source = nested && looksLikeBmc(nested) ? nested : root;
  const next: Partial<BMCData> = {};
  for (const key of BMC_KEYS) {
    const value = readField(source, key);
    if (typeof value === 'string') next[key] = value;
  }
  return next;
}

function hydrateBmc(raw: unknown): BMCData {
  return { ...EMPTY_BMC, ...pickBmc(raw) };
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim();
}

function mergeEmptyOnly(current: BMCData, incoming: Partial<BMCData>): BMCData {
  const next = { ...current };
  for (const key of BMC_KEYS) {
    const value = incoming[key];
    if (typeof value === 'string' && isBlank(current[key]) && value.trim()) {
      next[key] = value;
    }
  }
  return next;
}

function bmcEquals(a: BMCData, b: BMCData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function completionPercent(data: BMCData): number {
  const filled = BMC_KEYS.filter((key) => data[key].trim().length > 0).length;
  return (filled / BMC_KEYS.length) * 100;
}

/** The figure the stage header shows, stored on the document when it saves. */
export function bmcCompletion(data: BMCData): number {
  return Math.round(completionPercent(data));
}

type Confidence = 'high' | 'medium' | 'low';

function getConfidenceLevel(content: string): Confidence {
  if (content.length === 0) return 'low';
  if (content.length < 50) return 'medium';
  return 'high';
}

function getConfidenceColor(level: Confidence): string {
  switch (level) {
    case 'high':
      return 'bg-status-success-mark';
    case 'medium':
      return 'bg-status-warning-mark';
    default:
      return 'bg-muted-foreground/30';
  }
}

function assistPrompt(data: BMCData): string {
  const empty = BMC_SECTIONS
    .filter((section) => isBlank(data[section.id]))
    .map((section) => builderEn(section.titleKey));
  const focus = empty.length ? empty.join(', ') : 'the weakest cell';
  return [
    'Help me complete the Business Model Canvas in Startup Builder. Draft only empty cells; keep what I already wrote.',
    `Empty first: ${focus}.`,
    ...BMC_SECTIONS.map((section) => `${builderEn(section.titleKey)}: ${data[section.id].trim() || '(empty)'}`),
  ].join('\n');
}

export function BusinessModelCanvas({ onSave, onGenerate, initialData, contentRevision }: BusinessModelCanvasProps) {
  const t = useBuilderPrimaryText();
  const askInPlace = useAskInPlace();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<BMCData>(() => hydrateBmc(initialData));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setData(hydrateBmc(initialData));
    // Reload when the document version changes (save / restore), not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRevision]);

  const handleSectionChange = (sectionId: keyof BMCData, content: string) => {
    setData((prev) => ({ ...prev, [sectionId]: content }));
  };

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const incoming = await onGenerate?.(data);
      if (incoming) {
        const merged = mergeEmptyOnly(data, pickBmc(incoming));
        if (bmcEquals(data, merged)) {
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

  const renderSection = (section: BMCSection) => {
    const content = data[section.id];
    const confidence = getConfidenceLevel(content);
    const confKey = confidence === 'high' ? 'bmc_conf_high' : confidence === 'medium' ? 'bmc_conf_medium' : 'bmc_conf_low';
    const fieldId = `bmc-${section.id}`;
    return (
      <Card
        key={section.id}
        className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', BMC_AREA[section.id])}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <CfbGlyph name={section.glyph} className="icon-sm shrink-0 text-muted-foreground" />
              <CardTitle id={`${fieldId}-label`} className="truncate">
                <BilingualText en={builderEn(section.titleKey)} el={builderEl(section.titleKey)} compact />
              </CardTitle>
            </div>
            <div
              className={cn('h-2 w-2 shrink-0 rounded-full', getConfidenceColor(confidence))}
              title={bilingualAria(builderEn(confKey), builderEl(confKey))}
              aria-label={bilingualAria(builderEn(confKey), builderEl(confKey))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <BilingualText en={builderEn(section.descKey)} el={builderEl(section.descKey)} />
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col pt-0">
          <Textarea
            id={fieldId}
            aria-labelledby={`${fieldId}-label`}
            placeholder={t(builderEn('bmc_describe'), builderEl('bmc_describe'))}
            value={content}
            onChange={(e) => handleSectionChange(section.id, e.target.value)}
            className="min-h-[80px] flex-1 resize-none rounded-xl"
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <BuilderStageHeader
        glyph="target"
        titleEn={builderEn('bmc_title')}
        titleEl={builderEl('bmc_title')}
        subtitleEn={builderEn('bmc_sub')}
        subtitleEl={builderEl('bmc_sub')}
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
              <BilingualText en={builderEn('bmc_save')} el={builderEl('bmc_save')} compact />
            </Button>
          </>
        }
      />

      <div
        className={cn(
          'grid grid-cols-1 gap-3',
          'lg:grid-cols-5 lg:grid-rows-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(10rem,auto)]',
          "lg:[grid-template-areas:'partners_activities_value_rel_segments'_'partners_resources_value_channels_segments'_'costs_costs_costs_revenue_revenue']",
        )}
      >
        {BMC_SECTIONS.map(renderSection)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CfbGlyph name="chart" className="icon-sm" />
            <BilingualText en={builderEn('bmc_insights')} el={builderEl('bmc_insights')} compact />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className={cn(BUILDER_STAT, STATUS.info.text)}>
                {BMC_KEYS.filter((key) => getConfidenceLevel(data[key]) === 'high').length}
              </div>
              <div className={BUILDER_STAT_LABEL}>
                <BilingualText en={builderEn('bmc_well')} el={builderEl('bmc_well')} compact />
              </div>
            </div>
            <div className="text-center">
              <div className={cn(BUILDER_STAT, STATUS.warning.text)}>
                {BMC_KEYS.filter((key) => getConfidenceLevel(data[key]) === 'medium').length}
              </div>
              <div className={BUILDER_STAT_LABEL}>
                <BilingualText en={builderEn('bmc_refine')} el={builderEl('bmc_refine')} compact />
              </div>
            </div>
            <div className="text-center">
              <div className={cn(BUILDER_STAT, STATUS.danger.text)}>
                {BMC_KEYS.filter((key) => getConfidenceLevel(data[key]) === 'low').length}
              </div>
              <div className={BUILDER_STAT_LABEL}>
                <BilingualText en={builderEn('bmc_missing')} el={builderEl('bmc_missing')} compact />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
