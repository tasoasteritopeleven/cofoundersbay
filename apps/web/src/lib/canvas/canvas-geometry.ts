export type CanvasLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export const DEFAULT_CANVAS_LAYER: CanvasLayer = {
  id: 'default',
  name: 'Default',
  visible: true,
  locked: false,
};

export type NodeCanvasStyle = {
  opacity?: number;
  stroke?: string;
  shadow?: boolean;
  rotate?: number;
  strokeWidth?: number;
  radius?: number;
  scaleX?: number;
  scaleY?: number;
};

export function readNodeStyle(metadata: unknown): NodeCanvasStyle {
  if (!metadata || typeof metadata !== 'object') return {};
  const style = (metadata as { style?: unknown }).style;
  if (!style || typeof style !== 'object') return {};
  const rec = style as Record<string, unknown>;
  return {
    opacity: typeof rec.opacity === 'number' ? rec.opacity : undefined,
    stroke: typeof rec.stroke === 'string' ? rec.stroke : undefined,
    shadow: typeof rec.shadow === 'boolean' ? rec.shadow : undefined,
    rotate: typeof rec.rotate === 'number' ? rec.rotate : undefined,
    strokeWidth: typeof rec.strokeWidth === 'number' ? rec.strokeWidth : undefined,
    radius: typeof rec.radius === 'number' ? rec.radius : undefined,
    scaleX: typeof rec.scaleX === 'number' ? rec.scaleX : undefined,
    scaleY: typeof rec.scaleY === 'number' ? rec.scaleY : undefined,
  };
}

export function mergeNodeStyle(
  metadata: unknown,
  patch: NodeCanvasStyle,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const prev = readNodeStyle(base);
  base.style = { ...prev, ...patch };
  return base;
}

/** Keeps votes, product links, and style in lockstep when two tools patch the same node. */
export function mergeNodeMetadata(current: unknown, patch: unknown): Record<string, unknown> {
  const base =
    current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
  if (!patch || typeof patch !== 'object') return base;
  const rec = patch as Record<string, unknown>;
  const next = { ...base, ...rec };
  if ('style' in rec || 'style' in base) {
    next.style = { ...readNodeStyle(base), ...readNodeStyle(rec) };
  }
  return next;
}

export function nodeLayerId(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return DEFAULT_CANVAS_LAYER.id;
  const id = (metadata as { layerId?: unknown }).layerId;
  return typeof id === 'string' && id ? id : DEFAULT_CANVAS_LAYER.id;
}

export type AlignmentGuide = { axis: 'x' | 'y'; pos: number };

const GUIDE_THRESHOLD = 5;

export function computeAlignmentGuides(
  moving: { id: string; x: number; y: number; w: number; h: number },
  others: Array<{ id: string; posX: number; posY: number; width: number; height: number }>,
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];
  const mx = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const my = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  for (const n of others) {
    if (n.id === moving.id) continue;
    const ox = [n.posX, n.posX + n.width / 2, n.posX + n.width];
    const oy = [n.posY, n.posY + (n.height || 200) / 2, n.posY + (n.height || 200)];
    for (const a of mx) {
      for (const b of ox) {
        if (Math.abs(a - b) <= GUIDE_THRESHOLD) guides.push({ axis: 'x', pos: b });
      }
    }
    for (const a of my) {
      for (const b of oy) {
        if (Math.abs(a - b) <= GUIDE_THRESHOLD) guides.push({ axis: 'y', pos: b });
      }
    }
  }
  const uniq: AlignmentGuide[] = [];
  for (const g of guides) {
    if (!uniq.some((u) => u.axis === g.axis && Math.abs(u.pos - g.pos) < 0.5)) uniq.push(g);
  }
  return uniq.slice(0, 6);
}

export type CanvasClipboardPayload = {
  v: 1;
  nodes: Array<{
    type: string;
    title?: string | null;
    content?: string | null;
    width: number;
    height: number;
    color?: string | null;
    metadata?: unknown;
    posX?: number;
    posY?: number;
  }>;
};

