'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, RefreshCw, X } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { BUILDER_BTN, BuilderStageHeader, useAskInPlace, useBuilderPrimaryText } from './BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';
import { useToast } from '@/components/ui/toast';

export interface IdeaCoreData {
  problemStatement: string;
  targetAudience: string;
  solution: string;
  uniqueValue: string;
  timing: string;
  assumptions: string[];
  painPoints: string[];
  marketSize: string;
}

interface IdeaCoreProps {
  onSave?: (data: IdeaCoreData) => void | Promise<void>;
  onGenerate?: (data: IdeaCoreData) => Promise<Record<string, unknown> | null>;
  initialData?: unknown;
  contentRevision?: string;
}

const EMPTY_IDEA: IdeaCoreData = {
  problemStatement: '',
  targetAudience: '',
  solution: '',
  uniqueValue: '',
  timing: '',
  assumptions: [],
  painPoints: [],
  marketSize: '',
};

const SCALAR_KEYS = [
  'problemStatement',
  'targetAudience',
  'solution',
  'uniqueValue',
  'timing',
  'marketSize',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function looksLikeIdeaCore(record: Record<string, unknown>): boolean {
  return SCALAR_KEYS.some((key) => typeof record[key] === 'string')
    || Array.isArray(record.assumptions)
    || Array.isArray(record.painPoints);
}

/** Preview stores Idea Core flat; a save nests the same fields under `ideaCore`. */
export function pickIdeaCore(raw: unknown): Partial<IdeaCoreData> {
  const root = asRecord(raw);
  if (!root) return {};
  const nested = asRecord(root.ideaCore);
  const source = nested && looksLikeIdeaCore(nested) ? nested : root;
  const next: Partial<IdeaCoreData> = {};
  for (const key of SCALAR_KEYS) {
    if (typeof source[key] === 'string') next[key] = source[key] as string;
  }
  if (Array.isArray(source.assumptions)) next.assumptions = stringList(source.assumptions);
  if (Array.isArray(source.painPoints)) next.painPoints = stringList(source.painPoints);
  return next;
}

function hydrateIdeaCore(raw: unknown): IdeaCoreData {
  return { ...EMPTY_IDEA, ...pickIdeaCore(raw) };
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim();
}

function mergeEmptyOnly(current: IdeaCoreData, incoming: Partial<IdeaCoreData>): IdeaCoreData {
  const next: IdeaCoreData = { ...current, assumptions: [...current.assumptions], painPoints: [...current.painPoints] };
  for (const key of SCALAR_KEYS) {
    const value = incoming[key];
    if (typeof value === 'string' && isBlank(current[key]) && value.trim()) {
      next[key] = value;
    }
  }
  if (!current.assumptions.some((item) => item.trim()) && incoming.assumptions?.some((item) => item.trim())) {
    next.assumptions = incoming.assumptions;
  }
  if (!current.painPoints.some((item) => item.trim()) && incoming.painPoints?.some((item) => item.trim())) {
    next.painPoints = incoming.painPoints;
  }
  return next;
}

function ideaCoreEquals(a: IdeaCoreData, b: IdeaCoreData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function completionPercent(data: IdeaCoreData): number {
  const filled = [
    data.problemStatement,
    data.targetAudience,
    data.solution,
    data.uniqueValue,
    data.timing,
    data.marketSize,
    data.assumptions.some((item) => item.trim()) ? 'yes' : '',
    data.painPoints.some((item) => item.trim()) ? 'yes' : '',
  ].filter((field) => field.trim().length > 0).length;
  return (filled / 8) * 100;
}

/** The figure the stage header shows, stored on the document when it saves. */
export function ideaCoreCompletion(data: IdeaCoreData): number {
  return Math.round(completionPercent(data));
}

function assistPrompt(data: IdeaCoreData): string {
  const empty: string[] = [];
  if (isBlank(data.problemStatement)) empty.push('problem statement');
  if (isBlank(data.targetAudience)) empty.push('target audience');
  if (isBlank(data.solution)) empty.push('solution');
  if (isBlank(data.uniqueValue)) empty.push('unique value');
  if (isBlank(data.timing)) empty.push('why now');
  if (isBlank(data.marketSize)) empty.push('market size');
  if (!data.assumptions.some((item) => item.trim())) empty.push('key assumptions');
  if (!data.painPoints.some((item) => item.trim())) empty.push('pain points');
  const focus = empty.length ? empty.join(', ') : 'the weakest line';
  return [
    'Help me complete the Idea Core in Startup Builder. Draft only the empty fields; keep what I already wrote.',
    `Empty first: ${focus}.`,
    `Problem: ${data.problemStatement || '(empty)'}`,
    `Audience: ${data.targetAudience || '(empty)'}`,
    `Solution: ${data.solution || '(empty)'}`,
    `Unique value: ${data.uniqueValue || '(empty)'}`,
    `Why now: ${data.timing || '(empty)'}`,
    `Market size: ${data.marketSize || '(empty)'}`,
    `Assumptions: ${data.assumptions.filter((item) => item.trim()).join('; ') || '(empty)'}`,
    `Pain points: ${data.painPoints.filter((item) => item.trim()).join('; ') || '(empty)'}`,
  ].join('\n');
}

export function IdeaCore({ onSave, onGenerate, initialData, contentRevision }: IdeaCoreProps) {
  const t = useBuilderPrimaryText();
  const askInPlace = useAskInPlace();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<IdeaCoreData>(() => hydrateIdeaCore(initialData));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setData(hydrateIdeaCore(initialData));
    // Reload when the document version changes (save / restore), not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRevision]);

  const handleFieldChange = (field: (typeof SCALAR_KEYS)[number], value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssumptionChange = (index: number, value: string) => {
    setData((prev) => {
      const assumptions = [...prev.assumptions];
      assumptions[index] = value;
      return { ...prev, assumptions };
    });
  };

  const addAssumption = () => {
    setData((prev) => ({ ...prev, assumptions: [...prev.assumptions, ''] }));
  };

  const removeAssumption = (index: number) => {
    setData((prev) => ({
      ...prev,
      assumptions: prev.assumptions.filter((_, i) => i !== index),
    }));
  };

  const handlePainPointChange = (index: number, value: string) => {
    setData((prev) => {
      const painPoints = [...prev.painPoints];
      painPoints[index] = value;
      return { ...prev, painPoints };
    });
  };

  const addPainPoint = () => {
    setData((prev) => ({ ...prev, painPoints: [...prev.painPoints, ''] }));
  };

  const removePainPoint = (index: number) => {
    setData((prev) => ({
      ...prev,
      painPoints: prev.painPoints.filter((_, i) => i !== index),
    }));
  };

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const incoming = await onGenerate?.(data);
      if (incoming) {
        const merged = mergeEmptyOnly(data, pickIdeaCore(incoming));
        if (ideaCoreEquals(data, merged)) {
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

  return (
    <div className="space-y-6">
      <BuilderStageHeader
        glyph="spark"
        titleEn={builderEn('tab_idea')}
        titleEl={builderEl('tab_idea')}
        subtitleEn={builderEn('idea_sub')}
        subtitleEl={builderEl('idea_sub')}
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
                en={isGenerating ? builderEn('generating') : builderEn('ai_assist')}
                el={isGenerating ? builderEl('generating') : builderEl('ai_assist')}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="target" className="icon-sm" />
                <BilingualText en={builderEn('idea_problem_card')} el={builderEl('idea_problem_card')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="problem">
                  <BilingualText en={builderEn('idea_problem_label')} el={builderEl('idea_problem_label')} compact />
                </Label>
                <Textarea
                  id="problem"
                  placeholder={t(builderEn('idea_problem_ph'), builderEl('idea_problem_ph'))}
                  value={data.problemStatement}
                  onChange={(e) => handleFieldChange('problemStatement', e.target.value)}
                  className="min-h-[100px] rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audience">
                  <BilingualText en={builderEn('idea_audience')} el={builderEl('idea_audience')} compact />
                </Label>
                <Input
                  id="audience"
                  placeholder={t(builderEn('idea_audience_ph'), builderEl('idea_audience_ph'))}
                  value={data.targetAudience}
                  onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="market">
                  <BilingualText en={builderEn('idea_market')} el={builderEl('idea_market')} compact />
                </Label>
                <Input
                  id="market"
                  placeholder={t(builderEn('idea_market_ph'), builderEl('idea_market_ph'))}
                  value={data.marketSize}
                  onChange={(e) => handleFieldChange('marketSize', e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="chart" className="icon-sm" />
                <BilingualText en={builderEn('idea_solution_card')} el={builderEl('idea_solution_card')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="solution">
                  <BilingualText en={builderEn('idea_solution')} el={builderEl('idea_solution')} compact />
                </Label>
                <Textarea
                  id="solution"
                  placeholder={t(builderEn('idea_solution_ph'), builderEl('idea_solution_ph'))}
                  value={data.solution}
                  onChange={(e) => handleFieldChange('solution', e.target.value)}
                  className="min-h-[100px] rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unique">
                  <BilingualText en={builderEn('idea_uvp')} el={builderEl('idea_uvp')} compact />
                </Label>
                <Textarea
                  id="unique"
                  placeholder={t(builderEn('idea_uvp_ph'), builderEl('idea_uvp_ph'))}
                  value={data.uniqueValue}
                  onChange={(e) => handleFieldChange('uniqueValue', e.target.value)}
                  className="min-h-[80px] rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timing">
                  <BilingualText en={builderEn('idea_why_now')} el={builderEl('idea_why_now')} compact />
                </Label>
                <Textarea
                  id="timing"
                  placeholder={t(builderEn('idea_why_now_ph'), builderEl('idea_why_now_ph'))}
                  value={data.timing}
                  onChange={(e) => handleFieldChange('timing', e.target.value)}
                  className="min-h-[80px] rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="flag" className="icon-sm" />
                <BilingualText en={builderEn('idea_assumptions')} el={builderEl('idea_assumptions')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.assumptions.length === 0 && (
                <p className="text-xs leading-snug text-muted-foreground">
                  <BilingualText en={builderEn('idea_assumptions_hint')} el={builderEl('idea_assumptions_hint')} wrap />
                </p>
              )}
              {data.assumptions.map((assumption, index) => (
                <div key={`assumption-${index}`} className="flex gap-2">
                  <Input
                    placeholder={t(builderEn('idea_assumption_ph'), builderEl('idea_assumption_ph'))}
                    value={assumption}
                    onChange={(e) => handleAssumptionChange(index, e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-xl"
                    onClick={() => removeAssumption(index)}
                    aria-label={bilingualAria(builderEn('remove'), builderEl('remove'))}
                  >
                    <X className="icon-sm" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAssumption} className={`w-full ${BUILDER_BTN}`}>
                <BilingualText en={builderEn('idea_add_assumption')} el={builderEl('idea_add_assumption')} compact />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CfbGlyph name="compare" className="icon-sm" />
                <BilingualText en={builderEn('idea_pains')} el={builderEl('idea_pains')} compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.painPoints.length === 0 && (
                <p className="text-xs leading-snug text-muted-foreground">
                  <BilingualText en={builderEn('idea_pains_hint')} el={builderEl('idea_pains_hint')} wrap />
                </p>
              )}
              {data.painPoints.map((painPoint, index) => (
                <div key={`pain-${index}`} className="flex gap-2">
                  <Input
                    placeholder={t(builderEn('idea_pain_ph'), builderEl('idea_pain_ph'))}
                    value={painPoint}
                    onChange={(e) => handlePainPointChange(index, e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-xl"
                    onClick={() => removePainPoint(index)}
                    aria-label={bilingualAria(builderEn('remove'), builderEl('remove'))}
                  >
                    <X className="icon-sm" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addPainPoint} className={`w-full ${BUILDER_BTN}`}>
                <BilingualText en={builderEn('idea_add_pain')} el={builderEl('idea_add_pain')} compact />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
