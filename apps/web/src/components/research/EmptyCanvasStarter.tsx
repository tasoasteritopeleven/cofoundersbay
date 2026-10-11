'use client';

import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { researchEn, researchEl } from '@/lib/i18n/strings-research';
import { cn } from '@/lib/utils';

export type CanvasStarterKind = 'problem' | 'customer' | 'market' | 'competitor';

const STARTERS: Array<{
  kind: CanvasStarterKind;
  glyph: CfbGlyphName;
  titleKey: 'starter_problem' | 'starter_customer' | 'starter_market' | 'starter_competitor';
  hintKey: 'starter_problem_hint' | 'starter_customer_hint' | 'starter_market_hint' | 'starter_competitor_hint';
  posX: number;
  posY: number;
  color: string;
}> = [
  { kind: 'problem', glyph: 'spark', titleKey: 'starter_problem', hintKey: 'starter_problem_hint', posX: 80, posY: 80, color: '#FEF3C7' },
  { kind: 'customer', glyph: 'people', titleKey: 'starter_customer', hintKey: 'starter_customer_hint', posX: 420, posY: 80, color: '#DBEAFE' },
  { kind: 'market', glyph: 'chart', titleKey: 'starter_market', hintKey: 'starter_market_hint', posX: 80, posY: 320, color: '#D1FAE5' },
  { kind: 'competitor', glyph: 'target', titleKey: 'starter_competitor', hintKey: 'starter_competitor_hint', posX: 420, posY: 320, color: '#FEE2E2' },
];

export function canvasStarterPayload(kind: CanvasStarterKind, locale: 'en' | 'el') {
  const row = STARTERS.find((s) => s.kind === kind)!;
  const title = locale === 'el' ? researchEl(row.titleKey) : researchEn(row.titleKey);
  const hint = locale === 'el' ? researchEl(row.hintKey) : researchEn(row.hintKey);
  const hintAlt = locale === 'el' ? researchEn(row.hintKey) : researchEl(row.hintKey);
  return {
    type: 'note' as const,
    title,
    content: `<p>${hint}</p><p>${hintAlt}</p>`,
    posX: row.posX,
    posY: row.posY,
    width: 300,
    height: 200,
    color: row.color,
  };
}

export function EmptyCanvasStarter({
  onAddStarter,
  onAskAi,
}: {
  onAddStarter: (kind: CanvasStarterKind) => void;
  onAskAi: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-8">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary-accessible">
            <CfbGlyph name="research" className="icon-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <BilingualText en={researchEn('empty_canvas_title')} el={researchEl('empty_canvas_title')} compact />
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              <BilingualText en={researchEn('empty_canvas_hint')} el={researchEl('empty_canvas_hint')} wrap />
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STARTERS.map((row) => (
            <button
              key={row.kind}
              type="button"
              onClick={() => onAddStarter(row.kind)}
              className={cn(
                'flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left',
                'transition-colors hover:border-border hover:bg-muted/30',
              )}
            >
              <CfbGlyph name={row.glyph} className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  <BilingualText en={researchEn(row.titleKey)} el={researchEl(row.titleKey)} compact />
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  <BilingualText en={researchEn(row.hintKey)} el={researchEl(row.hintKey)} wrap />
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-xl text-xs" onClick={onAskAi}>
            <CfbGlyph name="spark" className="icon-sm" />
            <BilingualText en={researchEn('ask_ai_sketch')} el={researchEl('ask_ai_sketch')} compact />
          </Button>
        </div>
      </div>
    </div>
  );
}