export const CANVAS_CLIP_TYPE = 'application/x-cfb-canvas';

export type CanvasRect = {
  id: string;
  posX: number;
  posY: number;
  width: number;
  height?: number | null;
};

export function isNodeHidden(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as { hidden?: unknown }).hidden === true;
}

export function nodeVoteCount(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object') return 0;
  const votes = (metadata as { votes?: unknown }).votes;
  return typeof votes === 'number' && Number.isFinite(votes) ? Math.max(0, Math.floor(votes)) : 0;
}

export function nodeTransformCss(style: NodeCanvasStyle): string | undefined {
  const parts: string[] = [];
  if (style.rotate) parts.push(`rotate(${style.rotate}deg)`);
  const sx = style.scaleX ?? 1;
  const sy = style.scaleY ?? 1;
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  return parts.length ? parts.join(' ') : undefined;
}

export function hugBounds(nodes: CanvasRect[], pad = 24): { posX: number; posY: number; width: number; height: number } | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((n) => n.posX));
  const minY = Math.min(...nodes.map((n) => n.posY));
  const maxX = Math.max(...nodes.map((n) => n.posX + n.width));
  const maxY = Math.max(...nodes.map((n) => n.posY + (n.height || 200)));
  return {
    posX: minX - pad,
    posY: minY - pad,
    width: Math.max(80, maxX - minX + pad * 2),
    height: Math.max(80, maxY - minY + pad * 2),
  };
}

/** Figma Tidy Up: pack along the dominant axis with a consistent gap. */
export function tidyRects(
  nodes: CanvasRect[],
  axis: 'h' | 'v' | 'auto' = 'auto',
  gap = 16,
): Array<{ id: string; posX: number; posY: number }> {
  if (nodes.length < 2) return [];
  const minX = Math.min(...nodes.map((n) => n.posX));
  const minY = Math.min(...nodes.map((n) => n.posY));
  const spanX = Math.max(...nodes.map((n) => n.posX + n.width)) - minX;
  const spanY = Math.max(...nodes.map((n) => n.posY + (n.height || 200))) - minY;
  const horizontal = axis === 'h' || (axis === 'auto' && spanX >= spanY);
  const sorted = [...nodes].sort((a, b) => (horizontal ? a.posX - b.posX : a.posY - b.posY));
  let cursor = horizontal ? minX : minY;
  return sorted.map((n) => {
    const h = n.height || 200;
    const next = horizontal
      ? { id: n.id, posX: cursor, posY: minY }
      : { id: n.id, posX: minX, posY: cursor };
    cursor += (horizontal ? n.width : h) + gap;
    return next;
  });
}

export function parseNudge(query: string): { dx: number; dy: number } {
  const text = query.trim().toLowerCase();
  const pair = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (pair) return { dx: Number(pair[1]), dy: Number(pair[2]) };
  const large = /\b(shift|large|μεγαλ)\b/.test(text);
  const step = large ? 10 : 1;
  if (/(left|αριστερ)/.test(text)) return { dx: -step, dy: 0 };
  if (/(right|δεξι)/.test(text)) return { dx: step, dy: 0 };
  if (/(up|επανω|επάνω|πανω)/.test(text)) return { dx: 0, dy: -step };
  if (/(down|κατω|κάτω)/.test(text)) return { dx: 0, dy: step };
  return { dx: 0, dy: 0 };
}

export function parseScale(query: string): number {
  const n = Number(query);
  if (Number.isFinite(n) && n > 0) return n;
  const text = query.toLowerCase();
  if (/(down|smaller|μικρ)/.test(text)) return 0.9;
  return 1.1;
}

/**
 * One fill set for inspector, node picker, stickies, and the minimap.
 * `fill` is the wash on the card; `accent` is the sticky edge / selected ring.
 */
