'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, Code, Eye, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

let mermaidLoaded = false;
let mermaidLoadPromise: Promise<typeof import('mermaid')> | null = null;

function loadMermaid() {
  if (!mermaidLoadPromise) {
    mermaidLoadPromise = import('mermaid').then((mod) => {
      if (!mermaidLoaded) {
        mod.default.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          // 'loose' permits raw HTML and click handlers inside diagram labels.
          // Diagram source is user-authored on collaborative boards, so it is
          // untrusted input: 'strict' escapes labels and disables click events.
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });
        mermaidLoaded = true;
      }
      return mod;
    });
  }
  return mermaidLoadPromise;
}

let _renderIdCounter = 0;

interface MermaidDiagramNodeProps {
  content: string;
  onChange?: (newContent: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function MermaidDiagramNode({ content, onChange, readOnly = false, compact = false }: MermaidDiagramNodeProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(!content.trim());
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useRef(`mermaid-${++_renderIdCounter}`);

  const renderDiagram = useCallback(async (src: string) => {
    if (!src.trim()) {
      setSvg('');
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mod = await loadMermaid();
      const { svg: rendered } = await mod.default.render(renderId.current, src);
      setSvg(rendered);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid Mermaid syntax');
      setSvg('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    renderDiagram(content);
    setDraft(content);
  }, [content, renderDiagram]);

  const handleApply = useCallback(() => {
    onChange?.(draft);
    setShowCode(false);
  }, [draft, onChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  return (
    <div className={cn('flex flex-col w-full h-full', compact && 'gap-0')}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card/80">
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowCode(false); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-2xs transition-colors',
              !showCode ? 'bg-primary/15 text-primary-accessible' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Preview diagram"
          >
            <Eye className="icon-sm" />
            Preview
          </button>
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowCode(true); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-2xs transition-colors',
              showCode ? 'bg-primary/15 text-primary-accessible' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Edit Mermaid code"
          >
            <Code className="icon-sm" />
            Code
          </button>
          <div className="flex-1" />
          <button
            onMouseDown={(e) => { e.stopPropagation(); handleCopy(); }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-muted-foreground hover:text-foreground transition-colors"
            title="Copy Mermaid code"
          >
            {copied ? <Check className="icon-sm text-status-success" /> : <Copy className="icon-sm" />}
          </button>
        </div>
      )}

      {/* Code editor */}
      {showCode && !readOnly && (
        <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={`graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[End]\n  B -->|No| A`}
            className="flex-1 min-h-[120px] resize-none rounded-xl bg-secondary/60 border border-border p-2 text-xs font-mono text-foreground outline-none"
          />
          <button
            onMouseDown={(e) => { e.stopPropagation(); handleApply(); }}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors self-end"
          >
            Apply &amp; Render
          </button>
        </div>
      )}

      {/* SVG Preview */}
      {!showCode && (
        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="icon-md animate-spin" />
              <span className="text-2xs">Rendering…</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 text-destructive-accessible p-3 text-center">
              <AlertTriangle className="icon-md" />
              <p className="text-2xs font-medium">Syntax error</p>
              <p className="text-2xs text-muted-foreground max-w-[200px] leading-relaxed">{error}</p>
              {!readOnly && (
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setShowCode(true); }}
                  className="mt-1 px-2 py-0.5 bg-secondary rounded-md text-2xs text-foreground hover:bg-secondary/80"
                >
                  Edit Code
                </button>
              )}
            </div>
          )}
          {!loading && !error && svg && (
            <div
              ref={containerRef}
              className="w-full"
              // Not user HTML: this is SVG produced by mermaid itself, and with
              // securityLevel 'strict' (set above) mermaid escapes every label
              // and emits no event handlers. Sanitising it with the rich-text
              // profile would strip the diagram, so the guarantee is enforced
              // at the render config instead.
              dangerouslySetInnerHTML={{ __html: svg }}
              style={{ maxHeight: '100%' }}
            />
          )}
          {!loading && !error && !svg && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50 p-4 text-center">
              <Code className="icon-xl opacity-30" />
              <p className="text-2xs">No diagram yet</p>
              {!readOnly && (
                <button
                  onMouseDown={(e) => { e.stopPropagation(); setShowCode(true); }}
                  className="px-2 py-1 bg-primary/10 text-primary-accessible rounded-md text-2xs hover:bg-primary/20"
                >
                  Write Mermaid code
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MERMAID_STARTERS: Record<string, string> = {
  flowchart: `flowchart TD
  A([Start]) --> B{Decision?}
  B -->|Yes| C[Process A]
  B -->|No| D[Process B]
  C --> E([End])
  D --> E`,

  sequence: `sequenceDiagram
  actor User
  participant App
  participant API
  User->>App: Action
  App->>API: Request
  API-->>App: Response
  App-->>User: Result`,

  mindmap: `mindmap
  root((Startup))
    Product
      MVP
      Roadmap
    Market
      TAM
      ICP
    Finance
      Revenue
      Burn Rate
    Team
      Founders
      Advisors`,

  gantt: `gantt
  title Project Roadmap
  dateFormat  YYYY-MM-DD
  section Phase 1
    MVP Design   :a1, 2024-01-01, 30d
    Development  :a2, after a1, 45d
  section Phase 2
    Beta Launch  :b1, after a2, 14d
    Fundraise    :b2, after b1, 60d`,

  journey: `journey
  title User Onboarding Journey
  section Discovery
    Visit landing page: 5: User
    Read features: 4: User
  section Sign Up
    Create account: 4: User, System
    Email verify: 3: User, System
  section Activation
    Complete profile: 3: User
    First project: 5: User, AI`,

  pie: `pie title Revenue Breakdown
  "SaaS Subscriptions" : 60
  "Enterprise Deals" : 25
  "Consulting" : 10
  "Partnerships" : 5`,

  erDiagram: `erDiagram
  STARTUP ||--o{ FOUNDER : "has"
  STARTUP ||--o{ INVESTOR : "raised from"
  FOUNDER ||--o{ PROJECT : "creates"
  INVESTOR ||--o{ INVESTMENT : "makes"`,
};
