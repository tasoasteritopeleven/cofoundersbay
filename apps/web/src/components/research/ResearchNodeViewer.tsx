'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Download, FileText, Image as ImageIcon, Link as LinkIcon,
  StickyNote, FileType, ZoomIn, ZoomOut, Maximize2,
  Lightbulb, FlaskConical, HelpCircle, ListChecks, GitBranch, BookOpen, Users,
  // Extended icons
  Presentation, ClipboardList, LayoutGrid, Target, Map, Compass,
  Calculator, DollarSign, PieChart, Receipt, Landmark, TrendingUp,
  Scale, ShieldCheck, FileCheck, Stamp, Copyright, ShieldAlert,
  PenTool, Code, Blocks, Server, Network, Bug, Rocket,
  BarChart3, Search, UserCircle, Megaphone, Filter,
  Calendar, CheckSquare, GanttChart, Gauge, UserPlus, GraduationCap,
  Mail, Newspaper, Send, Inbox, FileBarChart, Award, ClipboardCheck,
  Database, Briefcase, FolderOpen, CircleDollarSign, ListTodo, Flag,
  Repeat, MessageSquare, Plus, X, Check, Link2, Link2Off, ExternalLink,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { ResearchNode } from '@/lib/api';
import { RichTextEditor } from './RichTextEditor';
import { PdfAnnotationViewer } from './PdfAnnotationViewer';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { BilingualText } from '@/components/common/BilingualText';
import { researchEn, researchEl } from '@/lib/i18n/strings-research';
import { matchProductLink, readCfbHref } from '@/lib/canvas/canvas-geometry';
import { bilingualInline } from '@/lib/i18n/format';

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
  metadata?: unknown;
  builderDocumentId?: string | null;
};

interface ResearchNodeViewerProps {
  node: ResearchNode;
  onClose: () => void;
  onUpdate: (data: NodeUpdateData) => void;
}

/* ─── Types ──────────────────────────────────────────────────── */
type ChecklistItem = { id: string; text: string; checked: boolean };