export const CANVAS_NOTE_FILLS = [
  { fill: '#FEF3C7', accent: '#F59E0B' },
  { fill: '#DBEAFE', accent: '#3B82F6' },
  { fill: '#D1FAE5', accent: '#10B981' },
  { fill: '#FCE7F3', accent: '#EC4899' },
  { fill: '#FEE2E2', accent: '#F43F5E' },
  { fill: '#EDE9FE', accent: '#8B5CF6' },
  { fill: '#FFEDD5', accent: '#F97316' },
  { fill: '#E5E7EB', accent: '#64748B' },
] as const;

export function resolveNoteFill(color: string | null | undefined): { fill: string; accent: string } {
  if (!color) return CANVAS_NOTE_FILLS[0];
  const key = color.toLowerCase();
  return (
    CANVAS_NOTE_FILLS.find((row) => row.fill.toLowerCase() === key || row.accent.toLowerCase() === key)
    ?? { fill: color, accent: color }
  );
}

export function fillContrastText(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '#FFFFFF';
  const n = hex.slice(1);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1E293B' : '#FFFFFF';
}

export function nodeChromeCss(metadata: unknown): {
  opacity?: number;
  boxShadow?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  transform?: string;
} {
  const style = readNodeStyle(metadata);
  return {
    opacity: style.opacity,
    boxShadow: style.shadow ? '0 10px 24px rgb(0 0 0 / 0.08)' : undefined,
    borderColor: style.stroke,
    borderWidth: style.strokeWidth,
    borderRadius: style.radius,
    transform: nodeTransformCss(style),
  };
}

/** Fill used by inspector, cards, stickies, shapes, and the minimap. */
export function nodePaintColor(
  color: string | null | undefined,
  metadata?: unknown,
): string | undefined {
  if (color) return resolveNoteFill(color).fill;
  if (metadata && typeof metadata === 'object') {
    const fill = (metadata as { fillColor?: unknown }).fillColor;
    if (typeof fill === 'string' && fill) return resolveNoteFill(fill).fill;
  }
  return undefined;
}

export type CanvasStylePatch = {
  fill?: string;
  opacity?: number;
  stroke?: string;
  shadow?: boolean;
  rotate?: number;
  strokeWidth?: number;
  radius?: number;
};

/** One write so notes (`color` + `style`) and shapes (`fillColor` / `strokeColor`) stay in lockstep. */
export function applyPaintToMetadata(
  metadata: unknown,
  patch: CanvasStylePatch,
): Record<string, unknown> {
  const next = mergeNodeStyle(metadata, {
    opacity: patch.opacity,
    stroke: patch.stroke,
    shadow: patch.shadow,
    rotate: patch.rotate,
    strokeWidth: patch.strokeWidth,
    radius: patch.radius,
  });
  if (patch.fill) next.fillColor = patch.fill;
  if (patch.stroke) next.strokeColor = patch.stroke;
  if (patch.opacity !== undefined) next.opacity = patch.opacity;
  if (patch.strokeWidth !== undefined) next.strokeWidth = patch.strokeWidth;
  if (patch.radius !== undefined) next.cornerRadius = patch.radius;
  return next;
}

export const CANVAS_PRODUCT_LINKS = [
  { href: '/builder?tab=idea', label: 'link_idea' },
  { href: '/builder?tab=market', label: 'link_market' },
  { href: '/builder?tab=pitch', label: 'link_pitch' },
  { href: '/readiness', label: 'link_readiness' },
  { href: '/milestones', label: 'link_milestones' },
] as const;

export type CanvasProductLinkLabel = (typeof CANVAS_PRODUCT_LINKS)[number]['label'];

export function readCfbHref(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const link = (metadata as { cfbLink?: unknown }).cfbLink;
  if (!link || typeof link !== 'object') return undefined;
  const href = (link as { href?: unknown }).href;
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return undefined;
  return href;
}

export function matchProductLink(href: string | undefined) {
  if (!href) return undefined;
  return CANVAS_PRODUCT_LINKS.find((row) => row.href === href);
}
