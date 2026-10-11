'use client';

import { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ResearchNode } from '@/lib/api';
import { nodePaintColor } from '@/lib/canvas/canvas-geometry';

/** Pixel drawing surface. The framed chrome is +`BOARD_MINIMAP_FRAME_PX`. */
export const BOARD_MINIMAP_DESKTOP_W = 180;
export const BOARD_MINIMAP_DESKTOP_H = 120;
export const BOARD_MINIMAP_COMPACT_W = 112;
export const BOARD_MINIMAP_COMPACT_H = 76;
/** Border on the floating frame (width/height style is surface + this). */
export const BOARD_MINIMAP_FRAME_PX = 2;
const PADDING = 20;

function getNodeColor(type: string, color: string | null): string {
  if (color) return color;
  const MAP: Record<string, string> = {
    note: '#FDE68A',
    document: '#93C5FD',
    image: '#86EFAC',
    pdf: '#FCA5A5',
    link: '#C4B5FD',
    reference: '#6EE7B7',
  };
  return MAP[type] ?? '#94A3B8';
}

interface BoardMiniMapProps {
  nodes: ResearchNode[];
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  onNavigate: (pan: { x: number; y: number }) => void;
  /** Phone-sized map: smaller drawing surface so it clears the draw strip. */
  compact?: boolean;
  /** Fill the parent instead of drawing a floating, fixed-size frame. */
  embedded?: boolean;
}

export function BoardMiniMap({
  nodes,
  pan,
  zoom,
  viewportWidth,
  viewportHeight,
  onNavigate,
  compact = false,
  embedded = false,
}: BoardMiniMapProps) {
  const miniW = compact ? BOARD_MINIMAP_COMPACT_W : BOARD_MINIMAP_DESKTOP_W;
  const miniH = compact ? BOARD_MINIMAP_COMPACT_H : BOARD_MINIMAP_DESKTOP_H;

  // Compute bounding box of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 2000, maxY: 1500 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.posX);
      minY = Math.min(minY, n.posY);
      maxX = Math.max(maxX, n.posX + n.width);
      maxY = Math.max(maxY, n.posY + n.height);
    }
    // Add padding around bounds
    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      maxX: maxX + PADDING,
      maxY: maxY + PADDING,
    };
  }, [nodes]);

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const scaleX = miniW / worldW;
  const scaleY = miniH / worldH;
  const scale = Math.min(scaleX, scaleY, 1);

  const toMini = useCallback((wx: number, wy: number) => ({
    x: (wx - bounds.minX) * scale,
    y: (wy - bounds.minY) * scale,
  }), [bounds, scale]);

  // Viewport rect in world coords
  const vpWorldX = -pan.x / zoom;
  const vpWorldY = -pan.y / zoom;
  const vpWorldW = viewportWidth / zoom;
  const vpWorldH = viewportHeight / zoom;

  const vpMini = toMini(vpWorldX, vpWorldY);
  const vpMiniW = Math.max(vpWorldW * scale, 8);
  const vpMiniH = Math.max(vpWorldH * scale, 8);

  // Client point -> pan. The rendered box can differ from the viewBox when the map is
  // embedded and stretches to its parent, so normalise through the measured rect first.
  const navigateFromClient = useCallback((clientX: number, clientY: number, currentTarget: Element) => {
    const rect = currentTarget.getBoundingClientRect();
    const mx = ((clientX - rect.left) / Math.max(rect.width, 1)) * miniW;
    const my = ((clientY - rect.top) / Math.max(rect.height, 1)) * miniH;
    // Convert minimap point to world coords
    const worldX = mx / scale + bounds.minX;
    const worldY = my / scale + bounds.minY;
    // Center the viewport on the clicked world point
    const newPanX = -(worldX * zoom) + viewportWidth / 2;
    const newPanY = -(worldY * zoom) + viewportHeight / 2;
    onNavigate({ x: newPanX, y: newPanY });
  }, [scale, bounds, zoom, viewportWidth, viewportHeight, onNavigate, miniW, miniH]);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Keep the click from reaching the board, which would start a pan.
    e.stopPropagation();
    navigateFromClient(e.clientX, e.clientY, e.currentTarget);
  }, [navigateFromClient]);

  return (
    <div
      data-compact={compact ? 'true' : 'false'}
      className={cn(
        'overflow-hidden',
        embedded
          ? 'h-full w-full rounded-xl bg-muted/30'
          : 'pointer-events-auto rounded-xl border border-border bg-muted/80 shadow-lg backdrop-blur-sm',
      )}
      style={embedded ? undefined : { width: miniW + BOARD_MINIMAP_FRAME_PX, height: miniH + BOARD_MINIMAP_FRAME_PX }}
    >
      <svg
        {...(embedded ? {} : { width: miniW, height: miniH })}
        viewBox={`0 0 ${miniW} ${miniH}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn('cursor-crosshair touch-manipulation', embedded && 'h-full w-full')}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClick}
        role="img"
        aria-label="Canvas mini-map"
      >
        {/* Background */}
        <rect x={0} y={0} width={miniW} height={miniH} fill="hsl(var(--muted))" />

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = toMini(node.posX, node.posY);
          const w = Math.max(node.width * scale, 3);
          const h = Math.max(node.height * scale, 3);
          return (
            <rect
              key={node.id}
              x={pos.x}
              y={pos.y}
              width={w}
              height={h}
              rx={1}
              fill={nodePaintColor(node.color, node.metadata) ?? getNodeColor(node.type, node.color)}
              opacity={0.75}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={Math.max(0, vpMini.x)}
          y={Math.max(0, vpMini.y)}
          width={Math.min(vpMiniW, miniW)}
          height={Math.min(vpMiniH, miniH)}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          rx={2}
          opacity={0.8}
        />
      </svg>
    </div>
  );
}
