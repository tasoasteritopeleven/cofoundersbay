'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight,
  Highlighter, MessageSquare, Download, RotateCw,
  Type, Minus, Plus, X, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';

/* ─── Types ─── */
interface PdfHighlight {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  note?: string;
}

interface PdfAnnotationViewerProps {
  url: string;
  title?: string;
  onAnnotationsChange?: (annotations: PdfHighlight[]) => void;
  initialAnnotations?: PdfHighlight[];
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FDE047' },
  { name: 'Green', value: '#86EFAC' },
  { name: 'Blue', value: '#93C5FD' },
  { name: 'Pink', value: '#FDA4AF' },
  { name: 'Purple', value: '#C4B5FD' },
  { name: 'Orange', value: '#FDBA74' },
];

export function PdfAnnotationViewer({
  url,
  title,
  onAnnotationsChange,
  initialAnnotations = [],
}: PdfAnnotationViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<PdfHighlight[]>(initialAnnotations);
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [annotationMode, setAnnotationMode] = useState<'highlight' | 'note' | null>(null);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  // Track iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Page navigation
  const goToPage = useCallback((page: number) => {
    if (page < 1) return;
    if (totalPages && page > totalPages) return;
    setCurrentPage(page);
    // Navigate the iframe to the specific page using hash
    if (iframeRef.current) {
      iframeRef.current.src = `${url}#page=${page}`;
    }
  }, [url, totalPages]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setPdfZoom((z) => Math.min(300, z + 25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfZoom((z) => Math.max(50, z - 25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPdfZoom(100);
  }, []);

  // Add annotation
  const addAnnotation = useCallback((annotation: Omit<PdfHighlight, 'id'>) => {
    const newAnnotation: PdfHighlight = {
      ...annotation,
      id: crypto.randomUUID(),
    };
    setAnnotations((prev) => {
      const updated = [...prev, newAnnotation];
      onAnnotationsChange?.(updated);
      return updated;
    });
  }, [onAnnotationsChange]);

  // Remove annotation
  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      onAnnotationsChange?.(updated);
      return updated;
    });
  }, [onAnnotationsChange]);

  // Update annotation note
  const updateAnnotationNote = useCallback((id: string, note: string) => {
    setAnnotations((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, note } : a);
      onAnnotationsChange?.(updated);
      return updated;
    });
  }, [onAnnotationsChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(currentPage + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(currentPage - 1);
      if (e.key === '+' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleZoomIn(); }
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleZoomOut(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, goToPage, handleZoomIn, handleZoomOut]);

  const currentPageAnnotations = annotations.filter((a) => a.page === currentPage);

  return (
    <div className="flex flex-col h-full">
      {/* ── PDF Toolbar ── */}
      <div className="flex-none flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border gap-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="icon-sm" />
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) goToPage(val);
              }}
              className="w-12 h-7 text-center text-xs bg-secondary rounded-lg border border-border outline-none focus:border-primary/50 text-foreground"
              min={1}
              max={totalPages || undefined}
            />
            {totalPages && (
              <span className="text-2xs text-muted-foreground">/ {totalPages}</span>
            )}
          </div>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={totalPages !== null && currentPage >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="icon-sm" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Zoom out"
          >
            <Minus className="icon-sm" />
          </button>
          <span className="text-2xs text-muted-foreground min-w-[42px] text-center tabular-nums">
            {pdfZoom}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Zoom in"
          >
            <Plus className="icon-sm" />
          </button>
          <button
            onClick={handleZoomReset}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Reset zoom"
          >
            <Maximize2 className="icon-sm" />
          </button>
        </div>

        {/* Annotation tools */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAnnotationMode(annotationMode === 'highlight' ? null : 'highlight')}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded transition-colors',
              annotationMode === 'highlight'
                ? 'bg-status-warning/20 text-status-warning'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
            )}
            title="Highlight mode"
          >
            <Highlighter className="icon-sm" />
          </button>
          <button
            onClick={() => setAnnotationMode(annotationMode === 'note' ? null : 'note')}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded transition-colors',
              annotationMode === 'note'
                ? 'bg-status-info/20 text-status-info'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
            )}
            title="Add note"
          >
            <MessageSquare className="icon-sm" />
          </button>

          {/* Color picker (when in annotation mode) */}
          {annotationMode && (
            <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setActiveColor(c.value)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 transition-all hover:scale-110',
                    activeColor === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Annotation panel toggle */}
          <button
            onClick={() => setShowAnnotationPanel((v) => !v)}
            className={cn(
              'h-7 px-2 flex items-center gap-1 rounded-lg text-2xs font-medium transition-colors',
              showAnnotationPanel
                ? 'bg-primary/10 text-primary-accessible'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
            )}
          >
            <Type className="icon-sm" />
            {annotations.length > 0 && (
              <span className="text-2xs bg-primary/20 text-primary-accessible rounded-full px-1.5 py-0">{annotations.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 flex min-h-0">
        {/* PDF iframe */}
        <div className="flex-1 relative overflow-auto bg-muted/20">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="icon-xl text-primary-accessible animate-spin" />
                <span className="text-sm text-muted-foreground">Loading PDF…</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={`${url}#page=${currentPage}&zoom=${pdfZoom}`}
            title={title || 'PDF Document'}
            className="w-full h-full border-none"
            style={{ minHeight: '100%' }}
            onLoad={handleIframeLoad}
          />

          {/* Annotation mode indicator */}
          {annotationMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 border border-border shadow-lg">
              {annotationMode === 'highlight'
                ? <Highlighter className="icon-sm" style={{ color: activeColor }} />
                : <MessageSquare className="icon-sm text-status-info" />
              }
              <span className="text-2xs font-medium text-foreground">
                {annotationMode === 'highlight' ? 'Click and drag to highlight' : 'Click to add note'}
              </span>
              <button aria-label="Cancel annotation"
                onClick={() => setAnnotationMode(null)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-secondary"
              >
                <X className="icon-sm" />
              </button>
            </div>
          )}
        </div>

        {/* ── Annotation sidebar ── */}
        {showAnnotationPanel && (
          <div className="w-64 flex-none border-l border-border bg-card overflow-y-auto">
            <div className="p-3 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="icon-sm text-muted-foreground" />
                Annotations
                <span className="text-2xs text-muted-foreground ml-auto">{annotations.length}</span>
              </h3>
            </div>

            {annotations.length === 0 ? (
              <div className="p-4 text-center">
                <Highlighter className="icon-xl text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-2xs text-muted-foreground">No annotations yet.</p>
                <p className="text-2xs text-muted-foreground mt-1">
                  Use the highlight or note tool to annotate the PDF.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {annotations.map((a) => (
                  <div key={a.id} className="p-2.5 space-y-1.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: a.color }} />
                        <span className="text-2xs text-muted-foreground">Page {a.page}</span>
                      </div>
                      <button aria-label="Remove annotation"
                        onClick={() => removeAnnotation(a.id)}
                        className="w-4 h-4 flex items-center justify-center rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive-accessible transition-colors"
                      >
                        <X className="w-2.5 h-2.5" aria-hidden="true" />
                      </button>
                    </div>
                    <textarea
                      value={a.note || ''}
                      onChange={(e) => updateAnnotationNote(a.id, e.target.value)}
                      placeholder={bilingualInline("Add a note…", "Προσθήκη σημείωσης…")}
                      className="w-full bg-secondary/50 rounded-lg px-2 py-1.5 text-2xs text-foreground outline-none border border-transparent focus:border-primary/30 transition-colors resize-none leading-relaxed"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Quick add annotation button */}
            <div className="p-3 border-t border-border">
              <button
                onClick={() => {
                  addAnnotation({
                    page: currentPage,
                    x: 50,
                    y: 50,
                    width: 200,
                    height: 20,
                    color: activeColor,
                    note: '',
                  });
                }}
                className="w-full h-7 rounded-lg bg-primary/10 text-primary-accessible hover:bg-primary/20 text-2xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="icon-sm" />
                Add note for page {currentPage}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
