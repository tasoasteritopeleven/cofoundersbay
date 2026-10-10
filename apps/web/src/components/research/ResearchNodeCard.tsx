'use client';

import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import {
  FileText, Image as ImageIcon, Link as LinkIcon, StickyNote,
  MoreHorizontal, Lock, Unlock, Trash2, X,
  Eye, EyeOff, Minimize2, MessageCircle,
  BookOpen, Palette, FileType, Users,
  Lightbulb, FlaskConical, HelpCircle, ListChecks, GitBranch, Sparkles,
  // Strategy & Planning
  Presentation, ClipboardList, LayoutGrid, Target, Map, Compass,
  // Financial
  DollarSign, PieChart, Receipt, Landmark, TrendingUp, Calculator,
  // Legal
  Scale, ShieldCheck, FileCheck, Stamp, Copyright, ShieldAlert,
  // Product & Tech
  PenTool, Code, Blocks, Server, Bug, Rocket,
  // Marketing & Sales
  BarChart3, Search, UserCircle, Megaphone, Filter, Funnel,
  // Team & Operations
  Network, Calendar, CheckSquare, GanttChart, Gauge, UserPlus, GraduationCap,
  // Communication
  Mail, Newspaper, FileSpreadsheet, Send, Inbox,
  // Data & Metrics
  Database, Award, ClipboardCheck, Activity, FileBarChart,
  // Investor Relations
  Briefcase, TrendingDown, FolderOpen, CircleDollarSign,
  // Task Management
  ListTodo, Flag, Repeat, MessageSquare,
  // Shapes & Diagram
  Square, Circle, Diamond, Triangle, Minus, MoveRight, Type, Spline,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FactLine } from '@/components/common/FactLine';
import { ResearchNode } from '@/lib/api';
import { CanvasCommentPins } from '@/components/research/CanvasCommentPin';
import { ShapeNode, type ShapeVariant, type ShapeMeta } from './ShapeNode';
import { MermaidDiagramNode } from './MermaidDiagramNode';
import { VisualTemplateNode, type TemplateVariant } from './VisualTemplateNode';
import { FlowDiagramNode, DEFAULT_FLOW_DIAGRAM } from './FlowDiagramNode';
import { WhiteboardNode } from './WhiteboardNode';
import { useRouter } from 'next/navigation';
import { BilingualText } from '@/components/common/BilingualText';
import { SanitizedHtml } from '@/components/common/SanitizedHtml';
import { researchEn, researchEl, RESEARCH_NODE_LABEL_EL } from '@/lib/i18n/strings-research';
import { nodeVoteCount, CANVAS_NOTE_FILLS, resolveNoteFill, nodeChromeCss, nodePaintColor, readCfbHref, matchProductLink } from '@/lib/canvas/canvas-geometry';

