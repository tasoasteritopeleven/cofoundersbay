'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, Layers, Link as LinkIcon, Lock, Plus } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { bilingualAria } from '@/lib/i18n/format';
import { researchEl, researchEn } from '@/lib/i18n/strings-research';
import type { CanvasLayer } from '@/lib/canvas/canvas-geometry';
import { CANVAS_NOTE_FILLS, CANVAS_PRODUCT_LINKS } from '@/lib/canvas/canvas-geometry';
import { cn } from '@/lib/utils';

type Props = {
  layers: CanvasLayer[];
  activeLayerId: string;
  onActivateLayer: (id: string) => void;
  onToggleLayer: (id: string) => void;
  onLockLayer: (id: string) => void;
  onAddLayer: () => void;
  selectedCount: number;
  fill?: string | null;
  opacity: number;
  stroke?: string;
  shadow: boolean;
  onStyle: (patch: { fill?: string; opacity?: number; stroke?: string; shadow?: boolean }) => void;
  onLink: (href: string) => void;
  productHref?: string | null;
  onRotate: () => void;
  onMatchSize: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  onTidy: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onHide: () => void;
  onVote: () => void;
  onIsolate: () => void;
  onFrame: () => void;
  onHug: () => void;
  isolated?: boolean;
  onDocFormat: (format: string) => void;
  onWordCount: () => void;
  onCite: () => void;
  onFindReplace: () => void;
  onInsertLink: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onCopyText: () => void;
  onPastePlain: () => void;
  onInsertDate: () => void;
  footer?: ReactNode;
  className?: string;
};

function RailButton({
  disabled,
  onClick,
  en,
  el,
  wide = false,
}: {
  disabled: boolean;
  onClick: () => void;
  en: string;
  el: string;
  wide?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      title={bilingualAria(en, el)}
      className={cn(
        'h-auto min-h-7 justify-start whitespace-normal rounded-xl px-2 py-1 text-left text-2xs leading-tight',
        wide && 'col-span-2',
      )}
      onClick={onClick}
    >
      {/* `wrap`, not truncate: at half of a 220px panel, "Find & replace ·
          Εύρεση" became "Fi… Εύρε…" on every row. */}
      <BilingualText en={en} el={el} compact wrap />
    </Button>
  );
}

