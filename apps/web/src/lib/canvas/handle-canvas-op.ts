import type { ActionOutcome, CanvasCommandOp } from '@cofounderbay/shared';
import type { ResearchBoardFull, ResearchNodeType } from '@/lib/api';
import type { CanvasCommandRequest } from '@/lib/canvas/canvas-command-bus';
import type { CanvasLayer } from '@/lib/canvas/canvas-geometry';
import { parseNudge, parseScale } from '@/lib/canvas/canvas-geometry';
import type { LayoutAlgorithm } from '@/lib/autoLayout';

export type CanvasOpContext = {
  boardId: string;
  board: ResearchBoardFull | undefined;
  selectedIds: string[];
  selectedGroupId: string | null;
  layers: CanvasLayer[];
  pan: { x: number; y: number };
  zoom: number;
  captureTitle: (kind: string) => string;
  placeNode: (type: ResearchNodeType, title: string, extra?: Record<string, unknown>, content?: string) => void;
  deleteNode: (id: string) => void;
  updateNode: (id: string, data: Record<string, unknown>) => void;
  connect: (fromId: string, toId: string) => void;
  duplicate: () => void;
  copy: () => void;
  paste: () => void;
  selectIds: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  align: (mode: 'left' | 'right' | 'top' | 'bottom' | 'h' | 'v' | 'center_h' | 'center_v') => void;
  createGroup: (x: number, y: number) => void;
  deleteGroup: (id: string) => void;
  applyStyle: (patch: { fill?: string; opacity?: number; stroke?: string; shadow?: boolean; rotate?: number; strokeWidth?: number; radius?: number }) => void;
  setLayers: (update: (prev: CanvasLayer[]) => CanvasLayer[]) => void;
  fit: (onlySelected: boolean) => void;
  zoomBy: (delta: number) => void;
  resetView: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  find: (query: string) => void;
  autoLayout: (alg: LayoutAlgorithm) => void;
  exportPng: () => void;
  exportJson: () => void;
  exportSvg: () => void;
  exportMarkdown: () => void;
  copyOutline: () => void;
  link: (href: string) => void;
  findByTitle: (title: string) => { id: string } | undefined;
  matchSize: (axis: 'w' | 'h' | 'both') => void;
  rotateBy: (deg: number) => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  selectSame: () => void;
  setTool: (tool: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  openComments: () => void;
  toggleMinimap: () => void;
  toggleRulers: () => void;
  shareLink: () => void;
  tidy: (axis: 'h' | 'v' | 'auto') => void;
  nudge: (dx: number, dy: number) => void;
  rename: (title: string) => void;
  setHidden: (hidden: boolean) => void;
  flip: (axis: 'h' | 'v') => void;
  pasteInPlace: () => void;
  frameSelection: () => void;
  hugSelection: () => void;
  vote: () => void;
  isolate: () => void;
  reveal: () => void;
  selectInverse: () => void;
  lockOthers: () => void;
  scaleBy: (factor: number) => void;
  setRadius: (radius: number) => void;
  formatText: (format: string) => void;
  findReplace: (find: string, replace: string) => void;
  insertLink: (href: string, label?: string) => void;
  insertCitation: (citation: string) => void;
  wordCount: () => void;
  mergeNotes: () => void;
  splitNotes: () => void;
  copyText: () => void;
  pastePlain: () => void;
  insertDate: () => void;
};

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function handleCanvasOp(
  ctx: CanvasOpContext,
  req: CanvasCommandRequest,
): Promise<ActionOutcome> {
  const { op, payload } = req;
  const href = `/research/${ctx.boardId}`;
  const cx = (window.innerWidth / 2 - ctx.pan.x) / ctx.zoom;
  const cy = (window.innerHeight / 2 - ctx.pan.y) / ctx.zoom;
  const selected = ctx.selectedIds;

  switch (op as CanvasCommandOp) {
    case 'add_note':
      ctx.placeNode('note', str(payload, 'title') || 'Note', undefined, str(payload, 'content'));
      return { ok: true, href };
    case 'add_sticky':
      ctx.placeNode('note', str(payload, 'title') || '', { isSticky: true }, str(payload, 'content'));
      return { ok: true, href };
    case 'add_shape':
      ctx.placeNode('shape_rect', str(payload, 'title') || 'Shape');
      return { ok: true, href };
    case 'capture': {
      const kind = (str(payload, 'nodeType') || 'question') as ResearchNodeType;
      ctx.placeNode(kind, str(payload, 'title') || ctx.captureTitle(kind), { displayType: kind }, str(payload, 'content'));
      return { ok: true, href };
    }
    case 'delete_selection':
      selected.forEach((id) => ctx.deleteNode(id));
      return { ok: true, href };
    case 'duplicate':
      ctx.duplicate();
      return { ok: true, href };
    case 'copy':
      ctx.copy();
      return { ok: true, href };
    case 'paste':
      ctx.paste();
      return { ok: true, href };
    case 'select_all':
      if (ctx.board) ctx.selectIds(ctx.board.nodes.map((n) => n.id));
      return { ok: true, href };
    case 'select_by_title': {
      const node = ctx.findByTitle(str(payload, 'title') || str(payload, 'query'));
      if (node) ctx.selectIds([node.id]);
      return { ok: true, href };
    }
    case 'undo':
      ctx.undo();
      return { ok: true, href };
    case 'redo':
      ctx.redo();
      return { ok: true, href };
    case 'align': {
      const mode = str(payload, 'align') as
        | 'left' | 'right' | 'top' | 'bottom' | 'h' | 'v' | 'center_h' | 'center_v';
      if (['left', 'right', 'top', 'bottom', 'h', 'v', 'center_h', 'center_v'].includes(mode)) ctx.align(mode);
      return { ok: true, href };
    }
    case 'group': {
      const posX = Number(payload.posX);
      const posY = Number(payload.posY);
      ctx.createGroup(
        Number.isFinite(posX) ? posX : cx - 200,
        Number.isFinite(posY) ? posY : cy - 150,
      );
      return { ok: true, href };
    }
    case 'ungroup':
      if (ctx.selectedGroupId) ctx.deleteGroup(ctx.selectedGroupId);
      return { ok: true, href };
    case 'lock':
      selected.forEach((id) => ctx.updateNode(id, { locked: true }));
      return { ok: true, href };
    case 'unlock':
      selected.forEach((id) => ctx.updateNode(id, { locked: false }));
      return { ok: true, href };
    case 'bring_front':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        if (node) ctx.updateNode(id, { zIndex: (node.zIndex || 1) + 20 });
      });
      return { ok: true, href };
    case 'send_back':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        if (node) ctx.updateNode(id, { zIndex: Math.max(1, (node.zIndex || 1) - 20) });
      });
      return { ok: true, href };
    case 'set_style':
      ctx.applyStyle({
        fill: str(payload, 'fill') || undefined,
        opacity: str(payload, 'query') ? Number(str(payload, 'query')) : undefined,
      });
      return { ok: true, href };
    case 'set_layer':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        const base = node?.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
        ctx.updateNode(id, { metadata: { ...base, layerId: str(payload, 'query') || ctx.layers[0]?.id } });
      });
      return { ok: true, href };
    case 'toggle_layer':
      ctx.setLayers((prev) =>
        prev.map((l) =>
          l.id === str(payload, 'query') || l.name.toLowerCase() === str(payload, 'query').toLowerCase()
            ? { ...l, visible: !l.visible }
            : l,
        ),
      );
      return { ok: true, href };
    case 'add_layer':
      ctx.setLayers((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: str(payload, 'title') || `Layer ${prev.length + 1}`, visible: true, locked: false },
      ]);
      return { ok: true, href };
    case 'fit_view':
      ctx.fit(selected.length > 0);
      return { ok: true, href };
    case 'zoom': {
      const mode = str(payload, 'query');
      if (mode === 'in') ctx.zoomBy(0.1);
      else if (mode === 'out') ctx.zoomBy(-0.1);
      else ctx.resetView();
      return { ok: true, href };
    }
    case 'toggle_grid':
      ctx.toggleGrid();
      return { ok: true, href };
    case 'toggle_snap':
      ctx.toggleSnap();
      return { ok: true, href };
    case 'find':
      ctx.find(str(payload, 'query'));
      return { ok: true, href };
    case 'connect_nodes': {
      const from = ctx.findByTitle(str(payload, 'fromTitle') || str(payload, 'title'));
      const to = ctx.findByTitle(str(payload, 'toTitle') || str(payload, 'query'));
      const a = from?.id || selected[0];
      const b = to?.id || selected[1];
      if (a && b && a !== b) ctx.connect(a, b);
      return { ok: true, href };
    }
    case 'auto_layout':
      ctx.autoLayout((str(payload, 'query') || 'dagre-tb') as LayoutAlgorithm);
      return { ok: true, href };
    case 'export': {
      const format = str(payload, 'query');
      if (format === 'png') ctx.exportPng();
      else if (format === 'svg') ctx.exportSvg();
      else if (format === 'outline') ctx.copyOutline();
      else if (format === 'markdown') ctx.exportMarkdown();
      else ctx.exportJson();
      return { ok: true, href };
    }
    case 'copy_outline':
      ctx.copyOutline();
      return { ok: true, href };
    case 'link_entity':
      if (str(payload, 'href')) ctx.link(str(payload, 'href'));
      return { ok: true, href };
    case 'convert_type':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        const base = node?.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
        ctx.updateNode(id, { metadata: { ...base, displayType: str(payload, 'nodeType') } });
      });
      return { ok: true, href };
    case 'add_text':
      ctx.placeNode('shape_text', str(payload, 'title') || 'Text', undefined, str(payload, 'content'));
      return { ok: true, href };
    case 'match_size': {
      const axis = str(payload, 'query');
      ctx.matchSize(axis === 'h' ? 'h' : axis === 'w' ? 'w' : 'both');
      return { ok: true, href };
    }
    case 'rotate':
      ctx.rotateBy(Number(str(payload, 'query') || '90') || 90);
      return { ok: true, href };
    case 'copy_style':
      ctx.copyStyle();
      return { ok: true, href };
    case 'paste_style':
      ctx.pasteStyle();
      return { ok: true, href };
    case 'select_same':
      ctx.selectSame();
      return { ok: true, href };
    case 'set_tool':
      ctx.setTool(str(payload, 'query') || 'select');
      return { ok: true, href };
    case 'collapse':
      ctx.setCollapsed(true);
      return { ok: true, href };
    case 'expand':
      ctx.setCollapsed(false);
      return { ok: true, href };
    case 'open_comments':
      ctx.openComments();
      return { ok: true, href };
    case 'toggle_minimap':
      ctx.toggleMinimap();
      return { ok: true, href };
    case 'toggle_rulers':
      ctx.toggleRulers();
      return { ok: true, href };
    case 'lock_layer':
      ctx.setLayers((prev) =>
        prev.map((l) =>
          !str(payload, 'query') || l.id === str(payload, 'query') || l.name.toLowerCase() === str(payload, 'query').toLowerCase()
            ? { ...l, locked: !l.locked }
            : l,
        ),
      );
      return { ok: true, href };
    case 'bring_forward':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        if (node) ctx.updateNode(id, { zIndex: (node.zIndex || 1) + 1 });
      });
      return { ok: true, href };
    case 'send_backward':
      selected.forEach((id) => {
        const node = ctx.board?.nodes.find((n) => n.id === id);
        if (node) ctx.updateNode(id, { zIndex: Math.max(1, (node.zIndex || 1) - 1) });
      });
      return { ok: true, href };
    case 'share_link':
      ctx.shareLink();
      return { ok: true, href };
    case 'tidy': {
      const axis = str(payload, 'query');
      ctx.tidy(axis === 'h' || axis === 'v' ? axis : 'auto');
      return { ok: true, href };
    }
    case 'nudge': {
      const { dx, dy } = parseNudge(str(payload, 'query'));
      if (dx || dy) ctx.nudge(dx, dy);
      return { ok: true, href };
    }
    case 'rename':
      if (str(payload, 'title')) ctx.rename(str(payload, 'title'));
      return { ok: true, href };
    case 'hide':
      ctx.setHidden(true);
      return { ok: true, href };
    case 'show':
      ctx.setHidden(false);
      return { ok: true, href };
    case 'flip_h':
      ctx.flip('h');
      return { ok: true, href };
    case 'flip_v':
      ctx.flip('v');
      return { ok: true, href };
    case 'paste_in_place':
      ctx.pasteInPlace();
      return { ok: true, href };
    case 'frame':
      ctx.frameSelection();
      return { ok: true, href };
    case 'hug':
      ctx.hugSelection();
      return { ok: true, href };
    case 'vote':
      ctx.vote();
      return { ok: true, href };
    case 'isolate':
      ctx.isolate();
      return { ok: true, href };
    case 'reveal':
      ctx.reveal();
      return { ok: true, href };
    case 'select_inverse':
      ctx.selectInverse();
      return { ok: true, href };
    case 'lock_others':
      ctx.lockOthers();
      return { ok: true, href };
    case 'scale':
      ctx.scaleBy(parseScale(str(payload, 'query') || 'up'));
      return { ok: true, href };
    case 'radius':
      ctx.setRadius(Number(str(payload, 'query') || '12') || 12);
      return { ok: true, href };
    case 'format_text':
      if (str(payload, 'query')) ctx.formatText(str(payload, 'query'));
      return { ok: true, href };
    case 'find_replace':
      ctx.findReplace(str(payload, 'title'), str(payload, 'query') || str(payload, 'content'));
      return { ok: true, href };
    case 'insert_link':
      ctx.insertLink(str(payload, 'href'), str(payload, 'title') || undefined);
      return { ok: true, href };
    case 'insert_citation':
      ctx.insertCitation(str(payload, 'title') || str(payload, 'content') || str(payload, 'query'));
      return { ok: true, href };
    case 'word_count':
      ctx.wordCount();
      return { ok: true, href };
    case 'merge_notes':
      ctx.mergeNotes();
      return { ok: true, href };
    case 'split_notes':
      ctx.splitNotes();
      return { ok: true, href };
    case 'copy_text':
      ctx.copyText();
      return { ok: true, href };
    case 'paste_plain':
      ctx.pastePlain();
      return { ok: true, href };
    case 'insert_date':
      ctx.insertDate();
      return { ok: true, href };
    default:
      return { ok: false, error: 'Unknown canvas command' };
  }
}
