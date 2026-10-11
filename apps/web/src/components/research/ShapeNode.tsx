'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fillContrastText } from '@/lib/canvas/canvas-geometry';

export type ShapeVariant =
  | 'shape_rect'
  | 'shape_circle'
  | 'shape_diamond'
  | 'shape_triangle'
  | 'shape_line'
  | 'shape_arrow'
  | 'shape_text';

export interface ShapeMeta {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  textColor?: string;
  cornerRadius?: number;
}

const SHAPE_DEFAULTS: Record<ShapeVariant, { fill: string; stroke: string }> = {
  shape_rect:     { fill: '#3B82F6', stroke: '#1D4ED8' },
  shape_circle:   { fill: '#8B5CF6', stroke: '#6D28D9' },
  shape_diamond:  { fill: '#F59E0B', stroke: '#D97706' },
  shape_triangle: { fill: '#10B981', stroke: '#059669' },
  shape_line:     { fill: 'none',    stroke: '#94A3B8' },
  shape_arrow:    { fill: '#6366F1', stroke: '#4F46E5' },
  shape_text:     { fill: 'none',    stroke: 'none' },
};

const SHAPE_PALETTE: string[] = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#EC4899','#06B6D4','#84CC16','#F97316','#64748B',
];

interface ShapeNodeProps {
  variant: ShapeVariant;
  width: number;
  height: number;
  label?: string;
  meta?: ShapeMeta;
  isSelected: boolean;
  onLabelChange?: (label: string) => void;
  onMetaChange?: (meta: ShapeMeta) => void;
  onDelete?: () => void;
}