export function CanvasInspectorPanel({
  layers,
  activeLayerId,
  onActivateLayer,
  onToggleLayer,
  onLockLayer,
  onAddLayer,
  selectedCount,
  fill,
  opacity,
  stroke,
  shadow,
  onStyle,
  onLink,
  productHref,
  onRotate,
  onMatchSize,
  onCopyStyle,
  onPasteStyle,
  onTidy,
  onFlipH,
  onFlipV,
  onHide,
  onVote,
  onIsolate,
  onFrame,
  onHug,
  isolated = false,
  onDocFormat,
  onWordCount,
  onCite,
  onFindReplace,
  onInsertLink,
  onMerge,
  onSplit,
  onCopyText,
  onPastePlain,
  onInsertDate,
  footer,
  className,
}: Props) {
  const idle = selectedCount === 0;
  return (
    <div
      data-canvas-chrome
      className={cn('pointer-events-auto flex max-h-full min-h-0 w-full cursor-default flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm sm:w-[220px]', className)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative z-10 shrink-0 border-b border-border bg-card/95 px-3 pt-3 pb-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
            <Layers className="icon-sm" />
            <BilingualText en={researchEn('layers')} el={researchEl('layers')} compact />
          </div>
          <Button aria-label="Add layer" variant="ghost" size="sm" className="h-7 w-7 rounded-xl p-0" onClick={onAddLayer}>
            <Plus className="icon-sm" />
          </Button>
        </div>
        <ul className="space-y-1">
          {layers.map((layer) => (
            <li key={layer.id} className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-0.5">
              <button
                type="button"
                className={cn(
                  'min-w-0 truncate text-left text-xs',
                  activeLayerId === layer.id ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => onActivateLayer(layer.id)}
              >
                {layer.name}
              </button>
              <span className="flex items-center gap-0.5">
                <button aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted/40"
                  onClick={() => onLockLayer(layer.id)}
                  aria-pressed={layer.locked}
                >
                  <Lock className={cn('icon-sm', layer.locked ? 'text-foreground' : 'opacity-40')} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted/40"
                  onClick={() => onToggleLayer(layer.id)}
                  aria-pressed={layer.visible}
                  aria-label={bilingualAria(`Show ${layer.name}`, `Εμφάνιση ${layer.name}`)}
                >
                  {layer.visible ? <Eye className="icon-sm" aria-hidden="true" /> : <EyeOff className="icon-sm" aria-hidden="true" />}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="relative z-0 min-h-0 flex-1 cursor-default overflow-y-auto overscroll-contain p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        // With nothing selected every control below is disabled, which left a
        // scrolling region with nothing in it a keyboard could reach (axe
        // scrollable-region-focusable). It takes focus itself only then.
        role="region"
        aria-label={bilingualAria(researchEn('inspector_region'), researchEl('inspector_region'))}
        tabIndex={idle ? 0 : undefined}
      >
        {idle && (
          <p className="mb-2 rounded-lg bg-muted/40 px-2 py-1.5 text-2xs leading-snug text-muted-foreground">
            <BilingualText
              en={researchEn('inspector_idle_hint')}
              el={researchEl('inspector_idle_hint')}
              stacked
              wrap
            />
          </p>
        )}
        <div className={cn(idle && 'opacity-50')}>
          <p className="mb-1.5 text-2xs font-medium text-muted-foreground">
            <BilingualText en={researchEn('format')} el={researchEl('format')} compact />
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {CANVAS_NOTE_FILLS.map((c) => (
              <button
                key={c.fill}
                type="button"
                disabled={idle}
                onClick={() => onStyle({ fill: c.fill })}
                className={cn(
                  'h-5 w-5 rounded-md border border-border',
                  fill && fill.toLowerCase() === c.fill.toLowerCase() && 'ring-1 ring-foreground/30',
                  fill && fill.toLowerCase() === c.accent.toLowerCase() && 'ring-1 ring-foreground/30',
                )}
                style={{ backgroundColor: c.fill }}
                aria-label={c.fill}
              />
            ))}
          </div>
          <label className="mb-2 flex items-center justify-between gap-2 text-2xs text-muted-foreground">
            <BilingualText en={researchEn('opacity')} el={researchEl('opacity')} compact />
            <input
              type="range"
              min={30}
              max={100}
              value={Math.round(opacity * 100)}
              disabled={idle}
              onChange={(e) => onStyle({ opacity: Number(e.target.value) / 100 })}
              className="w-24 accent-foreground"
            />
          </label>
          <label className="mb-2 flex items-center justify-between gap-2 text-2xs text-muted-foreground">
            <BilingualText en={researchEn('stroke')} el={researchEl('stroke')} compact />
            <input
              type="color"
              value={stroke || '#d4d4d8'}
              disabled={idle}
              onChange={(e) => onStyle({ stroke: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded-md border border-border bg-transparent"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
            <BilingualText en={researchEn('shadow')} el={researchEl('shadow')} compact />
            <input
              type="checkbox"
              checked={shadow}
              disabled={idle}
              onChange={(e) => onStyle({ shadow: e.target.checked })}
              className="rounded border-border"
            />
          </label>
        </div>

        <div className={cn('mt-2 border-t border-border pt-2', idle && 'opacity-50')}>
          <p className="mb-1.5 text-2xs font-medium text-muted-foreground">
            <BilingualText en={researchEn('note_text')} el={researchEl('note_text')} compact />
          </p>
          <div className="mb-1.5 flex flex-wrap gap-0.5">
            {[
              { format: 'bold', mark: 'B', en: researchEn('doc_bold'), el: researchEl('doc_bold') },
              { format: 'italic', mark: 'I', en: researchEn('doc_italic'), el: researchEl('doc_italic') },
              { format: 'underline', mark: 'U', en: researchEn('doc_underline'), el: researchEl('doc_underline') },
              { format: 'strike', mark: 'S', en: researchEn('doc_strike'), el: researchEl('doc_strike') },
              { format: 'h1', mark: 'H', en: researchEn('doc_heading'), el: researchEl('doc_heading') },
              { format: 'bullet', mark: '•', en: researchEn('doc_bullets'), el: researchEl('doc_bullets') },
              { format: 'number', mark: '1.', en: researchEn('doc_number'), el: researchEl('doc_number') },
              { format: 'check', mark: '☑', en: researchEn('doc_check'), el: researchEl('doc_check') },
              { format: 'highlight', mark: 'HL', en: researchEn('doc_highlight'), el: researchEl('doc_highlight') },
              { format: 'quote', mark: '“', en: researchEn('doc_quote'), el: researchEl('doc_quote') },
              { format: 'code', mark: '</>', en: researchEn('doc_code'), el: researchEl('doc_code') },
              { format: 'clear', mark: 'Tx', en: researchEn('doc_clear'), el: researchEl('doc_clear') },
            ].map((row) => (
              <button
                key={row.format}
                type="button"
                disabled={idle}
                title={bilingualAria(row.en, row.el)}
                onClick={() => onDocFormat(row.format)}
                className="h-7 min-w-7 rounded-lg px-1.5 text-2xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {row.mark}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            <RailButton disabled={idle} onClick={onFindReplace} en={researchEn('doc_find')} el={researchEl('doc_find')} />
            <RailButton disabled={idle} onClick={onInsertLink} en={researchEn('doc_link')} el={researchEl('doc_link')} />
            <RailButton disabled={idle} onClick={onCite} en={researchEn('doc_cite')} el={researchEl('doc_cite')} />
            <RailButton disabled={idle} onClick={onWordCount} en={researchEn('word_count')} el={researchEl('word_count')} />
            <RailButton disabled={selectedCount < 2} onClick={onMerge} en={researchEn('doc_merge')} el={researchEl('doc_merge')} />
            <RailButton disabled={idle} onClick={onSplit} en={researchEn('doc_split')} el={researchEl('doc_split')} />
            <RailButton disabled={idle} onClick={onCopyText} en={researchEn('doc_copy_text')} el={researchEl('doc_copy_text')} />
            <RailButton disabled={idle} onClick={onPastePlain} en={researchEn('doc_paste_plain')} el={researchEl('doc_paste_plain')} />
            <RailButton wide disabled={idle} onClick={onInsertDate} en={researchEn('doc_date')} el={researchEl('doc_date')} />
          </div>
        </div>

        <div className={cn('mt-2 border-t border-border pt-2', idle && 'opacity-50')}>
          <p className="mb-1.5 text-2xs font-medium text-muted-foreground">
            <BilingualText en={researchEn('arrange')} el={researchEl('arrange')} compact />
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            <RailButton disabled={idle} onClick={onRotate} en={researchEn('rotate')} el={researchEl('rotate')} />
            <RailButton disabled={selectedCount < 2} onClick={onMatchSize} en={researchEn('match_size')} el={researchEl('match_size')} />
            <RailButton disabled={idle} onClick={onCopyStyle} en={researchEn('copy_style')} el={researchEl('copy_style')} />
            <RailButton disabled={idle} onClick={onPasteStyle} en={researchEn('paste_style')} el={researchEl('paste_style')} />
            <RailButton disabled={selectedCount < 2} onClick={onTidy} en={researchEn('tidy')} el={researchEl('tidy')} />
            <RailButton disabled={idle} onClick={onHide} en={researchEn('hide_nodes')} el={researchEl('hide_nodes')} />
            <RailButton disabled={idle} onClick={onFlipH} en={researchEn('flip_h')} el={researchEl('flip_h')} />
            <RailButton disabled={idle} onClick={onFlipV} en={researchEn('flip_v')} el={researchEl('flip_v')} />
            <RailButton disabled={idle} onClick={onVote} en={researchEn('vote')} el={researchEl('vote')} />
            <RailButton disabled={idle && !isolated} onClick={onIsolate} en={isolated ? researchEn('reveal') : researchEn('isolate')} el={isolated ? researchEl('reveal') : researchEl('isolate')} />
            <RailButton disabled={idle} onClick={onFrame} en={researchEn('frame')} el={researchEl('frame')} />
            <RailButton disabled={idle} onClick={onHug} en={researchEn('hug')} el={researchEl('hug')} />
          </div>
        </div>

        <div className="mt-2 border-t border-border pt-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
            <LinkIcon className="icon-sm" />
            <BilingualText en={researchEn('link_to')} el={researchEl('link_to')} compact />
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {CANVAS_PRODUCT_LINKS.map((row) => (
              <Button
                key={row.href}
                variant="ghost"
                size="sm"
                disabled={idle}
                className={cn(
                  'h-auto min-h-7 justify-start whitespace-normal rounded-xl px-2 py-1 text-left text-2xs leading-tight',
                  productHref === row.href && 'bg-muted/60 text-foreground',
                )}
                title={bilingualAria(researchEn(row.label), researchEl(row.label))}
                onClick={() => onLink(row.href)}
              >
                <BilingualText en={researchEn(row.label)} el={researchEl(row.label)} compact wrap />
              </Button>
            ))}
          </div>
        </div>
      </div>
      {footer ? <div className="shrink-0 border-t border-border p-2">{footer}</div> : null}
    </div>
  );
}
