'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ZoomIn, ZoomOut, Maximize2, Upload, StickyNote, Magnet,
  FileText, Link as LinkIcon,
  Loader2, Settings, Users, Sparkles, Map, History,
  Filter, Grid3X3, Layers, Copy, GitBranch,
  Undo2, Redo2, Keyboard, Search, X,
  Eye, Trash2, Pin, Star, MessageSquare,
  Plus, ChevronDown, ArrowRight,
  // Strategy & Planning
  Presentation, ClipboardList, LayoutGrid, Target, Compass,
  // Financial
  DollarSign, PieChart, Receipt, Landmark, TrendingUp, Calculator,
  // Legal
  Scale, ShieldCheck, FileCheck, Stamp, Copyright, ShieldAlert,
  // Product & Tech
  PenTool, Code, Blocks, Server, Bug, Rocket,
  // Marketing & Sales
  BarChart3, UserCircle, Megaphone, Funnel,
  // Team & Operations
  Network, Calendar, CheckSquare, GanttChart, Gauge, UserPlus, GraduationCap,
  // Communication
  Mail, Newspaper, Send, Inbox,
  // Data & Metrics
  Database, Award, ClipboardCheck, FileBarChart,
  // Investor Relations
  Briefcase, FolderOpen, CircleDollarSign,
  // Task Management
  ListTodo, Flag, Repeat,
  // Research
  Lightbulb, FlaskConical, HelpCircle, BookOpen,
  // Shapes & Export
  Square, Circle, Diamond, Triangle, Minus, MoveRight, Type, Spline, Download,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/layout/SidebarContext';
import { SideNav } from '@/components/layout/SideNav';
import { TopBar } from '@/components/layout/TopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useToast } from '@/components/ui/toast';
import {
  getResearchBoard,
  updateResearchBoard,
  createResearchNode,
  updateResearchNode,
  deleteResearchNode,
  batchUpdateResearchNodes,
  uploadResearchAsset,
  createResearchConnector,
  deleteResearchConnector,
  type ResearchNode,
  type ResearchBoardFull,
} from '@/lib/api';
import { ResearchNodeCard } from '@/components/research/ResearchNodeCard';
import { ResearchNodeViewer } from '@/components/research/ResearchNodeViewer';
import { ResearchConnectorLines } from '@/components/research/ResearchConnectorLines';
import { ResearchGroupFrame, type ResearchGroup } from '@/components/research/ResearchGroupFrame';
import { BoardExport } from '@/components/research/BoardExport';
import { EntityReferenceSelector } from '@/components/research/EntityReferenceSelector';
import { NodeFilterBar } from '@/components/research/NodeTagsEditor';
import { CanvasCopilotPanel } from '@/components/research/CanvasCopilotPanel';
import { CanvasDrawToolbar, type DrawTool } from '@/components/research/CanvasDrawToolbar';
import { PageRail, type PageRailSection } from '@/components/layout/PageRail';
import { usePageRail } from '@/components/layout/PageRailContext';
import { MERMAID_STARTERS } from '@/components/research/MermaidDiagramNode';
import { getTemplateDefaultContent } from '@/components/research/VisualTemplateNode';
import { computeLayout, type LayoutAlgorithm } from '@/lib/autoLayout';
import { ShapeLibraryPanel, type ShapeTemplate } from '@/components/research/ShapeLibraryPanel';
import { toPng, toSvg } from 'html-to-image';
import { BoardSettingsPanel } from '@/components/research/BoardSettingsPanel';
import { BoardSummaryPanel } from '@/components/research/BoardSummaryPanel';
import { CommentsPanel } from '@/components/research/CommentsPanel';
import { BoardMiniMap } from '@/components/research/BoardMiniMap';
import { CanvasVersionPanel } from '@/components/research/CanvasVersionPanel';
import { CanvasBranchSelector } from '@/components/research/CanvasBranchSelector';
import { CollaboratorsBar, LiveCursors } from '@/components/research/CollaboratorsBar';
import { useResearchCollaboration } from '@/hooks/useResearchCollaboration';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { usePageControls, usePageList } from '@/lib/page-controls';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { EmptyCanvasStarter, canvasStarterPayload } from '@/components/research/EmptyCanvasStarter';
import { CanvasInspectorPanel } from '@/components/research/CanvasInspectorPanel';
import { CanvasAlignmentGuides } from '@/components/research/CanvasAlignmentGuides';
import { CanvasRulers } from '@/components/research/CanvasRulers';
import {
  consumePendingCanvasCommand,
  registerCanvasCommandHandler,
  runCanvasCommand,
  type CanvasCommandRequest,
} from '@/lib/canvas/canvas-command-bus';
import {
  CANVAS_CLIP_TYPE,
  DEFAULT_CANVAS_LAYER,
  computeAlignmentGuides,
  hugBounds,
  isNodeHidden,
  mergeNodeStyle,
  nodeLayerId,
  nodePaintColor,
  nodeVoteCount,
  applyPaintToMetadata,
  mergeNodeMetadata,
  readCfbHref,
  readNodeStyle,
  tidyRects,
  type AlignmentGuide,
  type CanvasClipboardPayload,
  type CanvasLayer,
} from '@/lib/canvas/canvas-geometry';
import { handleCanvasOp } from '@/lib/canvas/handle-canvas-op';
import {
  applyDocFormat,
  appendDocCitation,
  appendDocDate,
  appendDocLink,
  appendPlainText,
  countDocWords,
  findReplaceDoc,
  isCanvasDocFormat,
  mergeDocHtml,
  splitDocBlocks,
  stripDocTags,
} from '@/lib/canvas/canvas-document';
import type { ActionOutcome, CanvasCommandOp } from '@cofounderbay/shared';
import {
  researchEn,
  researchEl,
  useResearchPrimaryText,
  RESEARCH_NODE_CATEGORY_EL,
  RESEARCH_NODE_LABEL_EL,
} from '@/lib/i18n/strings-research';

type Tool = DrawTool;

const MAX_HISTORY = 50;

/* ─── Default content templates for new nodes ───────────────────────── */
function getDefaultContent(type: string): string {
  switch (type) {
    case 'pitch_deck':      return '<h2>Pitch Deck</h2><h3>1. Problem</h3><p>What problem are you solving?</p><h3>2. Solution</h3><p>How does your product solve it?</p><h3>3. Market Size</h3><p>Total addressable market...</p><h3>4. Business Model</h3><p>How do you make money?</p><h3>5. Traction</h3><p>Key metrics and milestones...</p><h3>6. Team</h3><p>Founders and key team members...</p><h3>7. The Ask</h3><p>How much are you raising and why?</p>';
    case 'business_plan':   return '<h2>Business Plan</h2><h3>Executive Summary</h3><p></p><h3>Market Analysis</h3><p></p><h3>Products &amp; Services</h3><p></p><h3>Marketing &amp; Sales Strategy</h3><p></p><h3>Operational Plan</h3><p></p><h3>Financial Projections</h3><p></p>';
    case 'business_model':  return '<h2>Business Model Canvas</h2><h3>Value Propositions</h3><p></p><h3>Customer Segments</h3><p></p><h3>Channels</h3><p></p><h3>Revenue Streams</h3><p></p><h3>Key Resources</h3><p></p><h3>Key Partners</h3><p></p><h3>Cost Structure</h3><p></p>';
    case 'lean_canvas':     return '<h2>Lean Canvas</h2><h3>Problem</h3><p>Top 3 problems</p><h3>Solution</h3><p>Top 3 features</p><h3>Unique Value Proposition</h3><p>Clear compelling message</p><h3>Channels</h3><p>Path to customers</p><h3>Customer Segments</h3><p>Target customers</p><h3>Key Metrics</h3><p>Key activities you measure</p><h3>Revenue Streams</h3><p></p><h3>Cost Structure</h3><p></p>';
    case 'swot':            return '<h2>SWOT Analysis</h2><p>Use the interactive grid above to fill in each quadrant.</p>';
    case 'roadmap':         return '<h2>Product Roadmap</h2><h3>Q1</h3><ul><li></li></ul><h3>Q2</h3><ul><li></li></ul><h3>Q3</h3><ul><li></li></ul><h3>Q4</h3><ul><li></li></ul>';
    case 'okr':             return '<h2>OKRs</h2><h3>Objective 1</h3><p></p><ul><li>KR1: </li><li>KR2: </li><li>KR3: </li></ul><h3>Objective 2</h3><p></p><ul><li>KR1: </li><li>KR2: </li><li>KR3: </li></ul>';
    case 'vision':          return '<h2>Vision Statement</h2><p></p><h3>Mission</h3><p></p><h3>Core Values</h3><ul><li></li></ul><h3>3-Year Goals</h3><p></p>';
    case 'financial_model': return '<h2>Financial Model</h2><h3>Revenue Projections</h3><p></p><h3>Cost Structure</h3><p></p><h3>Unit Economics</h3><p>LTV: <br/>CAC: <br/>Payback: </p><h3>Burn Rate</h3><p></p><h3>Runway</h3><p></p>';
    case 'budget':          return '<h2>Budget</h2><h3>Revenue</h3><p></p><h3>Operating Expenses</h3><ul><li>Salaries: </li><li>Marketing: </li><li>Infrastructure: </li><li>Office: </li></ul><h3>Total</h3><p></p>';
    case 'cap_table':       return '<h2>Cap Table</h2><h3>Founders</h3><p></p><h3>Employees (ESOP)</h3><p></p><h3>Investors</h3><p></p><h3>Total Shares</h3><p></p>';
    case 'term_sheet':      return '<h2>Term Sheet</h2><h3>Investment Amount</h3><p></p><h3>Valuation</h3><p>Pre-money: <br/>Post-money: </p><h3>Security Type</h3><p></p><h3>Investor Rights</h3><p></p>';
    case 'invoice':         return '<h2>Invoice</h2><p>Invoice #: <br/>Date: <br/>Due: </p><h3>Bill To</h3><p></p><h3>Services</h3><ul><li></li></ul><h3>Total</h3><p></p>';
    case 'revenue_model':   return '<h2>Revenue Model</h2><h3>Revenue Streams</h3><ul><li></li></ul><h3>Pricing Strategy</h3><p></p><h3>Unit Economics</h3><p></p>';
    case 'contract':        return '<h2>Contract</h2><h3>Parties</h3><p></p><h3>Scope of Work</h3><p></p><h3>Compensation</h3><p></p><h3>Term</h3><p></p><h3>Termination</h3><p></p>';
    case 'nda':             return '<h2>Non-Disclosure Agreement</h2><h3>Parties</h3><p></p><h3>Confidential Information</h3><p></p><h3>Obligations</h3><p></p><h3>Term</h3><p></p>';
    case 'legal':           return '<h2>Legal Document</h2><h3>Overview</h3><p></p><h3>Terms</h3><p></p><h3>Obligations</h3><p></p>';
    case 'incorporation':   return '<h2>Incorporation</h2><h3>Company Name</h3><p></p><h3>Entity Type</h3><p></p><h3>Registered Agent</h3><p></p><h3>Directors</h3><p></p>';
    case 'ip_filing':       return '<h2>IP / Patent Filing</h2><h3>Title</h3><p></p><h3>Inventors</h3><p></p><h3>Abstract</h3><p></p><h3>Claims</h3><ol><li></li></ol>';
    case 'compliance':      return '<h2>Compliance Document</h2><h3>Regulation</h3><p></p><h3>Requirements</h3><ul><li></li></ul><h3>Status</h3><p></p>';
    case 'spec':            return '<h2>Technical Specification</h2><h3>Overview</h3><p></p><h3>Requirements</h3><p></p><h3>Architecture</h3><p></p><h3>API Endpoints</h3><p></p><h3>Security</h3><p></p>';
    case 'user_story':      return '<h2>User Story</h2><p><strong>As a</strong> [type of user],<br/><strong>I want</strong> [an action],<br/><strong>So that</strong> [a benefit].</p><h3>Acceptance Criteria</h3><ul><li>Given... When... Then...</li></ul>';
    case 'api_doc':         return '<h2>API Documentation</h2><h3>Base URL</h3><p></p><h3>Authentication</h3><p></p><h3>Endpoints</h3><h4>GET /endpoint</h4><p>Description: <br/>Response: </p>';
    case 'architecture':    return '<h2>Architecture</h2><h3>Overview</h3><p></p><h3>Components</h3><ul><li></li></ul><h3>Data Flow</h3><p></p><h3>Tech Stack</h3><p></p>';
    case 'bug_report':      return '<h2>Bug Report</h2><h3>Summary</h3><p></p><h3>Severity</h3><p>Critical / High / Medium / Low</p><h3>Steps to Reproduce</h3><ol><li></li></ol><h3>Expected</h3><p></p><h3>Actual</h3><p></p>';
    case 'feature_request': return '<h2>Feature Request</h2><h3>Description</h3><p></p><h3>Business Value</h3><p></p><h3>User Impact</h3><p></p><h3>Proposed Solution</h3><p></p>';
    case 'wireframe':       return '<h2>Wireframe Notes</h2><h3>Screen / Page</h3><p></p><h3>Key Elements</h3><ul><li></li></ul><h3>User Flow</h3><p></p><h3>Notes</h3><p></p>';
    case 'competitor':      return '<h2>Competitor Analysis</h2><h3>Company</h3><p></p><h3>Products &amp; Pricing</h3><p></p><h3>Strengths</h3><ul><li></li></ul><h3>Weaknesses</h3><ul><li></li></ul>';
    case 'market_research': return '<h2>Market Research</h2><h3>Market Size</h3><p>TAM: <br/>SAM: <br/>SOM: </p><h3>Key Trends</h3><ul><li></li></ul><h3>Target Segments</h3><p></p>';
    case 'persona':         return '<h2>Customer Persona</h2><h3>Demographics</h3><p>Age: <br/>Location: <br/>Occupation: </p><h3>Goals</h3><ul><li></li></ul><h3>Pain Points</h3><ul><li></li></ul>';
    case 'go_to_market':    return '<h2>Go-to-Market Strategy</h2><h3>Target Market</h3><p></p><h3>Value Proposition</h3><p></p><h3>Channels</h3><ul><li></li></ul><h3>Launch Timeline</h3><p></p>';
    case 'branding':        return '<h2>Brand Guidelines</h2><h3>Mission</h3><p></p><h3>Voice &amp; Tone</h3><p></p><h3>Visual Identity</h3><p>Colors: <br/>Fonts: </p>';
    case 'funnel':          return '<h2>Marketing Funnel</h2><h3>Awareness</h3><p></p><h3>Interest</h3><p></p><h3>Consideration</h3><p></p><h3>Purchase</h3><p></p><h3>Retention</h3><p></p>';
    case 'meeting_notes':   return '<h2>Meeting Notes</h2><p><strong>Date:</strong> <br/><strong>Attendees:</strong> </p><h3>Agenda</h3><ol><li></li></ol><h3>Discussion</h3><p></p><h3>Action Items</h3><ul><li>[ ] </li></ul>';
    case 'org_chart':       return '<h2>Org Chart</h2><h3>Leadership</h3><ul><li>CEO: </li><li>CTO: </li><li>COO: </li></ul><h3>Departments</h3><ul><li></li></ul>';
    case 'timeline':        return '<h2>Timeline</h2><h3>Phase 1</h3><p>Dates: </p><h3>Phase 2</h3><p>Dates: </p><h3>Phase 3</h3><p>Dates: </p><h3>Milestones</h3><ul><li></li></ul>';
    case 'kpi':             return '<h2>KPI Dashboard</h2><h3>Key Metrics</h3><ul><li>MRR: </li><li>Churn: </li><li>CAC: </li><li>LTV: </li><li>NPS: </li></ul><h3>Goals</h3><p></p>';
    case 'hiring_plan':     return '<h2>Hiring Plan</h2><h3>Open Positions</h3><ul><li></li></ul><h3>Timeline</h3><p></p><h3>Budget</h3><p></p><h3>Sourcing Strategy</h3><p></p>';
    case 'onboarding':      return '<h2>Onboarding Plan</h2><h3>Week 1</h3><ul><li></li></ul><h3>Week 2</h3><ul><li></li></ul><h3>Month 1</h3><ul><li></li></ul>';
    case 'email_draft':     return '<h2>Email Draft</h2><p><strong>To:</strong> <br/><strong>Subject:</strong> </p><h3>Body</h3><p>Hi [Name],</p><p></p><p>Best regards,<br/>[Your Name]</p>';
    case 'press_release':   return '<h2>Press Release</h2><p><strong>FOR IMMEDIATE RELEASE</strong></p><h3>Headline</h3><p></p><h3>Subheading</h3><p></p><h3>Body</h3><p></p><h3>About</h3><p></p>';
    case 'proposal':        return '<h2>Proposal</h2><h3>Executive Summary</h3><p></p><h3>Scope</h3><p></p><h3>Timeline</h3><p></p><h3>Investment</h3><p></p><h3>Next Steps</h3><p></p>';
    case 'newsletter':      return '<h2>Newsletter</h2><p><strong>Issue #: </strong></p><h3>Highlights</h3><ul><li></li></ul><h3>Feature Story</h3><p></p><h3>Updates</h3><p></p>';
    case 'whitepaper':      return '<h2>White Paper</h2><h3>Abstract</h3><p></p><h3>Introduction</h3><p></p><h3>Problem Statement</h3><p></p><h3>Solution</h3><p></p><h3>Conclusion</h3><p></p>';
    case 'case_study':      return '<h2>Case Study</h2><h3>Overview</h3><p></p><h3>Challenge</h3><p></p><h3>Solution</h3><p></p><h3>Results</h3><p></p><h3>Key Takeaways</h3><p></p>';
    case 'survey':          return '<h2>Survey</h2><h3>Q1</h3><p></p><h3>Q2</h3><p></p><h3>Q3</h3><p></p><h3>Q4</h3><p></p><h3>Q5</h3><p></p>';
    case 'report':          return '<h2>Report</h2><h3>Executive Summary</h3><p></p><h3>Findings</h3><p></p><h3>Analysis</h3><p></p><h3>Recommendations</h3><p></p>';
    case 'due_diligence':   return '<h2>Due Diligence Checklist</h2><h3>Corporate</h3><ul><li>[ ] Certificate of Incorporation</li><li>[ ] Cap Table</li></ul><h3>Financial</h3><ul><li>[ ] Financial statements</li><li>[ ] Tax returns</li></ul><h3>Legal</h3><ul><li>[ ] IP assignments</li><li>[ ] Key contracts</li></ul>';
    case 'investor_update': return '<h2>Investor Update</h2><p><strong>Period:</strong> </p><h3>Highlights</h3><ul><li></li></ul><h3>Key Metrics</h3><p>MRR: <br/>Growth: <br/>Users: </p><h3>Challenges</h3><p></p><h3>Asks</h3><p></p>';
    case 'data_room':       return '<h2>Data Room Index</h2><h3>Corporate</h3><ul><li></li></ul><h3>Financial</h3><ul><li></li></ul><h3>Legal</h3><ul><li></li></ul><h3>Product</h3><ul><li></li></ul>';
    case 'valuation':       return '<h2>Valuation</h2><h3>Methodology</h3><p>DCF / Comparable / Scorecard</p><h3>Assumptions</h3><p></p><h3>Conclusion</h3><p>Pre-money: <br/>Post-money: </p>';
    case 'insight':         return '<h2>Insight</h2><h3>Finding</h3><p></p><h3>Implication</h3><p></p><h3>Evidence</h3><p></p>';
    case 'hypothesis':      return '<h2>Hypothesis</h2><p><strong>We believe</strong> [action]<br/><strong>will result in</strong> [outcome]<br/><strong>because</strong> [rationale].</p><h3>Validation Method</h3><p></p>';
    case 'question':        return '<h2>Research Question</h2><p></p><h3>Context</h3><p></p><h3>Possible Approaches</h3><ul><li></li></ul>';
    case 'evidence':        return '<h2>Evidence</h2><h3>Finding</h3><p></p><h3>Source</h3><p></p><h3>Relevance</h3><p></p>';
    case 'citation':        return '<h2>Citation</h2><p></p><h3>Authors</h3><p></p><h3>Publication</h3><p></p><h3>Key Points</h3><ul><li></li></ul>';
    case 'retrospective':   return '<h2>Retrospective</h2><h3>What Went Well</h3><ul><li></li></ul><h3>What Could Improve</h3><ul><li></li></ul><h3>Action Items</h3><ul><li>[ ] </li></ul>';
    case 'sprint':          return '<h2>Sprint Plan</h2><p><strong>Sprint #:</strong> <br/><strong>Dates:</strong> <br/><strong>Goal:</strong> </p><h3>Stories</h3><ul><li></li></ul>';
    case 'milestone':       return '<h2>Milestone</h2><p><strong>Target Date:</strong> </p><h3>Objectives</h3><ul><li></li></ul><h3>Dependencies</h3><p></p>';
    case 'task':            return '';
    case 'checklist':       return '';
    // Mermaid starter diagram
    case 'mermaid_diagram': return MERMAID_STARTERS.flowchart;
    // Visual structured templates
    case 'visual_bmc':  return getTemplateDefaultContent('visual_bmc');
    case 'visual_lean': return getTemplateDefaultContent('visual_lean');
    case 'visual_swot': return getTemplateDefaultContent('visual_swot');
    // Embedded interactive
    case 'flow_diagram': return '';
    case 'whiteboard':   return '';
    default:                return '';
  }
}