export function ShapeNode({
  variant,
  width,
  height,
  label = '',
  meta = {},
  isSelected,
  onLabelChange,
  onMetaChange,
  onDelete,
}: ShapeNodeProps) {
  const defaults = SHAPE_DEFAULTS[variant];
  const fill        = meta.fillColor   ?? defaults.fill;
  const stroke      = meta.strokeColor ?? defaults.stroke;
  const strokeWidth = meta.strokeWidth ?? 2;
  const opacity     = meta.opacity     ?? 1;
  const fontSize    = meta.fontSize    ?? 14;
  const textColor   = meta.textColor   ?? (variant === 'shape_text' ? '#1E293B' : fillContrastText(fill === 'none' ? undefined : fill));
  const cornerRadius = meta.cornerRadius ?? (variant === 'shape_rect' ? 8 : 0);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [showPalette, setShowPalette] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLabelCommit = useCallback(() => {
    setEditingLabel(false);
    onLabelChange?.(labelDraft);
  }, [labelDraft, onLabelChange]);

  const w = width;
  const h = height;

  /* ── Build the SVG path / element for each shape ── */
  function renderShape() {
    switch (variant) {
      case 'shape_rect':
        return (
          <rect
            x={strokeWidth}
            y={strokeWidth}
            width={w - strokeWidth * 2}
            height={h - strokeWidth * 2}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      case 'shape_circle':
        return (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={w / 2 - strokeWidth}
            ry={h / 2 - strokeWidth}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      case 'shape_diamond': {
        const pts = [
          `${w / 2},${strokeWidth}`,
          `${w - strokeWidth},${h / 2}`,
          `${w / 2},${h - strokeWidth}`,
          `${strokeWidth},${h / 2}`,
        ].join(' ');
        return (
          <polygon
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      }
      case 'shape_triangle': {
        const pts = [
          `${w / 2},${strokeWidth}`,
          `${w - strokeWidth},${h - strokeWidth}`,
          `${strokeWidth},${h - strokeWidth}`,
        ].join(' ');
        return (
          <polygon
            points={pts}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      }
      case 'shape_line':
        return (
          <line
            x1={strokeWidth}
            y1={h / 2}
            x2={w - strokeWidth}
            y2={h / 2}
            stroke={stroke}
            strokeWidth={strokeWidth * 1.5}
            opacity={opacity}
          />
        );
      case 'shape_arrow': {
        const aw = w - strokeWidth * 2;
        const ah = h;
        const arrowHeadW = Math.min(aw * 0.2, 24);
        return (
          <g opacity={opacity}>
            <line
              x1={strokeWidth}
              y1={ah / 2}
              x2={strokeWidth + aw - arrowHeadW}
              y2={ah / 2}
              stroke={stroke}
              strokeWidth={strokeWidth * 1.5}
            />
            <polygon
              points={[
                `${strokeWidth + aw},${ah / 2}`,
                `${strokeWidth + aw - arrowHeadW},${ah / 2 - arrowHeadW / 2}`,
                `${strokeWidth + aw - arrowHeadW},${ah / 2 + arrowHeadW / 2}`,
              ].join(' ')}
              fill={stroke}
            />
          </g>
        );
      }
      case 'shape_text':
        return null;
      default:
        return null;
    }
  }

  const showLabel = variant !== 'shape_line' && variant !== 'shape_arrow';
  const isTextOnly = variant === 'shape_text';

  return (
    <div
      className="relative group"
      style={{ width, height }}
      onDoubleClick={(e) => {
        if (!isTextOnly && showLabel) {
          e.stopPropagation();
          setEditingLabel(true);
          setLabelDraft(label);
          setTimeout(() => inputRef.current?.select(), 10);
        }
      }}
    >
      {/* SVG canvas */}
      {!isTextOnly && (
        <svg
          width={w}
          height={h}
          className="absolute inset-0"
          style={{ overflow: 'visible' }}
        >
          {renderShape()}
        </svg>
      )}

      {/* Text label or standalone text node */}
      {showLabel && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ padding: isTextOnly ? 4 : 8 }}
        >
          {editingLabel ? (
            <input
              ref={inputRef}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={handleLabelCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelCommit();
                if (e.key === 'Escape') { setEditingLabel(false); setLabelDraft(label); }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-transparent outline-none border-b border-white/50 text-center w-full pointer-events-auto"
              style={{
                color: isTextOnly ? '#1E293B' : textColor,
                fontSize,
                fontWeight: 600,
              }}
              autoFocus
            />
          ) : (
            <span
              className={cn(
                'text-center leading-snug select-none',
                isTextOnly && 'pointer-events-auto cursor-text',
              )}
              style={{
                color: isTextOnly ? '#1E293B' : textColor,
                fontSize,
                fontWeight: isTextOnly ? 500 : 600,
                wordBreak: 'break-word',
                maxWidth: '90%',
              }}
            >
              {label || (isTextOnly ? 'Text' : '')}
            </span>
          )}
        </div>
      )}

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-1 rounded pointer-events-none z-10" />
      )}

      {/* Floating controls — shown on hover/select */}
      {isSelected && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card border border-border rounded-lg px-1.5 py-1 shadow-lg z-20 pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Color palette */}
          <div className="relative">
            <button
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
              title="Change color"
              onClick={() => setShowPalette((v) => !v)}
            >
              <Palette className="icon-sm" />
            </button>
            {showPalette && (
              <div className="absolute top-8 left-0 bg-card border border-border rounded-lg p-2 shadow-xl z-30 flex flex-wrap gap-1 w-[120px]">
                {SHAPE_PALETTE.map((c) => (
                  <button
                    key={c}
                    className="w-5 h-5 rounded-full border-2 border-transparent hover:border-foreground/40 transition-all"
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      const darken = (hex: string) => {
                        const n = parseInt(hex.slice(1), 16);
                        const r = Math.max(0, ((n >> 16) & 255) - 40);
                        const g = Math.max(0, ((n >> 8) & 255) - 40);
                        const b = Math.max(0, (n & 255) - 40);
                        return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
                      };
                      onMetaChange?.({ ...meta, fillColor: c, strokeColor: darken(c) });
                      setShowPalette(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive-accessible transition-colors"
            title="Delete shape"
            onClick={onDelete}
          >
            <Trash2 className="icon-sm" />
          </button>
        </div>
      )}
    </div>
  );
}
