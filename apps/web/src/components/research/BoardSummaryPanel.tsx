'use client';

import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles, X, Loader2, Copy, Check, RefreshCw,
  FileText, GitBranch, Lightbulb, AlertTriangle, Tag, Layers,
  BarChart3, TrendingUp, Target, Users, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  analyzeResearchBoard,
  type ResearchNode,
  type ResearchBoardAnalysis,
} from '@/lib/api';

/* ─── Props ─── */
interface BoardSummaryPanelProps {
  boardId: string;
  boardTitle: string;
  nodes: ResearchNode[];
  onClose: () => void;
  onApplyTags?: (tags: string[]) => void;
}

/* ─── Helper: stat card ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/40 border border-border">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="icon-sm" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

/* ─── Collapsible Section ─── */
function CollapsibleSection({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <Icon className="icon-sm shrink-0" style={{ color }} />
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        {open ? <ChevronDown className="icon-sm text-muted-foreground" /> : <ChevronRight className="icon-sm text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

export function BoardSummaryPanel({
  boardId,
  boardTitle,
  nodes,
  onClose,
  onApplyTags,
}: BoardSummaryPanelProps) {
  const { success, error: showError } = useToast();
  const [analysis, setAnalysis] = useState<ResearchBoardAnalysis | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeResearchBoard(boardId),
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      success('Analysis complete', 'Board summary generated');
    },
    onError: (err) => {
      showError('Analysis failed', err instanceof Error ? err.message : 'Could not analyze board');
    },
  });

  // Board statistics
  const stats = useMemo(() => {
    const typeMap = new Map<string, number>();
    const tagSet = new Set<string>();
    let totalContent = 0;
    let withContent = 0;
    let withTags = 0;

    nodes.forEach((n) => {
      typeMap.set(n.type, (typeMap.get(n.type) || 0) + 1);
      n.tags.forEach((t) => tagSet.add(t));
      if (n.content) {
        totalContent += n.content.replace(/<[^>]+>/g, '').trim().length;
        withContent++;
      }
      if (n.tags.length > 0) withTags++;
    });

    const topTypes = Array.from(typeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      nodeCount: nodes.length,
      typeCount: typeMap.size,
      uniqueTags: tagSet.size,
      totalChars: totalContent,
      withContent,
      withTags,
      topTypes,
      allTags: Array.from(tagSet).sort(),
    };
  }, [nodes]);

  const handleCopySummary = useCallback(async () => {
    if (!analysis) return;
    const text = [
      `# Board Summary: ${boardTitle}`,
      '',
      analysis.summary,
      '',
      `## Themes`,
      ...analysis.themes.map((t) => `- ${t}`),
      '',
      `## Key Insights`,
      ...analysis.insights.map((i) => `- ${i}`),
      '',
      `## Research Gaps`,
      ...analysis.gaps.map((g) => `- ${g}`),
      '',
      `## Suggested Tags`,
      analysis.suggestedTags.join(', '),
      '',
      `## Suggested Connections`,
      ...analysis.connections.map((c) => `- ${c.from} → ${c.to}: ${c.reason}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Copied', 'Summary copied to clipboard');
    } catch {
      showError('Failed', 'Could not copy to clipboard');
    }
  }, [analysis, boardTitle, success, showError]);

  return (
    <div className="w-full sm:w-80 flex-none flex flex-col border-l border-border bg-card h-full overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border flex-none">
        <div className="w-6 h-6 rounded-lg bg-status-success/15 flex items-center justify-center">
          <BarChart3 className="icon-sm text-status-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Board Summary</p>
          <p className="text-2xs text-muted-foreground truncate">{boardTitle}</p>
        </div>
        <button aria-label="Close" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <X className="icon-sm" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">

          {/* Board Statistics */}
          <CollapsibleSection title="Board Statistics" icon={BarChart3} color="#10B981">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Layers} label="Total Nodes" value={stats.nodeCount} color="#3B82F6" />
              <StatCard icon={FileText} label="Node Types" value={stats.typeCount} color="#8B5CF6" />
              <StatCard icon={Tag} label="Unique Tags" value={stats.uniqueTags} color="#F59E0B" />
              <StatCard icon={TrendingUp} label="With Content" value={stats.withContent} color="#10B981" />
            </div>

            {/* Top node types */}
            {stats.topTypes.length > 0 && (
              <div className="mt-2">
                <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Top Node Types</p>
                <div className="space-y-1">
                  {stats.topTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-2xs text-foreground capitalize">{type.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full bg-primary/20 w-16">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(8, (count / stats.nodeCount) * 100)}%` }}
                          />
                        </div>
                        <span className="text-2xs text-muted-foreground tabular-nums w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All tags */}
            {stats.allTags.length > 0 && (
              <div className="mt-2">
                <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">All Tags</p>
                <div className="flex flex-wrap gap-1">
                  {stats.allTags.slice(0, 20).map((tag) => (
                    <span key={tag} className="text-2xs text-muted-foreground">{tag}</span>
                  ))}
                  {stats.allTags.length > 20 && (
                    <span className="text-2xs text-muted-foreground">+{stats.allTags.length - 20}</span>
                  )}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* AI Analysis Section */}
          <CollapsibleSection title="AI Analysis" icon={Sparkles} color="#A855F7">
            {!analysis ? (
              <div className="text-center py-3">
                <Sparkles className="icon-xl text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-2xs text-muted-foreground mb-3">
                  Generate an AI-powered summary of your research board with themes, insights, and gap analysis.
                </p>
                <button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending || nodes.length === 0}
                  className="h-8 px-4 rounded-xl bg-status-accent/15 text-status-accent hover:bg-status-accent/25 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 mx-auto"
                >
                  {analyzeMutation.isPending
                    ? <><Loader2 className="icon-sm animate-spin" /> Analyzing…</>
                    : <><Sparkles className="icon-sm" /> Generate Summary</>
                  }
                </button>
                {nodes.length === 0 && (
                  <p className="text-2xs text-muted-foreground mt-2 italic">Add nodes to your board first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    className="h-6 px-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground text-2xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={cn('icon-sm', analyzeMutation.isPending && 'animate-spin')} />
                    Regenerate
                  </button>
                  <button
                    onClick={handleCopySummary}
                    className="h-6 px-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground text-2xs font-medium transition-colors flex items-center gap-1"
                  >
                    {copied ? <Check className="icon-sm text-status-success" /> : <Copy className="icon-sm" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Summary */}
                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Executive Summary</p>
                  <p className="text-2xs text-foreground leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
                </div>

                {/* Themes */}
                {analysis.themes.length > 0 && (
                  <div>
                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Target className="icon-sm text-status-info" /> Themes ({analysis.themes.length})
                    </p>
                    <div className="space-y-1">
                      {analysis.themes.map((theme, i) => (
                        <div key={i} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-status-info/5 border border-status-info/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-status-info-mark mt-1.5 shrink-0" />
                          <span className="text-2xs text-foreground leading-snug">{theme}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights */}
                {analysis.insights.length > 0 && (
                  <div>
                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Lightbulb className="icon-sm text-status-warning" /> Key Insights ({analysis.insights.length})
                    </p>
                    <div className="space-y-1">
                      {analysis.insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-status-warning/5 border border-status-warning/20">
                          <Lightbulb className="icon-sm text-status-warning mt-0.5 shrink-0" />
                          <span className="text-2xs text-foreground leading-snug">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps */}
                {analysis.gaps.length > 0 && (
                  <div>
                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="icon-sm text-status-danger" /> Research Gaps ({analysis.gaps.length})
                    </p>
                    <div className="space-y-1">
                      {analysis.gaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-status-danger/5 border border-status-danger/20">
                          <AlertTriangle className="icon-sm text-status-danger mt-0.5 shrink-0" />
                          <span className="text-2xs text-foreground leading-snug">{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Connections */}
                {analysis.connections.length > 0 && (
                  <div>
                    <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <GitBranch className="icon-sm text-status-success" /> Suggested Connections ({analysis.connections.length})
                    </p>
                    <div className="space-y-1">
                      {analysis.connections.map((conn, i) => (
                        <div key={i} className="px-2.5 py-1.5 rounded-lg bg-status-success/5 border border-status-success/20">
                          <div className="flex items-center gap-1 text-2xs">
                            <span className="font-medium text-foreground truncate">{conn.from}</span>
                            <span className="text-status-success shrink-0">→</span>
                            <span className="font-medium text-foreground truncate">{conn.to}</span>
                          </div>
                          <p className="text-2xs text-muted-foreground mt-0.5">{conn.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Tags */}
                {analysis.suggestedTags.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Tag className="icon-sm text-status-accent" /> Suggested Tags
                      </p>
                      {onApplyTags && (
                        <button
                          onClick={() => onApplyTags(analysis.suggestedTags)}
                          className="text-2xs text-status-accent hover:text-status-accent transition-colors"
                        >
                          Apply all
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.suggestedTags.map((tag) => (
                        <span key={tag} className="text-2xs px-2 py-0.5 rounded-full bg-status-accent/10 text-status-accent">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Board Health */}
          <CollapsibleSection title="Board Health" icon={TrendingUp} color="#10B981" defaultOpen={false}>
            <div className="space-y-2">
              {/* Content coverage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs text-muted-foreground">Content Coverage</span>
                  <span className="text-2xs text-foreground font-medium tabular-nums">
                    {stats.nodeCount > 0 ? Math.round((stats.withContent / stats.nodeCount) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-status-success-mark transition-all"
                    style={{ width: `${stats.nodeCount > 0 ? (stats.withContent / stats.nodeCount) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5">{stats.withContent}/{stats.nodeCount} nodes have content</p>
              </div>

              {/* Tag coverage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs text-muted-foreground">Tag Coverage</span>
                  <span className="text-2xs text-foreground font-medium tabular-nums">
                    {stats.nodeCount > 0 ? Math.round((stats.withTags / stats.nodeCount) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-status-warning-mark transition-all"
                    style={{ width: `${stats.nodeCount > 0 ? (stats.withTags / stats.nodeCount) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5">{stats.withTags}/{stats.nodeCount} nodes are tagged</p>
              </div>

              {/* Total research volume */}
              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-secondary/30">
                <span className="text-2xs text-muted-foreground">Total Research Volume</span>
                <span className="text-2xs font-bold text-foreground tabular-nums">
                  {stats.totalChars > 1000 ? `${(stats.totalChars / 1000).toFixed(1)}k` : stats.totalChars} chars
                </span>
              </div>

              {/* Recommendations */}
              <div className="mt-1">
                <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recommendations</p>
                <ul className="space-y-1">
                  {stats.nodeCount === 0 && (
                    <li className="text-2xs text-muted-foreground flex items-start gap-1">
                      <span className="text-status-warning mt-0.5">•</span> Add nodes to begin your research
                    </li>
                  )}
                  {stats.withContent < stats.nodeCount * 0.5 && stats.nodeCount > 0 && (
                    <li className="text-2xs text-muted-foreground flex items-start gap-1">
                      <span className="text-status-warning mt-0.5">•</span> Add content to more nodes for richer analysis
                    </li>
                  )}
                  {stats.uniqueTags < 3 && stats.nodeCount > 5 && (
                    <li className="text-2xs text-muted-foreground flex items-start gap-1">
                      <span className="text-status-warning mt-0.5">•</span> Add tags to organize and categorize your research
                    </li>
                  )}
                  {stats.typeCount < 3 && stats.nodeCount > 5 && (
                    <li className="text-2xs text-muted-foreground flex items-start gap-1">
                      <span className="text-status-info mt-0.5">•</span> Try different node types for diverse perspectives
                    </li>
                  )}
                  {stats.withContent >= stats.nodeCount * 0.8 && stats.nodeCount >= 5 && (
                    <li className="text-2xs text-status-success flex items-start gap-1">
                      <span className="mt-0.5">✓</span> Great content coverage! Ready for AI analysis.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
