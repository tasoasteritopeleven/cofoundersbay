'use client';

import { useMemo, useState, useCallback } from 'react';
import { ResearchConnector, ResearchNode } from '@/lib/api';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';

interface ResearchConnectorLinesProps {
  connectors: ResearchConnector[];
  nodes: ResearchNode[];
  onDeleteConnector?: (connectorId: string) => void;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  note: '#F59E0B', document: '#3B82F6', image: '#22C55E', pdf: '#EF4444',
  link: '#A855F7', reference: '#64748B', insight: '#10B981', hypothesis: '#8B5CF6',
  question: '#6366F1', evidence: '#14B8A6', citation: '#0EA5E9', task: '#F97316',
  pitch_deck: '#EC4899', business_plan: '#7C3AED', financial_model: '#16A34A',
  contract: '#DC2626', wireframe: '#2563EB', meeting_notes: '#0E7490',
  shape_rect: '#3B82F6', shape_circle: '#8B5CF6', shape_diamond: '#F59E0B',
};

/* ─── Smart edge-point routing ───────────────────────────────────────────
   Returns the point on the perimeter of the source rect that is closest
   to the target center, plus a tangent direction for the control point.   */
interface EdgePoint { x: number; y: number; tangentX: number; tangentY: number }

function getEdgePoint(
  node: ResearchNode,
  targetX: number,
  targetY: number,
): EdgePoint {
  const nodeH = node.height || 200;
  const cx = node.posX + node.width / 2;
  const cy = node.posY + nodeH / 2;
  const hw = node.width / 2;
  const hh = nodeH / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;

  // Avoid division by zero for collinear nodes
  if (dx === 0 && dy === 0) return { x: cx, y: cy - hh, tangentX: 0, tangentY: -1 };

  // Determine which edge the ray to the target crosses first
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy * hw <= absDx * hh) {
    // Left or Right edge
    const sign = dx > 0 ? 1 : -1;
    return {
      x: cx + sign * hw,
      y: cy + dy * (hw / absDx),
      tangentX: sign,
      tangentY: 0,
    };
  } else {
    // Top or Bottom edge
    const sign = dy > 0 ? 1 : -1;
    return {
      x: cx + dx * (hh / absDy),
      y: cy + sign * hh,
      tangentX: 0,
      tangentY: sign,
    };
  }
}

/* ─── Cubic bezier path with tangent-aware control points ─────────────── */
function cubicPath(from: EdgePoint, to: EdgePoint): { d: string; midX: number; midY: number } {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const offset = Math.min(dist * 0.45, 120);

  const cp1x = from.x + from.tangentX * offset;
  const cp1y = from.y + from.tangentY * offset;
  const cp2x = to.x - to.tangentX * offset;
  const cp2y = to.y - to.tangentY * offset;

  const midX = (from.x + to.x) / 2;
  const midY = (cp1y + cp2y) / 2;

  return {
    d: `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`,
    midX,
    midY,
  };
}

