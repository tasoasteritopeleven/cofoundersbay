'use client';

export function CanvasRulers({
  pan,
  zoom,
  width,
  height,
}: {
  pan: { x: number; y: number };
  zoom: number;
  width: number;
  height: number;
}) {
  const step = zoom >= 1.4 ? 50 : zoom >= 0.7 ? 100 : 200;
  const xTicks: number[] = [];
  const yTicks: number[] = [];
  const startX = Math.floor(-pan.x / zoom / step) * step;
  const startY = Math.floor(-pan.y / zoom / step) * step;
  for (let v = startX; v * zoom + pan.x < width; v += step) xTicks.push(v);
  for (let v = startY; v * zoom + pan.y < height; v += step) yTicks.push(v);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-5 overflow-hidden border-b border-border bg-card/80">
        {xTicks.map((v) => (
          <span
            key={`x-${v}`}
            className="absolute top-0 text-2xs tabular-nums text-muted-foreground/70"
            style={{ left: pan.x + v * zoom }}
          >
            {v}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-8 overflow-hidden border-r border-border bg-card/80">
        {yTicks.map((v) => (
          <span
            key={`y-${v}`}
            className="absolute left-0.5 text-2xs tabular-nums text-muted-foreground/70"
            style={{ top: pan.y + v * zoom }}
          >
            {v}
          </span>
        ))}
      </div>
    </>
  );
}
