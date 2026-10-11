'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TemplateVariant = 'visual_bmc' | 'visual_lean' | 'visual_swot';

/* ─── Cell definitions ─────────────────────────────────────────────────── */

interface CellDef {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  colStart: number; // 1-indexed CSS grid column start
  colSpan: number;
  rowStart: number;
  rowSpan: number;
  accentColor: string;
}

const BMC_CELLS: CellDef[] = [
  { id: 'key_partners',          label: 'Key Partners',          emoji: '🤝', hint: 'Who are your key partners and suppliers?',                colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2, accentColor: '#3B82F6' },
  { id: 'key_activities',        label: 'Key Activities',        emoji: '⚙️', hint: 'What key activities does your value proposition require?',  colStart: 3, colSpan: 2, rowStart: 1, rowSpan: 1, accentColor: '#8B5CF6' },
  { id: 'value_propositions',    label: 'Value Propositions',    emoji: '💎', hint: 'What value do you deliver to customers?',                   colStart: 5, colSpan: 2, rowStart: 1, rowSpan: 2, accentColor: '#EC4899' },
  { id: 'customer_relationships',label: 'Customer Relationships',emoji: '💬', hint: 'What type of relationship does each segment expect?',       colStart: 7, colSpan: 2, rowStart: 1, rowSpan: 1, accentColor: '#10B981' },
  { id: 'customer_segments',     label: 'Customer Segments',     emoji: '👥', hint: 'Who are you creating value for?',                           colStart: 9, colSpan: 2, rowStart: 1, rowSpan: 2, accentColor: '#F97316' },
  { id: 'key_resources',         label: 'Key Resources',         emoji: '🔧', hint: 'What key resources does your value proposition require?',   colStart: 3, colSpan: 2, rowStart: 2, rowSpan: 1, accentColor: '#0EA5E9' },
  { id: 'channels',              label: 'Channels',              emoji: '📡', hint: 'Through which channels do customers want to be reached?',   colStart: 7, colSpan: 2, rowStart: 2, rowSpan: 1, accentColor: '#06B6D4' },
  { id: 'cost_structure',        label: 'Cost Structure',        emoji: '💰', hint: 'What are the most important costs in your business model?', colStart: 1, colSpan: 5, rowStart: 3, rowSpan: 1, accentColor: '#EF4444' },
  { id: 'revenue_streams',       label: 'Revenue Streams',       emoji: '💵', hint: 'For what value are customers willing to pay?',              colStart: 6, colSpan: 5, rowStart: 3, rowSpan: 1, accentColor: '#22C55E' },
];

const LEAN_CELLS: CellDef[] = [
  { id: 'problem',           label: 'Problem',                emoji: '🔥', hint: 'Top 3 problems your customers face',                colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 1, accentColor: '#EF4444' },
  { id: 'solution',          label: 'Solution',               emoji: '💡', hint: 'Top 3 features that solve the problems',            colStart: 3, colSpan: 2, rowStart: 1, rowSpan: 1, accentColor: '#8B5CF6' },
  { id: 'uvp',               label: 'Unique Value Prop',      emoji: '✨', hint: 'Single, clear, compelling message',                 colStart: 5, colSpan: 2, rowStart: 1, rowSpan: 2, accentColor: '#EC4899' },
  { id: 'unfair_advantage',  label: 'Unfair Advantage',       emoji: '🏆', hint: 'Cannot be easily copied or bought',                 colStart: 7, colSpan: 2, rowStart: 1, rowSpan: 1, accentColor: '#F97316' },
  { id: 'customer_segments', label: 'Customer Segments',      emoji: '👥', hint: 'Target customers and users',                       colStart: 9, colSpan: 2, rowStart: 1, rowSpan: 2, accentColor: '#06B6D4' },
  { id: 'existing_alts',     label: 'Existing Alternatives',  emoji: '🔄', hint: 'How do they currently solve this problem?',         colStart: 1, colSpan: 2, rowStart: 2, rowSpan: 1, accentColor: '#94A3B8' },
  { id: 'key_metrics',       label: 'Key Metrics',            emoji: '📊', hint: 'Key activities you measure',                       colStart: 3, colSpan: 2, rowStart: 2, rowSpan: 1, accentColor: '#10B981' },
  { id: 'channels',          label: 'Channels',               emoji: '📡', hint: 'Path to customers',                               colStart: 7, colSpan: 2, rowStart: 2, rowSpan: 1, accentColor: '#0EA5E9' },
  { id: 'cost_structure',    label: 'Cost Structure',         emoji: '💰', hint: 'Customer acquisition costs, hosting, etc.',        colStart: 1, colSpan: 5, rowStart: 3, rowSpan: 1, accentColor: '#EF4444' },
  { id: 'revenue_streams',   label: 'Revenue Streams',        emoji: '💵', hint: 'Revenue model, lifetime value, gross margin',     colStart: 6, colSpan: 5, rowStart: 3, rowSpan: 1, accentColor: '#22C55E' },
];

