'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain, Sparkles, Target, TrendingUp, DollarSign, Presentation,
  MessageSquare, Send, Loader2, X, Copy, ChevronRight, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Layers, Check, AlertCircle,
  Spline, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  chatWithCanvasCopilot,
  listCanvasCopilotAgents,
  exportCanvasToBuilder,
  importBuilderToCanvas,
  generateDocumentFromCanvas,
  listImportableDocuments,
  type CanvasCopilotMessage,
  type CanvasCopilotAgentConfig,
  type ImportableDocument,
  type ResearchNode,
} from '@/lib/api';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';

// ── Agent metadata ────────────────────────────────────────────────────────────

const AGENT_META: Record<string, { icon: React.ElementType; color: string; accent: string }> = {
  'canvas-strategy': { icon: Target,       color: 'text-violet-400', accent: 'border-violet-400/40 bg-violet-400/5' }, // categorical-palette
  'canvas-product':  { icon: Layers,       color: 'text-blue-400',   accent: 'border-blue-400/40 bg-blue-400/5' }, // categorical-palette
  'canvas-finance':  { icon: DollarSign,   color: 'text-emerald-400',accent: 'border-emerald-400/40 bg-emerald-400/5' }, // categorical-palette
  'canvas-market':   { icon: TrendingUp,   color: 'text-amber-400',  accent: 'border-amber-400/40 bg-amber-400/5' }, // categorical-palette
  'canvas-pitch':    { icon: Presentation, color: 'text-pink-400',   accent: 'border-pink-400/40 bg-pink-400/5' }, // categorical-palette
};

const FALLBACK_AGENTS: CanvasCopilotAgentConfig[] = [
  { id: 'canvas-strategy', name: 'Strategy Copilot',  description: 'SWOT, OKRs, competitive gaps, vision alignment',       suggestedQuestions: ['What strategic gaps does my canvas have?', 'Are my OKRs aligned?', 'Identify conflicts between nodes'] },
  { id: 'canvas-product',  name: 'Product Copilot',   description: 'Specs, user stories, PRDs, architecture synthesis',     suggestedQuestions: ['What product nodes are missing?', 'Identify the MVP path', 'What are the main product risks?'] },
  { id: 'canvas-finance',  name: 'Finance Copilot',   description: 'Revenue model, projections, unit economics',            suggestedQuestions: ['Are my projections consistent?', 'What financial nodes are missing?', 'Analyze unit economics'] },
  { id: 'canvas-market',   name: 'Market Copilot',    description: 'Market research, competitors, ICP, go-to-market',       suggestedQuestions: ['How strong is my market opportunity?', 'Identify competitive gaps', 'What market validation is missing?'] },
  { id: 'canvas-pitch',    name: 'Pitch Copilot',     description: 'Pitch deck outline, narrative, investor memo synthesis', suggestedQuestions: ['Generate a pitch deck outline', "Write a one-paragraph pitch", 'What\'s missing for a complete pitch?'] },
];

// ── Document type options for export ─────────────────────────────────────────

