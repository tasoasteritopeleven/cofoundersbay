'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Dynamic import guard ──────────────────────────────────────────────
   tldraw is client-only. We lazy-import it so Next.js SSR never touches it.
   The CSS is also imported inside the effect to avoid SSR stylesheet errors.  */

type TldrawInstance = typeof import('tldraw');
let tldrawModule: TldrawInstance | null = null;
let tldrawLoadPromise: Promise<TldrawInstance> | null = null;

function loadTldraw(): Promise<TldrawInstance> {
  if (tldrawModule) return Promise.resolve(tldrawModule);
  if (!tldrawLoadPromise) {
    tldrawLoadPromise = import('tldraw').then((mod) => {
      tldrawModule = mod;
      return mod;
    });
  }
  return tldrawLoadPromise;
}

/* ─── Inner whiteboard — rendered only after tldraw loads ─────────────── */

interface InnerWhiteboardProps {
  width: number;
  height: number;
  content: string | null;
  readOnly: boolean;
  onChange?: (snapshot: string) => void;
  tldraw: TldrawInstance;
}

function InnerWhiteboard({ height, content, readOnly, onChange, tldraw }: InnerWhiteboardProps) {
  const { Tldraw } = tldraw;
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSnapshot = useRef<object | null>(null);

  if (!initialSnapshot.current && content) {
    try { initialSnapshot.current = JSON.parse(content); } catch {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    if (initialSnapshot.current) {
      try { editor.loadSnapshot?.(initialSnapshot.current); } catch {}
    }
    if (!onChange) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = editor.store.listen(() => {
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => {
        try {
          const snapshot = editor.store.getSnapshot();
          onChange(JSON.stringify(snapshot));
        } catch {}
      }, 800);
    });
    return unsubscribe;
  }, [onChange]);

  return (
    <div
      style={{ height }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tldraw
        hideUi={readOnly}
        onMount={handleMount}
      />
    </div>
  );
}

/* ─── Public component ─────────────────────────────────────────────────── */

interface WhiteboardNodeProps {
  width: number;
  height: number;
  content: string | null;
  isSelected: boolean;
  readOnly?: boolean;
  onChange?: (newContent: string) => void;
  onDelete?: () => void;
}

export function WhiteboardNode({
  width,
  height,
  content,
  isSelected,
  readOnly = false,
  onChange,
  onDelete,
}: WhiteboardNodeProps) {
  const [tldraw, setTldraw] = useState<TldrawInstance | null>(null);
  const [loadError, setLoadError] = useState(false);
  const toolbarH = 32;

  useEffect(() => {
    loadTldraw()
      .then(setTldraw)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 bg-card shadow-sm',
        isSelected && 'ring-2 ring-primary ring-offset-1',
      )}
      style={{ width, height, borderColor: '#06B6D480' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-1.5 px-2 shrink-0 border-b"
        style={{ height: toolbarH, background: '#06B6D410', borderColor: '#06B6D420' }}
      >
        <Pencil className="icon-sm shrink-0" style={{ color: '#06B6D4' }} />
        <span className="text-2xs font-bold uppercase tracking-wide flex-1" style={{ color: '#06B6D4' }}>
          Whiteboard
        </span>
        {!readOnly && (
          <button
            onMouseDown={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive-accessible transition-colors"
            title="Delete node"
          >
            <Trash2 className="icon-sm" />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ height: height - toolbarH }}>
        {loadError && (
          <div className="flex items-center justify-center h-full text-destructive/60 text-xs">
            Failed to load whiteboard
          </div>
        )}
        {!tldraw && !loadError && (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground/50">
            <Loader2 className="icon-sm animate-spin" />
            <span className="text-2xs">Loading whiteboard…</span>
          </div>
        )}
        {tldraw && (
          <InnerWhiteboard
            width={width}
            height={height - toolbarH}
            content={content}
            readOnly={readOnly}
            onChange={onChange}
            tldraw={tldraw}
          />
        )}
      </div>

      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-1 rounded-xl pointer-events-none z-10" />
      )}
    </div>
  );
}