const SWOT_CELLS: CellDef[] = [
  { id: 'strengths',     label: 'Strengths',     emoji: '💪', hint: 'Internal positive factors',  colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1, accentColor: '#22C55E' },
  { id: 'weaknesses',    label: 'Weaknesses',    emoji: '⚠️', hint: 'Internal negative factors',  colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1, accentColor: '#EF4444' },
  { id: 'opportunities', label: 'Opportunities', emoji: '🚀', hint: 'External positive factors',  colStart: 1, colSpan: 1, rowStart: 2, rowSpan: 1, accentColor: '#3B82F6' },
  { id: 'threats',       label: 'Threats',       emoji: '⚡', hint: 'External negative factors',  colStart: 2, colSpan: 1, rowStart: 2, rowSpan: 1, accentColor: '#F59E0B' },
];

const TEMPLATE_CONFIG: Record<TemplateVariant, {
  cells: CellDef[];
  gridCols: number;
  gridRows: number;
  title: string;
  headerColor: string;
}> = {
  visual_bmc:  { cells: BMC_CELLS,  gridCols: 10, gridRows: 3, title: 'Business Model Canvas', headerColor: '#3B82F6' },
  visual_lean: { cells: LEAN_CELLS, gridCols: 10, gridRows: 3, title: 'Lean Canvas',            headerColor: '#8B5CF6' },
  visual_swot: { cells: SWOT_CELLS, gridCols: 2,  gridRows: 2, title: 'SWOT Analysis',          headerColor: '#10B981' },
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */

export function getTemplateDefaultContent(variant: TemplateVariant): string {
  const { cells } = TEMPLATE_CONFIG[variant];
  const empty: Record<string, string> = {};
  cells.forEach((c) => { empty[c.id] = ''; });
  return JSON.stringify({ cells: empty });
}

export function parseTemplateCells(content: string | null): Record<string, string> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return (parsed?.cells && typeof parsed.cells === 'object') ? parsed.cells : {};
  } catch {
    return {};
  }
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface VisualTemplateNodeProps {
  variant: TemplateVariant;
  width: number;
  height: number;
  content: string | null;
  isSelected: boolean;
  readOnly?: boolean;
  onChange?: (newContent: string) => void;
  onDelete?: () => void;
}