/* ─── Helpers ────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  // Core
  note: '#F59E0B', document: '#3B82F6', image: '#22C55E', pdf: '#EF4444',
  link: '#A855F7', reference: '#64748B',
  // Research & Analysis
  insight: '#10B981', hypothesis: '#8B5CF6', question: '#6366F1',
  evidence: '#14B8A6', citation: '#0EA5E9',
  // Strategy & Planning
  pitch_deck: '#EC4899', business_plan: '#7C3AED', business_model: '#8B5CF6',
  lean_canvas: '#A78BFA', swot: '#C084FC', roadmap: '#2563EB',
  okr: '#059669', vision: '#7C3AED',
  // Financial
  financial_model: '#16A34A', budget: '#15803D', cap_table: '#047857',
  invoice: '#059669', term_sheet: '#0D9488', revenue_model: '#10B981',
  // Legal
  contract: '#DC2626', nda: '#B91C1C', legal: '#991B1B',
  incorporation: '#9F1239', ip_filing: '#BE123C', compliance: '#E11D48',
  // Product & Tech
  wireframe: '#2563EB', spec: '#1D4ED8', user_story: '#3B82F6',
  api_doc: '#1E40AF', architecture: '#1E3A8A', bug_report: '#DC2626',
  feature_request: '#7C3AED',
  // Marketing & Sales
  competitor: '#EA580C', market_research: '#D97706', persona: '#CA8A04',
  branding: '#DB2777', go_to_market: '#E11D48', funnel: '#F97316',
  // Team & Operations
  org_chart: '#0891B2', meeting_notes: '#0E7490', checklist: '#0D9488',
  timeline: '#0284C7', kpi: '#0369A1', hiring_plan: '#075985', onboarding: '#0C4A6E',
  // Communication
  email_draft: '#6D28D9', press_release: '#7E22CE', presentation: '#9333EA',
  proposal: '#A855F7', newsletter: '#C026D3',
  // Data & Reports
  whitepaper: '#475569', case_study: '#64748B', survey: '#94A3B8',
  data: '#334155', report: '#1E293B',
  // Investor Relations
  due_diligence: '#B45309', investor_update: '#92400E', data_room: '#78350F',
  valuation: '#451A03',
  // Task Management
  task: '#F97316', milestone: '#EF4444', sprint: '#F59E0B', retrospective: '#84CC16',
};

function getEffectiveType(node: ResearchNode): string {
  const meta = node.metadata as Record<string, unknown> | null;
  return (meta?.displayType as string | undefined) || node.type;
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
    // Data & Reports
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
    // Default
    case 'document':
    default:                return FileText;
  }
}

function getDefaultTemplate(type: string): string {
  switch (type) {
    case 'pitch_deck':      return '<h2>Pitch Deck</h2><h3>1. Problem</h3><p>What problem are you solving?</p><h3>2. Solution</h3><p>How does your product solve it?</p><h3>3. Market Size</h3><p>Total addressable market...</p><h3>4. Business Model</h3><p>How do you make money?</p><h3>5. Traction</h3><p>Key metrics and milestones...</p><h3>6. Team</h3><p>Founders and key team members...</p><h3>7. The Ask</h3><p>How much are you raising and why?</p>';
    case 'business_plan':   return '<h2>Business Plan</h2><h3>Executive Summary</h3><p></p><h3>Market Analysis</h3><p></p><h3>Products &amp; Services</h3><p></p><h3>Marketing &amp; Sales Strategy</h3><p></p><h3>Operational Plan</h3><p></p><h3>Financial Projections</h3><p></p>';
    case 'business_model':  return '<h2>Business Model Canvas</h2><h3>Value Propositions</h3><p></p><h3>Customer Segments</h3><p></p><h3>Channels</h3><p></p><h3>Revenue Streams</h3><p></p><h3>Key Resources</h3><p></p><h3>Key Partners</h3><p></p><h3>Cost Structure</h3><p></p>';
    case 'lean_canvas':     return '<h2>Lean Canvas</h2><h3>Problem</h3><p>Top 3 problems</p><h3>Solution</h3><p>Top 3 features</p><h3>Unique Value Proposition</h3><p>Clear compelling message</p><h3>Channels</h3><p>Path to customers</p><h3>Customer Segments</h3><p>Target customers</p><h3>Key Metrics</h3><p>Key activities you measure</p><h3>Revenue Streams</h3><p></p><h3>Cost Structure</h3><p></p>';
    case 'roadmap':         return '<h2>Product Roadmap</h2><h3>Q1</h3><ul><li></li></ul><h3>Q2</h3><ul><li></li></ul><h3>Q3</h3><ul><li></li></ul><h3>Q4</h3><ul><li></li></ul>';
    case 'okr':             return '<h2>OKRs</h2><h3>Objective 1</h3><p></p><ul><li>KR1: </li><li>KR2: </li><li>KR3: </li></ul><h3>Objective 2</h3><p></p><ul><li>KR1: </li><li>KR2: </li><li>KR3: </li></ul>';
    case 'vision':          return '<h2>Vision Statement</h2><p></p><h3>Mission</h3><p></p><h3>Core Values</h3><ul><li></li></ul><h3>3-Year Goals</h3><p></p>';
    case 'financial_model': return '<h2>Financial Model</h2><h3>Revenue Projections</h3><p></p><h3>Cost Structure</h3><p></p><h3>Unit Economics</h3><p>LTV: <br/>CAC: <br/>Payback: </p><h3>Burn Rate</h3><p></p><h3>Runway</h3><p></p>';
    case 'budget':          return '<h2>Budget</h2><h3>Revenue</h3><p></p><h3>Operating Expenses</h3><ul><li>Salaries: </li><li>Marketing: </li><li>Infrastructure: </li><li>Office: </li></ul><h3>Total</h3><p></p>';
    case 'cap_table':       return '<h2>Cap Table</h2><h3>Founders</h3><p></p><h3>Employees (ESOP)</h3><p></p><h3>Investors</h3><p></p><h3>Total Shares</h3><p></p>';
    case 'term_sheet':      return '<h2>Term Sheet</h2><h3>Investment Amount</h3><p></p><h3>Valuation</h3><p>Pre-money: <br/>Post-money: </p><h3>Security Type</h3><p></p><h3>Investor Rights</h3><p></p><h3>Conditions</h3><p></p>';
    case 'contract':        return '<h2>Contract</h2><h3>Parties</h3><p></p><h3>Scope of Work</h3><p></p><h3>Compensation</h3><p></p><h3>Term</h3><p></p><h3>Termination</h3><p></p>';
    case 'nda':             return '<h2>Non-Disclosure Agreement</h2><h3>Parties</h3><p></p><h3>Confidential Information</h3><p></p><h3>Obligations</h3><p></p><h3>Term</h3><p></p>';
    case 'user_story':      return '<h2>User Story</h2><p><strong>As a</strong> [type of user],<br/><strong>I want</strong> [an action],<br/><strong>So that</strong> [a benefit].</p><h3>Acceptance Criteria</h3><ul><li>Given... When... Then...</li></ul><h3>Notes</h3><p></p>';
    case 'bug_report':      return '<h2>Bug Report</h2><h3>Summary</h3><p></p><h3>Severity</h3><p>Critical / High / Medium / Low</p><h3>Steps to Reproduce</h3><ol><li></li></ol><h3>Expected Behavior</h3><p></p><h3>Actual Behavior</h3><p></p><h3>Environment</h3><p>OS: <br/>Browser: <br/>Version: </p>';
    case 'feature_request': return '<h2>Feature Request</h2><h3>Description</h3><p></p><h3>Business Value</h3><p></p><h3>User Impact</h3><p></p><h3>Proposed Solution</h3><p></p>';
    case 'spec':            return '<h2>Technical Specification</h2><h3>Overview</h3><p></p><h3>Requirements</h3><p></p><h3>Architecture</h3><p></p><h3>API Endpoints</h3><p></p><h3>Security</h3><p></p>';
    case 'api_doc':         return '<h2>API Documentation</h2><h3>Base URL</h3><p></p><h3>Authentication</h3><p></p><h3>Endpoints</h3><h4>GET /endpoint</h4><p>Description: </p>';
    case 'meeting_notes':   return '<h2>Meeting Notes</h2><p><strong>Date:</strong> <br/><strong>Attendees:</strong> </p><h3>Agenda</h3><ol><li></li></ol><h3>Discussion</h3><p></p><h3>Action Items</h3><ul><li>[ ] </li></ul>';
    case 'persona':         return '<h2>Customer Persona</h2><h3>Demographics</h3><p>Age: <br/>Location: <br/>Occupation: </p><h3>Goals</h3><ul><li></li></ul><h3>Pain Points</h3><ul><li></li></ul><h3>Behaviors</h3><p></p>';
    case 'competitor':      return '<h2>Competitor Analysis</h2><h3>Company Overview</h3><p></p><h3>Products &amp; Pricing</h3><p></p><h3>Strengths</h3><ul><li></li></ul><h3>Weaknesses</h3><ul><li></li></ul>';
    case 'go_to_market':    return '<h2>Go-to-Market Strategy</h2><h3>Target Market</h3><p></p><h3>Value Proposition</h3><p></p><h3>Channels</h3><ul><li></li></ul><h3>Launch Timeline</h3><p></p>';
    case 'hiring_plan':     return '<h2>Hiring Plan</h2><h3>Open Positions</h3><ul><li></li></ul><h3>Timeline</h3><p></p><h3>Budget</h3><p></p>';
    case 'due_diligence':   return '<h2>Due Diligence Checklist</h2><h3>Corporate</h3><ul><li>[ ] Certificate of Incorporation</li><li>[ ] Cap Table</li></ul><h3>Financial</h3><ul><li>[ ] Financial statements</li><li>[ ] Tax returns</li></ul><h3>Legal</h3><ul><li>[ ] IP assignments</li><li>[ ] Key contracts</li></ul>';
    case 'investor_update': return '<h2>Investor Update</h2><p><strong>Period:</strong> </p><h3>Highlights</h3><ul><li></li></ul><h3>Key Metrics</h3><p>MRR: <br/>Growth: <br/>Users: </p><h3>Challenges</h3><p></p><h3>Asks</h3><p></p>';
    default:                return '';
  }
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ResearchNodeViewer({ node, onClose, onUpdate }: ResearchNodeViewerProps) {
  const { success, error: showError } = useToast();

  const effectiveType = getEffectiveType(node);
  const nodeColor = node.color || TYPE_COLORS[effectiveType] || TYPE_COLORS[node.type] || '#3B82F6';
  const Icon = getTypeIcon(effectiveType);

  // Determine view mode based on effective type
  const NON_EDITABLE_TYPES = ['image', 'pdf', 'link'];
  const isEditable = !NON_EDITABLE_TYPES.includes(effectiveType) && !NON_EDITABLE_TYPES.includes(node.type);
  const isImage = effectiveType === 'image' || node.type === 'image';
  const isPdf = effectiveType === 'pdf' || node.type === 'pdf';
  const isLink = effectiveType === 'link' || node.type === 'link';
  const isChecklist = effectiveType === 'checklist';
  const isTask = ['task', 'milestone', 'sprint', 'retrospective'].includes(effectiveType);
  const isSWOT = effectiveType === 'swot';
  const canDownload = !!node.upload;

  // Default template for blank editable nodes
  const initialContent = node.content || (isEditable && !isChecklist ? getDefaultTemplate(effectiveType) : '');

  const [editTitle, setEditTitle] = useState(node.title || '');
  const [editContent, setEditContent] = useState(initialContent);
  const [saved, setSaved] = useState(!!node.content);
  const [isSaving, setIsSaving] = useState(false);
  const [imgZoom, setImgZoom] = useState(1);

  // ── Checklist state ────────────────────────────────────────────────────
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() => {
    const meta = node.metadata as Record<string, unknown> | null;
    if (meta?.checklistItems && Array.isArray(meta.checklistItems)) {
      return meta.checklistItems as ChecklistItem[];
    }
    return [{ id: `${Date.now()}`, text: '', checked: false }];
  });

  // ── Task metadata state ────────────────────────────────────────────────
  // `metadata` is an untyped JSON bag on the node record; read it once
  // through a Record instead of casting at each field.
  const metadata: Record<string, unknown> = (node.metadata ?? {}) as Record<string, unknown>;
  const [taskMeta, setTaskMeta] = useState({
    status:   (metadata.status as string) || 'todo',
    priority: (metadata.priority as string) || 'medium',
    dueDate:  (metadata.dueDate as string) || '',
  });

  // ── SWOT state ─────────────────────────────────────────────────────────
  const [swot, setSwot] = useState({
    strengths:     (metadata.strengths as string) || '',
    weaknesses:    (metadata.weaknesses as string) || '',
    opportunities: (metadata.opportunities as string) || '',
    threats:       (metadata.threats as string) || '',
  });

  // ── Phase 10: Builder Document Link state ─────────────────────────────
  const router = useRouter();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');

  // Mark unsaved on content/title change
  useEffect(() => { setSaved(false); }, [editContent, editTitle]);

  const doSave = useCallback(() => {
    if (!isEditable) return;
    const updates: NodeUpdateData = {};
    if (editTitle !== (node.title || '')) updates.title = editTitle;
    if (editContent !== (node.content || '')) updates.content = editContent;
    if (Object.keys(updates).length === 0) { setSaved(true); return; }
    setIsSaving(true);
    try {
      onUpdate(updates);
      setSaved(true);
    } catch (err) {
      showError('Failed to save', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [editTitle, editContent, node.title, node.content, isEditable, onUpdate, showError]);

  // Auto-save with 1.5s debounce
  useEffect(() => {
    if (saved || !isEditable) return;
    const timer = setTimeout(() => doSave(), 1500);
    return () => clearTimeout(timer);
  }, [editContent, editTitle, saved, isEditable, doSave]);

  const handleSave = useCallback(() => {
    doSave();
    if (isEditable || isChecklist || isTask || isSWOT) success('Saved');
  }, [doSave, isEditable, isChecklist, isTask, isSWOT, success]);

  // ── Checklist helpers ──────────────────────────────────────────────────
  const saveChecklist = useCallback((items: ChecklistItem[]) => {
    onUpdate({ metadata: { ...((node.metadata as object) || {}), displayType: effectiveType, checklistItems: items } });
  }, [node.metadata, effectiveType, onUpdate]);

  const addChecklistItem = useCallback(() => {
    const newItem: ChecklistItem = { id: `${Date.now()}`, text: '', checked: false };
    const updated = [...checklistItems, newItem];
    setChecklistItems(updated);
    saveChecklist(updated);
  }, [checklistItems, saveChecklist]);

  const toggleChecklistItem = useCallback((id: string, checked: boolean) => {
    const updated = checklistItems.map((i) => i.id === id ? { ...i, checked } : i);
    setChecklistItems(updated);
    saveChecklist(updated);
  }, [checklistItems, saveChecklist]);

  const updateChecklistItemText = useCallback((id: string, text: string) => {
    setChecklistItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
  }, []);

  const blurChecklistItem = useCallback(() => {
    saveChecklist(checklistItems);
  }, [checklistItems, saveChecklist]);

  const removeChecklistItem = useCallback((id: string) => {
    if (checklistItems.length <= 1) return;
    const updated = checklistItems.filter((i) => i.id !== id);
    setChecklistItems(updated);
    saveChecklist(updated);
  }, [checklistItems, saveChecklist]);

  // ── Task meta helpers ──────────────────────────────────────────────────
  const updateTaskMeta = useCallback((patch: Partial<typeof taskMeta>) => {
    const updated = { ...taskMeta, ...patch };
    setTaskMeta(updated);
    onUpdate({ metadata: { ...((node.metadata as object) || {}), displayType: effectiveType, ...updated } });
  }, [taskMeta, node.metadata, effectiveType, onUpdate]);

  // ── SWOT helpers ───────────────────────────────────────────────────────
  const saveSwot = useCallback((updated: typeof swot) => {
    onUpdate({ metadata: { ...((node.metadata as object) || {}), displayType: effectiveType, ...updated } });
  }, [node.metadata, effectiveType, onUpdate]);

  // Word count for editable content
  const wordCount = useMemo(() => {
    if (!isEditable || !editContent) return 0;
    const text = editContent.replace(/<[^>]+>/g, '').trim();
    return text ? text.split(/\s+/).length : 0;
  }, [isEditable, editContent]);

  // Keyboard: Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleDownload = useCallback(async () => {
    if (!node.upload) return;
    try {
      const response = await fetch(node.upload.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = node.upload?.originalName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      success('Download started');
    } catch (err) {
      showError('Download failed', err instanceof Error ? err.message : 'Please try again');
    }
  }, [node.upload, success, showError]);

  const doneCount = checklistItems.filter((i) => i.checked).length;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className={cn(
        'flex flex-col gap-0 p-0 overflow-hidden max-w-4xl h-[88vh]',
      )}>
        <DialogTitle className="sr-only">{node.title ?? 'Research Node'}</DialogTitle>
        <DialogDescription className="sr-only"><BilingualText en="View and edit this research node." el="Προβολή και επεξεργασία αυτού του κόμβου έρευνας." /></DialogDescription>
        {/* ── Header: icon + editable title + unsaved/save ── */}
        <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <div className="flex-none p-1.5 rounded-lg" style={{ background: `${nodeColor}20` }}>
            <Icon className="icon-sm" style={{ color: nodeColor }} />
          </div>
          {isEditable ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none truncate placeholder:text-muted-foreground focus:bg-secondary/40 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
              placeholder={bilingualInline("Untitled", "Χωρίς τίτλο")}
            />
          ) : (
            <span className="flex-1 text-sm font-semibold text-foreground truncate">
              {node.title || node.upload?.originalName || 'Untitled'}
            </span>
          )}
          <div className="flex items-center gap-2 flex-none">
            {!saved && isEditable && (
              <span className="text-2xs text-muted-foreground">Unsaved</span>
            )}
            {isEditable && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            )}
            {canDownload && (
              <button
                onClick={handleDownload}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                title="Download"
              >
                <Download className="icon-sm" />
              </button>
            )}
            {node.upload?.sizeBytes && (
              <span className="text-2xs text-muted-foreground/70 tabular-nums">{fmtSize(node.upload.sizeBytes)}</span>
            )}
            {isEditable && wordCount > 0 && (
              <span className="text-2xs text-muted-foreground/50 tabular-nums">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {(() => {
          const href = readCfbHref(node.metadata);
          const match = matchProductLink(href);
          if (!href || !match) return null;
          return (
            <div className="flex-none flex items-center gap-2 px-4 py-1.5 border-b border-border bg-primary/5 text-xs">
              <LinkIcon className="icon-sm text-muted-foreground shrink-0" />
              <span className="text-primary-accessible font-medium">
                <BilingualText en={researchEn(match.label)} el={researchEl(match.label)} compact />
              </span>
              <button
                type="button"
                onClick={() => router.push(href)}
                className="flex items-center gap-1 text-primary-accessible hover:underline ml-1"
              >
                <ExternalLink className="icon-sm" />
                <BilingualText en={researchEn('node_open')} el={researchEl('node_open')} compact />
              </button>
            </div>
          );
        })()}

        {/* ── Phase 10: Builder Document link bar ── */}
        {(node.builderDocumentId || showLinkInput) && (
          <div className="flex-none flex items-center gap-2 px-4 py-1.5 border-b border-border bg-primary/5 text-xs">
            <Link2 className="icon-sm text-muted-foreground shrink-0" />
            {node.builderDocumentId ? (
              <>
                <span className="text-primary-accessible font-medium">Linked to Builder document</span>
                <button
                  onClick={() => router.push('/builder')}
                  className="flex items-center gap-1 text-primary-accessible hover:underline ml-1"
                >
                  <ExternalLink className="icon-sm" /> Open
                </button>
                <button
                  onClick={() => { onUpdate({ builderDocumentId: null }); }}
                  className="flex items-center gap-1 ml-auto text-muted-foreground hover:text-destructive-accessible transition-colors"
                  title="Remove link"
                >
                  <Link2Off className="icon-sm" />
                </button>
              </>
            ) : (
              <>
                <input
                  value={linkInputValue}
                  onChange={(e) => setLinkInputValue(e.target.value)}
                  placeholder={bilingualInline("Paste Builder Document ID…", "Επικολλήστε το ID εγγράφου του Builder…")}
                  className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && linkInputValue.trim()) {
                      onUpdate({ builderDocumentId: linkInputValue.trim() });
                      setLinkInputValue('');
                      setShowLinkInput(false);
                    }
                    if (e.key === 'Escape') { setLinkInputValue(''); setShowLinkInput(false); }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (linkInputValue.trim()) {
                      onUpdate({ builderDocumentId: linkInputValue.trim() });
                      setLinkInputValue('');
                    }
                    setShowLinkInput(false);
                  }}
                  className="h-5 px-2 rounded-md bg-primary text-primary-foreground text-2xs font-medium hover:bg-primary/90"
                >
                  Link
                </button>
                <button aria-label="Cancel link" onClick={() => setShowLinkInput(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="icon-sm" />
                </button>
              </>
            )}
          </div>
        )}
        {!node.builderDocumentId && !showLinkInput && (
          <button
            onClick={() => setShowLinkInput(true)}
            className="flex-none flex items-center gap-1.5 px-4 py-1 border-b border-transparent hover:border-border bg-transparent hover:bg-muted/40 text-2xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          >
            <Link2 className="icon-sm" /> Link to Builder document…
          </button>
        )}

        {/* ── Task metadata bar ── */}
        {isTask && (
          <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-border bg-secondary/30 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-muted-foreground font-medium">Status</span>
              <select
                value={taskMeta.status}
                onChange={(e) => updateTaskMeta({ status: e.target.value })}
                className="text-xs bg-background border border-border rounded px-2 py-0.5 outline-none cursor-pointer"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-muted-foreground font-medium">Priority</span>
              <select
                value={taskMeta.priority}
                onChange={(e) => updateTaskMeta({ priority: e.target.value })}
                className="text-xs bg-background border border-border rounded px-2 py-0.5 outline-none cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-muted-foreground font-medium">Due date</span>
              <input
                type="date"
                value={taskMeta.dueDate}
                onChange={(e) => updateTaskMeta({ dueDate: e.target.value })}
                className="text-xs bg-background border border-border rounded px-2 py-0.5 outline-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ── Checklist panel ── */}
        {isChecklist && (
          <div className="flex-none px-4 py-3 border-b border-border max-h-[50vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Items</span>
              <span className="text-2xs text-muted-foreground">{doneCount}/{checklistItems.length} completed</span>
            </div>
            <div className="space-y-1">
              {checklistItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 group py-0.5">
                  <button
                    onClick={() => toggleChecklistItem(item.id, !item.checked)}
                    className={cn(
                      'w-4 h-4 rounded border-2 flex-none flex items-center justify-center transition-colors',
                      item.checked ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary',
                    )}
                  >
                    {item.checked && <Check className="w-2.5 h-2.5 text-primary-foreground" aria-hidden="true" />}
                  </button>
                  <input
                    value={item.text}
                    onChange={(e) => updateChecklistItemText(item.id, e.target.value)}
                    onBlur={blurChecklistItem}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChecklistItem();
                      }
                      if (e.key === 'Backspace' && !item.text && checklistItems.length > 1) {
                        removeChecklistItem(item.id);
                      }
                    }}
                    className={cn(
                      'flex-1 bg-transparent outline-none text-sm leading-relaxed border-b border-transparent focus:border-border transition-colors',
                      item.checked && 'line-through text-muted-foreground',
                    )}
                    placeholder={idx === 0 ? 'Add first item…' : 'Add item…'}
                  />
                  <button aria-label="Remove item"
                    onClick={() => removeChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:text-destructive-accessible"
                  >
                    <X className="icon-sm" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addChecklistItem}
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="icon-sm" /> Add item
            </button>
          </div>
        )}

        {/* ── SWOT grid ── */}
        {isSWOT && (
          <div className="flex-none p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'strengths',     label: 'Strengths',     color: '#22C55E' },
                { key: 'weaknesses',    label: 'Weaknesses',    color: '#EF4444' },
                { key: 'opportunities', label: 'Opportunities', color: '#3B82F6' },
                { key: 'threats',       label: 'Threats',       color: '#F59E0B' },
              ] as const).map(({ key, label, color }) => (
                <div
                  key={key}
                  className="rounded-lg border-2 p-2.5"
                  style={{ borderColor: `${color}40`, background: `${color}08` }}
                >
                  <div className="text-2xs font-bold uppercase tracking-widest mb-1.5" style={{ color }}>
                    {label}
                  </div>
                  <textarea
                    value={swot[key]}
                    onChange={(e) => setSwot((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={() => saveSwot(swot)}
                    className="w-full bg-transparent outline-none text-xs leading-relaxed resize-none min-h-[72px] text-foreground/80"
                    placeholder={`Enter ${label.toLowerCase()}…`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-auto bg-background">
          {/* Image viewer */}
          {isImage && node.url && (
            <div className="flex flex-col items-center min-h-full p-4 gap-3">
              <div className="flex items-center gap-2">
                <button aria-label="Zoom out"
                  onClick={() => setImgZoom((z) => Math.max(0.2, z - 0.15))}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                >
                  <ZoomOut className="icon-sm" />
                </button>
                <span className="text-xs text-muted-foreground min-w-[44px] text-center">
                  {Math.round(imgZoom * 100)}%
                </span>
                <button aria-label="Zoom in"
                  onClick={() => setImgZoom((z) => Math.min(4, z + 0.15))}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                >
                  <ZoomIn className="icon-sm" />
                </button>
                <button aria-label="Reset zoom"
                  onClick={() => setImgZoom(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                >
                  <Maximize2 className="icon-sm" />
                </button>
              </div>
              <div className="overflow-auto flex-1 flex items-start justify-center w-full">
                <img
                  src={node.url}
                  alt={node.title || 'Image'}
                  style={{ transform: `scale(${imgZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}
                  className="max-w-full rounded-lg shadow-md"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {/* PDF viewer with annotations */}
          {isPdf && node.url && (
            <PdfAnnotationViewer
              url={node.url}
              title={node.title || 'PDF Document'}
              initialAnnotations={((node.metadata as Record<string, unknown>)?.pdfAnnotations as []) || []}
              onAnnotationsChange={(annotations) => {
                onUpdate({ metadata: { ...((node.metadata as Record<string, unknown>) || {}), pdfAnnotations: annotations } });
              }}
            />
          )}

          {/* Link viewer */}
          {isLink && node.url && (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
              <LinkIcon className="w-16 h-16 text-muted-foreground/30" aria-hidden="true" />
              <h3 className="text-lg font-semibold">External Link</h3>
              <a
                href={node.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-accessible hover:underline break-all text-center"
              >
                {node.url}
              </a>
            </div>
          )}

          {/* Rich text editor — always editable for notes/documents */}
          {isEditable && (
            <RichTextEditor
              content={editContent}
              onChange={(html) => { setEditContent(html); setSaved(false); }}
              placeholder={bilingualInline("Start writing your research notes…", "Ξεκινήστε να γράφετε τις σημειώσεις έρευνας…")}
              className="border-0 rounded-none h-full"
            />
          )}

          {/* Fallback for unknown file types */}
          {!isImage && !isPdf && !isLink && !isEditable && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="w-16 h-16 opacity-20" aria-hidden="true" />
              <p className="text-sm">Preview not available for this file type.</p>
              {canDownload && (
                <button
                  onClick={handleDownload}
                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <Download className="icon-sm" /> Download
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
