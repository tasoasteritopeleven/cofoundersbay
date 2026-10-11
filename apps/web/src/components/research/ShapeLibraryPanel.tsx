'use client';

import { useState, useMemo } from 'react';
import { X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResearchNodeType } from '@/lib/api';
import type { ShapeVariant, ShapeMeta } from './ShapeNode';
import { bilingualInline } from '@/lib/i18n/format';

/* ─── Shape template definition ────────────────────────────────────────── */

export interface ShapeTemplate {
  id: string;
  label: string;
  type: ResearchNodeType;
  meta: Partial<ShapeMeta>;
  defaultTitle: string;
  defaultWidth: number;
  defaultHeight: number;
  preview: React.ReactNode;
}

interface ShapeCategory {
  name: string;
  templates: ShapeTemplate[];
}

/* ─── Tiny SVG preview renderer ────────────────────────────────────────── */

function ShapePreview({ type, fill, stroke, label }: { type: ShapeVariant; fill: string; stroke: string; label?: string }) {
  const f = fill;
  const s = stroke;
  const W = 52, H = 36;
  const cx = W / 2, cy = H / 2;

  switch (type) {
    case 'shape_rect':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={4} y={4} width={W - 8} height={H - 8} rx={3} fill={f} stroke={s} strokeWidth={1.5} />
          {label && <text x={cx} y={cy + 4} fontSize={8} textAnchor="middle" fill={s} fontWeight="600">{label}</text>}
        </svg>
      );
    case 'shape_circle':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <ellipse cx={cx} cy={cy} rx={cx - 4} ry={cy - 4} fill={f} stroke={s} strokeWidth={1.5} />
          {label && <text x={cx} y={cy + 4} fontSize={8} textAnchor="middle" fill={s} fontWeight="600">{label}</text>}
        </svg>
      );
    case 'shape_diamond':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <polygon points={`${cx},4 ${W - 4},${cy} ${cx},${H - 4} 4,${cy}`} fill={f} stroke={s} strokeWidth={1.5} />
          {label && <text x={cx} y={cy + 4} fontSize={7} textAnchor="middle" fill={s} fontWeight="600">{label}</text>}
        </svg>
      );
    case 'shape_triangle':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <polygon points={`${cx},4 ${W - 4},${H - 4} 4,${H - 4}`} fill={f} stroke={s} strokeWidth={1.5} />
        </svg>
      );
    case 'shape_line':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1={4} y1={cy} x2={W - 4} y2={cy} stroke={s} strokeWidth={2} />
        </svg>
      );
    case 'shape_arrow':
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs><marker id="pv-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={s} /></marker></defs>
          <line x1={4} y1={cy} x2={W - 8} y2={cy} stroke={s} strokeWidth={2} markerEnd="url(#pv-arr)" />
        </svg>
      );
    default:
      return <div className="w-[52px] h-[36px] rounded border border-dashed" style={{ borderColor: s }} />;
  }
}

/* ─── Shape library data ────────────────────────────────────────────────── */

const COLORS = {
  blue:    { fill: '#DBEAFE', stroke: '#3B82F6' },
  green:   { fill: '#D1FAE5', stroke: '#10B981' },
  yellow:  { fill: '#FEF3C7', stroke: '#F59E0B' },
  red:     { fill: '#FEE2E2', stroke: '#EF4444' },
  purple:  { fill: '#EDE9FE', stroke: '#8B5CF6' },
  gray:    { fill: '#F1F5F9', stroke: '#64748B' },
  orange:  { fill: '#FFEDD5', stroke: '#F97316' },
  cyan:    { fill: '#CFFAFE', stroke: '#06B6D4' },
};

function mkShape(
  id: string,
  label: string,
  type: 'rect' | 'circle' | 'diamond' | 'triangle' | 'line' | 'arrow',
  colorKey: keyof typeof COLORS,
  defaultTitle = '',
  w = 160,
  h = 90,
): ShapeTemplate {
  const { fill, stroke } = COLORS[colorKey];
  const variant: ShapeVariant = `shape_${type}` as ShapeVariant;
  return {
    id,
    label,
    type: variant as ResearchNodeType,
    meta: { fillColor: fill, strokeColor: stroke, strokeWidth: 2, opacity: 1 } satisfies Partial<ShapeMeta>,
    defaultTitle,
    defaultWidth: w,
    defaultHeight: h,
    preview: <ShapePreview type={variant} fill={fill} stroke={stroke} />,
  };
}

