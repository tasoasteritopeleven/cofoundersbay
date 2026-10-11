import dagre from '@dagrejs/dagre';
import type { ResearchNode, ResearchConnector } from './api';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';
export type LayoutAlgorithm = 'dagre-tb' | 'dagre-lr' | 'dagre-bt' | 'dagre-rl' | 'grid' | 'radial';

export interface LayoutResult {
  id: string;
  posX: number;
  posY: number;
}

/* ─── Dagre hierarchical layout ────────────────────────────────────────── */

export function computeDagreLayout(
  nodes: ResearchNode[],
  connectors: ResearchConnector[],
  direction: LayoutDirection = 'TB',
  rankSep = 90,
  nodeSep = 50,
): LayoutResult[] {
  if (nodes.length === 0) return [];

  const g = new dagre.graphlib.Graph({ compound: false, multigraph: false });
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 60,
    marginy: 60,
    acyclicer: 'greedy',
    ranker: 'network-simplex',
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeSet = new Set(nodes.map((n) => n.id));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.width, height: node.height ?? 200 });
  });

  connectors.forEach((c) => {
    if (nodeSet.has(c.fromNodeId) && nodeSet.has(c.toNodeId) && c.fromNodeId !== c.toNodeId) {
      try { g.setEdge(c.fromNodeId, c.toNodeId); } catch {}
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const placed = g.node(node.id);
    if (!placed || isNaN(placed.x) || isNaN(placed.y)) {
      return { id: node.id, posX: node.posX, posY: node.posY };
    }
    return {
      id: node.id,
      posX: Math.round(placed.x - node.width / 2),
      posY: Math.round(placed.y - (node.height ?? 200) / 2),
    };
  });
}

/* ─── Grid layout (equal columns) ──────────────────────────────────────── */

export function computeGridLayout(
  nodes: ResearchNode[],
  startX = 80,
  startY = 80,
  colWidth = 320,
  rowHeight = 240,
  cols = 4,
): LayoutResult[] {
  return nodes.map((node, i) => ({
    id: node.id,
    posX: startX + (i % cols) * colWidth,
    posY: startY + Math.floor(i / cols) * rowHeight,
  }));
}

/* ─── Radial layout (nodes in a circle around the first node) ───────────── */

export function computeRadialLayout(
  nodes: ResearchNode[],
  centerX = 600,
  centerY = 400,
  radius = 300,
): LayoutResult[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ id: nodes[0].id, posX: centerX, posY: centerY }];

  const [hub, ...spokes] = nodes;
  const results: LayoutResult[] = [{ id: hub.id, posX: centerX - hub.width / 2, posY: centerY - (hub.height ?? 200) / 2 }];

  spokes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / spokes.length - Math.PI / 2;
    results.push({
      id: node.id,
      posX: Math.round(centerX + radius * Math.cos(angle) - node.width / 2),
      posY: Math.round(centerY + radius * Math.sin(angle) - (node.height ?? 200) / 2),
    });
  });

  return results;
}

/* ─── Dispatcher ────────────────────────────────────────────────────────── */

export function computeLayout(
  algorithm: LayoutAlgorithm,
  nodes: ResearchNode[],
  connectors: ResearchConnector[],
): LayoutResult[] {
  const canvasCenterX = 600;
  const canvasCenterY = 400;

  switch (algorithm) {
    case 'dagre-tb': return computeDagreLayout(nodes, connectors, 'TB');
    case 'dagre-lr': return computeDagreLayout(nodes, connectors, 'LR');
    case 'dagre-bt': return computeDagreLayout(nodes, connectors, 'BT');
    case 'dagre-rl': return computeDagreLayout(nodes, connectors, 'RL');
    case 'grid':     return computeGridLayout(nodes);
    case 'radial':   return computeRadialLayout(nodes, canvasCenterX, canvasCenterY);
    default:         return computeDagreLayout(nodes, connectors, 'TB');
  }
}