type NodeUpdateData = {
  title?: string;
  content?: string;
  url?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  color?: string;
  collapsed?: boolean;
  locked?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

interface ResearchNodeCardProps {
  node: ResearchNode;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onUpdate: (data: NodeUpdateData) => void;
  onDelete: () => void;
  onCommentClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => void;
  zoom?: number;
  placingPin?: boolean;
  onPinPlaced?: () => void;
  dimmed?: boolean;
}

function touchAsMouse(e: React.TouchEvent): React.MouseEvent {
  const t = e.touches[0] ?? e.changedTouches[0];
  return {
    clientX: t.clientX,
    clientY: t.clientY,
    shiftKey: false,
    stopPropagation: () => e.stopPropagation(),
    preventDefault: () => e.preventDefault(),
    target: e.target,
    currentTarget: e.currentTarget,
  } as unknown as React.MouseEvent;
}

/* ─── Color helpers ──────────────────────────────────────────── */
const TYPE_DEFAULTS: Record<string, { color: string; label: string }> = {
  // ── Core ──────────────────────────────────────────
  note:            { color: '#F59E0B', label: 'NOTE' },
  document:        { color: '#3B82F6', label: 'DOC' },
  image:           { color: '#22C55E', label: 'IMAGE' },
  pdf:             { color: '#EF4444', label: 'PDF' },
  link:            { color: '#A855F7', label: 'LINK' },
  reference:       { color: '#64748B', label: 'REF' },
  // ── Research & Analysis ──────────────────────────
  insight:         { color: '#10B981', label: 'INSIGHT' },
  hypothesis:      { color: '#8B5CF6', label: 'HYPOTHESIS' },
  question:        { color: '#6366F1', label: 'QUESTION' },
  evidence:        { color: '#14B8A6', label: 'EVIDENCE' },
  citation:        { color: '#0EA5E9', label: 'CITATION' },
  // ── Strategy & Planning ──────────────────────────
  pitch_deck:      { color: '#EC4899', label: 'PITCH' },
  business_plan:   { color: '#7C3AED', label: 'BIZ PLAN' },
  business_model:  { color: '#8B5CF6', label: 'BIZ MODEL' },
  lean_canvas:     { color: '#A78BFA', label: 'LEAN' },
  swot:            { color: '#C084FC', label: 'SWOT' },
  roadmap:         { color: '#2563EB', label: 'ROADMAP' },
  okr:             { color: '#059669', label: 'OKR' },
  vision:          { color: '#7C3AED', label: 'VISION' },
  // ── Financial ────────────────────────────────────
  financial_model: { color: '#16A34A', label: 'FIN MODEL' },
  budget:          { color: '#15803D', label: 'BUDGET' },
  cap_table:       { color: '#047857', label: 'CAP TABLE' },
  invoice:         { color: '#059669', label: 'INVOICE' },
  term_sheet:      { color: '#0D9488', label: 'TERM SHEET' },
  revenue_model:   { color: '#10B981', label: 'REVENUE' },
  // ── Legal ────────────────────────────────────────
  contract:        { color: '#DC2626', label: 'CONTRACT' },
  nda:             { color: '#B91C1C', label: 'NDA' },
  legal:           { color: '#991B1B', label: 'LEGAL' },
  incorporation:   { color: '#9F1239', label: 'INCORP' },
  ip_filing:       { color: '#BE123C', label: 'IP FILING' },
  compliance:      { color: '#E11D48', label: 'COMPLIANCE' },
  // ── Product & Tech ──────────────────────────────
  wireframe:       { color: '#2563EB', label: 'WIREFRAME' },
  spec:            { color: '#1D4ED8', label: 'SPEC' },
  user_story:      { color: '#3B82F6', label: 'USER STORY' },
  api_doc:         { color: '#1E40AF', label: 'API DOC' },
  architecture:    { color: '#1E3A8A', label: 'ARCH' },
  bug_report:      { color: '#DC2626', label: 'BUG' },
  feature_request: { color: '#7C3AED', label: 'FEATURE' },
  // ── Marketing & Sales ───────────────────────────
  competitor:      { color: '#EA580C', label: 'COMPETITOR' },
  market_research: { color: '#D97706', label: 'MARKET' },
  persona:         { color: '#CA8A04', label: 'PERSONA' },
  branding:        { color: '#DB2777', label: 'BRAND' },
  go_to_market:    { color: '#E11D48', label: 'GTM' },
  funnel:          { color: '#F97316', label: 'FUNNEL' },
  // ── Team & Operations ───────────────────────────
  org_chart:       { color: '#0891B2', label: 'ORG CHART' },
  meeting_notes:   { color: '#0E7490', label: 'MEETING' },
  checklist:       { color: '#0D9488', label: 'CHECKLIST' },
  timeline:        { color: '#0284C7', label: 'TIMELINE' },
  kpi:             { color: '#0369A1', label: 'KPI' },
  hiring_plan:     { color: '#075985', label: 'HIRING' },
  onboarding:      { color: '#0C4A6E', label: 'ONBOARD' },
  // ── Communication & Content ─────────────────────
  email_draft:     { color: '#6D28D9', label: 'EMAIL' },
  press_release:   { color: '#7E22CE', label: 'PR' },
  presentation:    { color: '#9333EA', label: 'SLIDES' },
  proposal:        { color: '#A855F7', label: 'PROPOSAL' },
  newsletter:      { color: '#C026D3', label: 'NEWSLETTER' },
  // ── Data & Metrics ──────────────────────────────
  whitepaper:      { color: '#475569', label: 'PAPER' },
  case_study:      { color: '#64748B', label: 'CASE STUDY' },
  survey:          { color: '#94A3B8', label: 'SURVEY' },
  data:            { color: '#334155', label: 'DATA' },
  report:          { color: '#1E293B', label: 'REPORT' },
  // ── Investor Relations ──────────────────────────
  due_diligence:   { color: '#B45309', label: 'DD' },
  investor_update: { color: '#92400E', label: 'UPDATE' },
  data_room:       { color: '#78350F', label: 'DATA ROOM' },
  valuation:       { color: '#451A03', label: 'VALUATION' },
  // ── Task Management ─────────────────────────────
  task:            { color: '#F97316', label: 'TASK' },
  milestone:       { color: '#EF4444', label: 'MILESTONE' },
  sprint:          { color: '#F59E0B', label: 'SPRINT' },
  retrospective:   { color: '#84CC16', label: 'RETRO' },
  // Draw shapes
  shape_rect:      { color: '#3B82F6', label: 'RECT' },
  shape_circle:    { color: '#8B5CF6', label: 'CIRCLE' },
  shape_diamond:   { color: '#F59E0B', label: 'DIAMOND' },
  shape_triangle:  { color: '#10B981', label: 'TRIANGLE' },
  shape_line:      { color: '#94A3B8', label: 'LINE' },
  shape_arrow:     { color: '#6366F1', label: 'ARROW' },
  shape_text:      { color: '#475569', label: 'TEXT' },
  mermaid_diagram: { color: '#EC4899', label: 'DIAGRAM' },
  // Visual templates (Phase 2)
  visual_bmc:  { color: '#3B82F6', label: 'BMC' },
  visual_lean: { color: '#8B5CF6', label: 'LEAN' },
  visual_swot: { color: '#10B981', label: 'SWOT' },
  // Embedded interactive (Phase 2)
  flow_diagram: { color: '#6366F1', label: 'FLOW' },
  whiteboard:   { color: '#06B6D4', label: 'BOARD' },
};

function getEffectiveType(node: ResearchNode): string {
  const meta = node.metadata as Record<string, unknown> | null;
  return (meta?.displayType as string | undefined) || node.type;
}

function getNodeColor(node: ResearchNode) {
  const eff = getEffectiveType(node);
  return node.color || TYPE_DEFAULTS[eff]?.color || TYPE_DEFAULTS[node.type]?.color || '#3B82F6';
}

function getTypeIcon(type: string) {
  switch (type) {
    // Core
    case 'note':            return StickyNote;
    case 'image':           return ImageIcon;
    case 'link':            return LinkIcon;
    case 'pdf':             return FileType;
    case 'reference':       return Users;
    // Research & Analysis
    case 'insight':         return Lightbulb;
    case 'hypothesis':      return FlaskConical;
    case 'question':        return HelpCircle;
    case 'evidence':        return GitBranch;
    case 'citation':        return BookOpen;
    // Strategy & Planning
    case 'pitch_deck':      return Presentation;
    case 'business_plan':   return ClipboardList;
    case 'business_model':  return LayoutGrid;
    case 'lean_canvas':     return LayoutGrid;
    case 'swot':            return Target;
    case 'roadmap':         return Map;
    case 'okr':             return Target;
    case 'vision':          return Compass;
    // Financial
    case 'financial_model': return Calculator;
    case 'budget':          return DollarSign;
    case 'cap_table':       return PieChart;
    case 'invoice':         return Receipt;
    case 'term_sheet':      return Landmark;
    case 'revenue_model':   return TrendingUp;
    // Legal
    case 'contract':        return Scale;
    case 'nda':             return ShieldCheck;
    case 'legal':           return FileCheck;
    case 'incorporation':   return Stamp;
    case 'ip_filing':       return Copyright;
    case 'compliance':      return ShieldAlert;
    // Product & Tech
    case 'wireframe':       return PenTool;
    case 'spec':            return Code;
    case 'user_story':      return Blocks;
    case 'api_doc':         return Server;
    case 'architecture':    return Network;
    case 'bug_report':      return Bug;
    case 'feature_request': return Rocket;
    // Marketing & Sales
    case 'competitor':      return BarChart3;
    case 'market_research': return Search;
    case 'persona':         return UserCircle;
    case 'branding':        return Megaphone;
    case 'go_to_market':    return Megaphone;
    case 'funnel':          return Filter;
    // Team & Operations
    case 'org_chart':       return Network;
    case 'meeting_notes':   return Calendar;
    case 'checklist':       return CheckSquare;
    case 'timeline':        return GanttChart;
    case 'kpi':             return Gauge;
    case 'hiring_plan':     return UserPlus;
    case 'onboarding':      return GraduationCap;
    // Communication & Content
    case 'email_draft':     return Mail;
    case 'press_release':   return Newspaper;
    case 'presentation':    return Presentation;
    case 'proposal':        return Send;
    case 'newsletter':      return Inbox;
    // Data & Metrics
    case 'whitepaper':      return FileBarChart;
    case 'case_study':      return Award;
    case 'survey':          return ClipboardCheck;
    case 'data':            return Database;
    case 'report':          return FileBarChart;
    // Investor Relations
    case 'due_diligence':   return Briefcase;
    case 'investor_update': return TrendingUp;
    case 'data_room':       return FolderOpen;
    case 'valuation':       return CircleDollarSign;
    // Task Management
    case 'task':            return ListTodo;
    case 'milestone':       return Flag;
    case 'sprint':          return Repeat;
    case 'retrospective':   return MessageSquare;
    // Draw shapes
    case 'shape_rect':      return Square;
    case 'shape_circle':    return Circle;
    case 'shape_diamond':   return Diamond;
    case 'shape_triangle':  return Triangle;
    case 'shape_line':      return Minus;
    case 'shape_arrow':     return MoveRight;
    case 'shape_text':      return Type;
    case 'mermaid_diagram': return Spline;
    // Visual templates
    case 'visual_bmc':  return LayoutGrid;
    case 'visual_lean': return Target;
    case 'visual_swot': return Target;
    // Embedded interactive
    case 'flow_diagram': return GitBranch;
    case 'whiteboard':   return PenTool;
    // Default
    case 'document':
    default:                return FileText;
  }
}

function typeLabelEn(type: string) {
  const raw = TYPE_DEFAULTS[type]?.label || 'Doc';
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function contentBodyPreview(content: string | null | undefined, title: string | null | undefined, max = 180) {
  if (!content) return null;
  let text = stripHtml(content);
  const t = title?.trim();
  if (t && text.toLowerCase().startsWith(t.toLowerCase())) {
    text = text.slice(t.length).replace(/^[\s:·\-–—]+/, '').trim();
  }
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function NodeProductLink({ metadata, onOpen }: { metadata: unknown; onOpen: (href: string) => void }) {
  const href = readCfbHref(metadata);
  const match = matchProductLink(href);
  if (!href || !match) return null;
  return (
    <button
      type="button"
      className="mt-1.5 flex w-fit items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5"
      onClick={(e) => { e.stopPropagation(); onOpen(href); }}
    >
      <LinkIcon className="h-2.5 w-2.5 text-primary-accessible" />
      <span className="text-2xs font-medium text-primary-accessible">
        <BilingualText en={researchEn(match.label)} el={researchEl(match.label)} compact />
      </span>
    </button>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ─── Node colors for color picker ───────────────────────────── */

/** Light-theme ink for a card painted with a pastel wash (see its use below). */
const WASHED_INK = {
  '--foreground': '220 26% 9%',
  '--muted-foreground': '220 10% 36%',
} as CSSProperties;

export function ResearchNodeCard({
  node,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDoubleClick,
  onUpdate,
  onDelete,
  onCommentClick,
  onContextMenu,
  onResizeStart,
  zoom,
  placingPin,
  onPinPlaced,
  dimmed = false,
}: ResearchNodeCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(node.title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const effectiveType = getEffectiveType(node);
  const wash = nodePaintColor(node.color, node.metadata);
  const typeAccent = TYPE_DEFAULTS[effectiveType]?.color || TYPE_DEFAULTS[node.type]?.color || '#3B82F6';
  const nodeColor = wash ? typeAccent : getNodeColor(node);
  const Icon = getTypeIcon(effectiveType);
  const typeEn = typeLabelEn(effectiveType);
  const typeEl = RESEARCH_NODE_LABEL_EL[effectiveType] ?? typeEn;

  const router = useRouter();

  const handleTouchDragStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    onDragStart(touchAsMouse(e));
  };

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    if (showMenu || showColorPicker) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showMenu, showColorPicker]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  // Get content preview (strip HTML) — available for all non-media/link types
  const getContentPreview = () => {
    const NON_TEXT = ['image', 'pdf', 'link', 'reference'];
    if (!NON_TEXT.includes(effectiveType) && !NON_TEXT.includes(node.type)) {
      return contentBodyPreview(node.content, node.title);
    }
    return null;
  };

  const contentPreview = getContentPreview();
  const isNote = effectiveType === 'note';
  const isImage = effectiveType === 'image' || node.type === 'image';
  const isDoc = !!node.upload && (node.type === 'document' || node.type === 'pdf');
  const isChecklist = effectiveType === 'checklist';
  const isTask = ['task', 'milestone', 'sprint', 'retrospective'].includes(effectiveType);
  const isSticky = isNote && (node.metadata as Record<string, unknown>)?.isSticky === true;

  // Inline sticky note editing state
  const [editingStickyContent, setEditingStickyContent] = useState(false);
  const [stickyContentDraft, setStickyContentDraft] = useState(node.content || '');
  const stickyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const SHAPE_TYPES = new Set(['shape_rect','shape_circle','shape_diamond','shape_triangle','shape_line','shape_arrow','shape_text']);
  const isShape = SHAPE_TYPES.has(effectiveType);
  const isMermaid = effectiveType === 'mermaid_diagram';
  const TEMPLATE_TYPES = new Set(['visual_bmc','visual_lean','visual_swot']);
  const isTemplate = TEMPLATE_TYPES.has(effectiveType);
  const isFlowDiagram = effectiveType === 'flow_diagram';
  const isWhiteboard  = effectiveType === 'whiteboard';

  // ── Shape node rendering ──────────────────────────────────────────────
  if (isShape) {
    const shapeMeta = (node.metadata ?? {}) as ShapeMeta;
    return (
      <div
        className={cn('absolute select-none', isDragging && 'opacity-75 scale-[1.02]')}
        style={{
          left: `${node.posX}px`,
          top: `${node.posY}px`,
          width: `${node.width}px`,
          height: `${node.height || 120}px`,
          zIndex: isSelected ? 10 : (node.zIndex || 1),
          ...nodeChromeCss(node.metadata),
        }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onContextMenu={onContextMenu}
      >
        <ShapeNode
          variant={effectiveType as ShapeVariant}
          width={node.width}
          height={node.height || 120}
          label={node.title || ''}
          meta={shapeMeta}
          isSelected={isSelected}
          onLabelChange={(label) => onUpdate({ title: label })}
          onMetaChange={(meta) => onUpdate({
            metadata: meta as Record<string, unknown>,
            // `node.color` is nullable; the shape prop is optional. Without the
            // second fallback a cleared colour arrives as `null` and fails to type.
            color: meta.fillColor ?? node.color ?? undefined,
          })}
          onDelete={onDelete}
        />
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }} />
          </>
        )}
      </div>
    );
  }

  // ── Visual template rendering ─────────────────────────────────────────
  if (isTemplate) {
    return (
      <div
        className={cn('absolute group select-none', isDragging && 'opacity-75 scale-[1.02]')}
        style={{
          left: `${node.posX}px`,
          top: `${node.posY}px`,
          width: `${node.width}px`,
          height: `${node.height || 400}px`,
          zIndex: isSelected ? 10 : (node.zIndex || 2),
        }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onContextMenu={onContextMenu}
      >
        <VisualTemplateNode
          variant={effectiveType as TemplateVariant}
          width={node.width}
          height={node.height || 400}
          content={node.content}
          isSelected={isSelected}
          readOnly={node.locked}
          onChange={(c) => onUpdate({ content: c })}
          onDelete={onDelete}
        />
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }} />
          </>
        )}
      </div>
    );
  }

  // ── Flow diagram rendering ─────────────────────────────────────────
  if (isFlowDiagram) {
    const defaultContent = JSON.stringify(DEFAULT_FLOW_DIAGRAM);
    return (
      <div
        className={cn('absolute group select-none', isDragging && 'opacity-75 scale-[1.02]')}
        style={{ left: `${node.posX}px`, top: `${node.posY}px`, width: `${node.width}px`, height: `${node.height || 360}px`, zIndex: isSelected ? 10 : (node.zIndex || 2) }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onContextMenu={onContextMenu}
      >
        <FlowDiagramNode
          width={node.width}
          height={node.height || 360}
          content={node.content || defaultContent}
          isSelected={isSelected}
          readOnly={node.locked}
          onChange={(c) => onUpdate({ content: c })}
          onDelete={onDelete}
        />
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }} />
          </>
        )}
      </div>
    );
  }

  // ── Whiteboard rendering ───────────────────────────────────────────
  if (isWhiteboard) {
    return (
      <div
        className={cn('absolute group select-none', isDragging && 'opacity-75 scale-[1.02]')}
        style={{ left: `${node.posX}px`, top: `${node.posY}px`, width: `${node.width}px`, height: `${node.height || 400}px`, zIndex: isSelected ? 10 : (node.zIndex || 2) }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onContextMenu={onContextMenu}
      >
        <WhiteboardNode
          width={node.width}
          height={node.height || 400}
          content={node.content}
          isSelected={isSelected}
          readOnly={node.locked}
          onChange={(c) => onUpdate({ content: c })}
          onDelete={onDelete}
        />
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize z-20" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }} />
          </>
        )}
      </div>
    );
  }

  // ── Mermaid diagram rendering ─────────────────────────────────────────
  if (isMermaid) {
    return (
      <div
        className={cn(
          'absolute group select-none rounded-xl border-2 bg-card shadow-sm transition-all duration-150',
          isSelected && 'ring-2 ring-primary ring-offset-1 shadow-md',
          !isSelected && 'hover:shadow-md',
          isDragging && 'opacity-75 shadow-xl scale-[1.02]',
          'cursor-grab active:cursor-grabbing',
        )}
        style={{
          left: `${node.posX}px`,
          top: `${node.posY}px`,
          width: `${node.width}px`,
          height: `${node.height || 300}px`,
          borderColor: '#EC4899B3',
          zIndex: isSelected ? 10 : (node.zIndex || 2),
        }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onContextMenu={onContextMenu}
      >
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border shrink-0">
          <div className="flex items-center gap-1.5">
            <Spline className="icon-sm" style={{ color: '#EC4899' }} />
            <span className="text-2xs font-semibold uppercase tracking-wide" style={{ color: '#EC4899' }}>DIAGRAM</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(e); }} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive-accessible">
              <Trash2 className="icon-sm" />
            </button>
          </div>
        </div>
        <div className="h-[calc(100%-36px)]" onMouseDown={(e) => e.stopPropagation()}>
          <MermaidDiagramNode
            content={node.content || ''}
            onChange={(c) => onUpdate({ content: c })}
            readOnly={node.locked}
          />
        </div>
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 z-10" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }} />
          </>
        )}
      </div>
    );
  }

  // ── Sticky note special rendering ──────────────────────────────────────
  if (isSticky) {
    const stickyColor = resolveNoteFill(node.color);
    const chrome = nodeChromeCss(node.metadata);

    return (
      <div
        className={cn(
          'absolute group select-none rounded-2xl border border-border shadow-sm transition-colors',
          isSelected && 'border-foreground/20 shadow-md',
          isDragging && 'opacity-75',
          'cursor-grab active:cursor-grabbing',
        )}
        style={{
          left: `${node.posX}px`,
          top: `${node.posY}px`,
          width: `${node.width}px`,
          minHeight: '100px',
          backgroundColor: stickyColor.fill,
          borderLeft: `4px solid ${stickyColor.accent}`,
          zIndex: isSelected ? 10 : (node.zIndex || 2),
          ...chrome,
        }}
        onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
        onClick={(e) => onSelect(e)}
        onDoubleClick={(e) => {
          if (!node.locked) {
            e.stopPropagation();
            setStickyContentDraft(node.content || '');
            setEditingStickyContent(true);
          }
        }}
        onContextMenu={onContextMenu}
      >
        {/* Sticky header with color dots + delete */}
        <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
          <div className="flex items-center gap-1">
            {CANVAS_NOTE_FILLS.map((c) => (
              <button
                key={c.fill}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const meta = node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
                  onUpdate({ color: c.fill, metadata: { ...meta, fillColor: c.fill } });
                }}
                className={cn(
                  'w-3 h-3 rounded-full border transition-transform hover:scale-125',
                  resolveNoteFill(node.color).fill === c.fill ? 'border-foreground/60 scale-125' : 'border-transparent',
                )}
                style={{ backgroundColor: c.accent }}
                aria-label={c.fill}
              />
            ))}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate({ locked: !node.locked }); }}
              className="w-4 h-4 flex items-center justify-center rounded-md hover:bg-black/10"
            >
              {node.locked ? <Lock className="w-2.5 h-2.5" style={{ color: stickyColor.accent }} aria-hidden="true" /> : <Unlock className="w-2.5 h-2.5 opacity-40" aria-hidden="true" />}
            </button>
            <button aria-label="Delete"
              onClick={handleDelete}
              className="w-4 h-4 flex items-center justify-center rounded-md hover:bg-status-danger/20"
            >
              <X className="w-2.5 h-2.5 text-destructive-accessible" />
            </button>
          </div>
        </div>

        {/* Sticky content — title first, then body */}
        <div className="px-3 pb-3">
          {node.title && (
            <p className="mb-1 text-sm font-semibold leading-snug" style={{ color: stickyColor.accent }}>
              {node.title}
            </p>
          )}
          {editingStickyContent ? (
            <textarea
              ref={stickyTextareaRef}
              value={stickyContentDraft}
              onChange={(e) => setStickyContentDraft(e.target.value)}
              onBlur={() => {
                setEditingStickyContent(false);
                if (stickyContentDraft !== node.content) onUpdate({ content: stickyContentDraft });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setStickyContentDraft(node.content || ''); setEditingStickyContent(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent outline-none resize-none text-xs leading-relaxed"
              style={{ color: stickyColor.accent, minHeight: '60px' }}
              autoFocus
              placeholder={researchEn('sticky_edit')}
            />
          ) : node.content?.includes('<') ? (
            <SanitizedHtml
              html={node.content}
              className="min-h-[40px] cursor-text text-xs leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_mark]:bg-status-warning-bg [&_mark]:text-status-warning [&_ul]:list-disc [&_ul]:pl-3.5 [&_ol]:list-decimal [&_ol]:pl-3.5 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_pre]:font-mono [&_pre]:text-2xs"
              style={{ color: stickyColor.accent }}
            />
          ) : (
            <p
              className="text-xs leading-relaxed whitespace-pre-wrap cursor-text min-h-[40px]"
              style={{ color: stickyColor.accent }}
            >
              {node.content
                ? (contentBodyPreview(node.content, node.title, 400) ?? stripHtml(node.content))
                : <span className="opacity-40 italic"><BilingualText en={researchEn('sticky_edit')} el={researchEl('sticky_edit')} /></span>}
            </p>
          )}
        </div>
        {readCfbHref(node.metadata) && (
          <div className="px-3 pb-2">
            <NodeProductLink metadata={node.metadata} onOpen={(href) => router.push(href)} />
          </div>
        )}

        {/* Resize handles */}
        {isSelected && !node.locked && onResizeStart && (
          <>
            <div className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }} />
            <div className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }} />
            <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }}>
              <svg viewBox="0 0 14 14" className="w-full h-full"><path d="M12 2L2 12M12 6L6 12M12 10L10 12" stroke={stickyColor.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" /></svg>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Standard node card rendering ──────────────────────────────────────
  return (
    <div
      className={cn(
        'absolute group select-none overflow-hidden',
        'rounded-2xl border border-border bg-card/95 transition-colors',
        'shadow-sm',
        isSelected && 'border-foreground/20 shadow-md',
        !isSelected && 'hover:border-border hover:bg-muted/15',
        isDragging && 'opacity-75',
        node.locked && 'border-dashed',
        'cursor-grab active:cursor-grabbing',
        dimmed && 'pointer-events-none opacity-20',
      )}
      style={{
        left: `${node.posX}px`,
        top: `${node.posY}px`,
        width: `${node.width}px`,
        height: node.collapsed ? 'auto' : undefined,
        backgroundColor: wash,
        // A wash is a light pastel in every theme, but the text on the card
        // reads theme tokens - so in the dark theme the title was
        // `--foreground` at 96% lightness on a yellow note, about 1.1:1, and
        // the type label and body sat not far above it. Scoping the light
        // theme's ink to a washed card keeps every token-driven line on it
        // legible without touching the unwashed cards, which sit on the
        // canvas background and must keep following the theme.
        ...(wash ? WASHED_INK : null),
        zIndex: isSelected ? 10 : (node.zIndex || 2),
        ...nodeChromeCss(node.metadata),
      }}
      onMouseDown={onDragStart} onTouchStart={handleTouchDragStart}
      onClick={(e) => onSelect(e)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Type strip + actions */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-1.5 text-primary-accessible">
            <Icon className="icon-sm shrink-0" style={{ color: nodeColor }} />
          </div>
          <span className="truncate text-2xs text-muted-foreground">
            <BilingualText en={typeEn} el={typeEl} compact />
          </span>
          {nodeVoteCount(node.metadata) > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-2xs font-medium text-primary-accessible">
              {nodeVoteCount(node.metadata)}
            </span>
          )}
        </div>
        <div ref={menuRef} className={cn('relative flex items-center gap-0.5 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
          {node.locked && <Lock className="icon-sm text-muted-foreground" />}
          <button aria-label="More actions"
            onClick={(e) => { e.stopPropagation(); setShowMenu((p) => !p); setShowColorPicker(false); }}
            className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <MoreHorizontal className="icon-sm text-muted-foreground" />
          </button>

          {/* Context menu */}
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[150px] bg-card border border-border rounded-xl shadow-lg py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { onDoubleClick(); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary w-full text-left transition-colors"
              >
                <BookOpen className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_open')} el={researchEl('node_open')} compact />
              </button>
              {node.builderDocumentId && (
                <button
                  onClick={() => { router.push('/builder'); setShowMenu(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-primary-accessible hover:bg-primary/10 w-full text-left transition-colors"
                >
                  <Rocket className="icon-sm" /> <BilingualText en={researchEn('linked_builder')} el={researchEl('linked_builder')} compact />
                </button>
              )}
              <button
                onClick={() => { onUpdate({ locked: !node.locked }); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary w-full text-left transition-colors"
              >
                {node.locked
                  ? <><Unlock className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_unlock')} el={researchEl('node_unlock')} compact /></>
                  : <><Lock className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_lock')} el={researchEl('node_lock')} compact /></>
                }
              </button>
              <button
                onClick={() => { onUpdate({ collapsed: !node.collapsed }); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary w-full text-left transition-colors"
              >
                {node.collapsed
                  ? <><Eye className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_expand')} el={researchEl('node_expand')} compact /></>
                  : <><EyeOff className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_collapse')} el={researchEl('node_collapse')} compact /></>
                }
              </button>
              <button
                onClick={() => { setShowColorPicker(true); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary w-full text-left transition-colors"
              >
                <Palette className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_color')} el={researchEl('node_color')} compact />
              </button>
              {onCommentClick && (
                <button
                  onClick={() => { onCommentClick(); setShowMenu(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary w-full text-left transition-colors"
                >
                  <MessageCircle className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('node_comments')} el={researchEl('node_comments')} compact />
                </button>
              )}
              <div className="px-3 py-1 text-2xs text-muted-foreground">
                <BilingualText en={researchEn('convert')} el={researchEl('convert')} compact />
              </div>
              {(['question', 'hypothesis', 'evidence', 'insight'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => {
                    const meta = { ...((node.metadata as Record<string, unknown>) ?? {}), displayType: kind };
                    onUpdate({ metadata: meta });
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
                >
                  <BilingualText
                    en={researchEn(`capture_${kind}` as 'capture_question' | 'capture_hypothesis' | 'capture_evidence' | 'capture_insight')}
                    el={researchEl(`capture_${kind}` as 'capture_question' | 'capture_hypothesis' | 'capture_evidence' | 'capture_insight')}
                    compact
                  />
                </button>
              ))}
              <button
                onClick={() => {
                  onUpdate({ zIndex: (node.zIndex || 1) + 20 });
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
              >
                <BilingualText en={researchEn('bring_front')} el={researchEl('bring_front')} compact />
              </button>
              <button
                onClick={() => {
                  onUpdate({ zIndex: Math.max(1, (node.zIndex || 1) - 20) });
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
              >
                <BilingualText en={researchEn('send_back')} el={researchEl('send_back')} compact />
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={(e) => { handleDelete(e); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-destructive-accessible hover:bg-destructive/10 w-full text-left transition-colors"
                disabled={node.locked}
              >
                <Trash2 className="icon-sm" /> <BilingualText en={researchEn('node_delete')} el={researchEl('node_delete')} compact />
              </button>
            </div>
          )}

          {/* Color picker popover */}
          {showColorPicker && (
            <div
              className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg p-2 z-50 flex flex-wrap gap-1.5 w-[116px]"
              onClick={(e) => e.stopPropagation()}
            >
              {CANVAS_NOTE_FILLS.map((c) => (
                <button
                  key={c.fill}
                  type="button"
                  title={c.fill}
                  onClick={() => {
                    const meta = node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
                    onUpdate({ color: c.fill, metadata: { ...meta, fillColor: c.fill } });
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                    resolveNoteFill(node.color).fill === c.fill ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ background: c.fill }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content preview */}
      {!node.collapsed && (
        <div className="px-3 pb-3">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim() && titleDraft !== node.title) onUpdate({ title: titleDraft.trim() });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                if (e.key === 'Escape') { setTitleDraft(node.title || ''); setEditingTitle(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="mb-1 w-full bg-transparent px-0 py-0.5 text-sm font-semibold leading-snug text-foreground outline-none"
              autoFocus
            />
          ) : (
            <p
              className="mb-1 cursor-text text-sm font-semibold leading-snug text-foreground line-clamp-2"
              onDoubleClick={(e) => {
                if (node.locked) return;
                e.stopPropagation();
                setTitleDraft(node.title || '');
                setEditingTitle(true);
              }}
            >
              {node.title || node.upload?.originalName || <BilingualText en={researchEn('node_untitled')} el={researchEl('node_untitled')} compact />}
            </p>
          )}

          {/* Image thumbnail */}
          {isImage && node.url && (
            <div className="rounded-lg overflow-hidden mb-2 h-24 bg-secondary">
              <img
                src={node.url}
                alt={node.title || 'Image'}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          )}

          {/* Checklist preview — show first few items as checkboxes */}
          {isChecklist && (() => {
            const meta = node.metadata as Record<string, unknown> | null;
            const items = (meta?.checklistItems as Array<{id: string; text: string; checked: boolean}>) || [];
            const done = items.filter((i) => i.checked).length;
            return (
              <div className="space-y-0.5">
                {items.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5">
                    <div className={cn('w-3 h-3 rounded border shrink-0', item.checked ? 'bg-primary border-primary' : 'border-muted-foreground/40')} />
                    <span className={cn('text-2xs truncate', item.checked ? 'line-through text-muted-foreground/50' : 'text-foreground/70')}>
                      {item.text || 'Untitled item'}
                    </span>
                  </div>
                ))}
                {items.length > 4 && <p className="text-2xs text-muted-foreground/50">+{items.length - 4} more</p>}
                {items.length > 0 && (
                  <p className="text-2xs text-muted-foreground/50 mt-1">{done}/{items.length} done</p>
                )}
                {items.length === 0 && <p className="text-2xs text-muted-foreground/50 italic">Empty checklist</p>}
              </div>
            );
          })()}

          {/* Task status badge */}
          {isTask && (() => {
            const meta = node.metadata as Record<string, unknown> | null;
            const status = (meta?.status as string) || 'todo';
            const priority = (meta?.priority as string) || 'medium';
            const dueDate = meta?.dueDate as string | undefined;
            return (
              <FactLine
                className="text-2xs"
                items={[status.replace('_', ' '), priority, dueDate ? `Due ${dueDate}` : null]}
              />
            );
          })()}

          {/* Note/document content preview */}
          {contentPreview && !isImage && !isDoc && !isChecklist && !isTask && effectiveType !== 'link' && effectiveType !== 'reference' && node.type !== 'link' && node.type !== 'reference' && (
            node.content?.includes('<') ? (
              <SanitizedHtml
                html={node.content}
                className="text-xs leading-relaxed text-muted-foreground line-clamp-5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_mark]:bg-status-warning-bg [&_mark]:text-status-warning [&_ul]:list-disc [&_ul]:pl-3.5 [&_ol]:list-decimal [&_ol]:pl-3.5 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_pre]:font-mono [&_pre]:text-2xs"
              />
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-5 whitespace-pre-wrap">
                {contentPreview}
              </p>
            )
          )}

          {/* Document/PDF file info — always show icon box for doc types */}
          {isDoc && (
            <div className="mb-1.5 flex items-center gap-2 py-2">
              <Icon className="icon-lg opacity-70 shrink-0" style={{ color: nodeColor }} />
              <div className="min-w-0">
                <p className="text-2xs text-muted-foreground truncate">
                  {node.upload?.mimeType ?? 'Document'}
                </p>
                {node.upload?.sizeBytes && (
                  <p className="text-2xs text-muted-foreground">{fmtSize(node.upload.sizeBytes)}</p>
                )}
              </div>
            </div>
          )}

          {/* Link preview */}
          {(effectiveType === 'link' || node.type === 'link') && node.url && (
            <p className="text-2xs text-primary-accessible truncate underline">{node.url}</p>
          )}

          {/* Reference preview */}
          {(effectiveType === 'reference' || node.type === 'reference') && (
            <div className="flex items-center gap-2 py-1.5">
              <Users className="icon-md text-muted-foreground shrink-0" />
              <span className="text-2xs text-muted-foreground truncate">Entity reference</span>
            </div>
          )}

          {/* Tags */}
          {node.tags.length > 0 && (
            <FactLine
              className="mt-1.5 text-2xs"
              items={[
                ...node.tags.slice(0, 3),
                node.tags.length > 3 ? `+${node.tags.length - 3}` : null,
              ]}
            />
          )}

          {/* Phase 10 — Builder document link badge */}
          {node.builderDocumentId && (
            <div
              className="mt-1.5 w-fit cursor-pointer"
              onClick={(e) => { e.stopPropagation(); router.push('/builder'); }}
              title="Linked to a Builder document — click to open Builder"
            >
              <Rocket className="w-2.5 h-2.5 text-primary-accessible" />
              <span className="text-2xs font-medium text-primary-accessible">
                <BilingualText en={researchEn('linked_builder')} el={researchEl('linked_builder')} compact />
              </span>
            </div>
          )}
          <NodeProductLink metadata={node.metadata} onOpen={(href) => router.push(href)} />
        </div>
      )}

      {/* Collapsed indicator */}
      {node.collapsed && (
        <div className="px-2.5 pb-2 flex items-center gap-1.5">
          <Minimize2 className="icon-sm text-muted-foreground" />
          <span className="text-2xs text-muted-foreground truncate">
            {node.title || 'Untitled'}
          </span>
        </div>
      )}

      {/* Inline canvas comment pins overlay (Phase 8b) */}
      <CanvasCommentPins
        nodeId={node.id}
        zoom={zoom ?? 1}
        nodeWidth={node.width}
        nodeHeight={node.height || 200}
        enabled={!node.locked}
        placingPin={placingPin}
        onPinPlaced={onPinPlaced}
      />

      {/* Resize handles — visible on hover when selected and not locked */}
      {isSelected && !node.locked && !node.collapsed && onResizeStart && (
        <>
          {/* Right edge */}
          <div
            className="absolute top-2 -right-1 w-2 h-[calc(100%-16px)] cursor-ew-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity hover:bg-primary/20 rounded-r"
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'right'); }}
          />
          {/* Bottom edge */}
          <div
            className="absolute -bottom-1 left-2 w-[calc(100%-16px)] h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity hover:bg-primary/20 rounded-b"
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'bottom'); }}
          />
          {/* Corner handle */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10"
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'corner'); }}
          >
            <svg viewBox="0 0 14 14" className="w-full h-full">
              <path d="M12 2L2 12M12 6L6 12M12 10L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground/60" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
