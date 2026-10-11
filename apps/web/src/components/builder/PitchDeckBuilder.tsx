'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { isPreviewDemo } from '@/lib/preview-demo';
import { fundraisingRoundView, fmtMoney } from '@/lib/fundraising-demo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageRail, type PageRailSection } from '@/components/layout/PageRail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  X,
  Copy,
  CopyPlus,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Check,
  Info,
  MoreVertical,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import {
  BUILDER_BTN,
  BUILDER_CARD_TITLE,
  BuilderAskAiButton,
  BuilderStageHeader,
  useAskInPlace,
  useBuilderPrimaryText,
} from './BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { useToast } from '@/components/ui/toast';
import { pickIdeaCore } from './IdeaCore';
import { pickBmc } from './BusinessModelCanvas';
import { pickMarket } from './MarketAnalysis';

interface Slide {
  id: string;
  type: string;
  title: string;
  content: string;
  notes: string;
  order: number;
}

export interface PitchDeckData {
  deckType: 'investor' | 'accelerator' | 'cofounder' | 'grant' | 'competition';
  slides: Slide[];
  companyName: string;
  tagline: string;
  askAmount: string;
  useOfFunds: string[];
}

interface PitchDeckBuilderProps {
  onSave?: (data: PitchDeckData) => void | Promise<void>;
  onGenerate?: (data: PitchDeckData) => Promise<Record<string, unknown> | null>;
  initialData?: unknown;
  contentRevision?: string;
  /** Dedicated `/builder/pitch-deck` route — AppShell already shows the title. */
  hideTitle?: boolean;
  /** The AppShell lead already says what the stage lead would; show deck progress there instead. */
  hideLead?: boolean;
  workspaceName?: string;
  ideaCore?: unknown;
  bmc?: unknown;
  market?: unknown;
  askPrompt?: string;
  /**
   * Page-level rail sections merged after this deck's own, so the page renders
   * one rail instead of a second <PageRail> stacked at right:0.
   */
  extraRailSections?: PageRailSection[];
}

const EMPTY_PITCH: PitchDeckData = {
  deckType: 'investor',
  slides: [],
  companyName: '',
  tagline: '',
  askAmount: '',
  useOfFunds: [],
};

const PITCH_SLIDE_TYPES = [
  'cover',
  'problem',
  'solution',
  'market',
  'product',
  'traction',
  'business-model',
  'competition',
  'team',
  'financials',
  'ask',
  'closing',
] as const;

const PITCH_SLIDE_ALIASES: Record<string, (typeof PITCH_SLIDE_TYPES)[number]> = {
  business_model: 'business-model',
  businessModel: 'business-model',
  bmc: 'business-model',
  close: 'closing',
};

type SlideTitleKey =
  | 'slide_cover'
  | 'slide_problem'
  | 'slide_solution'
  | 'slide_market'
  | 'slide_product'
  | 'slide_traction'
  | 'slide_bmc'
  | 'slide_comp'
  | 'slide_team'
  | 'slide_fin'
  | 'slide_ask'
  | 'slide_close';

type SlideHintKey =
  | 'hint_slide_cover'
  | 'hint_slide_problem'
  | 'hint_slide_solution'
  | 'hint_slide_market'
  | 'hint_slide_product'
  | 'hint_slide_traction'
  | 'hint_slide_bmc'
  | 'hint_slide_comp'
  | 'hint_slide_team'
  | 'hint_slide_fin'
  | 'hint_slide_ask'
  | 'hint_slide_close';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim();
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

const DECK_TYPE_VALUES: PitchDeckData['deckType'][] = [
  'investor',
  'accelerator',
  'cofounder',
  'grant',
  'competition',
];

function pickSlide(raw: unknown, index: number): Slide {
  const rec = asRecord(raw) ?? {};
  const type = typeof rec.type === 'string' && rec.type.trim() ? rec.type : 'custom';
  const title = typeof rec.title === 'string' ? rec.title : type;
  return {
    id: typeof rec.id === 'string' && rec.id.trim() ? rec.id : `slide-${index}-${type}`,
    type,
    title,
    content: typeof rec.content === 'string' ? rec.content : '',
    notes: typeof rec.notes === 'string' ? rec.notes : '',
    order: typeof rec.order === 'number' && Number.isFinite(rec.order) ? rec.order : index,
  };
}

function looksLikePitch(record: Record<string, unknown>): boolean {
  return Boolean(
    Array.isArray(record.slides)
      || typeof record.companyName === 'string'
      || typeof record.tagline === 'string'
      || typeof record.askAmount === 'string'
      || typeof record.deckType === 'string'
      || Array.isArray(record.useOfFunds)
      || PITCH_SLIDE_TYPES.some((type) => type in record),
  );
}

function slidesFromUnknown(value: unknown): Slide[] | undefined {
  if (Array.isArray(value) && value.length) return value.map(pickSlide);
  const rec = asRecord(value);
  if (!rec) return undefined;
  const fromKeys: Slide[] = [];
  for (const [index, type] of PITCH_SLIDE_TYPES.entries()) {
    const aliasKey = Object.keys(PITCH_SLIDE_ALIASES).find(
      (key) => PITCH_SLIDE_ALIASES[key] === type && rec[key] != null,
    );
    const raw = rec[type] ?? (aliasKey ? rec[aliasKey] : undefined);
    if (raw == null) continue;
    if (typeof raw === 'string') {
      if (!raw.trim()) continue;
      fromKeys.push({
        id: `slide-${type}`,
        type,
        title: type,
        content: raw,
        notes: '',
        order: index,
      });
      continue;
    }
    fromKeys.push(pickSlide({ ...(asRecord(raw) ?? {}), type }, index));
  }
  return fromKeys.length ? fromKeys : undefined;
}

