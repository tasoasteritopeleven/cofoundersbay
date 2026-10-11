'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, GripVertical, Palette, Lock, Unlock, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
export interface ResearchGroup {
  id: string;
  label: string;
  color: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  collapsed: boolean;
  locked: boolean;
  zIndex: number;
}

interface ResearchGroupFrameProps {
  group: ResearchGroup;
  isSelected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => void;
  onUpdate: (data: Partial<ResearchGroup>) => void;
  onDelete: () => void;
}

/* ─── Preset Colors ─── */
const GROUP_COLORS = [
  { name: 'Blue',    value: '#3B82F6' },
  { name: 'Purple',  value: '#8B5CF6' },
  { name: 'Green',   value: '#22C55E' },
  { name: 'Amber',   value: '#F59E0B' },
  { name: 'Rose',    value: '#F43F5E' },
  { name: 'Teal',    value: '#14B8A6' },
  { name: 'Orange',  value: '#F97316' },
  { name: 'Indigo',  value: '#6366F1' },
  { name: 'Cyan',    value: '#06B6D4' },
  { name: 'Pink',    value: '#EC4899' },
  { name: 'Lime',    value: '#84CC16' },
  { name: 'Slate',   value: '#64748B' },
];

export function ResearchGroupFrame({
  group,
  isSelected,
  onSelect,
  onDragStart,
  onResizeStart,
  onUpdate,
  onDelete,
}: ResearchGroupFrameProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(group.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Focus label input when editing starts
  useEffect(() => {
    if (editingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [editingLabel]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  const commitLabel = useCallback(() => {
    setEditingLabel(false);
    if (labelDraft.trim() && labelDraft !== group.label) {
      onUpdate({ label: labelDraft.trim() });
    } else {
      setLabelDraft(group.label);
    }
  }, [labelDraft, group.label, onUpdate]);

  const bgOpacity = '12'; // hex opacity for background fill

  return (
    <div
      className={cn(
        'absolute group select-none',
        'rounded-2xl border-2 transition-all duration-150',
        isSelected && 'ring-2 ring-primary/50 ring-offset-1',
        group.locked && 'border-dashed',
      )}
      style={{
        left: `${group.posX}px`,
        top: `${group.posY}px`,
        width: `${group.width}px`,
        height: group.collapsed ? 'auto' : `${group.height}px`,
        minHeight: group.collapsed ? undefined : '120px',
        borderColor: `${group.color}60`,
        backgroundColor: `${group.color}${bgOpacity}`,
        zIndex: group.zIndex || 1,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          if (group.locked) return;
          e.stopPropagation();
          onDragStart(e);
        }}
      >
        {/* Drag grip */}
        <GripVertical
          className="icon-sm opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
          style={{ color: group.color }}
        />

        {/* Label — inline editable */}
        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') { setLabelDraft(group.label); setEditingLabel(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-xs font-bold bg-transparent outline-none border-b-2 px-0 py-0"
            style={{ color: group.color, borderColor: group.color }}
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs font-bold uppercase tracking-wider truncate cursor-text"
            style={{ color: group.color }}
            onDoubleClick={(e) => {
              if (group.locked) return;
              e.stopPropagation();
              setLabelDraft(group.label);
              setEditingLabel(true);
            }}
          >
            {group.label || 'Untitled Group'}
          </span>
        )}

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          {/* Color picker */}
          <div ref={colorPickerRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
              className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Change color"
            >
              <Palette className="icon-sm" style={{ color: group.color }} />
            </button>
            {showColorPicker && (
              <div
                className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl p-2 z-50 grid grid-cols-4 gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { onUpdate({ color: c.value }); setShowColorPicker(false); }}
                    className={cn(
                      'w-6 h-6 rounded border-2 transition-all hover:scale-110',
                      group.color === c.value ? 'border-foreground scale-110' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate({ collapsed: !group.collapsed }); }}
            className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={group.collapsed ? 'Expand' : 'Collapse'}
          >
            {group.collapsed
              ? <Maximize2 className="icon-sm text-muted-foreground" />
              : <Minimize2 className="icon-sm text-muted-foreground" />
            }
          </button>

          {/* Lock toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate({ locked: !group.locked }); }}
            className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={group.locked ? 'Unlock' : 'Lock'}
          >
            {group.locked
              ? <Lock className="icon-sm text-muted-foreground" />
              : <Unlock className="icon-sm text-muted-foreground" />
            }
          </button>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-destructive/20 transition-colors"
            title="Delete group"
          >
            <X className="icon-sm text-destructive-accessible" />
          </button>
        </div>
      </div>

      {/* Collapsed body hint */}
      {group.collapsed && (
        <div className="px-3 pb-2">
          <span className="text-2xs text-muted-foreground italic">Group collapsed — nodes still visible</span>
        </div>
      )}

      {/* Resize handles — visible when selected and not locked/collapsed */}
      {isSelected && !group.locked && !group.collapsed && (
        <>
          <div
            className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity rounded-r"
            style={{ backgroundColor: `${group.color}20` }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }}
          />
          <div
            className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity rounded-b"
            style={{ backgroundColor: `${group.color}20` }}
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10"
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }}
          >
            <svg viewBox="0 0 14 14" className="w-full h-full">
              <path d="M12 2L2 12M12 6L6 12M12 10L10 12" stroke={group.color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