/* ─── Categorised node types for the "Add Node" mega-menu ───────────── */
import type { ResearchNodeType } from '@/lib/api';
import type { LucideIcon } from 'lucide-react';
import { qk } from '@/lib/query-keys';

interface NodeTypeItem { type: ResearchNodeType; label: string; icon: LucideIcon; color: string }
interface NodeCategory { category: string; items: NodeTypeItem[] }

const NODE_CATEGORIES: NodeCategory[] = [
  { category: 'Core', items: [
    { type: 'note',      label: 'Note',         icon: StickyNote,  color: '#F59E0B' },
    { type: 'document',  label: 'Document',      icon: FileText,    color: '#3B82F6' },
    { type: 'link',      label: 'Link / URL',    icon: LinkIcon,    color: '#A855F7' },
  ]},
  { category: 'Research & Analysis', items: [
    { type: 'insight',    label: 'Insight',       icon: Lightbulb,    color: '#10B981' },
    { type: 'hypothesis', label: 'Hypothesis',    icon: FlaskConical, color: '#8B5CF6' },
    { type: 'question',   label: 'Question',      icon: HelpCircle,   color: '#6366F1' },
    { type: 'evidence',   label: 'Evidence',      icon: GitBranch,    color: '#14B8A6' },
    { type: 'citation',   label: 'Citation',      icon: BookOpen,     color: '#0EA5E9' },
  ]},
  { category: 'Strategy & Planning', items: [
    { type: 'pitch_deck',     label: 'Pitch Deck',       icon: Presentation,  color: '#EC4899' },
    { type: 'business_plan',  label: 'Business Plan',    icon: ClipboardList, color: '#7C3AED' },
    { type: 'business_model', label: 'Business Model',   icon: LayoutGrid,    color: '#8B5CF6' },
    { type: 'lean_canvas',    label: 'Lean Canvas',      icon: LayoutGrid,    color: '#A78BFA' },
    { type: 'swot',           label: 'SWOT Analysis',    icon: Target,        color: '#C084FC' },
    { type: 'roadmap',        label: 'Roadmap',          icon: Map,           color: '#2563EB' },
    { type: 'okr',            label: 'OKRs / Goals',     icon: Target,        color: '#059669' },
    { type: 'vision',         label: 'Vision Statement',  icon: Compass,       color: '#7C3AED' },
  ]},
  { category: 'Financial', items: [
    { type: 'financial_model', label: 'Financial Model',  icon: Calculator,  color: '#16A34A' },
    { type: 'budget',          label: 'Budget',           icon: DollarSign,  color: '#15803D' },
    { type: 'cap_table',       label: 'Cap Table',        icon: PieChart,    color: '#047857' },
    { type: 'invoice',         label: 'Invoice',          icon: Receipt,     color: '#059669' },
    { type: 'term_sheet',      label: 'Term Sheet',       icon: Landmark,    color: '#0D9488' },
    { type: 'revenue_model',   label: 'Revenue Model',    icon: TrendingUp,  color: '#10B981' },
  ]},
  { category: 'Legal', items: [
    { type: 'contract',      label: 'Contract',          icon: Scale,        color: '#DC2626' },
    { type: 'nda',           label: 'NDA',               icon: ShieldCheck,  color: '#B91C1C' },
    { type: 'legal',         label: 'Legal Document',    icon: FileCheck,    color: '#991B1B' },
    { type: 'incorporation', label: 'Incorporation',     icon: Stamp,        color: '#9F1239' },
    { type: 'ip_filing',     label: 'IP / Patent',       icon: Copyright,    color: '#BE123C' },
    { type: 'compliance',    label: 'Compliance',        icon: ShieldAlert,  color: '#E11D48' },
  ]},
  { category: 'Product & Tech', items: [
    { type: 'wireframe',       label: 'Wireframe',        icon: PenTool,  color: '#2563EB' },
    { type: 'spec',            label: 'Tech Spec',        icon: Code,     color: '#1D4ED8' },
    { type: 'user_story',      label: 'User Story',       icon: Blocks,   color: '#3B82F6' },
    { type: 'api_doc',         label: 'API Doc',          icon: Server,   color: '#1E40AF' },
    { type: 'architecture',    label: 'Architecture',     icon: Network,  color: '#1E3A8A' },
    { type: 'bug_report',      label: 'Bug Report',       icon: Bug,      color: '#DC2626' },
    { type: 'feature_request', label: 'Feature Request',  icon: Rocket,   color: '#7C3AED' },
  ]},
  { category: 'Marketing & Sales', items: [
    { type: 'competitor',      label: 'Competitor Analysis', icon: BarChart3,  color: '#EA580C' },
    { type: 'market_research', label: 'Market Research',    icon: Search,     color: '#D97706' },
    { type: 'persona',         label: 'User Persona',       icon: UserCircle, color: '#CA8A04' },
    { type: 'branding',        label: 'Branding',           icon: Megaphone,  color: '#DB2777' },
    { type: 'go_to_market',    label: 'Go-to-Market',       icon: Megaphone,  color: '#E11D48' },
    { type: 'funnel',          label: 'Sales Funnel',       icon: Filter,     color: '#F97316' },
  ]},
  { category: 'Team & Operations', items: [
    { type: 'org_chart',     label: 'Org Chart',       icon: Network,       color: '#0891B2' },
    { type: 'meeting_notes', label: 'Meeting Notes',   icon: Calendar,      color: '#0E7490' },
    { type: 'checklist',     label: 'Checklist',       icon: CheckSquare,   color: '#0D9488' },
    { type: 'timeline',      label: 'Timeline',        icon: GanttChart,    color: '#0284C7' },
    { type: 'kpi',           label: 'KPI Dashboard',   icon: Gauge,         color: '#0369A1' },
    { type: 'hiring_plan',   label: 'Hiring Plan',     icon: UserPlus,      color: '#075985' },
    { type: 'onboarding',    label: 'Onboarding',      icon: GraduationCap, color: '#0C4A6E' },
  ]},
  { category: 'Communication', items: [
    { type: 'email_draft',   label: 'Email Draft',     icon: Mail,       color: '#6D28D9' },
    { type: 'press_release', label: 'Press Release',   icon: Newspaper,  color: '#7E22CE' },
    { type: 'presentation',  label: 'Presentation',    icon: Presentation, color: '#9333EA' },
    { type: 'proposal',      label: 'Proposal / RFP',  icon: Send,       color: '#A855F7' },
    { type: 'newsletter',    label: 'Newsletter',      icon: Inbox,      color: '#C026D3' },
  ]},
  { category: 'Data & Reports', items: [
    { type: 'whitepaper',  label: 'Whitepaper',    icon: FileBarChart,   color: '#475569' },
    { type: 'case_study',  label: 'Case Study',    icon: Award,          color: '#64748B' },
    { type: 'survey',      label: 'Survey',        icon: ClipboardCheck, color: '#94A3B8' },
    { type: 'data',        label: 'Data / Sheet',  icon: Database,       color: '#334155' },
    { type: 'report',      label: 'Report',        icon: FileBarChart,   color: '#1E293B' },
  ]},
  { category: 'Investor Relations', items: [
    { type: 'due_diligence',   label: 'Due Diligence',    icon: Briefcase,        color: '#B45309' },
    { type: 'investor_update', label: 'Investor Update',  icon: TrendingUp,       color: '#92400E' },
    { type: 'data_room',       label: 'Data Room',        icon: FolderOpen,       color: '#78350F' },
    { type: 'valuation',       label: 'Valuation',        icon: CircleDollarSign, color: '#451A03' },
  ]},
  { category: 'Task Management', items: [
    { type: 'task',          label: 'Task',          icon: ListTodo,      color: '#F97316' },
    { type: 'milestone',     label: 'Milestone',     icon: Flag,          color: '#EF4444' },
    { type: 'sprint',        label: 'Sprint',        icon: Repeat,        color: '#F59E0B' },
    { type: 'retrospective', label: 'Retrospective', icon: MessageSquare, color: '#84CC16' },
  ]},
  { category: 'Shapes & Diagrams', items: [
    { type: 'shape_rect',     label: 'Rectangle',      icon: Square,    color: '#3B82F6' },
    { type: 'shape_circle',   label: 'Circle',         icon: Circle,    color: '#8B5CF6' },
    { type: 'shape_diamond',  label: 'Diamond',        icon: Diamond,   color: '#F59E0B' },
    { type: 'shape_triangle', label: 'Triangle',       icon: Triangle,  color: '#10B981' },
    { type: 'shape_line',     label: 'Line',           icon: Minus,     color: '#94A3B8' },
    { type: 'shape_arrow',    label: 'Arrow',          icon: MoveRight, color: '#6366F1' },
    { type: 'shape_text',     label: 'Text Label',     icon: Type,      color: '#475569' },
    { type: 'mermaid_diagram',label: 'Mermaid Diagram',icon: Spline,    color: '#EC4899' },
  ]},
  { category: 'Visual Templates', items: [
    { type: 'visual_bmc',  label: 'Business Model Canvas', icon: LayoutGrid, color: '#3B82F6' },
    { type: 'visual_lean', label: 'Lean Canvas',            icon: Target,     color: '#8B5CF6' },
    { type: 'visual_swot', label: 'SWOT Analysis',          icon: Target,     color: '#10B981' },
  ]},
  { category: 'Interactive', items: [
    { type: 'flow_diagram', label: 'Flow Diagram',  icon: GitBranch, color: '#6366F1' },
    { type: 'whiteboard',   label: 'Whiteboard',    icon: PenTool,   color: '#06B6D4' },
  ]},
];

