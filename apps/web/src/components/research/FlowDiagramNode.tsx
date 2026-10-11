'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type FlowNodeType = 'input' | 'default' | 'output' | 'decision';

export interface FlowDiagramData {
  nodes: Node[];
  edges: Edge[];
}

/* ─── Default starter data ──────────────────────────────────────────────── */

export const DEFAULT_FLOW_DIAGRAM: FlowDiagramData = {
  nodes: [
    { id: '1', type: 'input',   position: { x: 100, y: 80 },  data: { label: 'Start' } },
    { id: '2', type: 'default', position: { x: 240, y: 170 }, data: { label: 'Process' } },
    { id: '3', type: 'output',  position: { x: 380, y: 80 },  data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
  ],
};

export function parseFlowData(content: string | null): FlowDiagramData {
  if (!content) return DEFAULT_FLOW_DIAGRAM;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.nodes && Array.isArray(parsed.nodes)) return parsed as FlowDiagramData;
  } catch {}
  return DEFAULT_FLOW_DIAGRAM;
}

/* ─── Node type palette ─────────────────────────────────────────────────── */

const NODE_PALETTE: { type: FlowNodeType; label: string; color: string }[] = [
  { type: 'input',   label: 'Start',    color: '#22C55E' },
  { type: 'default', label: 'Process',  color: '#3B82F6' },
  { type: 'default', label: 'Decision', color: '#F59E0B' },
  { type: 'output',  label: 'End',      color: '#EF4444' },
];

let _nodeCounter = 100;

/* ─── Component ─────────────────────────────────────────────────────────── */

interface FlowDiagramNodeProps {
  width: number;
  height: number;
  content: string | null;
  isSelected: boolean;
  readOnly?: boolean;
  onChange?: (newContent: string) => void;
  onDelete?: () => void;
}

export function FlowDiagramNode({
  width,
  height,
  content,
  isSelected,
  readOnly = false,
  onChange,
  onDelete,
}: FlowDiagramNodeProps) {
  const initial = parseFlowData(content);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [showPalette, setShowPalette] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Debounced save back to parent */
  const saveData = useCallback((ns: Node[], es: Edge[]) => {
    if (!onChange) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onChange(JSON.stringify({ nodes: ns, edges: es }));
    }, 600);
  }, [onChange]);

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    setNodes((nds) => { saveData(nds, edges); return nds; });
  }, [onNodesChange, edges, saveData, setNodes]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes);
    setEdges((eds) => { saveData(nodes, eds); return eds; });
  }, [onEdgesChange, nodes, saveData, setEdges]);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => {
      const newEdges = addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds);
      saveData(nodes, newEdges);
      return newEdges;
    });
  }, [nodes, saveData, setEdges]);

  const addNode = useCallback((type: FlowNodeType, label: string) => {
    const id = `n${++_nodeCounter}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 80 + Math.random() * 200, y: 60 + Math.random() * 180 },
      data: { label },
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      saveData(updated, edges);
      return updated;
    });
    setShowPalette(false);
  }, [edges, saveData, setNodes]);

  const deleteSelected = useCallback(() => {
    setNodes((nds) => {
      const selected = nds.filter((n) => !n.selected);
      saveData(selected, edges);
      return selected;
    });
    setEdges((eds) => {
      const selected = eds.filter((e) => !e.selected);
      saveData(nodes, selected);
      return selected;
    });
  }, [nodes, edges, saveData, setNodes, setEdges]);

  const toolbarH = 32;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 bg-card shadow-sm',
        isSelected && 'ring-2 ring-primary ring-offset-1',
      )}
      style={{ width, height, borderColor: '#6366F180' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-2 shrink-0 border-b"
        style={{
          height: toolbarH,
          background: '#6366F110',
          borderColor: '#6366F120',
        }}
      >
        <GitBranch className="icon-sm shrink-0" style={{ color: '#6366F1' }} />
        <span className="text-2xs font-bold uppercase tracking-wide flex-1" style={{ color: '#6366F1' }}>
          Flow Diagram
        </span>
        {!readOnly && (
          <>
            {/* Add node button + palette */}
            <div className="relative">
              <button
                onMouseDown={(e) => { e.stopPropagation(); setShowPalette((v) => !v); }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary-accessible text-2xs font-medium transition-colors"
                title="Add node"
              >
                <Plus className="icon-sm" />
                Add
              </button>
              {showPalette && (
                <div className="absolute top-6 left-0 bg-card border border-border rounded-lg shadow-xl z-50 p-1 w-32">
                  {NODE_PALETTE.map((p) => (
                    <button
                      key={`${p.type}-${p.label}`}
                      onMouseDown={(e) => { e.stopPropagation(); addNode(p.type, p.label); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary text-left text-2xs transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onMouseDown={(e) => { e.stopPropagation(); deleteSelected(); }}
              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive-accessible transition-colors"
              title="Delete selected"
            >
              <Trash2 className="icon-sm" />
            </button>
          </>
        )}
        {!readOnly && (
          <button
            onMouseDown={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="w-5 h-5 ml-0.5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive-accessible transition-colors"
            title="Delete node"
          >
            ✕
          </button>
        )}
      </div>

      {/* React Flow canvas — stop ALL mouse events from bubbling to parent canvas */}
      <div
        style={{ height: height - toolbarH }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          deleteKeyCode="Delete"
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 1.5 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b820" />
          <Controls showInteractive={false} position="bottom-right" />
          {width > 320 && <MiniMap nodeStrokeWidth={3} zoomable pannable position="bottom-left" />}
        </ReactFlow>
      </div>

      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-1 rounded-xl pointer-events-none z-10" />
      )}
    </div>
  );
}
