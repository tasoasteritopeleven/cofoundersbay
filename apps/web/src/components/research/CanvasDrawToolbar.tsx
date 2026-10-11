'use client';

import { useCallback } from 'react';
import {
  MousePointer2, Hand, Square, Circle, Diamond, Triangle,
  Minus, MoveRight, Type, StickyNote, GitBranch,
  Spline, Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type DrawTool =
  | 'select'
  | 'hand'
  | 'shape_rect'
  | 'shape_circle'
  | 'shape_diamond'
  | 'shape_triangle'
  | 'shape_line'
  | 'shape_arrow'
  | 'shape_text'
  | 'note'
  | 'connect'
  | 'mermaid';

interface ToolGroup {
  label: string;
  tools: ToolDef[];
}

interface ToolDef {
  tool: DrawTool;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  color?: string;
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: 'Selection',
    tools: [
      { tool: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
      { tool: 'hand',   icon: Hand,          label: 'Pan',    shortcut: 'H' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { tool: 'shape_rect',     icon: Square,    label: 'Rectangle', shortcut: 'R', color: '#3B82F6' },
      { tool: 'shape_circle',   icon: Circle,    label: 'Circle',    shortcut: 'O', color: '#8B5CF6' },
      { tool: 'shape_diamond',  icon: Diamond,   label: 'Diamond',   shortcut: 'D', color: '#F59E0B' },
      { tool: 'shape_triangle', icon: Triangle,  label: 'Triangle',  shortcut: 'T', color: '#10B981' },
      { tool: 'shape_line',     icon: Minus,     label: 'Line',      shortcut: 'L', color: '#94A3B8' },
      { tool: 'shape_arrow',    icon: MoveRight, label: 'Arrow',     shortcut: 'A', color: '#6366F1' },
    ],
  },
  {
    label: 'Text & Notes',
    tools: [
      { tool: 'shape_text', icon: Type,        label: 'Text Label', shortcut: 'X', color: '#475569' },
      { tool: 'note',       icon: StickyNote,  label: 'Sticky Note', shortcut: 'N', color: '#F59E0B' },
    ],
  },
  {
    label: 'Connect',
    tools: [
      { tool: 'connect', icon: GitBranch, label: 'Connector', shortcut: 'C', color: '#10B981' },
    ],
  },
  {
    label: 'Diagram',
    tools: [
      { tool: 'mermaid', icon: Spline, label: 'Mermaid Diagram', shortcut: 'M', color: '#EC4899' },
    ],
  },
];

interface CanvasDrawToolbarProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
}

export function CanvasDrawToolbar({ activeTool, onToolChange, onToggleLibrary, libraryOpen }: CanvasDrawToolbarProps) {
  const handlePick = useCallback((tool: DrawTool) => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onToolChange(tool);
  }, [onToolChange]);

  return (
    <div
      data-canvas-chrome
      role="toolbar"
      aria-label="Drawing tools"
      className={cn(
        'flex items-center gap-1 py-1.5 px-1.5 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-40 select-none',
        // Phone: horizontal strip that can scroll. Tablet/desktop: vertical rail.
        // `sm:w-11` is the 44px the inline width used to set, so the rail keeps
        // its size while the phone strip is free to be as wide as the screen.
        'flex-row max-w-full overflow-x-auto touch-pan-x scrollbar-hide',
        'sm:flex-col sm:overflow-visible sm:touch-auto sm:w-11',
      )}
    >
      {TOOL_GROUPS.map((group, gi) => (
        <div
          key={group.label}
          role="group"
          aria-label={group.label}
          className="flex flex-row sm:flex-col items-center gap-0.5 shrink-0"
        >
          {gi > 0 && (
            <div
              aria-hidden="true"
              className="w-px h-5 mx-0.5 sm:w-6 sm:h-px sm:mx-0 sm:my-0.5 bg-border/60 shrink-0"
            />
          )}
          {group.tools.map((def) => {
            const Icon = def.icon;
            const isActive = activeTool === def.tool;
            const title = `${def.label}${def.shortcut ? ` (${def.shortcut})` : ''}`;
            return (
              <button
                key={def.tool}
                type="button"
                onClick={handlePick(def.tool)}
                title={title}
                aria-label={title}
                aria-pressed={isActive}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-md transition-all duration-100 shrink-0 sm:h-8 sm:w-8',
                  'hover:bg-secondary active:scale-95 touch-manipulation',
                  isActive
                    ? 'bg-primary/15 ring-1 ring-primary/50 text-primary-accessible'
                    : 'text-muted-foreground',
                )}
                style={isActive && def.color ? { color: def.color } : undefined}
              >
                <Icon className="icon-sm" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ))}

      {onToggleLibrary && (
        <>
          <div aria-hidden="true" className="w-px h-5 mx-0.5 sm:w-6 sm:h-px sm:mx-0 sm:my-0.5 bg-border/60 shrink-0" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleLibrary(); }}
            title="Shape Library (Shapes panel)"
            aria-label="Shape Library"
            aria-pressed={!!libraryOpen}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-md transition-all duration-100 shrink-0 sm:h-8 sm:w-8',
              'hover:bg-secondary active:scale-95 touch-manipulation',
              libraryOpen ? 'bg-status-accent/15 ring-1 ring-status-accent/50 text-status-accent' : 'text-muted-foreground',
            )}
          >
            <Library className="icon-sm" aria-hidden="true" />
          </button>
        </>
      )}

      <div aria-hidden="true" className="w-px h-5 mx-0.5 sm:w-6 sm:h-px sm:mx-0 sm:my-0.5 bg-border/60 shrink-0 hidden sm:block" />
      <div
        className="w-2 h-2 rounded-full transition-colors duration-200 shrink-0 hidden sm:block"
        style={{
          backgroundColor:
            TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.tool === activeTool)?.color ?? '#3B82F6',
        }}
        title="Active tool"
        aria-hidden="true"
      />
    </div>
  );
}