const EXPORT_DOC_TYPES = [
  { value: 'pitch_deck',            label: 'Pitch Deck' },
  { value: 'business_model_canvas', label: 'Business Model Canvas' },
  { value: 'market_analysis',       label: 'Market Analysis' },
  { value: 'swot_analysis',         label: 'SWOT Analysis' },
  { value: 'financial_plan',        label: 'Financial Plan' },
  { value: 'prd',                   label: 'PRD & User Stories' },
  { value: 'go_to_market',          label: 'Go-to-Market Strategy' },
  { value: 'competitive_analysis',  label: 'Competitive Analysis' },
  { value: 'custom',                label: 'Custom Document' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface CanvasCopilotPanelProps {
  boardId: string;
  nodes: ResearchNode[];
  selectedNodeIds: string[];
  onClose: () => void;
  onCreateNodes?: (nodes: Array<{ type: string; title: string; content: string; posX: number; posY: number }>) => void;
  onNodeLinked?: (nodeId: string, documentId: string) => void;
  workspaceId?: string; // optional Builder workspace to export to
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'chat' | 'export' | 'import' | 'mermaid';

const MERMAID_TYPES = [
  { value: 'flowchart',  label: 'Flowchart' },
  { value: 'sequence',   label: 'Sequence' },
  { value: 'mindmap',    label: 'Mind Map' },
  { value: 'erDiagram',  label: 'ER Diagram' },
  { value: 'gantt',      label: 'Gantt Chart' },
  { value: 'pie',        label: 'Pie Chart' },
  { value: 'journey',    label: 'User Journey' },
  { value: 'classDiagram', label: 'Class Diagram' },
];

function extractMermaidCode(aiResponse: string): string {
  const fenced = aiResponse.match(/```(?:mermaid)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const lines = aiResponse.split('\n');
  const start = lines.findIndex((l) => /^(flowchart|sequenceDiagram|mindmap|erDiagram|gantt|pie|journey|classDiagram)/i.test(l.trim()));
  if (start !== -1) return lines.slice(start).join('\n').trim();
  return aiResponse.trim();
}

// ── Mermaid Generation Sub-component ──────────────────────────────────────────

interface MermaidGenTabProps {
  boardId: string;
  mermaidType: string;
  setMermaidType: (v: string) => void;
  mermaidPrompt: string;
  setMermaidPrompt: (v: string) => void;
  generatedCode: string;
  setGeneratedCode: (v: string) => void;
  onAddToCanvas: (code: string) => void;
}

function MermaidGenTab({
  boardId,
  mermaidType,
  setMermaidType,
  mermaidPrompt,
  setMermaidPrompt,
  generatedCode,
  setGeneratedCode,
  onAddToCanvas,
}: MermaidGenTabProps) {
  const { error: showError } = useToast();
  const [copied, setCopied] = useState(false);

  const genMutation = useMutation({
    mutationFn: () =>
      chatWithCanvasCopilot(boardId, {
        agentId: 'canvas-strategy',
        message: `Generate a valid Mermaid.js ${mermaidType} diagram for the following description. Reply with ONLY the raw Mermaid code (no explanation, no markdown fences):\n\n${mermaidPrompt}`,
        includeAllNodes: false,
      }),
    onSuccess: (result) => {
      const code = extractMermaidCode(result.message);
      setGeneratedCode(code);
    },
    onError: (e) => showError('Generation failed', e instanceof Error ? e.message : 'AI unavailable'),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
        <Spline className="icon-sm inline-block mr-1 text-status-accent" />
        Describe a diagram and let AI generate Mermaid code for you, then add it directly to the canvas.
      </div>

      {/* Diagram type */}
      <div className="space-y-1">
        <p id="ccp-diagtype" className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Diagram Type</p>
        <div className="grid grid-cols-2 gap-1" role="group" aria-labelledby="ccp-diagtype">
          {MERMAID_TYPES.map((mt) => (
            <button
              key={mt.value}
              type="button"
              aria-pressed={mermaidType === mt.value}
              onClick={() => setMermaidType(mt.value)}
              className={cn(
                'text-2xs px-2 py-1.5 rounded-lg border transition-colors text-left',
                mermaidType === mt.value
                  ? 'border-status-accent/50 bg-status-accent/10 text-status-accent font-medium'
                  : 'border-border text-muted-foreground hover:border-border',
              )}
            >
              {mt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <label htmlFor="ccp-f1" className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Describe Your Diagram</label>
        <textarea id="ccp-f1"
          rows={4}
          value={mermaidPrompt}
          onChange={(e) => setMermaidPrompt(e.target.value)}
          placeholder={`e.g. "User registration flow with email verification and onboarding steps"`}
          className="w-full resize-none text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-status-accent/60 placeholder:text-muted-foreground/50 leading-relaxed"
        />
      </div>

      {/* Generate button */}
      <button
        onClick={() => genMutation.mutate()}
        disabled={!mermaidPrompt.trim() || genMutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-status-accent-mark hover:bg-status-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-ink text-xs font-medium transition-colors"
      >
        {genMutation.isPending
          ? <><Loader2 className="icon-sm animate-spin" /> Generating…</>
          : <><Sparkles className="icon-sm" /> Generate Diagram</>}
      </button>

      {/* Generated code preview */}
      {generatedCode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Generated Code</p>
            <button onClick={handleCopy} className="text-2xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {copied ? <Check className="w-2.5 h-2.5 text-status-success" /> : <Copy className="w-2.5 h-2.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-2xs bg-muted/40 border border-border rounded-lg p-2.5 overflow-x-auto text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-48">
            {generatedCode}
          </pre>
          <button
            onClick={() => onAddToCanvas(generatedCode)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-status-success-mark hover:bg-status-success/90 text-ink text-xs font-medium transition-colors"
          >
            <Plus className="icon-sm" />
            Add to Canvas
          </button>
        </div>
      )}

      {genMutation.isError && (
        <div className="flex items-center gap-2 text-xs text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
          <AlertCircle className="icon-sm shrink-0" />
          <span>{(genMutation.error as Error)?.message ?? 'Generation failed'}</span>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasCopilotPanel({
  boardId,
  nodes,
  selectedNodeIds,
  onClose,
  onCreateNodes,
  onNodeLinked,
  workspaceId,
}: CanvasCopilotPanelProps) {
  const { success, error: showError } = useToast();

  const [tab, setTab] = useState<Tab>('chat');
  const [activeAgentId, setActiveAgentId] = useState('canvas-strategy');
  const [chatHistory, setChatHistory] = useState<CanvasCopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Export state
  const [exportDocType, setExportDocType] = useState('pitch_deck');
  const [exportTitle, setExportTitle] = useState('');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(workspaceId || '');
  const [linkNodes, setLinkNodes] = useState(true);
  const [generateAI, setGenerateAI] = useState(false);

  // Mermaid generation state
  const [mermaidType, setMermaidType] = useState('flowchart');
  const [mermaidPrompt, setMermaidPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  // Fetch agents
  const { data: agentsData } = useQuery({
    queryKey: qk('ai', 'copilot-agents', boardId),
    queryFn: () => listCanvasCopilotAgents(boardId),
  });
  const agents = agentsData?.agents ?? FALLBACK_AGENTS;
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? FALLBACK_AGENTS[0];

  // Fetch importable documents
  const { data: importableData, refetch: refetchImportable } = useQuery({
    queryKey: qk('research-boards', 'importable-docs', boardId),
    queryFn: () => listImportableDocuments(boardId),
    enabled: tab === 'import',
  });
  const importableDocs = importableData?.documents ?? [];

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatHistory]);

  // ── Chat mutation ─────────────────────────────────────────────────────────

  const chatMutation = useMutation({
    mutationFn: (msg: string) =>
      chatWithCanvasCopilot(boardId, {
        agentId: activeAgentId,
        message: msg,
        selectedNodeIds: scopeAll ? undefined : (selectedNodeIds.length > 0 ? selectedNodeIds : undefined),
        includeAllNodes: scopeAll || selectedNodeIds.length === 0,
        history: chatHistory.slice(-10),
      }),
    onSuccess: (result, msg) => {
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: result.message },
      ]);
    },
    onError: (e) => showError('AI Error', e instanceof Error ? e.message : 'Request failed'),
  });

  const sendMessage = useCallback(() => {
    const msg = input.trim();
    if (!msg || chatMutation.isPending) return;
    setInput('');
    chatMutation.mutate(msg);
  }, [input, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Export mutation ───────────────────────────────────────────────────────

  const exportMutation = useMutation({
    mutationFn: () => {
      if (!targetWorkspaceId) throw new Error('Select a Builder workspace first');
      if (generateAI) {
        return generateDocumentFromCanvas(boardId, {
          workspaceId: targetWorkspaceId,
          documentType: exportDocType,
          documentTitle: exportTitle || undefined,
          selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
          agentId: activeAgentId,
        });
      }
      return exportCanvasToBuilder(boardId, {
        workspaceId: targetWorkspaceId,
        selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
        documentType: exportDocType,
        documentTitle: exportTitle || undefined,
        linkNodes,
      });
    },
    onSuccess: (result) => {
      success('Exported to Builder', `Created "${result.documentTitle}" in Builder`);
      setExportTitle('');
    },
    onError: (e) => showError('Export failed', e instanceof Error ? e.message : 'Export failed'),
  });

  // ── Import mutation ───────────────────────────────────────────────────────

  const importMutation = useMutation({
    mutationFn: (docId: string) =>
      importBuilderToCanvas(boardId, { documentId: docId, posX: 400 + Math.random() * 200, posY: 200 + Math.random() * 200 }),
    onSuccess: (result) => {
      success('Imported to canvas', `"${result.title}" added as a canvas node`);
      onNodeLinked?.(result.nodeId, result.builderDocumentId);
      if (onCreateNodes) {
        onCreateNodes([{ type: result.nodeType, title: result.title, content: '', posX: 400, posY: 300 }]);
      }
      refetchImportable();
    },
    onError: (e) => showError('Import failed', e instanceof Error ? e.message : 'Import failed'),
  });

  const selectedCount = selectedNodeIds.length;
  const scopeLabel = scopeAll
    ? `All ${nodes.length} nodes`
    : selectedCount > 0
      ? `${selectedCount} selected node${selectedCount > 1 ? 's' : ''}`
      : `All ${nodes.length} nodes (nothing selected)`;

  return (
    <div className="flex flex-col h-full w-full sm:w-80 flex-none bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="icon-sm text-status-accent shrink-0" />
          <span className="text-sm font-semibold truncate">Canvas Copilot</span>
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-status-accent/10 text-status-accent font-medium">BETA</span>
        </div>
        <button aria-label="Close" onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0">
          <X className="icon-sm text-muted-foreground" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {([
          { id: 'chat',    icon: MessageSquare, label: 'Chat' },
          { id: 'mermaid', icon: Spline,        label: 'Diagram' },
          { id: 'export',  icon: ArrowUpRight,  label: 'Export' },
          { id: 'import',  icon: ArrowDownLeft, label: 'Import' },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === id
                ? 'border-status-accent text-status-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="icon-sm" />
            {label}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Agent selector */}
          <div className="px-3 pt-2.5 pb-2 border-b border-border shrink-0">
            <p className="text-2xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">Specialist Agent</p>
            <div className="grid grid-cols-5 gap-1">
              {agents.map((agent) => {
                const meta = AGENT_META[agent.id] ?? AGENT_META['canvas-strategy'];
                const Icon = meta.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => { setActiveAgentId(agent.id); setChatHistory([]); }}
                    title={agent.description}
                    className={cn(
                      'flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-2xs font-medium transition-all',
                      activeAgentId === agent.id
                        ? cn('border-2', meta.accent, meta.color)
                        : 'border-border text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('icon-sm', activeAgentId === agent.id ? meta.color : '')} />
                    <span className="leading-tight text-center">{agent.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-2xs text-muted-foreground mt-1.5 leading-tight">{activeAgent.description}</p>
          </div>

          {/* Scope toggle */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border shrink-0">
            <span className="text-2xs text-muted-foreground">Scope: <span className="text-foreground font-medium">{scopeLabel}</span></span>
            <button
              onClick={() => setScopeAll((v) => !v)}
              className={cn('text-2xs px-2 py-0.5 rounded border transition-colors', scopeAll ? 'border-status-accent/50 text-status-accent bg-status-accent/5' : 'border-border text-muted-foreground hover:border-border')}
            >
              {scopeAll ? 'Selected only' : 'All nodes'}
            </button>
          </div>

          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {chatHistory.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Suggested</p>
                {activeAgent.suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="w-full text-left text-xs p-2 rounded-lg border border-border hover:border-status-accent/40 hover:bg-status-accent/5 transition-all text-muted-foreground hover:text-foreground leading-relaxed"
                  >
                    <ChevronRight className="icon-sm inline-block mr-1 text-status-accent" />
                    {q}
                  </button>
                ))}
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                {msg.role === 'user' ? (
                  <div className="bg-status-accent/15 text-foreground text-xs px-3 py-2 rounded-2xl rounded-tr-sm max-w-[90%] leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="relative group max-w-[95%]">
                    <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <button aria-label="Copy message"
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      className="absolute -top-1 -right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 focus-within:opacity-100 bg-muted border border-border transition-opacity"
                    >
                      <Copy className="w-2.5 h-2.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="icon-sm animate-spin text-status-accent" />
                <span>Analyzing canvas…</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
            {chatHistory.length > 0 && (
              <button onClick={() => setChatHistory([])} className="text-2xs text-muted-foreground hover:text-foreground mb-1.5 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" /> New conversation
              </button>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${activeAgent.name}…`}
                className="flex-1 resize-none text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-status-accent/60 placeholder:text-muted-foreground/50 leading-relaxed"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || chatMutation.isPending}
                aria-label={bilingualAria('Send message', 'Αποστολή μηνύματος')}
                className="p-2 rounded-lg bg-status-accent-mark hover:bg-status-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {chatMutation.isPending
                  ? <Loader2 className="icon-sm text-white animate-spin" />
                  : <Send className="icon-sm text-white" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MERMAID GENERATION TAB ── */}
      {tab === 'mermaid' && (
        <MermaidGenTab
          boardId={boardId}
          mermaidType={mermaidType}
          setMermaidType={setMermaidType}
          mermaidPrompt={mermaidPrompt}
          setMermaidPrompt={setMermaidPrompt}
          generatedCode={generatedCode}
          setGeneratedCode={setGeneratedCode}
          onAddToCanvas={(code) => {
            onCreateNodes?.([
              {
                type: 'mermaid_diagram',
                title: `${mermaidType.charAt(0).toUpperCase() + mermaidType.slice(1)} Diagram`,
                content: code,
                posX: 400 + Math.random() * 200,
                posY: 200 + Math.random() * 200,
              },
            ]);
            success('Diagram added to canvas');
          }}
        />
      )}

      {/* ── EXPORT TAB ── */}
      {tab === 'export' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
            <Sparkles className="icon-sm inline-block mr-1 text-status-warning" />
            Export {selectedCount > 0 ? `${selectedCount} selected` : `all ${nodes.length}`} canvas nodes to a new Builder document.
          </div>

          {/* Workspace ID */}
          <div className="space-y-1">
            <label htmlFor="ccp-f2" className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Builder Workspace ID</label>
            <input id="ccp-f2"
              value={targetWorkspaceId}
              onChange={(e) => setTargetWorkspaceId(e.target.value)}
              placeholder={bilingualInline("Paste workspace UUID…", "Επικολλήστε το UUID του χώρου εργασίας…")}
              className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-status-accent/60 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Document type */}
          <div className="space-y-1">
            <label htmlFor="ccp-f3" className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Document Type</label>
            <select id="ccp-f3"
              value={exportDocType}
              onChange={(e) => setExportDocType(e.target.value)}
              className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-status-accent/60"
            >
              {EXPORT_DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label htmlFor="ccp-f4" className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">Document Title (optional)</label>
            <input id="ccp-f4"
              value={exportTitle}
              onChange={(e) => setExportTitle(e.target.value)}
              placeholder={bilingualInline("Auto-generated if empty", "Δημιουργείται αυτόματα αν μείνει κενό")}
              className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-status-accent/60 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={linkNodes} onChange={(e) => setLinkNodes(e.target.checked)} className="rounded" />
              <span className="text-xs text-muted-foreground">Link canvas nodes to the new document</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={generateAI} onChange={(e) => setGenerateAI(e.target.checked)} className="rounded" />
              <span className="text-xs text-muted-foreground">
                <Brain className="icon-sm inline mr-1 text-status-accent" />
                AI-generate content from nodes
              </span>
            </label>
          </div>

          {exportMutation.isSuccess && (
            <div className="flex items-center gap-2 text-xs text-status-success bg-status-success/10 border border-status-success/20 rounded-lg px-3 py-2">
              <Check className="icon-sm shrink-0" />
              <span>Exported! Open Builder to view the document.</span>
            </div>
          )}

          {exportMutation.isError && (
            <div className="flex items-center gap-2 text-xs text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
              <AlertCircle className="icon-sm shrink-0" />
              <span>{(exportMutation.error as Error)?.message ?? 'Export failed'}</span>
            </div>
          )}

          <button
            onClick={() => exportMutation.mutate()}
            disabled={!targetWorkspaceId.trim() || exportMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-status-accent-mark hover:bg-status-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-ink text-xs font-medium transition-colors"
          >
            {exportMutation.isPending
              ? <><Loader2 className="icon-sm animate-spin" /> Exporting…</>
              : <><ArrowUpRight className="icon-sm" /> Export to Builder</>}
          </button>
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
            <ArrowDownLeft className="icon-sm inline-block mr-1 text-status-info" />
            Import Builder documents as linked canvas nodes.
          </div>

          {importableDocs.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No Builder documents found. Create documents in the Builder workspace first.
            </div>
          ) : (
            importableDocs.map((doc: ImportableDocument) => (
              <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:border-border transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{doc.title}</p>
                  <p className="text-2xs text-muted-foreground truncate">{doc.workspaceName} · <StatusText value={doc.type} /></p>
                </div>
                {doc.alreadyLinked ? (
                  <span className="shrink-0 text-2xs text-status-success flex items-center gap-1">
                    <Check className="icon-sm" /> Linked
                  </span>
                ) : (
                  <button
                    onClick={() => importMutation.mutate(doc.id)}
                    disabled={importMutation.isPending}
                    className="shrink-0 text-2xs px-2 py-1 rounded-md border border-primary/40 text-primary-accessible hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {importMutation.isPending && importMutation.variables === doc.id
                      ? <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                      : 'Import'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