/** Preview stores the deck flat; a save nests the same fields under `pitchDeck`. */
export function pickPitchDeck(raw: unknown): Partial<PitchDeckData> {
  const root = asRecord(raw);
  if (!root) return {};
  const nested = asRecord(root.pitchDeck);
  const source = nested && looksLikePitch(nested) ? nested : root;
  const next: Partial<PitchDeckData> = {};
  if (typeof source.companyName === 'string') next.companyName = source.companyName;
  if (typeof source.tagline === 'string') next.tagline = source.tagline;
  if (typeof source.askAmount === 'string') next.askAmount = source.askAmount;
  if (typeof source.deckType === 'string' && DECK_TYPE_VALUES.includes(source.deckType as PitchDeckData['deckType'])) {
    next.deckType = source.deckType as PitchDeckData['deckType'];
  }
  const slides = Array.isArray(source.slides) && source.slides.length
    ? source.slides.map(pickSlide)
    : slidesFromUnknown(source);
  if (slides) next.slides = slides;
  if (Array.isArray(source.useOfFunds)) next.useOfFunds = stringList(source.useOfFunds);
  return next;
}

function hydratePitchDeck(raw: unknown): PitchDeckData {
  const picked = pickPitchDeck(raw);
  return {
    ...EMPTY_PITCH,
    ...picked,
    slides: picked.slides ?? [],
    useOfFunds: picked.useOfFunds ?? [],
  };
}

function slideFilled(slide: Slide): boolean {
  return Boolean(slide.content.trim() || slide.notes.trim());
}

function mergeSlides(current: Slide[], incoming: Slide[] | undefined): Slide[] {
  if (!incoming?.length) return current;
  if (!current.length) return incoming.map((slide, index) => ({ ...slide, order: index }));
  const next = current.map((slide) => ({ ...slide }));
  for (const incomingSlide of incoming) {
    const emptyIdx = next.findIndex((slide) => slide.type === incomingSlide.type && !slide.content.trim());
    if (emptyIdx >= 0) {
      const currentSlide = next[emptyIdx];
      next[emptyIdx] = {
        ...currentSlide,
        title: currentSlide.title.trim() ? currentSlide.title : incomingSlide.title,
        content: incomingSlide.content.trim() ? incomingSlide.content : currentSlide.content,
        notes: isBlank(currentSlide.notes) && incomingSlide.notes.trim() ? incomingSlide.notes : currentSlide.notes,
      };
      continue;
    }
    if (!next.some((slide) => slide.type === incomingSlide.type) && slideFilled(incomingSlide)) {
      next.push({ ...incomingSlide, id: incomingSlide.id || `slide-${Date.now()}-${incomingSlide.type}`, order: next.length });
    }
  }
  return next;
}

function mergeEmptyOnly(current: PitchDeckData, incoming: Partial<PitchDeckData>): PitchDeckData {
  return {
    deckType: current.deckType,
    companyName: isBlank(current.companyName) && incoming.companyName?.trim() ? incoming.companyName : current.companyName,
    tagline: isBlank(current.tagline) && incoming.tagline?.trim() ? incoming.tagline : current.tagline,
    askAmount: isBlank(current.askAmount) && incoming.askAmount?.trim() ? incoming.askAmount : current.askAmount,
    useOfFunds:
      current.useOfFunds.some((line) => line.trim())
        ? current.useOfFunds
        : (incoming.useOfFunds?.some((line) => line.trim()) ? incoming.useOfFunds : current.useOfFunds),
    slides: mergeSlides(current.slides, incoming.slides),
  };
}

