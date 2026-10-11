'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles, FileText, GitBranch, Layers, HelpCircle, MessageSquare,
  Loader2, X, Plus, Check, Trash2, RefreshCw, Info, AlertCircle,
  Lightbulb, StickyNote, FlaskConical, BookOpen, ListChecks,
  ChevronRight, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  extractResearchNodes,
  suggestResearchConnections,
  synthesizeResearchCluster,
  generateResearchQuestions,
  chatWithResearchBoard,
  type ResearchNode,
  type AINodeSuggestion,
  type AIConnectionSuggestion,
  type AISynthesisResult,
  type AIResearchQuestion,
  type AIChatMessage,
} from '@/lib/api';
import { bilingualAria } from '@/lib/i18n/format';
import { bilingualInline } from '@/lib/i18n/format';

import { pressableProps } from '@/lib/pressable';
/* ─── Types ─── */
type Tab = 'extract' | 'connect' | 'synthesize' | 'questions' | 'chat';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'extract',    label: 'Extract',    icon: <FileText className="icon-sm" />,     desc: 'Extract nodes from text' },
  { id: 'connect',    label: 'Connect',    icon: <GitBranch className="icon-sm" />,    desc: 'Suggest connections' },
  { id: 'synthesize', label: 'Synthesize', icon: <Layers className="icon-sm" />,       desc: 'Synthesize cluster' },
  { id: 'questions',  label: 'Questions',  icon: <HelpCircle className="icon-sm" />,   desc: 'Generate questions' },
  { id: 'chat',       label: 'Chat',       icon: <MessageSquare className="icon-sm" />, desc: 'Ask about your board' },
];