export function VisualTemplateNode({
  variant,
  width,
  height,
  content,
  isSelected,
  readOnly = false,
  onChange,
  onDelete,
}: VisualTemplateNodeProps) {
  const config = TEMPLATE_CONFIG[variant];
  const cells = parseTemplateCells(content);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [showHint, setShowHint] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commitCell = useCallback((cellId: string, value: string) => {
    setEditingCell(null);
    if (!onChange) return;
    const updated = { ...cells, [cellId]: value };
    onChange(JSON.stringify({ cells: updated }));
  }, [cells, onChange]);

  const handleCellDoubleClick = useCallback((e: React.MouseEvent, cellId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    setDraftValue(cells[cellId] || '');
    setEditingCell(cellId);
    setTimeout(() => textareaRef.current?.focus(), 10);
  }, [cells, readOnly]);

  const headerH = 32;
  const innerH = height - headerH;
  const colFrac = width / config.gridCols;
  const rowFrac = innerH / config.gridRows;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 bg-card shadow-sm',
        isSelected && 'ring-2 ring-primary ring-offset-1',
      )}
      style={{ width, height, borderColor: `${config.headerColor}60` }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{ height: headerH, background: `${config.headerColor}18`, borderBottom: `1px solid ${config.headerColor}30` }}
      >
        <span className="text-2xs font-bold tracking-wide" style={{ color: config.headerColor }}>
          {config.title.toUpperCase()}
        </span>
        {!readOnly && (
          <button aria-label="Delete"
            onMouseDown={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive-accessible opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all"
          >
            <Trash2 className="icon-sm" />
          </button>
        )}
      </div>

      {/* Grid area */}
      <div className="absolute" style={{ top: headerH, left: 0, right: 0, bottom: 0 }}>
        {config.cells.map((cell) => {
          const x      = (cell.colStart - 1) * colFrac;
          const y      = (cell.rowStart - 1) * rowFrac;
          const cw     = cell.colSpan * colFrac;
          const ch     = cell.rowSpan * rowFrac;
          const isEdit = editingCell === cell.id;
          const value  = cells[cell.id] || '';

          return (
            <div
              key={cell.id}
              className="absolute overflow-hidden"
              style={{
                left: x,
                top: y,
                width: cw,
                height: ch,
                borderRight:  `1px solid ${config.headerColor}20`,
                borderBottom: `1px solid ${config.headerColor}20`,
              }}
            >
              {/* Cell header */}
              <div
                className="flex items-center gap-1 px-2 pt-1.5 pb-0.5"
                style={{ borderBottom: `1px solid ${cell.accentColor}20` }}
              >
                <span className="text-2xs">{cell.emoji}</span>
                <span
                  className="text-2xs font-semibold uppercase tracking-wide truncate flex-1"
                  style={{ color: cell.accentColor }}
                >
                  {cell.label}
                </span>
                <button aria-label="Show hint"
                  onMouseDown={(e) => { e.stopPropagation(); setShowHint(showHint === cell.id ? null : cell.id); }}
                  className="opacity-0 hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center text-muted-foreground/40"
                >
                  <Info className="icon-sm" />
                </button>
              </div>

              {/* Hint tooltip */}
              {showHint === cell.id && (
                <div
                  className="absolute top-7 left-2 right-2 bg-card border border-border rounded-lg p-1.5 shadow-lg z-50 pointer-events-none"
                  style={{ zIndex: 60 }}
                >
                  <p className="text-2xs text-muted-foreground leading-relaxed">{cell.hint}</p>
                </div>
              )}

              {/* Cell content */}
              <div
                className="px-2 pt-0.5 pb-1 h-[calc(100%-28px)] overflow-hidden"
                onDoubleClick={(e) => handleCellDoubleClick(e, cell.id)}
              >
                {isEdit ? (
                  <textarea
                    ref={textareaRef}
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    onBlur={() => commitCell(cell.id, draftValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setEditingCell(null); setDraftValue(''); }
                      if (e.key === 'Enter' && e.ctrlKey) commitCell(cell.id, draftValue);
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full h-full resize-none bg-transparent outline-none text-2xs leading-relaxed text-foreground"
                    placeholder={cell.hint}
                  />
                ) : (
                  <p
                    className={cn(
                      'text-2xs leading-relaxed text-foreground/80 whitespace-pre-wrap overflow-hidden',
                      !value && 'text-muted-foreground/40 italic',
                    )}
                    style={{ maxHeight: ch - 30 }}
                  >
                    {value || 'Double-click to edit…'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-1 rounded-xl pointer-events-none z-10" />
      )}
    </div>
  );
}