export function ResearchConnectorLines({ connectors, nodes, onDeleteConnector }: ResearchConnectorLinesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const confirm = useConfirm();

  const nodeMap = useMemo(() => {
    const map = new Map<string, ResearchNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const svgPaths = useMemo(() => {
    return connectors.map((connector) => {
      const fromNode = nodeMap.get(connector.fromNodeId);
      const toNode   = nodeMap.get(connector.toNodeId);
      if (!fromNode || !toNode) return null;

      const fromCX = fromNode.posX + fromNode.width / 2;
      const fromCY = fromNode.posY + (fromNode.height || 200) / 2;
      const toCX   = toNode.posX   + toNode.width / 2;
      const toCY   = toNode.posY   + (toNode.height || 200) / 2;

      const fromEdge = getEdgePoint(fromNode, toCX, toCY);
      const toEdge   = getEdgePoint(toNode, fromCX, fromCY);
      const { d, midX, midY } = cubicPath(fromEdge, toEdge);

      const lineColor = connector.color || NODE_TYPE_COLORS[fromNode.type] || '#6b7280';

      return {
        id: connector.id,
        path: d,
        color: lineColor,
        style: connector.style || 'solid',
        label: connector.label,
        labelX: midX,
        labelY: midY,
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null);
  }, [connectors, nodeMap]);

  const handleClick = useCallback(async (e: React.MouseEvent, connectorId: string) => {
    e.stopPropagation();
    if (!onDeleteConnector) return;
    const ok = await confirm({
      title: <BilingualText en="Delete this connection?" el="Διαγραφή αυτής της σύνδεσης;" />,
      description: (
        <BilingualText
          en="Only the link between the two nodes is removed; the nodes stay."
          el="Αφαιρείται μόνο ο σύνδεσμος μεταξύ των δύο κόμβων· οι κόμβοι παραμένουν."
        />
      ),
      confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact />,
    });
    if (ok) onDeleteConnector(connectorId);
  }, [onDeleteConnector, confirm]);

  if (svgPaths.length === 0) return null;

  return (
    <svg className="absolute inset-0" style={{ zIndex: 0, overflow: 'visible' }}>
      <defs>
        {svgPaths.map((path) => {
          const isHovered = hoveredId === path.id;
          return (
            <marker
              key={`arrow-${path.id}`}
              id={`arrowhead-${path.id}`}
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
            >
              <polygon
                points="0 0, 10 4, 0 8"
                fill={path.color}
                opacity={isHovered ? 1 : 0.75}
              />
            </marker>
          );
        })}
        {/* Circle start markers */}
        {svgPaths.map((path) => (
          <marker
            key={`dot-${path.id}`}
            id={`dot-${path.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="3"
            refY="3"
            orient="auto"
          >
            <circle cx="3" cy="3" r="2.5" fill={path.color} opacity="0.7" />
          </marker>
        ))}
      </defs>

      {svgPaths.map((path) => {
        const isHovered = hoveredId === path.id;
        return (
          <g key={path.id}>
            {/* Fat invisible hit area */}
            <path
              d={path.path}
              stroke="transparent"
              strokeWidth="16"
              fill="none"
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => setHoveredId(path.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => handleClick(e, path.id)}
            />

            {/* Glow layer (hover only) */}
            {isHovered && (
              <path
                d={path.path}
                stroke={path.color}
                strokeWidth="7"
                fill="none"
                opacity="0.18"
                className="pointer-events-none"
              />
            )}

            {/* Visible connector line */}
            <path
              d={path.path}
              stroke={path.color}
              strokeWidth={isHovered ? 2.5 : 1.75}
              fill="none"
              strokeDasharray={
                path.style === 'dashed' ? '7,4' :
                path.style === 'dotted' ? '2,4' : undefined
              }
              markerEnd={`url(#arrowhead-${path.id})`}
              markerStart={`url(#dot-${path.id})`}
              opacity={isHovered ? 1 : 0.6}
              className="transition-all duration-100 pointer-events-none"
            />

            {/* Label pill */}
            {path.label && (
              <g className="pointer-events-none">
                <rect
                  x={path.labelX - path.label.length * 3.6 - 8}
                  y={path.labelY - 11}
                  width={path.label.length * 7.2 + 16}
                  height={22}
                  rx={11}
                  fill="hsl(var(--card))"
                  stroke={path.color}
                  strokeWidth="1"
                  opacity="0.92"
                />
                <text
                  x={path.labelX}
                  y={path.labelY + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(var(--foreground))"
                  fontSize="11"
                  fontWeight="500"
                >
                  {path.label}
                </text>
              </g>
            )}

            {/* Delete hint on hover */}
            {isHovered && onDeleteConnector && (
              <g className="pointer-events-none">
                <rect
                  x={path.labelX - 33}
                  y={path.labelY + (path.label ? 14 : -10)}
                  width={66}
                  height={18}
                  rx={9}
                  fill="hsl(var(--destructive) / 0.1)"
                  stroke="hsl(var(--destructive) / 0.3)"
                  strokeWidth="1"
                />
                <text
                  x={path.labelX}
                  y={path.labelY + (path.label ? 23 : -1)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(var(--destructive))"
                  fontSize="10"
                  fontWeight="500"
                  opacity="0.85"
                >
                  click to delete
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
