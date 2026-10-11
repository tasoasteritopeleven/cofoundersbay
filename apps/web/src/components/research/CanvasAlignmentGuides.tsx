'use client';

import type { AlignmentGuide } from '@/lib/canvas/canvas-geometry';

export function CanvasAlignmentGuides({
  guides,
  pan,
  zoom,
}: {
  guides: AlignmentGuide[];
  pan: { x: number; y: number };
  zoom: number;
}) {
  if (guides.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <div
            key={`x-${i}-${g.pos}`}
            className="absolute top-0 h-full w-px bg-foreground/25"
            style={{ left: pan.x + g.pos * zoom }}
          />
        ) : (
          <div
            key={`y-${i}-${g.pos}`}
            className="absolute left-0 h-px w-full bg-foreground/25"
            style={{ top: pan.y + g.pos * zoom }}
          />
        ),
      )}
    </div>
  );
}