function pitchEquals(a: PitchDeckData, b: PitchDeckData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function artefactContext(ideaCore: unknown, bmc: unknown, market?: unknown) {
  const idea = pickIdeaCore(ideaCore);
  const canvas = pickBmc(bmc);
  const sizing = pickMarket(market);
  const tamBits = [
    sizing.tam?.value && `TAM: ${sizing.tam.value}${sizing.tam.description ? ` — ${sizing.tam.description}` : ''}`,
    sizing.sam?.value && `SAM: ${sizing.sam.value}${sizing.sam.description ? ` — ${sizing.sam.description}` : ''}`,
    sizing.som?.value && `SOM: ${sizing.som.value}${sizing.som.description ? ` — ${sizing.som.description}` : ''}`,
  ].filter(Boolean);
  return {
    problem: asText(idea.problemStatement),
    solution: asText(idea.solution),
    unique: asText(idea.uniqueValue),
    audience: asText(idea.targetAudience),
    market: tamBits.join('\n') || asText(idea.marketSize),
    proposition: asText(canvas.valuePropositions),
    advantage: asText(sizing.competitiveAdvantage) || asText(sizing.positioning),
  };
}

function assistPrompt(
  data: PitchDeckData,
  ideaCore: unknown,
  bmc: unknown,
  market: unknown,
  workspaceName?: string,
): string {
  const ctx = artefactContext(ideaCore, bmc, market);
  const emptyTypes = SLIDE_TEMPLATES
    .filter((template) => !data.slides.some((slide) => slide.type === template.type && slide.content.trim()))
    .map((template) => builderEn(template.titleKey));
  const focus = emptyTypes.length ? emptyTypes.join(', ') : 'the weakest slide';
  return [
    'Help me complete the investor pitch deck in Startup Builder. Draft only empty slides and empty fields; keep what I already wrote.',
    `Empty first: ${focus}.`,
    `Company: ${data.companyName || workspaceName || '(empty)'}`,
    `Tagline: ${data.tagline || '(empty)'}`,
    `Ask: ${data.askAmount || '(empty)'}`,
    `Problem: ${ctx.problem || '(empty)'}`,
    `Solution: ${ctx.solution || '(empty)'}`,
    `Unique value: ${ctx.unique || '(empty)'}`,
    `BMC value: ${ctx.proposition || '(empty)'}`,
    `Market: ${ctx.market || '(empty)'}`,
  ].join('\n');
}

const SLIDE_TEMPLATES: {
  type: string;
  titleKey: SlideTitleKey;
  hintKey: SlideHintKey;
  glyph: CfbGlyphName;
}[] = [
  { type: 'cover', titleKey: 'slide_cover', hintKey: 'hint_slide_cover', glyph: 'builder' },
  { type: 'problem', titleKey: 'slide_problem', hintKey: 'hint_slide_problem', glyph: 'target' },
  { type: 'solution', titleKey: 'slide_solution', hintKey: 'hint_slide_solution', glyph: 'spark' },
  { type: 'market', titleKey: 'slide_market', hintKey: 'hint_slide_market', glyph: 'chart' },
  { type: 'product', titleKey: 'slide_product', hintKey: 'hint_slide_product', glyph: 'flag' },
  { type: 'traction', titleKey: 'slide_traction', hintKey: 'hint_slide_traction', glyph: 'award' },
  { type: 'business-model', titleKey: 'slide_bmc', hintKey: 'hint_slide_bmc', glyph: 'wallet' },
  { type: 'competition', titleKey: 'slide_comp', hintKey: 'hint_slide_comp', glyph: 'shield' },
  { type: 'team', titleKey: 'slide_team', hintKey: 'hint_slide_team', glyph: 'people' },
  { type: 'financials', titleKey: 'slide_fin', hintKey: 'hint_slide_fin', glyph: 'wallet' },
  { type: 'ask', titleKey: 'slide_ask', hintKey: 'hint_slide_ask', glyph: 'target' },
  { type: 'closing', titleKey: 'slide_close', hintKey: 'hint_slide_close', glyph: 'builder' },
];

/**
 * Written slides as a share of a full deck (twelve, or more if added), so two
 * written slides read 17% rather than 100% of a two-slide deck.
 */
export function pitchDeckCompletion(slides: { content: string }[]): number {
  const filled = slides.filter((slide) => slide.content.trim().length > 0).length;
  return Math.round((filled / Math.max(slides.length, SLIDE_TEMPLATES.length)) * 100);
}

const DECK_TYPES: {
  value: PitchDeckData['deckType'];
  labelKey: 'pitch_investor' | 'pitch_accel' | 'pitch_cofounder' | 'pitch_grant' | 'pitch_comp';
  hintKey:
    | 'pitch_type_hint_investor'
    | 'pitch_type_hint_accel'
    | 'pitch_type_hint_cofounder'
    | 'pitch_type_hint_grant'
    | 'pitch_type_hint_competition';
}[] = [
  { value: 'investor', labelKey: 'pitch_investor', hintKey: 'pitch_type_hint_investor' },
  { value: 'accelerator', labelKey: 'pitch_accel', hintKey: 'pitch_type_hint_accel' },
  { value: 'cofounder', labelKey: 'pitch_cofounder', hintKey: 'pitch_type_hint_cofounder' },
  { value: 'grant', labelKey: 'pitch_grant', hintKey: 'pitch_type_hint_grant' },
  { value: 'competition', labelKey: 'pitch_comp', hintKey: 'pitch_type_hint_competition' },
];

function snapshotOf(data: PitchDeckData) {
  return JSON.stringify(data);
}

export function PitchDeckBuilder({
  onSave,
  onGenerate,
  initialData,
  contentRevision,
  hideTitle = false,
  hideLead = false,
  workspaceName,
  ideaCore,
  bmc,
  market,
  askPrompt,
  extraRailSections,
}: PitchDeckBuilderProps) {
  const t = useBuilderPrimaryText();
  const fieldId = useId();
  const askInPlace = useAskInPlace();
  const { success, error: toastError } = useToast();
  const savedRef = useRef(snapshotOf(hydratePitchDeck(initialData)));
  const [data, setData] = useState<PitchDeckData>(() => hydratePitchDeck(initialData));
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    const next = hydratePitchDeck(initialData);
    setData(next);
    savedRef.current = snapshotOf(next);
    setCurrentSlideIndex((index) => Math.min(index, Math.max(0, next.slides.length - 1)));
    // Reload when the document version changes (save / restore), not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentRevision]);

  useEffect(() => {
    setCompletionPercentage(pitchDeckCompletion(data.slides));
  }, [data.slides]);

  useEffect(() => {
    if (!data.companyName && workspaceName) {
      setData((prev) => {
        if (prev.companyName) return prev;
        const next = { ...prev, companyName: workspaceName };
        try {
          const saved = JSON.parse(savedRef.current) as PitchDeckData;
          if (!saved.companyName) savedRef.current = snapshotOf(next);
        } catch {
          savedRef.current = snapshotOf(next);
        }
        return next;
      });
    }
  }, [workspaceName, data.companyName]);

  /*
   * The ask follows the round the same way the company name follows the
   * workspace. /fundraising and the dashboard both say the showcase is raising
   * a $750K seed; this deck said "—" beside "Funding ask" on the same account,
   * which is the kind of contradiction between adjacent pages the product is
   * meant not to have. Demo only: the round model is the demo's, and seeding a
   * real founder's deck with a sample figure would be inventing their ask.
   * Same guard as the company name — never overwrite something typed.
   */
  useEffect(() => {
    if (data.askAmount || !isPreviewDemo()) return;
    const round = fundraisingRoundView();
    const ask = fmtMoney(round.target, round.currency);
    setData((prev) => {
      if (prev.askAmount) return prev;
      const next = { ...prev, askAmount: ask };
      try {
        const saved = JSON.parse(savedRef.current) as PitchDeckData;
        if (!saved.askAmount) savedRef.current = snapshotOf(next);
      } catch {
        savedRef.current = snapshotOf(next);
      }
      return next;
    });
  }, [data.askAmount]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (data.slides.length === 0) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentSlideIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentSlideIndex((index) => Math.min(data.slides.length - 1, index + 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data.slides.length]);

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const incoming = await onGenerate?.(data);
      if (incoming) {
        const merged = mergeEmptyOnly(data, pickPitchDeck(incoming));
        if (pitchEquals(data, merged)) {
          success('Nothing to change');
        } else {
          setData(merged);
        }
        return;
      }
      askInPlace(askPrompt ?? assistPrompt(data, ideaCore, bmc, market, workspaceName));
    } finally {
      setIsGenerating(false);
    }
  };

  const addSlide = (type: string) => {
    const template = SLIDE_TEMPLATES.find((item) => item.type === type);
    if (!template) return;

    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type: template.type,
      title: builderEn(template.titleKey),
      content: '',
      notes: '',
      order: data.slides.length,
    };

    setData((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }));
    setCurrentSlideIndex(data.slides.length);
  };

  const addRemainingSlides = () => {
    setData((prev) => {
      const next = [...prev.slides];
      SLIDE_TEMPLATES.forEach((template) => {
        if (next.some((slide) => slide.type === template.type)) return;
        next.push({
          id: `slide-${Date.now()}-${template.type}`,
          type: template.type,
          title: builderEn(template.titleKey),
          content: '',
          notes: '',
          order: next.length,
        });
      });
      return { ...prev, slides: next };
    });
  };

  const updateSlide = (field: keyof Slide, value: string) => {
    setData((prev) => ({
      ...prev,
      slides: prev.slides.map((slide, index) =>
        index === currentSlideIndex ? { ...slide, [field]: value } : slide,
      ),
    }));
  };

  const removeSlide = (index: number) => {
    setData((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
    }));
    if (currentSlideIndex >= data.slides.length - 1) {
      setCurrentSlideIndex(Math.max(0, data.slides.length - 2));
    }
  };

  const duplicateSlide = (index: number) => {
    const slide = data.slides[index];
    if (!slide) return;
    const copy: Slide = {
      ...slide,
      id: `slide-${Date.now()}`,
      order: index + 1,
    };
    setData((prev) => ({
      ...prev,
      slides: [...prev.slides.slice(0, index + 1), copy, ...prev.slides.slice(index + 1)],
    }));
    setCurrentSlideIndex(index + 1);
  };

  const moveSlide = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= data.slides.length) return;

    const newSlides = [...data.slides];
    [newSlides[fromIndex], newSlides[toIndex]] = [newSlides[toIndex], newSlides[fromIndex]];
    setData((prev) => ({ ...prev, slides: newSlides }));
    setCurrentSlideIndex(toIndex);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(data);
      savedRef.current = snapshotOf(data);
      success('Saved');
    } catch {
      toastError('Could not save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const heading = data.companyName.trim() || 'Pitch Deck';
    const parts = [
      `# ${heading}`,
      data.tagline,
      data.askAmount ? `Ask: ${data.askAmount}` : '',
      data.useOfFunds.filter((line) => line.trim()).length
        ? `Use of funds:\n${data.useOfFunds.filter((line) => line.trim()).map((line) => `- ${line}`).join('\n')}`
        : '',
      ...data.slides.map((slide, index) => {
        const notes = slide.notes.trim() ? `\n\n_Notes:_ ${slide.notes}` : '';
        return `## ${index + 1}. ${slide.title}\n\n${slide.content}${notes}`;
      }),
    ].filter((block) => block && block.trim().length > 0);

    const blob = new Blob([parts.join('\n\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const slug = heading.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'pitch-deck';
    anchor.href = url;
    anchor.download = `${slug}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    success(t(builderEn('pitch_exported'), builderEl('pitch_exported')));
  };

  const copyCurrentSlide = async () => {
    const slide = data.slides[currentSlideIndex];
    if (!slide) return;
    const text = [slide.title, slide.content, slide.notes].filter((part) => part.trim()).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      success(t(builderEn('pitch_copied'), builderEl('pitch_copied')));
    } catch {
      /* clipboard can be denied; export remains available */
    }
  };

  const fillFromArtefacts = () => {
    const ctx = artefactContext(ideaCore, bmc, market);
    setData((prev) => ({
      ...prev,
      companyName: prev.companyName || workspaceName || prev.companyName,
      tagline: prev.tagline || ctx.unique || prev.tagline,
      slides: prev.slides.map((slide) => {
        if (slide.content.trim()) return slide;
        if (slide.type === 'cover' && (prev.companyName || workspaceName || ctx.unique)) {
          return {
            ...slide,
            content: [prev.companyName || workspaceName, ctx.unique].filter(Boolean).join('\n\n'),
          };
        }
        if (slide.type === 'problem' && ctx.problem) return { ...slide, content: ctx.problem };
        if (slide.type === 'solution' && ctx.solution) return { ...slide, content: ctx.solution };
        if (slide.type === 'market' && ctx.market) return { ...slide, content: ctx.market };
        if (slide.type === 'business-model' && ctx.proposition) return { ...slide, content: ctx.proposition };
        if (slide.type === 'competition' && ctx.advantage) return { ...slide, content: ctx.advantage };
        if (slide.type === 'ask' && prev.askAmount) {
          return {
            ...slide,
            content: [prev.askAmount, ...prev.useOfFunds.filter((line) => line.trim())].join('\n'),
          };
        }
        return slide;
      }),
    }));
    success(t(builderEn('pitch_filled_core'), builderEl('pitch_filled_core')));
  };

  const artefacts = artefactContext(ideaCore, bmc, market);
  const copilotPrompt = askPrompt ?? assistPrompt(data, ideaCore, bmc, market, workspaceName);

  const currentSlide = data.slides[currentSlideIndex];
  const filledCount = data.slides.filter((slide) => slide.content.trim().length > 0).length;
  const deckSize = Math.max(data.slides.length, SLIDE_TEMPLATES.length);
  const missingTemplates = SLIDE_TEMPLATES.filter(
    (template) => !data.slides.some((slide) => slide.type === template.type),
  );
  const emptySlides = data.slides.filter((slide) => !slide.content.trim());
  const dirty = snapshotOf(data) !== savedRef.current;
  const activeDeck = DECK_TYPES.find((item) => item.value === data.deckType) ?? DECK_TYPES[0];
  const wordCount = currentSlide
    ? currentSlide.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const canFillFromArtefacts = Boolean(
    artefacts.problem
      || artefacts.solution
      || artefacts.unique
      || artefacts.proposition
      || artefacts.market
      || data.askAmount,
  );

  const renderSlideTitle = (slide: Slide) => {
    const template = SLIDE_TEMPLATES.find((item) => item.type === slide.type);
    if (template && slide.title === builderEn(template.titleKey)) {
      return <BilingualText en={builderEn(template.titleKey)} el={builderEl(template.titleKey)} compact />;
    }
    return slide.title;
  };

  /** The editable title, in the reader's language while it is still the template default. */
  const displayedSlideTitle = (slide: Slide) => {
    const template = SLIDE_TEMPLATES.find((item) => item.type === slide.type);
    if (template && slide.title === builderEn(template.titleKey)) {
      return t(builderEn(template.titleKey), builderEl(template.titleKey));
    }
    return slide.title;
  };

  const slideTitlePair = (slide: Slide) => {
    const template = SLIDE_TEMPLATES.find((item) => item.type === slide.type);
    return template && slide.title === builderEn(template.titleKey)
      ? { en: builderEn(template.titleKey), el: builderEl(template.titleKey) }
      : { en: slide.title, el: slide.title };
  };

  // The slide menu's actions over the slides in the deck, through the same handlers. Copy text
  // stays out: it fills the reader's clipboard, which the assistant has no use for.
  const numberedSlides = data.slides.map((slide, index) => ({ slide, index }));
  const slideOptions = (rows: typeof numberedSlides) =>
    rowOptions(
      rows,
      ({ slide }) => slide.id,
      ({ slide, index }) => `${index + 1}. ${slideTitlePair(slide).en}`,
      ({ slide, index }) => `${index + 1}. ${slideTitlePair(slide).el}`,
    );
  const slideIndex = (id?: string) => data.slides.findIndex((slide) => slide.id === id);
  usePageControls([
    { id: 'move_slide_up', labelEn: 'Move slide up', labelEl: 'Μετακίνηση διαφάνειας πάνω', writes: true, options: slideOptions(numberedSlides.slice(1)), undo: (v?: string) => ({ control: 'move_slide_down', value: v }), run: (v?: string) => { const i = slideIndex(v); if (i > 0) moveSlide(i, 'up'); } },
    { id: 'move_slide_down', labelEn: 'Move slide down', labelEl: 'Μετακίνηση διαφάνειας κάτω', writes: true, options: slideOptions(numberedSlides.slice(0, -1)), undo: (v?: string) => ({ control: 'move_slide_up', value: v }), run: (v?: string) => { const i = slideIndex(v); if (i >= 0 && i < data.slides.length - 1) moveSlide(i, 'down'); } },
    { id: 'duplicate_slide', labelEn: 'Duplicate slide', labelEl: 'Αντίγραφο διαφάνειας', writes: true, options: slideOptions(numberedSlides), run: (v?: string) => { const i = slideIndex(v); if (i >= 0) duplicateSlide(i); } },
    { id: 'delete_slide', labelEn: 'Delete slide', labelEl: 'Διαγραφή διαφάνειας', writes: true, options: slideOptions(numberedSlides), run: (v?: string) => { const i = slideIndex(v); if (i >= 0) removeSlide(i); } },
  ]);
  usePageList([
    {
      id: 'slides',
      labelEn: 'Slides',
      labelEl: 'Διαφάνειες',
      rows: numberedSlides.map(({ slide, index }) =>
        `${index + 1}. ${slideTitlePair(slide).en} · ${slide.content.trim() ? `${slide.content.trim().split(/\s+/).length} words` : 'empty'}`,
      ),
    },
  ]);

  /*
   * What is about the deck, rather than in it.
   *
   * The twelve slides and the generate buttons are the page. A strip
   * restating the deck's own metadata above them is not, and neither is the
   * details form at the foot - company name, tagline, ask and use of funds
   * are what the cover and the ask slide read from, which makes them
   * settings for the deck rather than a slide in it.
   */
  const rail: PageRailSection[] = [
    {
      id: 'deck-summary',
      glyph: 'chart',
      labelEn: 'Deck summary',
      labelEl: 'Σύνοψη deck',
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deckType" className="text-muted-foreground">
              <BilingualText en={builderEn('pitch_deck_type')} el={builderEl('pitch_deck_type')} compact />
            </Label>
            <Select
              value={data.deckType}
              onValueChange={(value) =>
                setData((prev) => ({ ...prev, deckType: value as PitchDeckData['deckType'] }))
              }
            >
              <SelectTrigger id="deckType"
                className="h-8 min-h-8 w-full rounded-xl text-xs"
                aria-label={bilingualAria(builderEn('pitch_deck_type'), builderEl('pitch_deck_type'))}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECK_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(builderEn(item.labelKey), builderEl(item.labelKey))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-snug text-muted-foreground">
              <BilingualText en={builderEn(activeDeck.hintKey)} el={builderEl(activeDeck.hintKey)} />
            </p>
          </div>

          <dl className="space-y-2.5 border-t border-border pt-4 text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">
                <BilingualText en={builderEn('pitch_company')} el={builderEl('pitch_company')} compact />
              </dt>
              <dd className="min-w-0 break-words font-medium">{data.companyName || '—'}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="text-muted-foreground">
                <BilingualText en={builderEn('pitch_ask')} el={builderEl('pitch_ask')} compact />
              </dt>
              <dd className="min-w-0 break-words font-medium tabular-nums">{data.askAmount || '—'}</dd>
            </div>
          </dl>
          <Button asChild variant="ghost" size="sm" className={`${BUILDER_BTN} h-auto min-h-9 w-full justify-between gap-1.5 whitespace-normal py-1.5 text-left`}>
            <Link href="/readiness">
              <span className="flex min-w-0 items-center gap-1.5">
                <CfbGlyph name="award" className="icon-sm shrink-0" />
                <BilingualText en={builderEn('pitch_readiness')} el={builderEl('pitch_readiness')} compact wrap />
              </span>
              <ChevronRight className="icon-sm shrink-0" />
            </Link>
          </Button>
        </div>
      ),
    },
    {
      id: 'deck-details',
      glyph: 'briefcase',
      labelEn: 'Deck details',
      labelEl: 'Στοιχεία deck',
      content: (
        <div className="space-y-4">
          <p className="text-xs leading-snug text-muted-foreground">
            <BilingualText en={builderEn('pitch_info_hint')} el={builderEl('pitch_info_hint')} />
          </p>
          <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="companyName">
                    <BilingualText en={builderEn('pitch_company')} el={builderEl('pitch_company')} compact />
                  </Label>
                  <Input id="companyName"
                    className="min-h-11 rounded-xl"
                    value={data.companyName}
                    onChange={(event) => setData((prev) => ({ ...prev, companyName: event.target.value }))}
                    placeholder={t(builderEn('pitch_company_ph'), builderEl('pitch_company_ph'))}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="tagline">
                    <BilingualText en={builderEn('pitch_tagline')} el={builderEl('pitch_tagline')} compact />
                  </Label>
                  <Input id="tagline"
                    className="min-h-11 rounded-xl"
                    value={data.tagline}
                    onChange={(event) => setData((prev) => ({ ...prev, tagline: event.target.value }))}
                    placeholder={t(builderEn('pitch_tagline_ph'), builderEl('pitch_tagline_ph'))}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="askAmount">
                    <BilingualText en={builderEn('pitch_ask')} el={builderEl('pitch_ask')} compact />
                  </Label>
                  <Input id="askAmount"
                    className="min-h-11 rounded-xl"
                    value={data.askAmount}
                    onChange={(event) => setData((prev) => ({ ...prev, askAmount: event.target.value }))}
                    placeholder={t(builderEn('pitch_ask_ph'), builderEl('pitch_ask_ph'))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="line">
                  <BilingualText en={builderEn('pitch_use_funds')} el={builderEl('pitch_use_funds')} compact />
                </Label>
                {data.useOfFunds.map((line, index) => (
                  <div key={`fund-${index}`} className="flex gap-2">
                    <Input id="line"
                      className="rounded-xl"
                      value={line}
                      onChange={(event) => {
                        const next = [...data.useOfFunds];
                        next[index] = event.target.value;
                        setData((prev) => ({ ...prev, useOfFunds: next }));
                      }}
                      placeholder={t(builderEn('pitch_use_funds_ph'), builderEl('pitch_use_funds_ph'))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      aria-label={bilingualAria(builderEn('remove'), builderEl('remove'))}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          useOfFunds: prev.useOfFunds.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <X className="icon-sm" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={BUILDER_BTN}
                  onClick={() => setData((prev) => ({ ...prev, useOfFunds: [...prev.useOfFunds, ''] }))}
                >
                  <BilingualText en={builderEn('pitch_add_use')} el={builderEl('pitch_add_use')} compact />
                </Button>
              </div>
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      {/* Declared and rendered here: this is a component, not a page, so
          there is no AppShell to take a `rail` prop. PageRail is fixed, so
          it lands exactly where that prop would have put it. */}
      <PageRail sections={extraRailSections ? [...rail, ...extraRailSections] : rail} />
      <BuilderStageHeader
        glyph="builder"
        titleEn={builderEn('tab_pitch')}
        titleEl={builderEl('tab_pitch')}
        subtitleEn={builderEn('pitch_lead')}
        subtitleEl={builderEl('pitch_lead')}
        leading={hideLead ? <></> : undefined}
        // Completion lives here, beside the editor, and nowhere in the rail.
        meta={
          data.slides.length === 0 ? null : (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Progress
                  value={completionPercentage}
                  className="h-1.5 w-24 shrink-0"
                  aria-label={bilingualAria(builderEn('pitch_complete'), builderEl('pitch_complete'))}
                />
                <span className="font-medium tabular-nums text-foreground">{completionPercentage}%</span>
              </span>
              <span className="min-w-0 tabular-nums">
                {filledCount}/{deckSize}{' '}
                <BilingualText en={builderEn('pitch_slides_written')} el={builderEl('pitch_slides_written')} compact />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={bilingualAria(builderEn('pitch_complete_how'), builderEl('pitch_complete_how'))}
                      >
                        <Info className="icon-sm" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs leading-snug">
                      <BilingualText en={builderEn('pitch_complete_hint')} el={builderEl('pitch_complete_hint')} wrap />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </div>
          )
        }
        hideTitle={hideTitle}
        showAskAi={!hideTitle}
        askPrompt={copilotPrompt}
        extraActions={
          <>
            {dirty && (
              <span className="text-xs text-muted-foreground">
                <BilingualText en={builderEn('pitch_unsaved')} el={builderEl('pitch_unsaved')} compact />
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={BUILDER_BTN}
              onClick={() => void generateWithAI()}
              disabled={isGenerating || isSaving}
            >
              {isGenerating ? (
                <RefreshCw className="icon-sm mr-1.5 animate-spin" />
              ) : (
                <CfbGlyph name="spark" className="icon-sm mr-1.5" />
              )}
              <BilingualText
                en={isGenerating ? builderEn('generating') : builderEn('ai_generate')}
                el={isGenerating ? builderEl('generating') : builderEl('ai_generate')}
                compact
              />
            </Button>
            <Button type="button" variant="outline" size="sm" className={BUILDER_BTN} onClick={handleExport}>
              <Download className="icon-sm mr-1.5" />
              <BilingualText en={builderEn('pitch_export')} el={builderEl('pitch_export')} compact />
            </Button>
            <Button
              type="button"
              size="sm"
              className={BUILDER_BTN}
              onClick={() => void handleSave()}
              disabled={isSaving || isGenerating}
            >
              {isSaving ? (
                <RefreshCw className="icon-sm mr-1.5 animate-spin" />
              ) : (
                <Save className="icon-sm mr-1.5" />
              )}
              <BilingualText en={builderEn('save')} el={builderEl('save')} compact />
            </Button>
          </>
        }
      />


      {data.slides.length === 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className={cn(BUILDER_CARD_TITLE, 'flex items-center gap-2')}>
              <CfbGlyph name="flag" className="icon-sm" />
              <BilingualText en={builderEn('pitch_outline')} el={builderEl('pitch_outline')} compact />
            </CardTitle>
            <p className="text-xs leading-snug text-muted-foreground">
              <BilingualText en={builderEn('pitch_outline_hint')} el={builderEl('pitch_outline_hint')} />
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
              <AIInsightButton className={`w-full sm:w-auto ${BUILDER_BTN}`} prompt={copilotPrompt} />
              <Button
                type="button"
                size="sm"
                className={`w-full sm:w-auto ${BUILDER_BTN}`}
                onClick={() => void generateWithAI()}
                disabled={isGenerating || isSaving}
              >
                {isGenerating ? (
                  <RefreshCw className="icon-sm mr-1.5 animate-spin" />
                ) : (
                  <CfbGlyph name="spark" className="icon-sm mr-1.5" />
                )}
                <BilingualText en={builderEn('pitch_gen_full')} el={builderEl('pitch_gen_full')} compact />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SLIDE_TEMPLATES.map((template, index) => (
                <button
                  key={template.type}
                  type="button"
                  onClick={() => addSlide(template.type)}
                  className="flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-border hover:bg-muted/30"
                >
                  <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  <CfbGlyph name={template.glyph} className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      <BilingualText en={builderEn(template.titleKey)} el={builderEl(template.titleKey)} compact />
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      <BilingualText en={builderEn(template.hintKey)} el={builderEl(template.hintKey)} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {(missingTemplates.length > 0 || emptySlides.length > 0) && (
            <div
              className={cn(
                'grid grid-cols-1 gap-4',
                missingTemplates.length > 0 && emptySlides.length > 0 && 'md:grid-cols-2',
              )}
            >
              {missingTemplates.length > 0 && (
                <Card className="min-w-0 border-status-warning-border/50">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <CardTitle className={cn(BUILDER_CARD_TITLE, 'flex items-center gap-2')}>
                      <AlertTriangle className={cn('icon-sm shrink-0', STATUS.warning.icon)} aria-hidden="true" />
                      <BilingualText en={builderEn('pitch_missing')} el={builderEl('pitch_missing')} compact />
                      <span className="font-normal tabular-nums text-muted-foreground">{missingTemplates.length}</span>
                    </CardTitle>
                    <Button type="button" variant="outline" size="sm" className={cn('ml-auto', BUILDER_BTN)} onClick={addRemainingSlides}>
                      <BilingualText en={builderEn('pitch_add_remaining')} el={builderEl('pitch_add_remaining')} compact />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {missingTemplates.map((template) => (
                      <button
                        key={template.type}
                        type="button"
                        onClick={() => addSlide(template.type)}
                        className="chip tap-target-phone inline-flex min-h-8 items-center gap-1.5 rounded-md bg-secondary/40 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary focus-ring"
                        aria-label={bilingualAria(`Add ${builderEn(template.titleKey)}`, `Προσθήκη: ${builderEl(template.titleKey)}`)}
                      >
                        <Plus className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                        <BilingualText en={builderEn(template.titleKey)} el={builderEl(template.titleKey)} compact />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
              {emptySlides.length > 0 && (
                <Card className="min-w-0">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <CardTitle className={cn(BUILDER_CARD_TITLE, 'flex items-center gap-2')}>
                      <CfbGlyph name="spark" className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                      <BilingualText en={builderEn('pitch_next_write')} el={builderEl('pitch_next_write')} compact />
                      <span className="font-normal tabular-nums text-muted-foreground">{emptySlides.length}</span>
                    </CardTitle>
                    {canFillFromArtefacts && (
                      <Button type="button" variant="outline" size="sm" className={cn('ml-auto', BUILDER_BTN)} onClick={fillFromArtefacts}>
                        <BilingualText en={builderEn('pitch_fill_core')} el={builderEl('pitch_fill_core')} compact />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {emptySlides.map((slide) => {
                      const index = data.slides.findIndex((item) => item.id === slide.id);
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setCurrentSlideIndex(index)}
                          className="chip tap-target-phone inline-flex min-h-8 items-center gap-1.5 rounded-md bg-secondary/40 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-secondary focus-ring"
                        >
                          <span className="font-mono text-2xs text-muted-foreground">{index + 1}</span>
                          <span className="min-w-0">{renderSlideTitle(slide)}</span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 min-w-0 gap-6 lg:grid-cols-4">
            <div className="order-2 min-w-0 space-y-4 lg:order-1 lg:col-span-1">
              <Card className="min-w-0">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">
                    <BilingualText en={builderEn('pitch_slides')} el={builderEl('pitch_slides')} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[min(40vh,320px)] space-y-1 overflow-y-auto lg:max-h-[400px]">
                  {data.slides.map((slide, index) => (
                    <button
                      type="button"
                      key={slide.id}
                      className={cn(
                        'group flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl py-2 pr-2 text-left transition-colors',
                        index === currentSlideIndex
                          ? 'bg-muted/50 text-foreground'
                          : 'hover:bg-muted/40',
                      )}
                      onClick={() => setCurrentSlideIndex(index)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}</span>
                        <span className="truncate text-sm">{renderSlideTitle(slide)}</span>
                      </div>
                      <div
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          slide.content.trim() ? 'bg-status-success-mark' : 'bg-muted-foreground/30',
                        )}
                      />
                    </button>
                  ))}
                </CardContent>
                {/* Every type, one click away, without a twelve-row column under the list. */}
                <div className="border-t border-border px-4 py-2 sm:px-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-auto min-h-10 w-full justify-between gap-2 rounded-xl px-0 text-left">
                        <span className="flex min-w-0 items-center gap-2">
                          <Plus className="icon-sm shrink-0" aria-hidden="true" />
                          <span className="min-w-0 text-xs leading-snug">
                            <BilingualText en={builderEn('pitch_add')} el={builderEl('pitch_add')} compact wrap />
                          </span>
                        </span>
                        <ChevronDown className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
                      <DropdownMenuLabel className="text-2xs font-normal leading-snug text-muted-foreground">
                        <BilingualText en={builderEn('pitch_add_hint')} el={builderEl('pitch_add_hint')} wrap />
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {SLIDE_TEMPLATES.map((template) => {
                        const exists = data.slides.some((slide) => slide.type === template.type);
                        return (
                          <DropdownMenuItem
                            key={template.type}
                            onClick={() => addSlide(template.type)}
                            className={cn('gap-2', exists && 'text-muted-foreground')}
                          >
                            <CfbGlyph name={template.glyph} className="icon-sm shrink-0" />
                            <span className="min-w-0 flex-1 text-xs leading-snug">
                              <BilingualText en={builderEn(template.titleKey)} el={builderEl(template.titleKey)} compact wrap />
                            </span>
                            {exists && (
                              <>
                                <Check className="icon-sm shrink-0 text-status-success" aria-hidden="true" />
                                <span className="sr-only">
                                  <BilingualText en={builderEn('pitch_in_deck')} el={builderEl('pitch_in_deck')} compact />
                                </span>
                              </>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>

            </div>

            <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
              {currentSlide ? (
                <Card className="min-w-0">
                  <CardHeader className="flex flex-col gap-3 space-y-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {currentSlideIndex + 1}/{data.slides.length}
                          </span>
                          <Input
                            value={displayedSlideTitle(currentSlide)}
                            onChange={(event) => updateSlide('title', event.target.value)}
                            className="h-10 w-full min-w-0 rounded-xl font-semibold"
                            aria-label={bilingualAria('Slide title', 'Τίτλος διαφάνειας')}
                          />
                        </CardTitle>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="ml-auto h-10 w-10 shrink-0 rounded-xl"
                        onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                        disabled={currentSlideIndex === 0}
                        aria-label={bilingualAria(builderEn('pitch_prev'), builderEl('pitch_prev'))}
                      >
                        <ChevronLeft className="icon-sm" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl"
                        onClick={() =>
                          setCurrentSlideIndex(Math.min(data.slides.length - 1, currentSlideIndex + 1))
                        }
                        disabled={currentSlideIndex === data.slides.length - 1}
                        aria-label={bilingualAria(builderEn('pitch_next'), builderEl('pitch_next'))}
                      >
                        <ChevronRight className="icon-sm" />
                      </Button>
                    </div>
                    {/* Writing actions stay in view; arranging the deck is a menu away, with delete last. */}
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <BuilderAskAiButton
                        labelEn={builderEn('pitch_ask_slide')}
                        labelEl={builderEl('pitch_ask_slide')}
                        prompt={`Help me write this ${currentSlide.title} pitch-deck slide from my Idea Core and BMC. Keep it investor-clear and specific. Current draft: ${currentSlide.content || '(empty)'}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className={BUILDER_BTN}
                        onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                      >
                        <Eye className="icon-sm mr-1.5" aria-hidden="true" />
                        <BilingualText
                          en={viewMode === 'edit' ? builderEn('pitch_preview') : builderEn('pitch_edit')}
                          el={viewMode === 'edit' ? builderEl('pitch_preview') : builderEl('pitch_edit')}
                          compact
                        />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                            aria-label={bilingualAria(builderEn('pitch_slide_actions'), builderEl('pitch_slide_actions'))}
                          >
                            <MoreVertical className="icon-sm" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52">
                          <DropdownMenuItem
                            disabled={currentSlideIndex === 0}
                            onClick={() => moveSlide(currentSlideIndex, 'up')}
                          >
                            <ArrowUp className="icon-sm mr-2" aria-hidden="true" />
                            <BilingualText en={builderEn('pitch_move_up')} el={builderEl('pitch_move_up')} compact />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={currentSlideIndex === data.slides.length - 1}
                            onClick={() => moveSlide(currentSlideIndex, 'down')}
                          >
                            <ArrowDown className="icon-sm mr-2" aria-hidden="true" />
                            <BilingualText en={builderEn('pitch_move_down')} el={builderEl('pitch_move_down')} compact />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateSlide(currentSlideIndex)}>
                            <CopyPlus className="icon-sm mr-2" aria-hidden="true" />
                            <BilingualText en={builderEn('pitch_duplicate')} el={builderEl('pitch_duplicate')} compact />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void copyCurrentSlide()}>
                            <Copy className="icon-sm mr-2" aria-hidden="true" />
                            <BilingualText en={builderEn('pitch_copy')} el={builderEl('pitch_copy')} compact />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive-accessible focus:bg-destructive/10 focus:text-destructive-accessible"
                            onClick={() => removeSlide(currentSlideIndex)}
                          >
                            <Trash2 className="icon-sm mr-2" aria-hidden="true" />
                            <BilingualText en={builderEn('pitch_delete')} el={builderEl('pitch_delete')} compact />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {viewMode === 'edit' ? (
                      <>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <Label htmlFor={`${fieldId}-content`}>
                              <BilingualText en={builderEn('pitch_content')} el={builderEl('pitch_content')} compact />
                            </Label>
                            <span id={`${fieldId}-words`} className="text-2xs tabular-nums text-muted-foreground">
                              {wordCount} <BilingualText en={builderEn('pitch_words')} el={builderEl('pitch_words')} compact />
                            </span>
                          </div>
                          <Textarea
                            id={`${fieldId}-content`}
                            aria-describedby={`${fieldId}-words`}
                            value={currentSlide.content}
                            onChange={(event) => updateSlide('content', event.target.value)}
                            placeholder={t(builderEn('pitch_content_ph'), builderEl('pitch_content_ph'))}
                            className="min-h-[180px] rounded-xl text-sm sm:min-h-[250px]"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${fieldId}-notes`}>
                            <BilingualText en={builderEn('pitch_notes')} el={builderEl('pitch_notes')} compact />
                          </Label>
                          <Textarea
                            id={`${fieldId}-notes`}
                            value={currentSlide.notes}
                            onChange={(event) => updateSlide('notes', event.target.value)}
                            placeholder={t(builderEn('pitch_notes_ph'), builderEl('pitch_notes_ph'))}
                            className="min-h-[80px] rounded-xl text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="aspect-video min-h-[220px] rounded-2xl border border-border bg-background p-6 sm:min-h-0 sm:p-8">
                        <p className="mb-3 font-mono text-xs text-muted-foreground">
                          {currentSlideIndex + 1}/{data.slides.length}
                        </p>
                        <h2 className="page-section mb-4 font-semibold tracking-tight">
                          {displayedSlideTitle(currentSlide)}
                        </h2>
                        {currentSlide.content.trim() ? (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{currentSlide.content}</div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            <BilingualText
                              en={builderEn('pitch_preview_empty')}
                              el={builderEl('pitch_preview_empty')}
                            />
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
