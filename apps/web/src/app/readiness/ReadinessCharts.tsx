'use client';

import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

type RadarDatum = { dimension: string; score: number; benchmark: number };
type HistoryDatum = { week: string; score: number; accel: number; invest: number };

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  fontSize: 12.2412,
};

/**
 * Two balanced lines for a long axis label.
 *
 * Recharts draws each label outside the radius, anchored toward the centre, on
 * a single line. Greek dimension names are long ("Ετοιμότητα
 * χρηματοδότησης" is ~163px at this size), and once the radar moved beside the
 * summary its column narrowed: the lower-left label ran ~43px past the SVG
 * edge and read "ητα χρηματοδότησης". Splitting at the word that best balances
 * the two halves keeps the widest line to one word in the worst case, so the
 * radar keeps its size instead of shrinking to make room.
 */
function wrapAxisLabel(label: string, max = 14): string[] {
  const words = label.split(' ');
  if (label.length <= max || words.length < 2) return [label];
  let best: string[] = [label];
  let widest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(a.length, b.length);
    if (w < widest) {
      widest = w;
      best = [a, b];
    }
  }
  return best;
}

type AxisTickProps = {
  x?: number;
  y?: number;
  /** Recharts passes the chart centre to custom ticks; with symmetric margins
      the SVG is 2 x cx wide. */
  cx?: number;
  textAnchor?: 'start' | 'middle' | 'end';
  payload?: { value?: unknown };
};

const AXIS_FONT_PX = 12.2412;
let measureCtx: CanvasRenderingContext2D | null | undefined;

/** The rendered width of a label line, measured with the page's own font. */
function lineWidth(text: string): number {
  if (typeof document === 'undefined') return text.length * AXIS_FONT_PX * 0.6;
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * AXIS_FONT_PX * 0.6;
  measureCtx.font = `${AXIS_FONT_PX}px ${getComputedStyle(document.body).fontFamily}`;
  return measureCtx.measureText(text).width;
}

function RadarAxisTick({ x = 0, y = 0, cx, textAnchor = 'middle', payload }: AxisTickProps) {
  const lines = wrapAxisLabel(String(payload?.value ?? ''));
  // Wrapping is enough from tablet up. On a 390px phone the radar is still
  // tall enough to want its radius, and the widest Greek word
  // ("χρηματοδότησης", ~96px) ran 27px past the left edge. Rather than shrink
  // the whole chart for one label, the label steps inward just far enough.
  let tx = x;
  if (cx) {
    const width = Math.max(...lines.map(lineWidth));
    const pad = 4;
    const right = cx * 2;
    if (textAnchor === 'end' && tx - width < pad) tx = width + pad;
    else if (textAnchor === 'start' && tx + width > right - pad) tx = right - pad - width;
    else if (textAnchor === 'middle') tx = Math.min(Math.max(tx, width / 2 + pad), right - pad - width / 2);
  }
  return (
    <text x={tx} y={y} textAnchor={textAnchor} fontSize={AXIS_FONT_PX} fill="hsl(var(--muted-foreground))">
      {lines.map((line, i) => (
        // One line sits on the point; two straddle it.
        <tspan key={i} x={tx} dy={i === 0 ? (lines.length > 1 ? '-0.25em' : '0.35em') : '1.2em'}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * The radar's scale, upright.
 *
 * Recharts turns radius labels to run along their axis, so the scale read as
 * three vertical numbers, and four ticks on 0-100 landed on an odd 35. One
 * label carries the whole scale: the centre is 0, the outer ring is 100 and
 * the grid rings sit between. A mid-scale "50" sat wherever the score shape
 * happened to cross the axis — on this workspace, under its edge — so it is
 * not drawn.
 */
function RadarScaleTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: unknown } }) {
  const value = Number(payload?.value ?? 0);
  if (value !== 100) return null;
  return (
    <text x={x} y={y - 4} textAnchor="middle" fontSize={AXIS_FONT_PX - 1} fill="hsl(var(--muted-foreground))" opacity={0.75}>
      {value}
    </text>
  );
}

export function ReadinessRadarChartInner({
  data,
  scoreName = 'Your Score',
  benchmarkName = 'Benchmark',
  height = 280,
}: {
  data: RadarDatum[];
  scoreName?: string;
  benchmarkName?: string;
  /** `'100%'` lets the radar grow into a card that has height to spare; the
      wrapper must then resolve a height of its own (flex-1 + min-h). */
  height?: number | string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
        <PolarGrid className="stroke-border/40" />
        <PolarAngleAxis dataKey="dimension" tick={<RadarAxisTick />} />
        <Radar name={scoreName} dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
        <Radar name={benchmarkName} dataKey="benchmark" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
        {/* Drawn after both shapes so the scale reads on top of them. */}
        {/* At 30 degrees the scale lay along the "Market" spoke and its 100 sat on
            that label. Six dimensions put spokes every 60 degrees from 90, so 0
            runs between Market and Product, where there is no label to hit. */}
        <PolarRadiusAxis angle={0} domain={[0, 100]} tick={<RadarScaleTick />} tickCount={3} axisLine={false} />
        <RechartsTooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(val: number, name: string) => [`${val}%`, name]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ScoreHistoryChartInner({
  history,
  overallName = 'Overall',
  acceleratorName = 'Accelerator',
  investorName = 'Investor',
}: {
  history: HistoryDatum[];
  overallName?: string;
  acceleratorName?: string;
  investorName?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={history} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis dataKey="week" tick={{ fontSize: 12.2412 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12.2412 }} />
        <RechartsTooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(val: number, name: string) => [`${val}%`, name]}
        />
        <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name={overallName} />
        <Line type="monotone" dataKey="accel" stroke="hsl(var(--status-accent-mark))" strokeWidth={2} dot={{ r: 2.5 }} name={acceleratorName} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="invest" stroke="hsl(var(--status-success-mark))" strokeWidth={2} dot={{ r: 2.5 }} name={investorName} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}