const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    name: 'Basic',
    templates: [
      mkShape('rect-blue',     'Rectangle',  'rect',     'blue',   'Label'),
      mkShape('circle-green',  'Circle',     'circle',   'green',  'Label', 120, 120),
      mkShape('diamond-yellow','Diamond',    'diamond',  'yellow', 'Label', 140, 100),
      mkShape('triangle-red',  'Triangle',   'triangle', 'red',    '',      120, 100),
      mkShape('line-gray',     'Line',       'line',     'gray',   '',      200, 40),
      mkShape('arrow-purple',  'Arrow',      'arrow',    'purple', '',      200, 40),
    ],
  },
  {
    name: 'Flowchart',
    templates: [
      { ...mkShape('flow-start',  'Start / End',  'circle', 'green', 'Start', 120, 60), label: 'Start / End' },
      { ...mkShape('flow-process','Process',      'rect',   'blue',  'Process', 160, 80) },
      { ...mkShape('flow-decision','Decision',    'diamond','yellow','Yes / No?', 160, 100) },
      mkShape('flow-data',    'Data / I/O',   'rect',   'cyan',   'Input',  160, 80),
      mkShape('flow-end',     'Terminator',   'circle', 'red',    'End',    120, 60),
      mkShape('flow-doc',     'Document',     'rect',   'orange', 'Doc',    160, 80),
    ],
  },
  {
    name: 'UML',
    templates: [
      mkShape('uml-class',    'Class',        'rect',   'purple', 'ClassName', 180, 120),
      mkShape('uml-actor',    'Actor',        'circle', 'gray',   'Actor',     80, 80),
      mkShape('uml-usecase',  'Use Case',     'circle', 'blue',   'Use Case',  160, 80),
      mkShape('uml-note',     'Note',         'rect',   'yellow', 'Note…',     160, 90),
      mkShape('uml-interface','Interface',    'circle', 'cyan',   '«interface»',120, 80),
      mkShape('uml-component','Component',    'rect',   'orange', '«component»',160, 80),
    ],
  },
  {
    name: 'Cloud / Infra',
    templates: [
      mkShape('cloud-server', 'Server',       'rect',   'gray',   'Server',    160, 80),
      mkShape('cloud-db',     'Database',     'circle', 'blue',   'DB',        120, 80),
      mkShape('cloud-svc',    'Service',      'diamond','cyan',   'Service',   160, 90),
      mkShape('cloud-lambda', 'Function',     'triangle','orange','λ',          120, 90),
      mkShape('cloud-queue',  'Queue',        'rect',   'purple', 'Queue',     160, 70),
      mkShape('cloud-storage','Storage',      'rect',   'green',  'Storage',   160, 80),
    ],
  },
];

/* ─── Props ────────────────────────────────────────────────────────────── */

interface ShapeLibraryPanelProps {
  onClose: () => void;
  onAddShape: (template: ShapeTemplate) => void;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function ShapeLibraryPanel({ onClose, onAddShape }: ShapeLibraryPanelProps) {
  const [search, setSearch]           = useState('');
  const [openCats, setOpenCats]       = useState<Set<string>>(new Set(SHAPE_CATEGORIES.map((c) => c.name)));

  const filtered = useMemo<ShapeCategory[]>(() => {
    if (!search.trim()) return SHAPE_CATEGORIES;
    const q = search.toLowerCase();
    return SHAPE_CATEGORIES
      .map((cat) => ({ ...cat, templates: cat.templates.filter((t) => t.label.toLowerCase().includes(q)) }))
      .filter((cat) => cat.templates.length > 0);
  }, [search]);

  const toggleCat = (name: string) =>
    setOpenCats((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return (
    <div
      className="absolute z-40 inset-x-2 top-2 sm:inset-x-auto sm:top-14 sm:left-14 sm:w-64 w-auto bg-card border rounded-xl shadow-xl flex flex-col overflow-hidden"
      style={{ maxHeight: 'min(70dvh, calc(100% - 6rem))' }}
      data-canvas-chrome
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0 bg-muted/30">
        <span className="text-2xs font-bold uppercase tracking-wider text-foreground flex-1">Shape Library</span>
        <button aria-label="Close" onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
          <X className="icon-sm" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-2 h-7 rounded-md border bg-background">
          <Search className="icon-sm text-muted-foreground/60 shrink-0" />
          <input
            className="flex-1 text-2xs bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder={bilingualInline("Search shapes…", "Αναζήτηση σχημάτων…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((cat) => {
          const open = openCats.has(cat.name);
          return (
            <div key={cat.name} className="border-b last:border-0">
              {/* Category header */}
              <button
                className="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-muted/40 transition-colors text-left"
                onClick={() => toggleCat(cat.name)}
              >
                {open ? <ChevronDown className="icon-sm text-muted-foreground/60" /> : <ChevronRight className="icon-sm text-muted-foreground/60" />}
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.name}</span>
                <span className="ml-auto text-2xs text-muted-foreground/40">{cat.templates.length}</span>
              </button>

              {/* Shapes grid */}
              {open && (
                <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
                  {cat.templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => onAddShape(tpl)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-1.5 rounded-lg border border-transparent',
                        'hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer',
                        'active:scale-95',
                      )}
                      title={`Add ${tpl.label}`}
                    >
                      <div className="flex items-center justify-center w-[52px] h-[36px]">
                        {tpl.preview}
                      </div>
                      <span className="text-2xs text-muted-foreground font-medium text-center leading-tight max-w-full truncate">
                        {tpl.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-8 text-2xs text-muted-foreground/50">
            No shapes match "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