interface CanvasSnapshot {
  nodes: Array<{ id: string; posX: number; posY: number; width: number; height: number }>;
  action: string;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

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

export default function ResearchBoardPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const t = useResearchPrimaryText();
  const { primary } = useLanguagePreference();
  const { open: openAskAi } = usePopupChat();
  const boardId = params?.boardId as string;

  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pendingTapRef = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [layers, setLayers] = useState<CanvasLayer[]>([DEFAULT_CANVAS_LAYER]);
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_CANVAS_LAYER.id);
  const activeLayerIdRef = useRef(DEFAULT_CANVAS_LAYER.id);
  activeLayerIdRef.current = activeLayerId;
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [showRulers, setShowRulers] = useState(false);
  const [isolatedIds, setIsolatedIds] = useState<Set<string>>(new Set());
  const clipRef = useRef<CanvasClipboardPayload | null>(null);
  const styleClipRef = useRef<{ color?: string | null; style?: ReturnType<typeof readNodeStyle> } | null>(null);
  // React 19's `useRef` has no zero-argument overload: the initial value is
  // required, and the type has to admit it until the command runner mounts.
  const runOpRef = useRef<((req: CanvasCommandRequest) => Promise<ActionOutcome>) | undefined>(undefined);
  const hydratedCommand = useRef(false);
  const GRID_SIZE = 32;

  // Snap coordinate to grid
  const snap = useCallback((val: number) => {
    if (!snapToGrid) return val;
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }, [snapToGrid]);

  // Multi-selection state (replaces single selectedNodeId)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [viewingNode, setViewingNode] = useState<ResearchNode | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<CanvasSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Box selection (Shift+Drag)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState({ x: 0, y: 0 });

  // Connection drawing mode
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<{ x: number; y: number } | null>(null);

  // Keyboard shortcuts help dialog
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useModalA11y<HTMLDivElement>(showShortcuts, () => setShowShortcuts(false));

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);

  // Drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeDir, setResizeDir] = useState<'right' | 'bottom' | 'corner' | null>(null);
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

  // Group frames state (persisted in canvasState)
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [resizingGroupId, setResizingGroupId] = useState<string | null>(null);
  const [groupResizeDir, setGroupResizeDir] = useState<'right' | 'bottom' | 'corner' | null>(null);
  const [groupResizeStart, setGroupResizeStart] = useState({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

  // Sticky notes quick-create mode
  const [stickyNoteMode, setStickyNoteMode] = useState(false);

  // Board summary
  const [showBoardSummary, setShowBoardSummary] = useState(false);

  // Canvas → Builder synthesis prompt (dismissed per board, persisted in localStorage)
  const synthDismissKey = `cfb_synth_dismissed_${boardId}`;
  const [synthDismissed, setSynthDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(synthDismissKey) === 'true') {
      setSynthDismissed(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Entity reference selector
  const [showEntitySelector, setShowEntitySelector] = useState(false);

  // Filtering state
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterSearch, setFilterSearch] = useState('');

  // Panel states
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [commentsNodeId, setCommentsNodeId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showShapeLibrary, setShowShapeLibrary] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);

  const currentUser = useCurrentUser();

  const { isConnected, collaborators, emitCursor, emitNodeMove, emitNodeUpdate } = useResearchCollaboration({
    boardId: boardId ?? null,
    enabled: !!boardId,
  });

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: qk('research-boards', 'board', boardId),
    queryFn: () => getResearchBoard(boardId),
  });

  const board = data?.board;

  // Filtered nodes derived from board data
  const filteredNodes = useMemo(() => {
    const nodes = board?.nodes ?? [];
    const hidden = new Set(layers.filter((l) => !l.visible).map((l) => l.id));
    return nodes.filter((n) => {
      if (isNodeHidden(n.metadata)) return false;
      if (hidden.has(nodeLayerId(n.metadata))) return false;
      const matchesSearch = !filterSearch ||
        (n.title ?? '').toLowerCase().includes(filterSearch.toLowerCase()) ||
        (n.content ?? '').toLowerCase().includes(filterSearch.toLowerCase());
      const matchesTags = filterTags.length === 0 ||
        filterTags.every((t) => n.tags.includes(t));
      return matchesSearch && matchesTags;
    });
  }, [board?.nodes, filterSearch, filterTags, layers]);

  const updateBoardMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateResearchBoard>[1]) => updateResearchBoard(boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: (data: Parameters<typeof createResearchNode>[1]) => {
      const meta = data.metadata && typeof data.metadata === 'object'
        ? { ...(data.metadata as Record<string, unknown>) }
        : {};
      if (typeof meta.layerId !== 'string' || !meta.layerId) {
        meta.layerId = activeLayerIdRef.current;
      }
      return createResearchNode(boardId, { ...data, metadata: meta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({ nodeId, data }: { nodeId: string; data: NodeUpdateData }) =>
      updateResearchNode(nodeId, data),
    onMutate: async ({ nodeId, data }) => {
      await queryClient.cancelQueries({ queryKey: qk('research-boards', 'board', boardId) });
      const previous = queryClient.getQueryData<{ board: ResearchBoardFull }>(['research-board', boardId]);
      queryClient.setQueryData(qk('research-boards', 'board', boardId), (old: { board: ResearchBoardFull } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          board: {
            ...old.board,
            nodes: old.board.nodes.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                ...data,
                metadata: data.metadata !== undefined
                  ? mergeNodeMetadata(n.metadata, data.metadata)
                  : n.metadata,
              };
            }),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk('research-boards', 'board', boardId), ctx.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: deleteResearchNode,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
      setSelectedNodeIds((prev) => { const next = new Set(prev); next.delete(deletedId); return next; });
    },
  });

  const createConnectorMutation = useMutation({
    mutationFn: (data: Parameters<typeof createResearchConnector>[1]) => createResearchConnector(boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
    },
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: deleteResearchConnector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
      success('Connection deleted');
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof batchUpdateResearchNodes>[1]) =>
      batchUpdateResearchNodes(boardId, updates),
  });

  // Save canvas state periodically (includes groups)
  useEffect(() => {
    if (!board) return;
    const timeout = setTimeout(() => {
      updateBoardMutation.mutate({ canvasState: { zoom, pan, groups, layers } });
    }, 2000);
    return () => clearTimeout(timeout);
  }, [zoom, pan, groups, layers]);

  // Restore canvas state on load
  useEffect(() => {
    if (board?.canvasState && typeof board.canvasState === 'object') {
      const state = board.canvasState as { zoom?: number; pan?: { x: number; y: number }; groups?: ResearchGroup[]; layers?: CanvasLayer[] };
      if (state.zoom) setZoom(state.zoom);
      if (state.pan) setPan(state.pan);
      if (state.groups && Array.isArray(state.groups)) setGroups(state.groups);
      if (state.layers && Array.isArray(state.layers) && state.layers.length > 0) {
        setLayers(state.layers);
        setActiveLayerId(state.layers[0]?.id ?? DEFAULT_CANVAS_LAYER.id);
      }
    }
  }, [board?.id]);

  // Zoom handlers
  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setZoom((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.25), 3);
      // Zoom centered on cursor: keep the point under the mouse fixed
      if (centerX !== undefined && centerY !== undefined && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;
        const factor = next / prev;
        setPan((p) => ({
          x: mouseX - (mouseX - p.x) * factor,
          y: mouseY - (mouseY - p.y) * factor,
        }));
      }
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      // Scroll = zoom centered on cursor
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta, e.clientX, e.clientY);
    } else {
      // Shift+scroll = horizontal pan
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [handleZoom]);

  // Attach wheel handler with { passive: false } so preventDefault() works.
  // React's synthetic onWheel is passive by default in React 17+ which prevents
  // calling preventDefault() and triggers a console warning.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Fit-to-content: auto-zoom and center to show all nodes
  const fitToContent = useCallback((onlySelected = false) => {
    if (!board || board.nodes.length === 0 || !canvasRef.current) return;
    const source = onlySelected && selectedNodeIds.size > 0
      ? board.nodes.filter((n) => selectedNodeIds.has(n.id))
      : board.nodes;
    if (source.length === 0) return;
    const PADDING = 80;
    const rect = canvasRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of source) {
      minX = Math.min(minX, n.posX);
      minY = Math.min(minY, n.posY);
      maxX = Math.max(maxX, n.posX + n.width);
      maxY = Math.max(maxY, n.posY + (n.height || 200));
    }
    const contentW = maxX - minX + PADDING * 2;
    const contentH = maxY - minY + PADDING * 2;
    const newZoom = Math.min(Math.max(Math.min(rect.width / contentW, rect.height / contentH), 0.25), 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setZoom(newZoom);
    setPan({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  }, [board, selectedNodeIds]);

  // --- Undo/Redo helpers ---
  const pushHistory = useCallback((action: string) => {
    if (!board) return;
    const snap: CanvasSnapshot = {
      nodes: board.nodes.map((n) => ({ id: n.id, posX: n.posX, posY: n.posY, width: n.width, height: n.height })),
      action,
    };
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      trimmed.push(snap);
      if (trimmed.length > MAX_HISTORY) trimmed.shift();
      return trimmed;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [board, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0 || !board) return;
    const prev = history[historyIndex - 1];
    const updates = prev.nodes.map((s) => ({ id: s.id, posX: s.posX, posY: s.posY }));
    batchUpdateMutation.mutate(updates);
    setHistoryIndex((i) => i - 1);
    queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
  }, [historyIndex, history, board, batchUpdateMutation, boardId, queryClient]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !board) return;
    const next = history[historyIndex + 1];
    const updates = next.nodes.map((s) => ({ id: s.id, posX: s.posX, posY: s.posY }));
    batchUpdateMutation.mutate(updates);
    setHistoryIndex((i) => i + 1);
    queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
  }, [historyIndex, history, board, batchUpdateMutation, boardId, queryClient]);

  // --- Connection drawing ---
  const handleCompleteConnection = useCallback((toId: string) => {
    if (!connectionStart || connectionStart === toId) {
      setConnectionStart(null);
      setTempConnectionEnd(null);
      return;
    }
    createConnectorMutation.mutate({ fromNodeId: connectionStart, toNodeId: toId });
    setConnectionStart(null);
    setTempConnectionEnd(null);
    setActiveTool('select');
    success('Connection created');
  }, [connectionStart, createConnectorMutation, success]);

  // --- Duplicate selected nodes ---
  const duplicateSelected = useCallback(() => {
    if (!board || selectedNodeIds.size === 0) return;
    const toDup = board.nodes.filter((n) => selectedNodeIds.has(n.id));
    toDup.forEach((n, i) => {
      createNodeMutation.mutate({
        type: n.type,
        title: n.title ?? 'Copy',
        content: n.content ?? '',
        posX: n.posX + 30,
        posY: n.posY + 30 + i * 20,
        width: n.width,
        height: n.height,
      });
    });
    success(`Duplicated ${toDup.length} node(s)`);
  }, [board, selectedNodeIds, createNodeMutation, success]);

  const placeCaptureNode = useCallback((type: ResearchNodeType, titleEn: string, titleEl: string) => {
    const title = t(titleEn, titleEl);
    const cx = (window.innerWidth / 2 - pan.x) / zoom;
    const cy = (window.innerHeight / 2 - pan.y) / zoom;
    createNodeMutation.mutate({
      type,
      title,
      content: '',
      posX: cx - 140,
      posY: cy - 100,
      width: 280,
      height: 200,
      metadata: { displayType: type },
    });
  }, [createNodeMutation, pan.x, pan.y, zoom, t]);

  const alignSelected = useCallback((mode: 'left' | 'top' | 'h' | 'v' | 'right' | 'bottom' | 'center_h' | 'center_v') => {
    if (!board || selectedNodeIds.size < 2) return;
    const nodes = board.nodes.filter((n) => selectedNodeIds.has(n.id));
    if (nodes.length < 2) return;
    let updates: Array<{ id: string; posX?: number; posY?: number }> = [];
    if (mode === 'left') {
      const x = Math.min(...nodes.map((n) => n.posX));
      updates = nodes.map((n) => ({ id: n.id, posX: x }));
    } else if (mode === 'right') {
      const edge = Math.max(...nodes.map((n) => n.posX + n.width));
      updates = nodes.map((n) => ({ id: n.id, posX: edge - n.width }));
    } else if (mode === 'top') {
      const y = Math.min(...nodes.map((n) => n.posY));
      updates = nodes.map((n) => ({ id: n.id, posY: y }));
    } else if (mode === 'bottom') {
      const edge = Math.max(...nodes.map((n) => n.posY + (n.height || 200)));
      updates = nodes.map((n) => ({ id: n.id, posY: edge - (n.height || 200) }));
    } else if (mode === 'center_h') {
      const mid = (Math.min(...nodes.map((n) => n.posX)) + Math.max(...nodes.map((n) => n.posX + n.width))) / 2;
      updates = nodes.map((n) => ({ id: n.id, posX: mid - n.width / 2 }));
    } else if (mode === 'center_v') {
      const mid = (Math.min(...nodes.map((n) => n.posY)) + Math.max(...nodes.map((n) => n.posY + (n.height || 200)))) / 2;
      updates = nodes.map((n) => ({ id: n.id, posY: mid - (n.height || 200) / 2 }));
    } else if (mode === 'h') {
      const sorted = [...nodes].sort((a, b) => a.posX - b.posX);
      const start = sorted[0].posX;
      const end = sorted[sorted.length - 1].posX;
      const step = sorted.length > 1 ? (end - start) / (sorted.length - 1) : 0;
      updates = sorted.map((n, i) => ({ id: n.id, posX: start + step * i }));
    } else {
      const sorted = [...nodes].sort((a, b) => a.posY - b.posY);
      const start = sorted[0].posY;
      const end = sorted[sorted.length - 1].posY;
      const step = sorted.length > 1 ? (end - start) / (sorted.length - 1) : 0;
      updates = sorted.map((n, i) => ({ id: n.id, posY: start + step * i }));
    }
    batchUpdateMutation.mutate(updates);
  }, [board, selectedNodeIds, batchUpdateMutation]);

  const copyOutline = useCallback(async () => {
    if (!board) return;
    const lines = board.nodes
      .slice()
      .sort((a, b) => a.posY - b.posY || a.posX - b.posX)
      .map((n) => `- ${n.title || t(researchEn('node_untitled'), researchEl('node_untitled'))}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      success(t(researchEn('copied_outline'), researchEl('copied_outline')), `${lines.length}`);
    } catch {
      showError(t(researchEn('fail_delete'), researchEl('fail_delete')));
    }
  }, [board, success, showError, t]);

  const copySelection = useCallback(() => {
    if (!board || selectedNodeIds.size === 0) return;
    const payload: CanvasClipboardPayload = {
      v: 1,
      nodes: board.nodes.filter((n) => selectedNodeIds.has(n.id)).map((n) => ({
        type: n.type,
        title: n.title,
        content: n.content,
        width: n.width,
        height: n.height || 200,
        color: n.color,
        metadata: n.metadata,
        posX: n.posX,
        posY: n.posY,
      })),
    };
    clipRef.current = payload;
    try {
      void navigator.clipboard.writeText(JSON.stringify({ [CANVAS_CLIP_TYPE]: payload }));
    } catch { /* clipboard may be blocked; in-memory clip still works */ }
  }, [board, selectedNodeIds]);

  const pasteClipboard = useCallback((inPlace = false) => {
    const clip = clipRef.current;
    if (!clip?.nodes.length) return;
    const cx = (window.innerWidth / 2 - pan.x) / zoom;
    const cy = (window.innerHeight / 2 - pan.y) / zoom;
    clip.nodes.forEach((n, i) => {
      createNodeMutation.mutate({
        type: n.type as ResearchNodeType,
        title: n.title ?? undefined,
        content: n.content ?? '',
        posX: inPlace && typeof n.posX === 'number' ? n.posX : cx - 80 + i * 16,
        posY: inPlace && typeof n.posY === 'number' ? n.posY : cy - 80 + i * 16,
        width: n.width,
        height: n.height,
        color: n.color ?? undefined,
        metadata: n.metadata as Record<string, unknown> | undefined,
      });
    });
  }, [createNodeMutation, pan.x, pan.y, zoom]);

  const exportBoardJson = useCallback(() => {
    if (!board) return;
    const blob = new Blob([JSON.stringify({
      title: board.title,
      nodes: board.nodes,
      connectors: board.connectors,
      canvasState: { zoom, pan, groups, layers },
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${board.title || 'canvas'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [board, zoom, pan, groups, layers]);

  const selectedNodes = useMemo(
    () => (board?.nodes ?? []).filter((n) => selectedNodeIds.has(n.id)),
    [board?.nodes, selectedNodeIds],
  );

  const selectedIdKey = useMemo(() => Array.from(selectedNodeIds).sort().join(','), [selectedNodeIds]);
  useEffect(() => {
    if (selectedNodeIds.size !== 1) return;
    const node = board?.nodes.find((n) => n.id === selectedIdKey);
    if (!node) return;
    const id = nodeLayerId(node.metadata);
    if (layers.some((layer) => layer.id === id)) setActiveLayerId(id);
    // Follow the node's layer only when the selection changes — not after an in-place assign.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdKey]);

  useEffect(() => {
    if (!viewingNode || !board) return;
    const fresh = board.nodes.find((n) => n.id === viewingNode.id);
    if (!fresh) {
      setViewingNode(null);
      return;
    }
    if (
      fresh.content !== viewingNode.content
      || fresh.title !== viewingNode.title
      || fresh.color !== viewingNode.color
      || readCfbHref(fresh.metadata) !== readCfbHref(viewingNode.metadata)
    ) {
      setViewingNode(fresh);
    }
  }, [board, viewingNode]);

  const applyStyleToSelection = useCallback((patch: { fill?: string; opacity?: number; stroke?: string; shadow?: boolean; rotate?: number; strokeWidth?: number; radius?: number }) => {
    for (const node of selectedNodes) {
      updateNodeMutation.mutate({
        nodeId: node.id,
        data: {
          ...(patch.fill ? { color: patch.fill } : {}),
          metadata: applyPaintToMetadata(node.metadata, patch),
        },
      });
    }
  }, [selectedNodes, updateNodeMutation]);

  const rotateSelection = useCallback((deg: number) => {
    for (const node of selectedNodes) {
      const prev = readNodeStyle(node.metadata).rotate ?? 0;
      updateNodeMutation.mutate({
        nodeId: node.id,
        data: { metadata: mergeNodeStyle(node.metadata, { rotate: prev + deg }) },
      });
    }
  }, [selectedNodes, updateNodeMutation]);

  const matchSelectedSize = useCallback((axis: 'w' | 'h' | 'both') => {
    if (selectedNodes.length < 2) return;
    const src = selectedNodes[0];
    const updates = selectedNodes.map((n) => ({
      id: n.id,
      width: axis === 'h' ? n.width : src.width,
      height: axis === 'w' ? n.height : src.height,
    }));
    batchUpdateMutation.mutate(updates);
  }, [selectedNodes, batchUpdateMutation]);

  const copyNodeStyle = useCallback(() => {
    const src = selectedNodes[0];
    if (!src) return;
    const srcMeta = src.metadata && typeof src.metadata === 'object' ? (src.metadata as Record<string, unknown>) : {};
    styleClipRef.current = {
      color: src.color ?? (typeof srcMeta.fillColor === 'string' ? srcMeta.fillColor : null),
      style: readNodeStyle(src.metadata),
    };
  }, [selectedNodes]);

  const pasteNodeStyle = useCallback(() => {
    const clip = styleClipRef.current;
    if (!clip) return;
    applyStyleToSelection({
      fill: clip.color ?? undefined,
      opacity: clip.style?.opacity,
      stroke: clip.style?.stroke,
      shadow: clip.style?.shadow,
      rotate: clip.style?.rotate,
      strokeWidth: clip.style?.strokeWidth,
    });
  }, [applyStyleToSelection]);

  const selectSameType = useCallback(() => {
    const src = selectedNodes[0];
    if (!src || !board) return;
    setSelectedNodeIds(new Set(board.nodes.filter((n) => n.type === src.type).map((n) => n.id)));
  }, [selectedNodes, board]);

  const tidySelection = useCallback((axis: 'h' | 'v' | 'auto') => {
    const updates = tidyRects(selectedNodes, axis);
    if (updates.length) batchUpdateMutation.mutate(updates);
  }, [selectedNodes, batchUpdateMutation]);

  const nudgeSelection = useCallback((dx: number, dy: number) => {
    if (!board || selectedNodeIds.size === 0) return;
    const updates = board.nodes
      .filter((n) => selectedNodeIds.has(n.id))
      .map((n) => ({ id: n.id, posX: n.posX + dx, posY: n.posY + dy }));
    queryClient.setQueryData(qk('research-boards', 'board', boardId), (old: { board: ResearchBoardFull } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        board: {
          ...old.board,
          nodes: old.board.nodes.map((n) => selectedNodeIds.has(n.id) ? { ...n, posX: n.posX + dx, posY: n.posY + dy } : n),
        },
      };
    });
    batchUpdateMutation.mutate(updates);
  }, [board, selectedNodeIds, batchUpdateMutation, queryClient, boardId]);

  const renameSelection = useCallback((title: string) => {
    const id = Array.from(selectedNodeIds)[0];
    if (id && title) updateNodeMutation.mutate({ nodeId: id, data: { title } });
  }, [selectedNodeIds, updateNodeMutation]);

  const setSelectionHidden = useCallback((hidden: boolean) => {
    for (const node of selectedNodes) {
      const base = node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
      updateNodeMutation.mutate({ nodeId: node.id, data: { metadata: { ...base, hidden } } });
    }
  }, [selectedNodes, updateNodeMutation]);

  const flipSelection = useCallback((axis: 'h' | 'v') => {
    for (const node of selectedNodes) {
      const prev = readNodeStyle(node.metadata);
      const patch = axis === 'h'
        ? { scaleX: (prev.scaleX ?? 1) * -1 }
        : { scaleY: (prev.scaleY ?? 1) * -1 };
      updateNodeMutation.mutate({ nodeId: node.id, data: { metadata: mergeNodeStyle(node.metadata, patch) } });
    }
  }, [selectedNodes, updateNodeMutation]);

  const voteSelection = useCallback(() => {
    for (const node of selectedNodes) {
      const base = node.metadata && typeof node.metadata === 'object' ? { ...(node.metadata as Record<string, unknown>) } : {};
      updateNodeMutation.mutate({
        nodeId: node.id,
        data: { metadata: { ...base, votes: nodeVoteCount(node.metadata) + 1 } },
      });
    }
  }, [selectedNodes, updateNodeMutation]);

  const isolateSelection = useCallback(() => {
    setIsolatedIds(new Set(selectedNodeIds));
  }, [selectedNodeIds]);

  const revealIsolated = useCallback(() => {
    setIsolatedIds(new Set());
  }, []);

  const selectInverse = useCallback(() => {
    if (!board) return;
    setSelectedNodeIds(new Set(board.nodes.filter((n) => !selectedNodeIds.has(n.id)).map((n) => n.id)));
  }, [board, selectedNodeIds]);

  const lockOthers = useCallback(() => {
    if (!board) return;
    for (const node of board.nodes) {
      if (!selectedNodeIds.has(node.id) && !node.locked) {
        updateNodeMutation.mutate({ nodeId: node.id, data: { locked: true } });
      }
    }
  }, [board, selectedNodeIds, updateNodeMutation]);

  const scaleSelection = useCallback((factor: number) => {
    const updates = selectedNodes.map((n) => ({
      id: n.id,
      width: Math.max(80, Math.round(n.width * factor)),
      height: Math.max(60, Math.round((n.height || 200) * factor)),
    }));
    if (updates.length) batchUpdateMutation.mutate(updates);
  }, [selectedNodes, batchUpdateMutation]);

  const setSelectionRadius = useCallback((radius: number) => {
    applyStyleToSelection({ radius });
  }, [applyStyleToSelection]);

  const rewriteSelectedContent = useCallback((next: (html: string) => string) => {
    for (const node of selectedNodes) {
      updateNodeMutation.mutate({ nodeId: node.id, data: { content: next(node.content ?? '') } });
    }
  }, [selectedNodes, updateNodeMutation]);

  const formatSelectedText = useCallback((format: string) => {
    if (!isCanvasDocFormat(format)) return;
    rewriteSelectedContent((html) => applyDocFormat(html, format));
  }, [rewriteSelectedContent]);

  const findReplaceSelected = useCallback((find: string, replace: string) => {
    rewriteSelectedContent((html) => findReplaceDoc(html, find, replace));
  }, [rewriteSelectedContent]);

  const insertLinkOnSelected = useCallback((href: string, label?: string) => {
    rewriteSelectedContent((html) => appendDocLink(html, href, label));
  }, [rewriteSelectedContent]);

  const insertCitationOnSelected = useCallback((citation: string) => {
    rewriteSelectedContent((html) => appendDocCitation(html, citation));
  }, [rewriteSelectedContent]);

  const wordCountSelected = useCallback(() => {
    const totals = selectedNodes.reduce(
      (acc, node) => {
        const c = countDocWords(node.content ?? '');
        return { words: acc.words + c.words, chars: acc.chars + c.chars };
      },
      { words: 0, chars: 0 },
    );
    success(
      t(researchEn('word_count'), researchEl('word_count')),
      `${totals.words} · ${totals.chars}`,
    );
  }, [selectedNodes, success, t]);

  const mergeSelectedNotes = useCallback(() => {
    if (selectedNodes.length < 2) return;
    const sorted = [...selectedNodes].sort((a, b) => a.posY - b.posY || a.posX - b.posX);
    const keep = sorted[0];
    updateNodeMutation.mutate({
      nodeId: keep.id,
      data: { content: mergeDocHtml(sorted.map((n) => n.content ?? '')) },
    });
    sorted.slice(1).forEach((n) => deleteNodeMutation.mutate(n.id));
    setSelectedNodeIds(new Set([keep.id]));
  }, [selectedNodes, updateNodeMutation, deleteNodeMutation]);

  const splitSelectedNotes = useCallback(() => {
    const node = selectedNodes[0];
    if (!node) return;
    const blocks = splitDocBlocks(node.content ?? '');
    if (blocks.length < 2) return;
    updateNodeMutation.mutate({ nodeId: node.id, data: { content: blocks[0] } });
    blocks.slice(1).forEach((html, i) => {
      createNodeMutation.mutate({
        type: node.type,
        title: node.title || 'Note',
        content: html,
        posX: node.posX + 24 * (i + 1),
        posY: node.posY + (node.height || 200) + 16 + i * 12,
        width: node.width,
        height: node.height || 200,
      });
    });
  }, [selectedNodes, updateNodeMutation, createNodeMutation]);

  const copyTextSelected = useCallback(() => {
    const text = selectedNodes.map((n) => stripDocTags(n.content ?? '')).filter(Boolean).join('\n\n');
    void navigator.clipboard.writeText(text).then(() => {
      success(t(researchEn('doc_copy_text'), researchEl('doc_copy_text')));
    }).catch(() => {
      showError(t(researchEn('fail_delete'), researchEl('fail_delete')));
    });
  }, [selectedNodes, success, showError, t]);

  const pastePlainSelected = useCallback(() => {
    void navigator.clipboard.readText().then((text) => {
      rewriteSelectedContent((html) => appendPlainText(html, text));
    }).catch(() => {
      showError(t(researchEn('fail_delete'), researchEl('fail_delete')));
    });
  }, [rewriteSelectedContent, showError, t]);

  const insertDateOnSelected = useCallback(() => {
    rewriteSelectedContent((html) => appendDocDate(html));
  }, [rewriteSelectedContent]);

  const exportBoardSvg = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = await toSvg(canvasRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `${board?.title ?? 'canvas'}-export.svg`;
      link.href = dataUrl;
      link.click();
    } catch {
      showError('Export failed. Try zooming to fit first.');
    }
  }, [board?.title, showError]);

  const exportBoardMarkdown = useCallback(() => {
    if (!board) return;
    const lines = [`# ${board.title}`, '', ...(board.nodes.map((n) => `## ${n.title || 'Untitled'}\n\n${(n.content ?? '').replace(/<[^>]*>/g, '')}\n`))];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${board.title || 'canvas'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [board]);

  const shareBoardLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/research/${boardId}`);
      success(t(researchEn('share_link'), researchEl('share_link')));
    } catch {
      showError(t(researchEn('fail_delete'), researchEl('fail_delete')));
    }
  }, [boardId, success, showError, t]);

  const issue = useCallback((op: CanvasCommandOp, payload: Record<string, unknown> = {}) => {
    void runCanvasCommand(op, { boardId, ...payload });
  }, [boardId]);

  const promptFindReplace = useCallback(() => {
    const find = window.prompt(bilingualAria(researchEn('doc_find'), researchEl('doc_find')));
    if (!find) return;
    const replace = window.prompt(bilingualAria('Replace with', 'Αντικατάσταση με')) ?? '';
    issue('find_replace', { title: find, query: replace });
  }, [issue]);

  const promptInsertLink = useCallback(() => {
    const href = window.prompt(bilingualAria(researchEn('doc_link'), researchEl('doc_link')));
    if (!href) return;
    issue('insert_link', { href });
  }, [issue]);

  const promptCite = useCallback(() => {
    const citation = window.prompt(
      bilingualAria(researchEn('doc_cite'), researchEl('doc_cite')),
      selectedNodes[0]?.title || '',
    );
    if (!citation) return;
    issue('insert_citation', { title: citation });
  }, [issue, selectedNodes]);

  const linkSelection = useCallback((href: string) => {
    for (const node of selectedNodes) {
      const base = node.metadata && typeof node.metadata === 'object'
        ? { ...(node.metadata as Record<string, unknown>) }
        : {};
      updateNodeMutation.mutate({
        nodeId: node.id,
        data: { metadata: { ...base, cfbLink: { href } } },
      });
    }
  }, [selectedNodes, updateNodeMutation]);

  const findNodeByTitle = useCallback((title: string) => {
    const q = title.trim().toLowerCase();
    if (!q || !board) return undefined;
    return board.nodes.find((n) => (n.title ?? '').toLowerCase().includes(q));
  }, [board]);
  const canvasWorldPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
      rect,
    };
  }, [pan, zoom]);

  const placeActiveToolAt = useCallback((clientX: number, clientY: number) => {
    const pt = canvasWorldPoint(clientX, clientY);
    if (!pt) return false;
    if (activeTool === 'note') {
      createNodeMutation.mutate({
        type: 'note',
        title: 'New Note',
        content: '',
        posX: pt.x,
        posY: pt.y,
        width: 280,
        height: 200,
      });
      setActiveTool('select');
      return true;
    }
    if (activeTool === 'mermaid') {
      createNodeMutation.mutate({
        type: 'mermaid_diagram' as ResearchNodeType,
        title: 'Diagram',
        content: MERMAID_STARTERS.flowchart,
        posX: pt.x,
        posY: pt.y,
        width: 420,
        height: 320,
      });
      setActiveTool('select');
      return true;
    }
    if (['shape_rect','shape_circle','shape_diamond','shape_triangle','shape_line','shape_arrow','shape_text'].includes(activeTool)) {
      const isLine = activeTool === 'shape_line' || activeTool === 'shape_arrow';
      createNodeMutation.mutate({
        type: activeTool as ResearchNodeType,
        title: '',
        content: '',
        posX: pt.x,
        posY: pt.y,
        width: isLine ? 200 : 160,
        height: isLine ? 50 : 120,
      });
      setActiveTool('select');
      return true;
    }
    return false;
  }, [activeTool, canvasWorldPoint, createNodeMutation]);

  // Pan / box-select / note-create handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    
    // Cancel connection drawing on canvas click
    if (connectionStart) {
      setConnectionStart(null);
      setActiveTool('select');
      return;
    }

    if (placeActiveToolAt(e.clientX, e.clientY)) {
      return;
    } else if (activeTool === 'hand') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.shiftKey) {
      // Shift+Drag → box selection
      const pt = canvasWorldPoint(e.clientX, e.clientY);
      if (pt) {
        setIsBoxSelecting(true);
        setBoxSelectStart({ x: e.clientX, y: e.clientY });
        setSelectionBox({ startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y });
      }
    } else {
      // Normal canvas drag → pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeIds(new Set());
    }
  }, [activeTool, pan, placeActiveToolAt, canvasWorldPoint, connectionStart]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (isPanning) {
      setPan({
        x: clientX - panStart.x,
        y: clientY - panStart.y,
      });
    } else if (isBoxSelecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (clientX - rect.left - pan.x) / zoom;
      const cy = (clientY - rect.top - pan.y) / zoom;
      setSelectionBox((prev) => prev ? { ...prev, currentX: cx, currentY: cy } : null);
    } else if (resizingNodeId && canvasRef.current) {
      const dx = (clientX - resizeStart.mouseX) / zoom;
      const dy = (clientY - resizeStart.mouseY) / zoom;
      const MIN_W = 160, MIN_H = 100;
      let newW = resizeStart.origW;
      let newH = resizeStart.origH;
      if (resizeDir === 'right' || resizeDir === 'corner') newW = Math.max(MIN_W, resizeStart.origW + dx);
      if (resizeDir === 'bottom' || resizeDir === 'corner') newH = Math.max(MIN_H, resizeStart.origH + dy);
      queryClient.setQueryData(qk('research-boards', 'board', boardId), (old: { board: ResearchBoardFull } | undefined) => {
        if (!old) return old;
        return { ...old, board: { ...old.board, nodes: old.board.nodes.map((n) =>
          n.id === resizingNodeId ? { ...n, width: newW, height: newH } : n
        )}};
      });
    } else if (resizingGroupId) {
      const dx = (clientX - groupResizeStart.mouseX) / zoom;
      const dy = (clientY - groupResizeStart.mouseY) / zoom;
      let newW = groupResizeStart.origW, newH = groupResizeStart.origH;
      if (groupResizeDir === 'right' || groupResizeDir === 'corner') newW = Math.max(200, groupResizeStart.origW + dx);
      if (groupResizeDir === 'bottom' || groupResizeDir === 'corner') newH = Math.max(120, groupResizeStart.origH + dy);
      setGroups((prev) => prev.map((g) => g.id === resizingGroupId ? { ...g, width: newW, height: newH } : g));
    } else if (draggingGroupId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = snap((clientX - rect.left - pan.x) / zoom - dragOffset.x);
      const y = snap((clientY - rect.top - pan.y) / zoom - dragOffset.y);
      setGroups((prev) => prev.map((g) => g.id === draggingGroupId ? { ...g, posX: x, posY: y } : g));
    } else if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const rawY = (clientY - rect.top - pan.y) / zoom - dragOffset.y;
      const x = snap(rawX);
      const y = snap(rawY);

      if (selectedNodeIds.size > 1 && selectedNodeIds.has(draggingNodeId)) {
        const draggedNode = board?.nodes?.find((n) => n.id === draggingNodeId);
        if (draggedNode) {
          const dx = x - draggedNode.posX;
          const dy = y - draggedNode.posY;
          queryClient.setQueryData(qk('research-boards', 'board', boardId), (old: { board: ResearchBoardFull } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              board: {
                ...old.board,
                nodes: old.board.nodes.map((n) =>
                  selectedNodeIds.has(n.id) ? { ...n, posX: n.posX + dx, posY: n.posY + dy } : n
                ),
              },
            };
          });
        }
      } else {
        queryClient.setQueryData(qk('research-boards', 'board', boardId), (old: { board: ResearchBoardFull } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            board: {
              ...old.board,
              nodes: old.board.nodes.map((n) =>
                n.id === draggingNodeId ? { ...n, posX: x, posY: y } : n
              ),
            },
          };
        });
      }
      const dragged = board?.nodes?.find((n) => n.id === draggingNodeId);
      if (dragged) {
        setGuides(computeAlignmentGuides(
          { id: dragged.id, x, y, w: dragged.width, h: dragged.height || 200 },
          (board?.nodes ?? []).map((n) => ({ id: n.id, posX: n.posX, posY: n.posY, width: n.width, height: n.height || 200 })),
        ));
      }
    }
  }, [isPanning, panStart, isBoxSelecting, draggingNodeId, dragOffset, pan, zoom, boardId, queryClient, selectedNodeIds, board, snap, resizingNodeId, resizeDir, resizeStart, resizingGroupId, groupResizeDir, groupResizeStart, draggingGroupId]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY);
  }, [handlePointerMove]);

  const handleCanvasMouseUp = useCallback(() => {
    setGuides([]);
    // Finalize box selection
    if (isBoxSelecting && selectionBox && board) {
      const minX = Math.min(selectionBox.startX, selectionBox.currentX);
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
      const minY = Math.min(selectionBox.startY, selectionBox.currentY);
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY);
      const inBox = board.nodes.filter((n) =>
        n.posX >= minX && n.posX + n.width <= maxX &&
        n.posY >= minY && n.posY + n.height <= maxY
      ).map((n) => n.id);
      setSelectedNodeIds(new Set(inBox));
      setSelectionBox(null);
      setIsBoxSelecting(false);
    }

    // Finalize node drag
    if (draggingNodeId && board) {
      pushHistory('Move nodes');
      if (selectedNodeIds.size > 1 && selectedNodeIds.has(draggingNodeId)) {
        const updates = board.nodes
          .filter((n) => selectedNodeIds.has(n.id))
          .map((n) => ({ id: n.id, posX: n.posX, posY: n.posY }));
        batchUpdateMutation.mutate(updates);
      } else {
        const node = board.nodes.find((n) => n.id === draggingNodeId);
        if (node) {
          updateNodeMutation.mutate({
            nodeId: draggingNodeId,
            data: { posX: node.posX, posY: node.posY },
          });
        }
      }
    }
    // Finalize node resize
    if (resizingNodeId && board) {
      pushHistory('Resize node');
      const node = board.nodes.find((n) => n.id === resizingNodeId);
      if (node) {
        updateNodeMutation.mutate({
          nodeId: resizingNodeId,
          data: { width: node.width, height: node.height },
        });
      }
    }
    // Group drag/resize finalization is automatic (state-based, persisted via canvasState debounce)
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingNodeId(null);
    setResizeDir(null);
    setDraggingGroupId(null);
    setResizingGroupId(null);
    setGroupResizeDir(null);
  }, [draggingNodeId, board, updateNodeMutation, isBoxSelecting, selectionBox, selectedNodeIds, batchUpdateMutation, pushHistory, resizingNodeId]);

  // Touch: one-finger pan / place tool, two-finger pinch zoom. Native listeners
  // so preventDefault can stop the browser from scrolling the page instead.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const pinchDistance = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        pinchRef.current = { distance: pinchDistance(e.touches), zoom };
        panDragRef.current = null;
        pendingTapRef.current = null;
        setIsPanning(false);
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (e.target !== el) {
        pendingTapRef.current = null;
        return;
      }
      if (connectionStart) {
        setConnectionStart(null);
        setActiveTool('select');
        pendingTapRef.current = null;
        return;
      }
      const placing = ['note', 'mermaid', 'shape_rect', 'shape_circle', 'shape_diamond', 'shape_triangle', 'shape_line', 'shape_arrow', 'shape_text'].includes(activeTool);
      if (placing) {
        pendingTapRef.current = { x: t.clientX, y: t.clientY };
        return;
      }
      e.preventDefault();
      panDragRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      setIsPanning(true);
      setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
      if (activeTool !== 'hand') setSelectedNodeIds(new Set());
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && pinchRef.current) {
        e.preventDefault();
        const dist = pinchDistance(e.touches);
        if (dist < 8) return;
        const next = Math.min(Math.max(pinchRef.current.zoom * (dist / pinchRef.current.distance), 0.25), 3);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = el.getBoundingClientRect();
        const mouseX = cx - rect.left;
        const mouseY = cy - rect.top;
        setZoom((prev) => {
          if (prev === next) return prev;
          const factor = next / prev;
          setPan((p) => ({
            x: mouseX - (mouseX - p.x) * factor,
            y: mouseY - (mouseY - p.y) * factor,
          }));
          return next;
        });
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (pendingTapRef.current) {
        const dx = t.clientX - pendingTapRef.current.x;
        const dy = t.clientY - pendingTapRef.current.y;
        if (Math.hypot(dx, dy) > 10) {
          panDragRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
          setIsPanning(true);
          setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
          pendingTapRef.current = null;
        }
        return;
      }
      if (panDragRef.current) {
        e.preventDefault();
        setPan({ x: t.clientX - panDragRef.current.x, y: t.clientY - panDragRef.current.y });
        return;
      }
      handlePointerMove(t.clientX, t.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && pendingTapRef.current) {
        const tap = pendingTapRef.current;
        pendingTapRef.current = null;
        placeActiveToolAt(tap.x, tap.y);
      }
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) {
        panDragRef.current = null;
        handleCanvasMouseUp();
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        panDragRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
        setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom, pan, activeTool, connectionStart, handlePointerMove, handleCanvasMouseUp, placeActiveToolAt]);

  // Node drag handlers
  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (activeTool !== 'select') return;
    
    const node = board?.nodes?.find((n) => n.id === nodeId);
    if (!node || node.locked) return;
    const layer = layers.find((l) => l.id === nodeLayerId(node.metadata));
    if (layer?.locked) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(nodeId);
    setDragOffset({ x: mouseX - node.posX, y: mouseY - node.posY });
    // Multi-select: if not already in selection, replace selection with just this node
    if (!selectedNodeIds.has(nodeId)) {
      setSelectedNodeIds(new Set([nodeId]));
    }
  }, [activeTool, board, pan, zoom, selectedNodeIds, layers]);

  // Node resize handler
  const handleNodeResizeStart = useCallback((nodeId: string, e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    const node = board?.nodes?.find((n) => n.id === nodeId);
    if (!node || node.locked) return;
    e.preventDefault();
    setResizingNodeId(nodeId);
    setResizeDir(direction);
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      origW: node.width,
      origH: node.height || 200,
    });
  }, [board]);

  // ─── Group frame handlers ───────────────────────────────────────────────
  const createGroup = useCallback((posX: number, posY: number, size?: { width?: number; height?: number; label?: string }) => {
    const id = crypto.randomUUID();
    setGroups((prev) => [...prev, {
      id,
      label: size?.label || 'Frame',
      color: '#3B82F6',
      posX,
      posY,
      width: size?.width ?? 400,
      height: size?.height ?? 300,
      collapsed: false,
      locked: false,
      zIndex: 0,
    }]);
    setSelectedGroupId(id);
  }, []);

  const updateGroup = useCallback((id: string, data: Partial<ResearchGroup>) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...data } : g));
  }, []);

  const frameSelection = useCallback(() => {
    const box = hugBounds(selectedNodes);
    if (!box) {
      createGroup((window.innerWidth / 2 - pan.x) / zoom - 200, (window.innerHeight / 2 - pan.y) / zoom - 150);
      return;
    }
    createGroup(box.posX, box.posY, { width: box.width, height: box.height, label: 'Frame' });
  }, [selectedNodes, createGroup, pan.x, pan.y, zoom]);

  const hugSelection = useCallback(() => {
    const box = hugBounds(selectedNodes);
    if (!box) return;
    if (selectedGroupId) {
      updateGroup(selectedGroupId, box);
      return;
    }
    createGroup(box.posX, box.posY, { width: box.width, height: box.height, label: 'Frame' });
  }, [selectedNodes, selectedGroupId, updateGroup, createGroup]);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (selectedGroupId === id) setSelectedGroupId(null);
  }, [selectedGroupId]);

  const handleGroupDragStart = useCallback((groupId: string, e: React.MouseEvent) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group || group.locked) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    setDraggingGroupId(groupId);
    setDragOffset({ x: mouseX - group.posX, y: mouseY - group.posY });
    setSelectedGroupId(groupId);
    setSelectedNodeIds(new Set());
  }, [groups, pan, zoom]);

  const handleGroupResizeStart = useCallback((groupId: string, e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    const group = groups.find((g) => g.id === groupId);
    if (!group || group.locked) return;
    e.preventDefault();
    setResizingGroupId(groupId);
    setGroupResizeDir(direction);
    setGroupResizeStart({ mouseX: e.clientX, mouseY: e.clientY, origW: group.width, origH: group.height });
  }, [groups]);

  // File upload handler
  const handleFileUpload = async (files: FileList) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let offsetX = 0;
    for (const file of Array.from(files)) {
      try {
        const { upload } = await uploadResearchAsset(file);
        
        // Determine node type based on file MIME type
        let type: ResearchNodeType = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';
        else if (file.type.includes('word') || file.type.includes('text')) type = 'document';

        await createNodeMutation.mutateAsync({
          type: type as any, // Cast to satisfy type checking
          title: file.name,
          uploadId: upload.id,
          url: upload.url,
          posX: (rect.width / 2 - pan.x) / zoom + offsetX,
          posY: (rect.height / 2 - pan.y) / zoom,
          width: type === 'image' ? 320 : 280,
          height: type === 'image' ? 240 : 200,
          metadata: {
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            originalName: upload.originalName,
          },
        });

        offsetX += 300;
      } catch (err) {
        showError('Upload failed', err instanceof Error ? err.message : 'Please try again');
      }
    }
    
    queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
    success('Files uploaded', `${files.length} file(s) added to board`);
  };

  // Keyboard shortcuts — full set from Codebase B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLDivElement && (e.target as HTMLDivElement).contentEditable === 'true') return;

      // Delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.size > 0) {
          const toDelete = board?.nodes?.filter((n) => selectedNodeIds.has(n.id) && !n.locked) ?? [];
          toDelete.forEach((n) => deleteNodeMutation.mutate(n.id));
        }
      }
      // Escape — clear selection + cancel connection
      else if (e.key === 'Escape') {
        setSelectedNodeIds(new Set());
        setViewingNode(null);
        setActiveTool('select');
        setConnectionStart(null);
        setTempConnectionEnd(null);
        setShowShortcuts(false);
        setIsolatedIds(new Set());
      }
      // Undo (Ctrl+Z)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Duplicate (Ctrl+D)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        issue('paste_in_place');
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        issue('paste');
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        issue('copy');
      }
      // Select all (Ctrl+A)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (board) setSelectedNodeIds(new Set(board.nodes.map((n) => n.id)));
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        issue('format_text', { query: 'bold' });
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        issue('format_text', { query: 'italic' });
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        issue('format_text', { query: 'underline' });
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        promptInsertLink();
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        promptFindReplace();
      }
      // Arrow key movement
      else if (selectedNodeIds.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const dir = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : 'down';
        issue('nudge', { query: e.shiftKey ? `shift ${dir}` : dir });
      }
      else if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        issue('tidy');
      }
      else if (e.shiftKey && (e.key === 'H' || e.key === 'h') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        issue('hide');
      }
      else if (e.shiftKey && (e.key === 'I' || e.key === 'i') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        issue(isolatedIds.size ? 'reveal' : 'isolate');
      }
      else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        issue('frame');
      }
      // Tool shortcuts
      else if (e.key === 'v' || e.key === 'V') {
        issue('set_tool', { query: 'select' });
      } else if (e.key === 'n' || e.key === 'N') {
        issue('set_tool', { query: 'note' });
      } else if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) issue('set_tool', { query: 'connect' });
      }
      // Reset view (Ctrl+0)
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        issue('zoom', { query: 'reset' });
      }
      // Create group frame (Shift+G) — must check before plain G
      else if (e.key === 'G' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        issue('group');
      }
      // Toggle snap-to-grid (G, no modifiers)
      else if (e.key === 'g' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        issue('toggle_snap');
      }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        openRailSection('filters');
      }
      // Fit-to-content (F)
      else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        issue('fit_view');
      }
      // Add sticky note (S, no modifiers)
      else if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        issue('add_sticky');
      }
      // Show shortcuts (?)
      else if (e.key === '?' && e.shiftKey) {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, board, deleteNodeMutation, undo, redo, duplicateSelected, copySelection, pasteClipboard, boardId, queryClient, batchUpdateMutation, issue, isolatedIds, promptFindReplace, promptInsertLink]);

  // Right-click context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Drag and drop files
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) { setIsDragOver(false); dragCounterRef.current = 0; }
  }, []);

  const { expanded, toggle, setExpanded, mounted: sidebarMounted } = useSidebar();
  const { pinned: railPinned, hasRail, openRailSection } = usePageRail();

  // Mounted guard: prevents hydration mismatch by ensuring SSR and first
  // client render both show the same loading placeholder. The real query
  // state is only evaluated after the component mounts on the client.
  const [mounted, setMounted] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [phoneInspector, setPhoneInspector] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsPhone(mq.matches);
    sync();
    if (mq.matches) setShowMiniMap(false);
    setMounted(true);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Auto-collapse sidebar for immersive canvas mode; restore on leave
  useEffect(() => {
    setExpanded(false);
    return () => { setExpanded(true); };
  }, [setExpanded]);

  // PNG export handler
  const handleExportPng = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `${board?.title ?? 'canvas'}-export.png`;
      link.href = dataUrl;
      link.click();
      success('Canvas exported as PNG');
    } catch {
      showError('Export failed. Try zooming to fit first.');
    }
  }, [board?.title, success, showError]);

  // Auto-layout handler
  const handleAutoLayout = useCallback(async (algorithm: LayoutAlgorithm) => {
    const nodes = board?.nodes ?? [];
    const connectors = board?.connectors ?? [];
    if (nodes.length === 0) { showError('No nodes to layout'); return; }
    const results = computeLayout(algorithm, nodes, connectors);
    try {
      await batchUpdateResearchNodes(
        boardId,
        results.map((r) => ({ id: r.id, posX: r.posX, posY: r.posY }))
      );
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', boardId) });
      success(`Auto-layout applied (${algorithm.replace('dagre-', '').toUpperCase()})`);
    } catch {
      showError('Layout failed — please try again');
    }
  }, [board?.nodes, board?.connectors, boardId, queryClient, success, showError]);

  runOpRef.current = (req) => handleCanvasOp({
    boardId,
    board,
    selectedIds: Array.from(selectedNodeIds),
    selectedGroupId,
    layers,
    pan,
    zoom,
    captureTitle: (kind) => t(
      researchEn(`capture_${kind}` as 'capture_question'),
      researchEl(`capture_${kind}` as 'capture_question'),
    ),
    placeNode: (type, title, extra, content) => {
      const cx = (window.innerWidth / 2 - pan.x) / zoom;
      const cy = (window.innerHeight / 2 - pan.y) / zoom;
      createNodeMutation.mutate({
        type,
        title,
        content: content ?? '',
        posX: cx - 140,
        posY: cy - 100,
        width: 280,
        height: 200,
        metadata: extra,
      });
    },
    deleteNode: (id) => deleteNodeMutation.mutate(id),
    updateNode: (id, data) => updateNodeMutation.mutate({ nodeId: id, data: data as NodeUpdateData }),
    connect: (fromId, toId) => createConnectorMutation.mutate({ fromNodeId: fromId, toNodeId: toId }),
    duplicate: duplicateSelected,
    copy: copySelection,
    paste: pasteClipboard,
    selectIds: (ids) => setSelectedNodeIds(new Set(ids)),
    undo,
    redo,
    align: alignSelected,
    createGroup,
    deleteGroup,
    applyStyle: applyStyleToSelection,
    setLayers,
    fit: fitToContent,
    zoomBy: (delta) => handleZoom(delta),
    resetView: () => { setZoom(1); setPan({ x: 0, y: 0 }); },
    toggleGrid: () => setShowGrid((v) => !v),
    toggleSnap: () => setSnapToGrid((v) => !v),
    find: (query) => {
      openRailSection('filters');
      if (query) setFilterSearch(query);
    },
    autoLayout: (alg) => { void handleAutoLayout(alg); },
    exportPng: () => { void handleExportPng(); },
    exportJson: exportBoardJson,
    exportSvg: () => { void exportBoardSvg(); },
    exportMarkdown: exportBoardMarkdown,
    copyOutline: () => { void copyOutline(); },
    link: linkSelection,
    findByTitle: findNodeByTitle,
    matchSize: matchSelectedSize,
    rotateBy: rotateSelection,
    copyStyle: copyNodeStyle,
    pasteStyle: pasteNodeStyle,
    selectSame: selectSameType,
    setTool: (tool) => setActiveTool(tool as Tool),
    setCollapsed: (collapsed) => {
      selectedNodeIds.forEach((id) => updateNodeMutation.mutate({ nodeId: id, data: { collapsed } }));
    },
    openComments: () => {
      const id = Array.from(selectedNodeIds)[0];
      if (id) setCommentsNodeId(id);
    },
    toggleMinimap: () => setShowMiniMap((v) => !v),
    toggleRulers: () => setShowRulers((v) => !v),
    shareLink: () => { void shareBoardLink(); },
    tidy: tidySelection,
    nudge: nudgeSelection,
    rename: renameSelection,
    setHidden: setSelectionHidden,
    flip: flipSelection,
    pasteInPlace: () => pasteClipboard(true),
    frameSelection,
    hugSelection,
    vote: voteSelection,
    isolate: isolateSelection,
    reveal: revealIsolated,
    selectInverse,
    lockOthers,
    scaleBy: scaleSelection,
    setRadius: setSelectionRadius,
    formatText: formatSelectedText,
    findReplace: findReplaceSelected,
    insertLink: insertLinkOnSelected,
    insertCitation: insertCitationOnSelected,
    wordCount: wordCountSelected,
    mergeNotes: mergeSelectedNotes,
    splitNotes: splitSelectedNotes,
    copyText: copyTextSelected,
    pastePlain: pastePlainSelected,
    insertDate: insertDateOnSelected,
  }, req);

  useEffect(() => {
    return registerCanvasCommandHandler((req) =>
      runOpRef.current
        ? runOpRef.current(req)
        : Promise.resolve({ ok: false, error: 'Canvas not ready' }),
    );
  }, []);

  useEffect(() => {
    if (!board || hydratedCommand.current) return;
    const pending = consumePendingCanvasCommand();
    if (!pending || pending.applied) {
      hydratedCommand.current = true;
      return;
    }
    hydratedCommand.current = true;
    void runOpRef.current?.({ requestId: 'hydrate', op: pending.op, payload: pending.payload });
  }, [board]);

  // Show a stable loading spinner until mounted + query resolves
  const showLoading = !mounted || isLoading;

  usePageControls([
    {
      id: 'ask_canvas_ai',
      labelEn: 'Ask AI about this canvas',
      labelEl: 'Ρωτήστε το AI για αυτόν τον καμβά',
      writes: false,
      run: () => openAskAi(undefined, 'ai'),
    },
  ]);
  usePageList([
    {
      id: 'nodes',
      labelEn: 'Canvas nodes',
      labelEl: 'Κόμβοι καμβά',
      rows: board ? board.nodes.map((n) => n.title?.trim() || n.type) : undefined,
    },
  ]);

  /*
   * The page rail: the secondary controls, as six families.
   *
   * A canvas is a tool, and a tool's fast path is its toolbar - so the
   * toolbar keeps only creation, connection, Ask AI, undo/redo, zoom and the
   * branch selector. The rail owns everything else outright - the old More
   * menu is gone rather than duplicated, and the contract test fails the
   * build if a control ever appears in both places again.
   *
   * The filter section is the NodeFilterBar, bound to the same state the
   * canvas reads - and the strip's badge counts active filters, which is how a
   * filtered canvas stays honest while the rail is closed.
   */
  type RailRow = { icon: React.ElementType; en: string; el: string; onClick: () => void; pressed?: boolean; tone?: string };
  const railRows = (rows: RailRow[]) => (
    <ul className="space-y-0.5">
      {rows.map(({ icon: Icon, en, el, onClick, pressed, tone }) => (
        <li key={en}>
          <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            className={cn(
              'tap-target flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/70',
              pressed && 'bg-primary/10 text-primary-accessible',
            )}
          >
            <Icon className={cn('icon-sm shrink-0', tone)} aria-hidden="true" />
            <span className="min-w-0 flex-1"><BilingualText en={en} el={el} compact wrap /></span>
          </button>
        </li>
      ))}
    </ul>
  );
  const activeFilters = filterTags.length + (filterSearch.trim() ? 1 : 0);
  const rail: PageRailSection[] = [
    {
      id: 'view',
      glyph: 'discover',
      labelEn: 'View',
      labelEl: 'Προβολή',
      content: railRows([
        { icon: Grid3X3, en: showGrid ? researchEn('hide_grid') : researchEn('show_grid'), el: showGrid ? researchEl('hide_grid') : researchEl('show_grid'), onClick: () => setShowGrid(!showGrid), pressed: showGrid },
        { icon: Magnet, en: snapToGrid ? researchEn('disable_snap') : researchEn('enable_snap'), el: snapToGrid ? researchEl('disable_snap') : researchEl('enable_snap'), onClick: () => setSnapToGrid((v) => !v), pressed: snapToGrid },
        { icon: Map, en: showMiniMap ? researchEn('hide_map') : researchEn('show_map'), el: showMiniMap ? researchEl('hide_map') : researchEl('show_map'), onClick: () => issue('toggle_minimap'), pressed: showMiniMap },
        { icon: Layers, en: showRulers ? researchEn('hide_rulers') : researchEn('rulers'), el: showRulers ? researchEl('hide_rulers') : researchEl('rulers'), onClick: () => issue('toggle_rulers'), pressed: showRulers },
        { icon: Layers, en: researchEn('fit_nodes'), el: researchEl('fit_nodes'), onClick: () => issue('fit_view') },
        { icon: Keyboard, en: researchEn('shortcuts'), el: researchEl('shortcuts'), onClick: () => setShowShortcuts(true) },
      ]),
    },
    {
      id: 'insert',
      glyph: 'builder',
      labelEn: 'Insert',
      labelEl: 'Εισαγωγή',
      content: railRows([
        { icon: StickyNote, en: researchEn('add_sticky'), el: researchEl('add_sticky'), onClick: () => issue('add_sticky'), tone: 'text-status-warning' },
        { icon: Grid3X3, en: researchEn('create_group'), el: researchEl('create_group'), onClick: () => issue('group'), tone: 'text-primary-accessible' },
        {
          icon: LinkIcon, en: researchEn('add_link'), el: researchEl('add_link'),
          onClick: () => {
            const url = prompt(t(researchEn('enter_url'), researchEl('enter_url')));
            if (url) createNodeMutation.mutate({ type: 'link', title: url, url, posX: (window.innerWidth / 2 - pan.x) / zoom, posY: (window.innerHeight / 2 - pan.y) / zoom });
          },
        },
        { icon: Users, en: researchEn('ref_entity'), el: researchEl('ref_entity'), onClick: () => setShowEntitySelector(true) },
        { icon: Upload, en: researchEn('upload'), el: researchEl('upload'), onClick: () => fileInputRef.current?.click() },
        { icon: HelpCircle, en: researchEn('capture_question'), el: researchEl('capture_question'), onClick: () => issue('capture', { nodeType: 'question' }) },
        { icon: FlaskConical, en: researchEn('capture_hypothesis'), el: researchEl('capture_hypothesis'), onClick: () => issue('capture', { nodeType: 'hypothesis' }) },
        { icon: GitBranch, en: researchEn('capture_evidence'), el: researchEl('capture_evidence'), onClick: () => issue('capture', { nodeType: 'evidence' }) },
        { icon: Lightbulb, en: researchEn('capture_insight'), el: researchEl('capture_insight'), onClick: () => issue('capture', { nodeType: 'insight' }) },
      ]),
    },
    {
      id: 'arrange',
      glyph: 'compare',
      labelEn: 'Align selection',
      labelEl: 'Στοίχιση επιλογής',
      badge: selectedNodeIds.size >= 2 ? selectedNodeIds.size : null,
      content: railRows([
        { icon: Layers, en: researchEn('align_left'), el: researchEl('align_left'), onClick: () => issue('align', { align: 'left' }) },
        { icon: Layers, en: researchEn('align_right'), el: researchEl('align_right'), onClick: () => issue('align', { align: 'right' }) },
        { icon: Layers, en: researchEn('align_top'), el: researchEl('align_top'), onClick: () => issue('align', { align: 'top' }) },
        { icon: Layers, en: researchEn('align_bottom'), el: researchEl('align_bottom'), onClick: () => issue('align', { align: 'bottom' }) },
        { icon: Layers, en: researchEn('align_center_h'), el: researchEl('align_center_h'), onClick: () => issue('align', { align: 'center_h' }) },
        { icon: Layers, en: researchEn('align_center_v'), el: researchEl('align_center_v'), onClick: () => issue('align', { align: 'center_v' }) },
        { icon: Layers, en: researchEn('align_h'), el: researchEl('align_h'), onClick: () => issue('align', { align: 'h' }) },
        { icon: Layers, en: researchEn('align_v'), el: researchEl('align_v'), onClick: () => issue('align', { align: 'v' }) },
      ]),
    },
    {
      id: 'ai',
      glyph: 'spark',
      labelEn: 'Assistant & analysis',
      labelEl: 'Βοηθός & ανάλυση',
      badge: showAIPanel || showBoardSummary ? 1 : null,
      content: railRows([
        { icon: Sparkles, en: researchEn('ai_analysis'), el: researchEl('ai_analysis'), onClick: () => { setShowAIPanel((v) => !v); setShowBoardSummary(false); }, pressed: showAIPanel },
        { icon: BarChart3, en: researchEn('board_summary'), el: researchEl('board_summary'), onClick: () => { setShowBoardSummary((v) => !v); setShowAIPanel(false); }, pressed: showBoardSummary },
        { icon: History, en: researchEn('canvas_history'), el: researchEl('canvas_history'), onClick: () => setShowHistoryDrawer((v) => !v), pressed: showHistoryDrawer },
      ]),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Filter nodes',
      labelEl: 'Φίλτρα κόμβων',
      badge: activeFilters || null,
      content: board ? (
        <div className="space-y-3">
          <NodeFilterBar
            availableTags={Array.from(new Set(board.nodes.flatMap((n) => n.tags)))}
            selectedTags={filterTags}
            onTagsChange={setFilterTags}
            searchQuery={filterSearch}
            onSearchChange={setFilterSearch}
          />
        </div>
      ) : null,
    },
    {
      id: 'export',
      glyph: 'applications',
      labelEn: 'Export & share',
      labelEl: 'Εξαγωγή & κοινοποίηση',
      content: (
        <div className="space-y-2">
          {board && <BoardExport board={board} canvasRef={canvasRef as React.RefObject<HTMLDivElement>} />}
          {railRows([
            { icon: Download, en: researchEn('export_png'), el: researchEl('export_png'), onClick: () => issue('export', { query: 'png' }), tone: 'text-primary-accessible' },
            { icon: Download, en: researchEn('export_svg'), el: researchEl('export_svg'), onClick: () => issue('export', { query: 'svg' }) },
            { icon: Download, en: researchEn('export_json'), el: researchEl('export_json'), onClick: () => issue('export', { query: 'json' }) },
            { icon: FileText, en: researchEn('export_md'), el: researchEl('export_md'), onClick: () => issue('export', { query: 'markdown' }) },
            { icon: Copy, en: researchEn('copy_outline'), el: researchEl('copy_outline'), onClick: () => issue('copy_outline') },
            { icon: Copy, en: researchEn('share_link'), el: researchEl('share_link'), onClick: () => issue('share_link') },
          ])}
        </div>
      ),
    },
    {
      id: 'settings',
      glyph: 'sliders',
      labelEn: 'Board settings & layout',
      labelEl: 'Ρυθμίσεις & διάταξη',
      content: (
        <div className="space-y-3">
          {railRows([{ icon: Settings, en: researchEn('board_settings'), el: researchEl('board_settings'), onClick: () => setShowBoardSettings(true) }])}
          <p className="px-2.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BilingualText en={researchEn('auto_layout')} el={researchEl('auto_layout')} compact />
          </p>
          {railRows(([
            { alg: 'dagre-tb' as LayoutAlgorithm, en: 'Top to bottom', el: 'Πάνω προς κάτω' },
            { alg: 'dagre-lr' as LayoutAlgorithm, en: 'Left to right', el: 'Αριστερά προς δεξιά' },
            { alg: 'dagre-bt' as LayoutAlgorithm, en: 'Bottom to top', el: 'Κάτω προς πάνω' },
            { alg: 'dagre-rl' as LayoutAlgorithm, en: 'Right to left', el: 'Δεξιά προς αριστερά' },
            { alg: 'grid' as LayoutAlgorithm, en: 'Grid', el: 'Πλέγμα' },
            { alg: 'radial' as LayoutAlgorithm, en: 'Radial', el: 'Ακτινωτή' },
          ]).map(({ alg, en, el }) => ({ icon: Network, en, el, onClick: () => issue('auto_layout', { query: alg }), tone: 'text-status-accent' })))}
        </div>
      ),
    },
  ];

  return (
    <div className="h-[100dvh] bg-background overflow-hidden">
      <PageRail sections={rail} />
      {/* Sidebar */}
      <SideNav />

      {/* Main content area - offset by sidebar */}
      <div
        role="main"
        aria-label={bilingualAria('Research workspace', 'Χώρος έρευνας')}
        className={cn(
          // `isolate`: this column uses z-50 internally (toolbar, overlays). A
          // stacking context of its own keeps those layers inside the column,
          // so they order against each other and not against the fixed chrome.
          'relative isolate h-[100dvh] flex flex-col overflow-hidden transition-[margin-left,margin-right] duration-200 ease-out',
          'sm:ml-[4.25rem]',
          (sidebarMounted ? expanded : true) ? 'lg:ml-[15rem]' : 'lg:ml-[4.25rem]',
          // This page mounts its own chrome rather than AppShellFrame, so it
          // reserves the page rail's strip itself - same widths the frame uses.
          hasRail && (railPinned ? 'lg:mr-[21.752rem]' : 'lg:mr-[3.25rem]'),
        )}
      >
        <TopBar />
        <MobileBottomNav />
        {/* Loading state — also rendered during SSR for consistent HTML */}
        {showLoading && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <Loader2 className="icon-xl animate-spin text-primary-accessible" />
            <p className="mt-3 text-sm text-muted-foreground">
              <BilingualText en={researchEn('canvas_loading')} el={researchEl('canvas_loading')} compact />
            </p>
          </div>
        )}

        {/* Error state — only after mount to avoid hydration mismatch */}
        {!showLoading && (error || !board) && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="mb-4 text-destructive-accessible">
              <BilingualText en={researchEn('canvas_fail')} el={researchEl('canvas_fail')} />
            </p>
            <Button className="rounded-xl" onClick={() => router.push('/research')}>
              <BilingualText en={researchEn('canvas_back')} el={researchEl('canvas_back')} compact />
            </Button>
          </div>
        )}

        {/* Board content */}
        {!showLoading && board && (
        <div className="flex min-h-0 flex-1 flex-col pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        {/* The canvas has no visible page title - the toolbar names the tool,
            not the board - so the board's name is the page's heading for
            screen readers and the outline. */}
        <h1 className="sr-only">{board.title}</h1>
        {/* Toolbar — compact on phones; secondary actions live in More */}
        <div className="h-12 border-b bg-card/95 backdrop-blur-sm flex items-center px-2 sm:px-4 shrink-0 z-50 gap-1.5 sm:gap-3 overflow-x-auto scrollbar-hide">
          {/* Left: Brand + node count */}
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/research" className="flex items-center gap-2 transition-opacity hover:opacity-80" aria-label={bilingualAria(researchEn('canvas_back'), researchEl('canvas_back'))}>
              <CfbGlyph name="research" className="icon-md text-muted-foreground shrink-0" />
              <span className="hidden text-sm font-semibold text-foreground sm:inline">
                <BilingualText en={researchEn('canvas_title')} el={researchEl('canvas_title')} compact />
              </span>
            </Link>
            <span className="shrink-0 rounded-full bg-secondary/80 px-2 py-0.5 text-2xs tabular-nums text-muted-foreground">
              {board.nodes.length}{' '}
              <BilingualText
                en={board.nodes.length === 1 ? researchEn('node') : researchEn('nodes')}
                el={board.nodes.length === 1 ? researchEl('node') : researchEl('nodes')}
                compact
              />
            </span>
            <CollaboratorsBar collaborators={collaborators} isConnected={isConnected} className="ml-1 hidden 2xl:flex" />
          </div>

          <div className="hidden sm:block h-5 w-px bg-border/60" />

          {/* Quick Note tool — draw toolbar covers this on phones */}
          <Button
            variant={activeTool === 'note' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => issue('set_tool', { query: activeTool === 'note' ? 'select' : 'note' })}
            className="hidden sm:inline-flex h-8 gap-1.5 rounded-xl text-xs"
            title={t(researchEn('note_title'), researchEl('note_title'))}
          >
            <StickyNote className="icon-sm text-status-warning" />
            <span className="hidden 2xl:inline">
              <BilingualText en={researchEn('note')} el={researchEl('note')} compact />
            </span>
          </Button>

          {/* Categorised Add Node mega-dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-xl text-xs" aria-label={researchEn('add_node')}>
                <Plus className="icon-sm" aria-hidden="true" />
                <span className="hidden 2xl:inline">
                  <BilingualText en={researchEn('add_node')} el={researchEl('add_node')} compact />
                </span>
                <ChevronDown className="icon-sm opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-[70vh] overflow-y-auto">
              {NODE_CATEGORIES.map((cat, ci) => (
                <div key={cat.category}>
                  {ci > 0 && <DropdownMenuSeparator />}
                  <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <BilingualText en={cat.category} el={RESEARCH_NODE_CATEGORY_EL[cat.category] ?? cat.category} compact />
                  </div>
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.type}
                        onClick={() => {
                          if (item.type === 'link') {
                            const url = prompt(t(researchEn('enter_url'), researchEl('enter_url')));
                            if (url) {
                              createNodeMutation.mutate({
                                type: 'link',
                                title: url,
                                url,
                                posX: (window.innerWidth / 2 - pan.x) / zoom,
                                posY: (window.innerHeight / 2 - pan.y) / zoom,
                              });
                            }
                          } else {
                            const isTemplate  = ['visual_bmc','visual_lean'].includes(item.type);
                            const isSwot      = item.type === 'visual_swot';
                            const isMermaid2  = item.type === 'mermaid_diagram';
                            const isFlow      = item.type === 'flow_diagram';
                            const isBoard     = item.type === 'whiteboard';
                            const isShapeType = item.type.startsWith('shape_');
                            const isLineShape = item.type === 'shape_line' || item.type === 'shape_arrow';
                            const w = isTemplate ? 880 : isSwot ? 400 : isMermaid2 ? 420 : isFlow ? 560 : isBoard ? 600 : isLineShape ? 200 : isShapeType ? 160 : (item.type === 'checklist' || item.type === 'task' || item.type === 'milestone' ? 300 : 280);
                            const h = isTemplate ? 400 : isSwot ? 320 : isMermaid2 ? 320 : isFlow ? 360 : isBoard ? 420 : isLineShape ? 50 : isShapeType ? 120 : (item.type === 'pitch_deck' || item.type === 'business_plan' ? 240 : 200);
                            createNodeMutation.mutate({
                              type: item.type,
                              title: isShapeType ? '' : `New ${item.label}`,
                              content: getDefaultContent(item.type),
                              posX: (window.innerWidth / 2 - pan.x) / zoom - w / 2,
                              posY: (window.innerHeight / 2 - pan.y) / zoom - h / 2,
                              width: w,
                              height: h,
                            });
                          }
                        }}
                        className="gap-2"
                      >
                        <Icon className="icon-sm shrink-0" style={{ color: item.color }} />
                        <BilingualText en={item.label} el={RESEARCH_NODE_LABEL_EL[item.type] ?? item.label} compact />
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connect tool */}
          <Button
            variant={activeTool === 'connect' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => issue('set_tool', { query: activeTool === 'connect' ? 'select' : 'connect' })}
            className="hidden sm:inline-flex h-8 gap-1.5 rounded-xl text-xs"
            title={t(researchEn('connect_title'), researchEl('connect_title'))}
          >
            <GitBranch className="icon-sm text-status-success" />
            <span className="hidden 2xl:inline">
              <BilingualText en={researchEn('connect')} el={researchEl('connect')} compact />
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => openAskAi()}
            title={t(researchEn('ask_ai_canvas'), researchEl('ask_ai_canvas'))}
          >
            <CfbGlyph name="spark" className="icon-sm" />
            <span className="hidden 2xl:inline">
              <BilingualText en={researchEn('ask_ai')} el={researchEl('ask_ai')} compact />
            </span>
          </Button>

          <div className="hidden sm:block h-5 w-px bg-border/60" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} disabled={historyIndex <= 0} title={t(researchEn('undo'), researchEl('undo'))}>
              <Undo2 className="icon-sm" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} disabled={historyIndex >= history.length - 1} title={t(researchEn('redo'), researchEl('redo'))}>
              <Redo2 className="icon-sm" />
            </Button>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom(-0.25)} title={t(researchEn('zoom_out'), researchEl('zoom_out'))}>
              <ZoomOut className="icon-sm" />
            </Button>
            <span className="hidden sm:inline text-2xs text-muted-foreground w-10 text-center tabular-nums select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom(0.25)} title={t(researchEn('zoom_in'), researchEl('zoom_in'))}>
              <ZoomIn className="icon-sm" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex h-7 w-7 p-0"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title={t(researchEn('reset_view'), researchEl('reset_view'))}
            >
              <Maximize2 className="icon-sm" />
            </Button>
          </div>

          <div className="hidden sm:block h-5 w-px bg-border/60" />

          {/* Branch Selector — the one secondary control that stays on the
              toolbar: which branch you are on is part of what you are looking
              at, not a tool you reach for. Everything else in this spot moved
              to the page rail. */}
          <div className="hidden sm:block">
            <CanvasBranchSelector
              boardId={boardId}
              activeBranchId={activeBranchId}
              onBranchSelect={(id, name) => { setActiveBranchId(id); setActiveBranchName(name); }}
              onCreateBranch={() => setShowHistoryDrawer(true)}
            />
          </div>

        </div>


      {/* Canvas → Builder synthesis prompt banner */}
      {!synthDismissed && board.nodes.length >= 10 && (
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b bg-status-accent-bg border-status-accent-border shrink-0 z-40">
          <Sparkles className="icon-sm shrink-0 text-status-accent" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground">
              {board.nodes.length} <BilingualText en={researchEn('synth_ready')} el={researchEl('synth_ready')} compact />
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">
              <BilingualText en={researchEn('synth_hint')} el={researchEl('synth_hint')} compact />
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs font-semibold shrink-0" asChild>
            <Link href="/builder?tab=idea_core">
              <BilingualText en={researchEn('synth_open')} el={researchEl('synth_open')} compact /> <ArrowRight className="icon-sm" />
            </Link>
          </Button>
          <button
            onClick={() => { setSynthDismissed(true); localStorage.setItem(synthDismissKey, 'true'); }}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="icon-sm" />
          </button>
        </div>
      )}

      {/* Canvas + AI sidebar row */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className={cn(
          'flex-1 relative overflow-hidden cursor-grab touch-none overscroll-none',
          isPanning && 'cursor-grabbing',
          activeTool === 'hand' && 'cursor-grab',
          (activeTool === 'note' || activeTool === 'connect') && 'cursor-crosshair',
          (['shape_rect','shape_circle','shape_diamond','shape_triangle','shape_line','shape_arrow','shape_text','mermaid'] as Tool[]).includes(activeTool) && 'cursor-crosshair',
          connectionStart && 'cursor-crosshair',
        )}
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / ${showGrid ? '0.12' : '0.06'}) 1px, transparent 1px)`,
          backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
          backgroundPosition: `${pan.x % (32 * zoom)}px ${pan.y % (32 * zoom)}px`,
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={(e) => {
          handleCanvasMouseMove(e);
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const worldX = (e.clientX - rect.left - pan.x) / zoom;
            const worldY = (e.clientY - rect.top - pan.y) / zoom;
            emitCursor(worldX, worldY);
            // Track temp connection endpoint
            if (connectionStart) {
              setTempConnectionEnd({ x: worldX, y: worldY });
            }
          }
        }}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {/* ─── Canvas Draw Toolbar: horizontal strip on phones, left rail from sm ── */}
        <div
          data-canvas-chrome
          className={cn(
            'absolute z-40 pointer-events-auto flex items-end gap-1.5',
            'inset-x-2 bottom-8',
            'sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-1/2 sm:block sm:-translate-y-1/2',
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1 sm:flex-none">
          <CanvasDrawToolbar
            activeTool={activeTool}
            onToolChange={(t) => issue('set_tool', { query: t })}
            onToggleLibrary={() => setShowShapeLibrary((p) => !p)}
            libraryOpen={showShapeLibrary}
          />
          </div>
          <button
            type="button"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card/95 text-muted-foreground shadow-xl sm:hidden',
              phoneInspector && 'bg-primary/15 text-primary-accessible',
            )}
            aria-pressed={phoneInspector}
            aria-label={bilingualAria(researchEn('layers'), researchEl('layers'))}
            onClick={() => setPhoneInspector((open) => !open)}
          >
            <Layers className="icon-sm" aria-hidden="true" />
          </button>
        </div>

        {/* ─── Shape Library Panel ──────────────────────────────────────── */}
        {showShapeLibrary && (
          <ShapeLibraryPanel
            onClose={() => setShowShapeLibrary(false)}
            onAddShape={(tpl: ShapeTemplate) => {
              const cx = (window.innerWidth / 2 - pan.x) / zoom;
              const cy = (window.innerHeight / 2 - pan.y) / zoom;
              createNodeMutation.mutate({
                type: tpl.type,
                title: tpl.defaultTitle,
                content: '',
                posX: cx - tpl.defaultWidth / 2,
                posY: cy - tpl.defaultHeight / 2,
                width: tpl.defaultWidth,
                height: tpl.defaultHeight,
                metadata: tpl.meta as Record<string, unknown>,
              });
            }}
          />
        )}

        {/* Transform container */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* Connector lines */}
          <ResearchConnectorLines
            connectors={board.connectors}
            nodes={board.nodes}
            onDeleteConnector={(id) => deleteConnectorMutation.mutate(id)}
          />

          {/* Temp connection line while drawing */}
          {connectionStart && tempConnectionEnd && (() => {
            const fromNode = board.nodes.find((n) => n.id === connectionStart);
            if (!fromNode) return null;
            const fx = fromNode.posX + fromNode.width / 2;
            const fy = fromNode.posY + (fromNode.height || 200) / 2;
            const tx = tempConnectionEnd.x;
            const ty = tempConnectionEnd.y;
            return (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                <line
                  x1={fx} y1={fy} x2={tx} y2={ty}
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  opacity="0.7"
                />
                <circle cx={tx} cy={ty} r="5" fill="#10B981" opacity="0.5" />
              </svg>
            );
          })()}

          {/* Group frames (render below nodes) */}
          {groups.map((group) => (
            <ResearchGroupFrame
              key={group.id}
              group={group}
              isSelected={selectedGroupId === group.id}
              onSelect={() => { setSelectedGroupId(group.id); setSelectedNodeIds(new Set()); }}
              onDragStart={(e) => handleGroupDragStart(group.id, e)}
              onResizeStart={(e, dir) => handleGroupResizeStart(group.id, e, dir)}
              onUpdate={(data) => updateGroup(group.id, data)}
              onDelete={() => deleteGroup(group.id)}
            />
          ))}

          {/* Nodes */}
          {filteredNodes.map((node) => (
            <ResearchNodeCard
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.has(node.id)}
              isDragging={draggingNodeId === node.id}
              dimmed={isolatedIds.size > 0 && !isolatedIds.has(node.id)}
              onSelect={(e?: React.MouseEvent) => {
                if (connectionStart) {
                  handleCompleteConnection(node.id);
                } else if (e?.shiftKey) {
                  setSelectedNodeIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                    return next;
                  });
                } else {
                  setSelectedNodeIds(new Set([node.id]));
                }
              }}
              onDragStart={(e) => handleNodeDragStart(node.id, e)}
              onDoubleClick={() => setViewingNode(node)}
              onUpdate={(data) => updateNodeMutation.mutate({ nodeId: node.id, data })}
              onResizeStart={(e, dir) => handleNodeResizeStart(node.id, e, dir)}
              onDelete={() => deleteNodeMutation.mutate(node.id)}
              onCommentClick={() => setCommentsNodeId(node.id)}
              onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, node.id); }}
            />
          ))}
        </div>

        {/* Box selection rectangle */}
        {selectionBox && (
          <div
            className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none z-20"
            style={{
              left: `${Math.min(selectionBox.startX, selectionBox.currentX) * zoom + pan.x}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY) * zoom + pan.y}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX) * zoom}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY) * zoom}px`,
            }}
          />
        )}

        {/* Connection mode indicator */}
        {connectionStart && (
          <div className="absolute top-3 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-status-success-mark text-ink text-xs font-medium shadow-lg backdrop-blur-sm">
              <GitBranch className="icon-sm" />
              Click a node to connect · Press Esc to cancel
            </div>
          </div>
        )}

        {/* Live cursors */}
        <LiveCursors collaborators={collaborators} pan={pan} zoom={zoom} />

        <CanvasAlignmentGuides guides={guides} pan={pan} zoom={zoom} />
        {showRulers && canvasRef.current && (
          <CanvasRulers
            pan={pan}
            zoom={zoom}
            width={canvasRef.current.clientWidth}
            height={canvasRef.current.clientHeight}
          />
        )}

        {/* MiniMap — compact on phones, above the draw strip; from sm it sits
            at bottom-10, and from lg it keeps that height but steps left of
            the 52px chat bubble (right-6 + bubble + 0.75rem gap) so the Co
            mark does not cover the map. z-[45] keeps it above the inspector
            at the seam. */}
        {showMiniMap && board ? (
          <div
            data-canvas-chrome
            className="pointer-events-auto absolute bottom-[5.5rem] right-2 z-[45] cursor-default sm:bottom-10 sm:right-4 lg:right-[calc(2.25rem+52px)]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <BoardMiniMap
              nodes={board.nodes}
              pan={pan}
              zoom={zoom}
              viewportWidth={canvasRef.current?.clientWidth ?? window.innerWidth}
              viewportHeight={canvasRef.current?.clientHeight ?? window.innerHeight}
              onNavigate={setPan}
              compact={isPhone}
            />
          </div>
        ) : null}
        <div
          data-canvas-chrome
          className={cn(
            'pointer-events-auto absolute top-4 right-4 z-40 flex w-[220px] cursor-default flex-col overflow-hidden',
            // Stop above the MiniMap: compact 78px frame, desktop 122px frame,
            // plus a 0.5rem seam. When the map is off, 99px still holds the
            // inspector off the chat bubble.
            // Phones do not keep a 220px column over the notes. The same panel
            // opens from the layers button as a sheet above the draw strip.
            showMiniMap
              ? 'bottom-[calc(6rem+78px)] sm:bottom-[calc(3rem+122px)]'
              : 'bottom-[99px]',
            'max-sm:bottom-[6.5rem] max-sm:left-2 max-sm:right-2 max-sm:top-auto max-sm:z-50 max-sm:w-auto max-sm:max-h-[46dvh]',
          )}
          data-phone-inspector={phoneInspector ? 'open' : 'closed'}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CanvasInspectorPanel
            className="h-full min-h-0"
            layers={layers}
            activeLayerId={activeLayerId}
            onActivateLayer={(id) => {
              setActiveLayerId(id);
              if (selectedNodeIds.size > 0) issue('set_layer', { query: id });
            }}
            onToggleLayer={(id) => issue('toggle_layer', { query: id })}
            onLockLayer={(id) => issue('lock_layer', { query: id })}
            onAddLayer={() => issue('add_layer')}
            selectedCount={selectedNodeIds.size}
            fill={selectedNodes[0] ? nodePaintColor(selectedNodes[0].color, selectedNodes[0].metadata) : null}
            opacity={readNodeStyle(selectedNodes[0]?.metadata).opacity ?? 1}
            stroke={readNodeStyle(selectedNodes[0]?.metadata).stroke}
            shadow={readNodeStyle(selectedNodes[0]?.metadata).shadow ?? false}
            onStyle={applyStyleToSelection}
            onLink={(href) => issue('link_entity', { href })}
            productHref={selectedNodes[0] ? readCfbHref(selectedNodes[0].metadata) : null}
            onRotate={() => issue('rotate', { query: '90' })}
            onMatchSize={() => issue('match_size')}
            onCopyStyle={() => issue('copy_style')}
            onPasteStyle={() => issue('paste_style')}
            onTidy={() => issue('tidy')}
            onFlipH={() => issue('flip_h')}
            onFlipV={() => issue('flip_v')}
            onHide={() => issue('hide')}
            onVote={() => issue('vote')}
            onIsolate={() => issue(isolatedIds.size ? 'reveal' : 'isolate')}
            onFrame={() => issue('frame')}
            onHug={() => issue('hug')}
            isolated={isolatedIds.size > 0}
            onDocFormat={(format) => issue('format_text', { query: format })}
            onWordCount={() => issue('word_count')}
            onCite={promptCite}
            onFindReplace={promptFindReplace}
            onInsertLink={promptInsertLink}
            onMerge={() => issue('merge_notes')}
            onSplit={() => issue('split_notes')}
            onCopyText={() => issue('copy_text')}
            onPastePlain={() => issue('paste_plain')}
            onInsertDate={() => issue('insert_date')}
          />
        </div>

        {/* Comments Panel */}
        {commentsNodeId && currentUser && (
          <div className="absolute z-40 pointer-events-auto inset-x-2 top-2 sm:inset-x-auto sm:left-4 sm:top-4 sm:w-[340px]">
            <CommentsPanel
              nodeId={commentsNodeId}
              nodeTitle={board?.nodes?.find((n) => n.id === commentsNodeId)?.title}
              currentUserId={currentUser.id}
              onClose={() => setCommentsNodeId(null)}
            />
          </div>
        )}

        {board.nodes.length === 0 && !isDragOver && (
          <EmptyCanvasStarter
            onAddStarter={(kind) => {
              createNodeMutation.mutate(canvasStarterPayload(kind, primary === 'el' ? 'el' : 'en'));
            }}
            onAskAi={() => { setShowAIPanel(true); }}
          />
        )}

        {/* Drop zone overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary/5 backdrop-blur-[2px] transition-all duration-200">
            <div className="bg-card/95 border-2 border-dashed border-primary rounded-2xl p-10 text-center shadow-2xl">
              <Upload className="h-14 w-14 text-primary-accessible mx-auto mb-4 animate-bounce" />
              <p className="text-lg font-semibold">
                <BilingualText en={researchEn('drop_here')} el={researchEl('drop_here')} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <BilingualText en={researchEn('drop_hint')} el={researchEl('drop_hint')} />
              </p>
            </div>
          </div>
        )}

        {/* Bottom status bar */}
        <div className="absolute bottom-0 inset-x-0 h-7 bg-card/80 backdrop-blur-sm border-t border-border flex items-center justify-between px-3 z-30 pointer-events-none select-none">
          <span className="text-2xs tabular-nums text-muted-foreground/70 truncate">
            {Math.round(zoom * 100)}% · {board.nodes.length}{' '}
            {t(board.nodes.length === 1 ? researchEn('node') : researchEn('nodes'), board.nodes.length === 1 ? researchEl('node') : researchEl('nodes'))}
            {board.connectors.length > 0 && ` · ${board.connectors.length} ${t(board.connectors.length === 1 ? researchEn('connection') : researchEn('connections'), board.connectors.length === 1 ? researchEl('connection') : researchEl('connections'))}`}
            {selectedNodeIds.size > 0 && ` · ${selectedNodeIds.size} ${t(researchEn('selected'), researchEl('selected'))}`}
            {connectionStart && ` · ${t(researchEn('drawing'), researchEl('drawing'))}`}
            <span className="hidden sm:inline">
              {groups.length > 0 && ` · ${groups.length} ${t(groups.length === 1 ? researchEn('group') : researchEn('groups'), groups.length === 1 ? researchEl('group') : researchEl('groups'))}`}
              {snapToGrid && ` · ⊞ ${t(researchEn('snap'), researchEl('snap'))}`}
            </span>
          </span>
          <span className="ml-2 min-w-0 max-w-[46%] truncate text-2xs tabular-nums text-muted-foreground/50 sm:max-w-none sm:shrink-0">
            <span className="sr-only sm:hidden">{t(researchEn('hint_nav_touch'), researchEl('hint_nav_touch'))}</span>
            <span className="hidden sm:inline">
              {history.length > 0 && `${t(researchEn('history'), researchEl('history'))}: ${historyIndex + 1}/${history.length} · `}
              {t(researchEn('hint_nav'), researchEl('hint_nav'))}
            </span>
          </span>
        </div>
      </div>

      {/* Canvas Copilot Panel — overlay on phones, sidebar from sm */}
      {showAIPanel && (
        <div className="absolute inset-0 z-50 sm:static sm:inset-auto sm:z-auto">
        <CanvasCopilotPanel
          boardId={boardId}
          nodes={board.nodes}
          selectedNodeIds={Array.from(selectedNodeIds)}
          onClose={() => setShowAIPanel(false)}
          onCreateNodes={(newNodes) => {
            for (const n of newNodes) {
              const isMermaidNode = n.type === 'mermaid_diagram';
              const isFlowNode    = n.type === 'flow_diagram';
              const isBoard       = n.type === 'whiteboard';
              createNodeMutation.mutate({
                type: n.type as ResearchNodeType,
                title: n.title,
                content: n.content,
                posX: n.posX,
                posY: n.posY,
                width:  isMermaidNode ? 420 : isFlowNode ? 560 : isBoard ? 600 : 280,
                height: isMermaidNode ? 320 : isFlowNode ? 360 : isBoard ? 420 : 200,
              });
            }
          }}
        />
        </div>
      )}

      {/* Board Summary Panel — overlay on phones, sidebar from sm */}
      {showBoardSummary && (
        <div className="absolute inset-0 z-50 sm:static sm:inset-auto sm:z-auto">
        <BoardSummaryPanel
          boardId={boardId}
          boardTitle={board.title}
          nodes={board.nodes}
          onClose={() => setShowBoardSummary(false)}
        />
        </div>
      )}
      </div>{/* end flex row */}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFileUpload(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Node viewer popup */}
      {viewingNode && (
        <ResearchNodeViewer
          node={viewingNode}
          onClose={() => setViewingNode(null)}
          onUpdate={(data) => {
            updateNodeMutation.mutate({ nodeId: viewingNode.id, data });
            setViewingNode({ ...viewingNode, ...data });
          }}
        />
      )}

      {/* Entity reference selector */}
      <EntityReferenceSelector
        open={showEntitySelector}
        onClose={() => setShowEntitySelector(false)}
        onSelect={(entity) => {
          createNodeMutation.mutate({
            type: 'reference',
            title: entity.title,
            content: JSON.stringify({
              entityType: entity.type,
              entityId: entity.id,
              subtitle: entity.subtitle,
              avatarUrl: entity.avatarUrl,
            }),
            posX: (window.innerWidth / 2 - pan.x) / zoom,
            posY: (window.innerHeight / 2 - pan.y) / zoom,
          });
        }}
      />

      {/* Board settings dialog */}
      {currentUser && (
        <BoardSettingsPanel
          board={board}
          open={showBoardSettings}
          onClose={() => setShowBoardSettings(false)}
          currentUserId={currentUser.id}
        />
      )}
      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[70] w-52 bg-card border border-border rounded-lg shadow-xl overflow-hidden py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.nodeId ? (
            <>
              <button
                onClick={() => { const n = board?.nodes?.find((nd) => nd.id === contextMenu.nodeId); if (n) setViewingNode(n); setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Eye className="icon-sm" /> <BilingualText en={researchEn('node_open')} el={researchEl('node_open')} compact />
              </button>
              <button
                onClick={() => { if (contextMenu.nodeId) { setSelectedNodeIds(new Set([contextMenu.nodeId])); duplicateSelected(); } setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Copy className="icon-sm" /> <BilingualText en={researchEn('duplicate')} el={researchEl('duplicate')} compact />
              </button>
              <button
                onClick={() => { if (contextMenu.nodeId) { setConnectionStart(contextMenu.nodeId); setActiveTool('connect'); } setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <GitBranch className="icon-sm" /> <BilingualText en={researchEn('connect_from')} el={researchEl('connect_from')} compact />
              </button>
              <button
                onClick={() => { if (contextMenu.nodeId) setCommentsNodeId(contextMenu.nodeId); setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <MessageSquare className="icon-sm" /> <BilingualText en={researchEn('node_comments')} el={researchEl('node_comments')} compact />
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { if (contextMenu.nodeId) { const n = board?.nodes?.find((nd) => nd.id === contextMenu.nodeId); if (n && !n.locked) deleteNodeMutation.mutate(contextMenu.nodeId); } setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive-accessible transition-colors flex items-center gap-2"
              >
                <Trash2 className="icon-sm" /> <BilingualText en={researchEn('node_delete')} el={researchEl('node_delete')} compact />
              </button>
            </>
          ) : (
            <>
              {/* Quick-access node types for right-click */}
              {[
                { type: 'note' as ResearchNodeType, label: 'Note', icon: StickyNote, color: '#F59E0B' },
                { type: 'question' as ResearchNodeType, label: 'Question', icon: HelpCircle, color: '#6366F1' },
                { type: 'hypothesis' as ResearchNodeType, label: 'Hypothesis', icon: FlaskConical, color: '#8B5CF6' },
                { type: 'evidence' as ResearchNodeType, label: 'Evidence', icon: GitBranch, color: '#14B8A6' },
                { type: 'insight' as ResearchNodeType, label: 'Insight', icon: Lightbulb, color: '#10B981' },
                { type: 'document' as ResearchNodeType, label: 'Document', icon: FileText, color: '#3B82F6' },
                { type: 'pitch_deck' as ResearchNodeType, label: 'Pitch Deck', icon: Presentation, color: '#EC4899' },
                { type: 'business_plan' as ResearchNodeType, label: 'Business Plan', icon: ClipboardList, color: '#7C3AED' },
                { type: 'financial_model' as ResearchNodeType, label: 'Financial Model', icon: Calculator, color: '#16A34A' },
                { type: 'meeting_notes' as ResearchNodeType, label: 'Meeting Notes', icon: Calendar, color: '#0E7490' },
                { type: 'checklist' as ResearchNodeType, label: 'Checklist', icon: CheckSquare, color: '#0D9488' },
                { type: 'task' as ResearchNodeType, label: 'Task', icon: ListTodo, color: '#F97316' },
                { type: 'contract' as ResearchNodeType, label: 'Contract', icon: Scale, color: '#DC2626' },
                { type: 'wireframe' as ResearchNodeType, label: 'Wireframe', icon: PenTool, color: '#2563EB' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => {
                      const rect = canvasRef.current?.getBoundingClientRect();
                      if (rect) {
                        const x = (contextMenu.x - rect.left - pan.x) / zoom;
                        const y = (contextMenu.y - rect.top - pan.y) / zoom;
                        createNodeMutation.mutate({ type: item.type, title: `New ${item.label}`, content: getDefaultContent(item.type), posX: x, posY: y, width: 280, height: 200 });
                      }
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <Icon className="icon-sm" style={{ color: item.color }} />
                    <BilingualText en={item.label} el={RESEARCH_NODE_LABEL_EL[item.type] ?? item.label} compact />
                  </button>
                );
              })}
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { fileInputRef.current?.click(); setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Upload className="icon-sm" />
                <BilingualText en={researchEn('upload')} el={researchEl('upload')} compact />
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = (contextMenu.x - rect.left - pan.x) / zoom;
                    const y = (contextMenu.y - rect.top - pan.y) / zoom;
                    void issue('group', { posX: x, posY: y });
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Grid3X3 className="icon-sm text-muted-foreground" /> <BilingualText en={researchEn('create_group')} el={researchEl('create_group')} compact />
              </button>
              <button
                onClick={() => {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = (contextMenu.x - rect.left - pan.x) / zoom;
                    const y = (contextMenu.y - rect.top - pan.y) / zoom;
                    createNodeMutation.mutate({ type: 'note' as ResearchNodeType, title: '', content: '', posX: x, posY: y, width: 200, height: 200, color: '#F59E0B', metadata: { isSticky: true } });
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <StickyNote className="icon-sm text-status-warning" /> <BilingualText en={researchEn('add_sticky')} el={researchEl('add_sticky')} compact />
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { if (board) setSelectedNodeIds(new Set(board.nodes.map((n) => n.id))); setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Layers className="icon-sm" /> <BilingualText en={researchEn('select_all')} el={researchEl('select_all')} compact />
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setContextMenu(null); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
              >
                <Maximize2 className="icon-sm" /> <BilingualText en={researchEn('reset_view')} el={researchEl('reset_view')} compact />
              </button>
            </>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          {/* A hand-rolled overlay with no dialog semantics: a keyboard user
              opened it and kept tabbing through the board behind it, and
              Escape did nothing. `useModalA11y` supplies what Radix would. */}
          <div
            ref={shortcutsRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-dialog-title"
            tabIndex={-1}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 id="shortcuts-dialog-title" className="text-lg font-semibold flex items-center gap-2">
                <Keyboard className="icon-md text-muted-foreground" />
                Keyboard Shortcuts
              </h2>
              <Button aria-label="Close shortcuts" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowShortcuts(false)}>
                <X className="icon-sm" />
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {[
                { keys: ['Ctrl/⌘', 'Z'], desc: 'Undo' },
                { keys: ['Ctrl/⌘', 'Y'], desc: 'Redo' },
                { keys: ['Ctrl/⌘', 'A'], desc: 'Select all' },
                { keys: ['Ctrl/⌘', 'D'], desc: 'Duplicate selection' },
                { keys: ['Delete'], desc: 'Delete selection' },
                { keys: ['Shift', 'Click'], desc: 'Multi-select' },
                { keys: ['Shift', 'Drag'], desc: 'Box select' },
                { keys: ['Arrow keys'], desc: 'Move selected (1px)' },
                { keys: ['Shift', 'Arrow'], desc: 'Move selected (10px)' },
                { keys: ['Scroll'], desc: 'Zoom in/out' },
                { keys: ['Ctrl/⌘', '0'], desc: 'Reset view' },
                { keys: ['Esc'], desc: 'Clear selection' },
                { keys: ['V'], desc: 'Select tool' },
                { keys: ['N'], desc: 'Note tool' },
                { keys: ['C'], desc: 'Connect tool' },
                { keys: ['G'], desc: 'Toggle snap-to-grid' },
                { keys: ['F'], desc: 'Fit all nodes in view' },
                { keys: ['Shift', 'G'], desc: 'Create group frame' },
                { keys: ['S'], desc: 'Add sticky note' },
                { keys: ['Ctrl/⌘', 'B'], desc: 'Bold note text' },
                { keys: ['Ctrl/⌘', 'I'], desc: 'Italic note text' },
                { keys: ['Ctrl/⌘', 'U'], desc: 'Underline note text' },
                { keys: ['Ctrl/⌘', 'K'], desc: 'Insert link' },
                { keys: ['Ctrl/⌘', 'H'], desc: 'Find and replace' },
                { keys: ['Shift', 'A'], desc: 'Tidy selection' },
                { keys: ['?'], desc: 'Show shortcuts' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-1 text-2xs font-mono bg-secondary border border-border rounded">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>
        )}

      {/* Canvas Version Panel (Snapshots + Versions + Branches) */}
      <CanvasVersionPanel
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        boardId={boardId}
        boardTitle={board?.title}
      />
      </div>
    </div>
  );
}