/* ─── Helpers ─── */
function nodeTypeIcon(type: string, cls = 'w-3.5 h-3.5') {
  switch (type) {
    case 'note':       return <StickyNote className={cls} aria-hidden="true" />;
    case 'insight':    return <Lightbulb className={cls} aria-hidden="true" />;
    case 'question':   return <HelpCircle className={cls} aria-hidden="true" />;
    case 'hypothesis': return <FlaskConical className={cls} aria-hidden="true" />;
    case 'citation':   return <BookOpen className={cls} aria-hidden="true" />;
    case 'task':       return <ListChecks className={cls} aria-hidden="true" />;
    default:           return <StickyNote className={cls} aria-hidden="true" />;
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'text-status-success' : pct >= 60 ? 'text-status-warning' : 'text-muted-foreground';
  return <span className={cn('text-2xs font-medium', color)}>{pct}%</span>;
}

/* ─── Props ─── */
interface AIAnalysisPanelProps {
  boardId: string;
  nodes: ResearchNode[];
  selectedNodeIds: string[];
  onClose: () => void;
  onCreateNodes?: (nodes: Array<{ type: string; title: string; content: string; posX: number; posY: number }>) => void;
  onApplyTags?: (tags: string[]) => void;
}

export function AIAnalysisPanel({
  boardId,
  nodes,
  selectedNodeIds,
  onClose,
  onCreateNodes,
}: AIAnalysisPanelProps) {
  const { success, error: showError } = useToast();
  const [tab, setTab] = useState<Tab>('extract');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extract tab
  const [extractText, setExtractText] = useState('');
  const [extractedSuggestions, setExtractedSuggestions] = useState<AINodeSuggestion[]>([]);

  // Connect tab
  const [connSuggestions, setConnSuggestions] = useState<AIConnectionSuggestion[]>([]);

  // Synthesize tab
  const [synthResult, setSynthResult] = useState<AISynthesisResult | null>(null);

  // Questions tab
  const [questionSuggestions, setQuestionSuggestions] = useState<AIResearchQuestion[]>([]);
  const [questionFocus, setQuestionFocus] = useState('');

  // Chat tab
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));

  const run = useCallback(async (fn: () => Promise<void>) => {
    setErrorMsg(null);
    setLoading(true);
    try { await fn(); } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI request failed';
      setErrorMsg(msg);
      showError('AI Error', msg);
    } finally { setLoading(false); }
  }, [showError]);

  /* ── Extract ── */
  const handleExtract = () => run(async () => {
    if (extractText.trim().length < 20) throw new Error('Please paste at least 20 characters of text.');
    const result = await extractResearchNodes(boardId, extractText);
    setExtractedSuggestions(result.nodes.map((n) => ({ ...n, accepted: undefined })));
    if (result.nodes.length === 0) throw new Error('No nodes extracted. Try different or longer text.');
    success('Extraction complete', `${result.nodes.length} node suggestions`);
  });

  const toggleExtracted = (id: string) => {
    setExtractedSuggestions((prev) => prev.map((n) =>
      n.id === id ? { ...n, accepted: n.accepted === true ? false : n.accepted === false ? undefined : true } : n
    ));
  };

  const commitExtracted = () => {
    const accepted = extractedSuggestions.filter((s) => s.accepted !== false);
    if (accepted.length === 0) { showError('No nodes selected'); return; }
    if (onCreateNodes) {
      onCreateNodes(accepted.map((s, i) => ({
        type: s.type === 'insight' || s.type === 'hypothesis' || s.type === 'question' || s.type === 'task' ? 'note' : s.type,
        title: s.title,
        content: s.content,
        posX: 100 + (i % 4) * 220,
        posY: 100 + Math.floor(i / 4) * 160,
      })));
    }
    setExtractedSuggestions([]);
    setExtractText('');
    success('Nodes added', `${accepted.length} nodes added to canvas`);
  };

  /* ── Connect ── */
  const handleSuggestConnections = () => run(async () => {
    if (selectedNodes.length < 2) throw new Error('Select at least 2 nodes on the canvas first.');
    const result = await suggestResearchConnections(boardId, selectedNodeIds);
    setConnSuggestions(result.connections.map((c) => ({ ...c, accepted: undefined })));
    if (result.connections.length === 0) throw new Error('No connection suggestions found.');
    success('Analysis complete', `${result.connections.length} connection suggestions`);
  });

  const toggleConn = (id: string) => {
    setConnSuggestions((prev) => prev.map((c) =>
      c.id === id ? { ...c, accepted: c.accepted === true ? false : c.accepted === false ? undefined : true } : c
    ));
  };

  /* ── Synthesize ── */
  const handleSynthesize = () => run(async () => {
    if (selectedNodes.length < 2) throw new Error('Select at least 2 nodes on the canvas to synthesize.');
    const result = await synthesizeResearchCluster(boardId, selectedNodeIds);
    setSynthResult(result.synthesis);
  });

  const commitSynthesis = () => {
    if (!synthResult || !onCreateNodes) return;
    onCreateNodes([{
      type: 'note',
      title: synthResult.title,
      content: synthResult.content,
      posX: 200,
      posY: 200,
    }]);
    setSynthResult(null);
    success('Synthesis added', 'Insight node added to canvas');
  };

  /* ── Questions ── */
  const handleGenerateQuestions = () => run(async () => {
    if (nodes.length === 0) throw new Error('Your board has no nodes yet.');
    const result = await generateResearchQuestions(boardId, questionFocus || undefined);
    setQuestionSuggestions(result.questions);
    if (result.questions.length === 0) throw new Error('No questions generated.');
    success('Questions generated', `${result.questions.length} research questions`);
  });

  const addQuestionToCanvas = (q: AIResearchQuestion) => {
    if (!onCreateNodes) return;
    onCreateNodes([{ type: 'note', title: q.title, content: `<p>${q.rationale}</p>`, posX: 100, posY: 100 }]);
    setQuestionSuggestions((prev) => prev.filter((x) => x.id !== q.id));
    success('Question added');
  };

  const addAllQuestions = () => {
    if (!onCreateNodes || questionSuggestions.length === 0) return;
    onCreateNodes(questionSuggestions.map((q, i) => ({
      type: 'note', title: q.title, content: `<p>${q.rationale}</p>`,
      posX: 100 + (i % 3) * 220, posY: 100 + Math.floor(i / 3) * 140,
    })));
    setQuestionSuggestions([]);
    success('All questions added');
  };

  /* ── Chat ── */
  const handleChat = async () => {
    const msg = chatInput.trim();
    if (!msg || loading) return;
    setChatInput('');
    const userMsg: AIChatMessage = { role: 'user', content: msg };
    setChatHistory((prev) => [...prev, userMsg]);
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await chatWithResearchBoard(boardId, msg, [...chatHistory, userMsg]);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Chat failed';
      setErrorMsg(errMsg);
      setChatHistory((prev) => prev.filter((m) => m !== userMsg));
      setChatInput(msg);
    } finally { setLoading(false); }
  };

  const nodeLabel = (id: string) => nodes.find((n) => n.id === id)?.title?.slice(0, 30) ?? id;

  return (
    <div className="w-80 flex-none flex flex-col border-l border-border bg-card h-full overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border flex-none">
        <div className="w-6 h-6 rounded-lg bg-status-accent/15 flex items-center justify-center">
          <Sparkles className="icon-sm text-status-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">AI Research Assistant</p>
          <p className="text-2xs text-muted-foreground">Analyze, extract, and synthesize</p>
        </div>
        <button aria-label="Close" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <X className="icon-sm" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex-none border-b border-border bg-secondary/30">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setErrorMsg(null); }}
              title={t.desc}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-2xs font-medium transition-colors border-b-2',
                tab === t.id
                  ? 'border-status-accent text-status-accent bg-status-accent/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              {t.icon}
              <span className="leading-none">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="flex-none flex items-start gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20 text-2xs text-destructive-accessible overflow-hidden">
          <AlertCircle className="icon-sm shrink-0 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
          <button aria-label="Dismiss error" onClick={() => setErrorMsg(null)} className="shrink-0"><X className="icon-sm" /></button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">

          {/* ── Extract Tab ── */}
          {tab === 'extract' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-2xs font-semibold text-foreground mb-1">Extract from Text</p>
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  Paste research text, abstracts, or notes. AI will extract structured nodes.
                </p>
              </div>

              <textarea
                value={extractText}
                onChange={(e) => setExtractText(e.target.value)}
                placeholder={bilingualInline("Paste research text, abstract, paper excerpt, or notes here…", "Επικολλήστε εδώ κείμενο έρευνας, περίληψη, απόσπασμα ή σημειώσεις…")}
                className="w-full bg-secondary/50 rounded-xl px-3 py-2.5 text-2xs text-foreground placeholder:text-muted-foreground/50 outline-none border border-border focus:border-status-accent/50 transition-colors resize-none leading-relaxed"
                rows={6}
              />

              <div className="flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">{extractText.length} chars</span>
                <button
                  onClick={handleExtract}
                  disabled={loading || extractText.trim().length < 20}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-2xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="icon-sm animate-spin" /> : <Sparkles className="icon-sm" />}
                  Extract Nodes
                </button>
              </div>

              {extractedSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-semibold text-foreground">{extractedSuggestions.length} suggestions</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExtractedSuggestions((p) => p.map((n) => ({ ...n, accepted: true })))} className="text-2xs text-status-accent hover:text-status-accent transition-colors">Select all</button>
                      <span className="text-muted-foreground">·</span>
                      <button onClick={() => setExtractedSuggestions([])} className="text-2xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                    </div>
                  </div>

                  {extractedSuggestions.map((s) => {
                    const isRejected = s.accepted === false;
                    const isAccepted = s.accepted === true;
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleExtracted(s.id)}
                        {...pressableProps({ pressed: s.accepted === true })}
                        className={cn(
                          'rounded-xl border p-2.5 cursor-pointer transition-all',
                          isRejected ? 'opacity-40 border-border bg-card' :
                          isAccepted ? 'border-status-accent/50 bg-status-accent/5' :
                          'border-border bg-card hover:border-status-accent/30'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-sm flex items-center justify-center shrink-0 mt-0.5 bg-secondary text-muted-foreground">
                            {nodeTypeIcon(s.type, 'w-3 h-3')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-2xs font-semibold text-foreground leading-snug">{s.title}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <ConfidenceBadge confidence={s.confidence} />
                                <div className={cn(
                                  'w-4 h-4 rounded flex items-center justify-center border transition-colors',
                                  isAccepted ? 'bg-status-accent-mark border-status-accent' : 'border-border'
                                )}>
                                  {isAccepted && <Check className="w-2.5 h-2.5 text-white" aria-hidden="true" />}
                                </div>
                              </div>
                            </div>
                            <span className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">{s.type}</span>
                            {s.content && <p className="text-2xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{s.content}</p>}
                            {s.rationale && (
                              <p className="text-2xs text-status-accent/70 mt-1 italic leading-relaxed">
                                <Info className="w-2.5 h-2.5 inline mr-0.5" />{s.rationale}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={commitExtracted}
                    className="w-full h-8 rounded-xl bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="icon-sm" />
                    Add {extractedSuggestions.filter((s) => s.accepted !== false).length} nodes to canvas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Connect Tab ── */}
          {tab === 'connect' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-2xs font-semibold text-foreground mb-1">Suggest Connections</p>
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  Select 2+ nodes on canvas, then click Analyze. AI will suggest meaningful relationships.
                </p>
              </div>

              <div className="rounded-xl border border-border p-2.5">
                <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Selected nodes</p>
                {selectedNodes.length === 0 ? (
                  <p className="text-2xs text-muted-foreground italic">Click nodes on the canvas to select them</p>
                ) : (
                  <div className="space-y-1">
                    {selectedNodes.slice(0, 8).map((n) => (
                      <div key={n.id} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{nodeTypeIcon(n.type, 'w-3 h-3')}</span>
                        <span className="text-2xs text-foreground truncate">{n.title}</span>
                      </div>
                    ))}
                    {selectedNodes.length > 8 && <p className="text-2xs text-muted-foreground">+{selectedNodes.length - 8} more</p>}
                  </div>
                )}
              </div>

              <button
                onClick={handleSuggestConnections}
                disabled={loading || selectedNodes.length < 2}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="icon-sm animate-spin" /> : <GitBranch className="icon-sm" />}
                Analyze {selectedNodes.length > 0 ? `${selectedNodes.length} nodes` : 'selected nodes'}
              </button>

              {connSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-semibold text-foreground">{connSuggestions.length} suggested connections</p>
                    <button onClick={() => setConnSuggestions([])} className="text-2xs text-muted-foreground hover:text-foreground">Clear</button>
                  </div>

                  {connSuggestions.map((c) => {
                    const isRejected = c.accepted === false;
                    const isAccepted = c.accepted === true;
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleConn(c.id)}
                        {...pressableProps({ pressed: c.accepted === true })}
                        className={cn(
                          'rounded-xl border p-2.5 cursor-pointer transition-all',
                          isRejected ? 'opacity-40 border-border bg-card' :
                          isAccepted ? 'border-status-success/40 bg-status-success/5' :
                          'border-border bg-card hover:border-status-success/30'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-status-success-mark" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-2xs font-bold uppercase tracking-wide text-status-success">{c.connType}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <ConfidenceBadge confidence={c.confidence} />
                                <div className={cn(
                                  'w-4 h-4 rounded flex items-center justify-center border transition-colors',
                                  isAccepted ? 'bg-status-success-mark border-status-success' : 'border-border'
                                )}>
                                  {isAccepted && <Check className="w-2.5 h-2.5 text-white" aria-hidden="true" />}
                                </div>
                              </div>
                            </div>
                            <p className="text-2xs text-foreground mt-0.5 leading-snug">
                              <span className="font-medium">{nodeLabel(c.fromId)}</span>
                              <span className="text-muted-foreground mx-1">→</span>
                              <span className="font-medium">{nodeLabel(c.toId)}</span>
                            </p>
                            {c.rationale && <p className="text-2xs text-muted-foreground mt-1 leading-relaxed">{c.rationale}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Synthesize Tab ── */}
          {tab === 'synthesize' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-2xs font-semibold text-foreground mb-1">Synthesize Cluster</p>
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  Select 2+ nodes on canvas. AI will synthesize them into a single Insight node.
                </p>
              </div>

              <div className="rounded-xl border border-border p-2.5">
                <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Nodes to synthesize</p>
                {selectedNodes.length < 2 ? (
                  <p className="text-2xs text-muted-foreground italic">Select at least 2 nodes on the canvas</p>
                ) : (
                  <div className="space-y-1">
                    {selectedNodes.slice(0, 6).map((n) => (
                      <div key={n.id} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span className="text-2xs text-foreground truncate">{n.title}</span>
                      </div>
                    ))}
                    {selectedNodes.length > 6 && <p className="text-2xs text-muted-foreground">+{selectedNodes.length - 6} more</p>}
                  </div>
                )}
              </div>

              <button
                onClick={handleSynthesize}
                disabled={loading || selectedNodes.length < 2}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="icon-sm animate-spin" /> : <Layers className="icon-sm" />}
                Synthesize {selectedNodes.length > 0 ? `${selectedNodes.length} nodes` : ''}
              </button>

              {synthResult && (
                <div className="rounded-xl border border-status-success/40 bg-status-success/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="icon-sm text-status-success" />
                    <p className="text-2xs font-semibold text-status-success">Synthesis Result</p>
                  </div>
                  <input
                    value={synthResult.title}
                    onChange={(e) => setSynthResult((prev) => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full bg-secondary/50 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none border border-border focus:border-status-success/50 transition-colors"
                  />
                  <textarea
                    value={synthResult.content}
                    onChange={(e) => setSynthResult((prev) => prev ? { ...prev, content: e.target.value } : null)}
                    className="w-full bg-secondary/50 rounded-lg px-2.5 py-2 text-2xs text-foreground outline-none border border-border focus:border-status-success/50 transition-colors resize-none leading-relaxed"
                    rows={4}
                  />
                  <p className="text-2xs text-muted-foreground italic">
                    <Info className="w-2.5 h-2.5 inline mr-0.5" />{synthResult.rationale}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={commitSynthesis} className="flex-1 h-7 rounded-lg bg-status-success/15 text-status-success hover:bg-status-success/25 text-2xs font-semibold transition-colors flex items-center justify-center gap-1">
                      <Plus className="icon-sm" /> Add to canvas
                    </button>
                    <button aria-label="Clear result" onClick={() => setSynthResult(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                      <Trash2 className="icon-sm" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Questions Tab ── */}
          {tab === 'questions' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-2xs font-semibold text-foreground mb-1">Generate Research Questions</p>
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  AI analyzes your board and generates incisive research questions that reveal gaps and next directions.
                </p>
              </div>

              <div>
                <label htmlFor="aia-f1" className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide">Focus (optional)</label>
                <input id="aia-f1"
                  value={questionFocus}
                  onChange={(e) => setQuestionFocus(e.target.value)}
                  placeholder="e.g. methodology gaps, theoretical tensions…"
                  className="mt-1 w-full bg-secondary/50 rounded-lg px-2.5 py-1.5 text-2xs text-foreground outline-none border border-border focus:border-status-accent/50 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted-foreground">{nodes.length} board nodes</span>
                <button
                  onClick={handleGenerateQuestions}
                  disabled={loading || nodes.length === 0}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-2xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="icon-sm animate-spin" /> : <RefreshCw className="icon-sm" />}
                  Generate
                </button>
              </div>

              {questionSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-semibold text-foreground">{questionSuggestions.length} questions</p>
                    <button onClick={addAllQuestions} className="text-2xs text-status-accent hover:text-status-accent transition-colors">Add all</button>
                  </div>
                  {questionSuggestions.map((q) => (
                    <div key={q.id} className="rounded-xl border border-border bg-card p-2.5 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <HelpCircle className="icon-sm text-status-accent shrink-0 mt-0.5" />
                        <p className="text-2xs font-medium text-foreground leading-snug flex-1">{q.title}</p>
                        <ConfidenceBadge confidence={q.confidence} />
                      </div>
                      {q.rationale && <p className="text-2xs text-muted-foreground leading-relaxed">{q.rationale}</p>}
                      <button
                        onClick={() => addQuestionToCanvas(q)}
                        className="flex items-center gap-1 text-2xs text-status-accent hover:text-status-accent transition-colors"
                      >
                        <Plus className="icon-sm" /> Add to canvas
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Chat Tab ── */}
          {tab === 'chat' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-2xs font-semibold text-foreground mb-1">Chat with Your Board</p>
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  Ask questions about your research content. AI has context of all {nodes.length} board nodes.
                </p>
              </div>

              {/* Chat history */}
              <div ref={chatScrollRef} className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {chatHistory.length === 0 && (
                  <div className="space-y-1.5">
                    {[
                      'What are the main themes in my research?',
                      'What tensions or contradictions do you see?',
                      'What gaps does my literature review have?',
                      'Suggest a methodology for my hypothesis',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setChatInput(q)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg border border-border text-2xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn('rounded-xl p-2.5', msg.role === 'user' ? 'bg-secondary ml-4' : 'bg-status-accent/5 border border-status-accent/20')}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="icon-sm text-status-accent" />
                        <span className="text-2xs font-bold text-status-accent uppercase tracking-wide">AI Assistant</span>
                      </div>
                    )}
                    <p className="text-2xs text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.content)}
                        className="mt-1.5 flex items-center gap-0.5 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-2.5 h-2.5" aria-hidden="true" /> Copy
                      </button>
                    )}
                  </div>
                ))}
                {loading && tab === 'chat' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-status-accent/5 border border-status-accent/20">
                    <Loader2 className="icon-sm text-status-accent animate-spin" />
                    <span className="text-2xs text-status-accent">Thinking…</span>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="flex gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                  placeholder={bilingualInline("Ask about your research…", "Ρωτήστε για την έρευνά σας…")}
                  disabled={loading}
                  className="flex-1 bg-secondary/50 rounded-lg px-2.5 py-1.5 text-2xs text-foreground placeholder:text-muted-foreground/50 outline-none border border-border focus:border-status-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleChat}
                  disabled={loading || !chatInput.trim()}
                  aria-label={bilingualAria('Send question', 'Αποστολή ερώτησης')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-status-accent/15 text-status-accent hover:bg-status-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="icon-sm animate-spin" /> : <ChevronRight className="icon-sm" />}
                </button>
              </div>

              {chatHistory.length > 0 && (
                <button
                  onClick={() => setChatHistory([])}
                  className="text-2xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Trash2 className="icon-sm" /> Clear conversation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
