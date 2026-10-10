"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Upload, ZoomIn, ZoomOut, Maximize2, Trash2, FileText, ImageIcon,
  FileType, StickyNote, Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link2, RotateCcw, RotateCw, Download, Plus, Search,
  Layers, MoreHorizontal, Pin, Palette, Save, FolderPlus,
  Copy, Scissors, Grid3x3, Minimize2, History, Share2,
  GitBranch, MessageSquare, Sparkles, Layout, ArrowLeft,
  ArrowRight, Command, Undo2, Redo2, MousePointer2, Box,
  Trash, Eye, EyeOff, Lock, Unlock, Star, Bookmark,
  Filter, SortAsc, Tag, Folder, Archive, FileOutput,
  X, Check, AlertCircle, Info, ChevronDown, ChevronRight,
  Moon, Sun, Settings2, HelpCircle, Keyboard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useModalA11y } from "@/hooks/useModalA11y";
import { bilingualAria } from "@/lib/i18n/format";
import { SanitizedHtml } from '@/components/common/SanitizedHtml';
import { bilingualInline } from '@/lib/i18n/format';

/* ─── Types ──────────────────────────────────────────────────── */
type NodeType = "document" | "image" | "pdf" | "text" | "note" | "folder" | "link";

interface NodeColor {
  bg: string;
  border: string;
  icon: string;
  label: string;
  solid: string;
}

const NODE_COLORS: Record<string, NodeColor> = {
  blue:   { bg: "bg-card", border: "border-status-info-border",   icon: "text-status-info",   label: "Blue", solid: "hsl(221 90% 60%)" },
  purple: { bg: "bg-card", border: "border-status-accent-border", icon: "text-status-accent", label: "Purple", solid: "hsl(262 72% 60%)" },
  green:  { bg: "bg-card", border: "border-status-success-border",icon: "text-status-success",label: "Green", solid: "hsl(162 63% 45%)" },
  amber:  { bg: "bg-card", border: "border-status-warning-border",  icon: "text-status-warning",  label: "Amber", solid: "hsl(38 92% 55%)" },
  rose:   { bg: "bg-card", border: "border-status-danger-border",   icon: "text-status-danger",   label: "Rose", solid: "hsl(0 72% 55%)" },
  slate:  { bg: "bg-card", border: "border-border",  icon: "text-muted-foreground",  label: "Slate", solid: "hsl(220 9% 55%)" },
};

interface CanvasNodeData {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  url?: string;
  mimeType?: string;
  fileSize?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  colorKey: string;
  pinned?: boolean;
  locked?: boolean;
  hidden?: boolean;
  starred?: boolean;
  tags?: string[];
  connections?: string[];
  folderId?: string;
  comments?: NodeComment[];
  metadata?: Record<string, any>;
  createdAt?: number;
  updatedAt?: number;
}

interface NodeComment {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

interface CanvasConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
  style?: "solid" | "dashed" | "dotted";
}

interface CanvasState {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  folders: CanvasFolder[];
  version: number;
  timestamp: number;
}

interface CanvasFolder {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

interface HistoryState {
  state: CanvasState;
  action: string;
}

interface DragState {
  active: boolean;
  nodeId?: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
  startPanX: number;
  startPanY: number;
  mode: "pan" | "node" | "select";
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.12;
const AUTO_SAVE_DELAY = 2000;
const MAX_HISTORY = 50;

/* ─── Helpers ────────────────────────────────────────────────── */
function detectType(mimeType: string, name: string): NodeType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/") || name.endsWith(".md") || name.endsWith(".txt")) return "document";
  return "document";
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function nodeIcon(type: NodeType, colorKey: string, size = "w-5 h-5") {
  const col = NODE_COLORS[colorKey]?.icon ?? "text-primary-accessible";
  switch (type) {
    case "image":    return <ImageIcon className={cn(size, col)} />;
    case "pdf":      return <FileType className={cn(size, col)} />;
    case "note":     return <StickyNote className={cn(size, col)} />;
    case "text":     return <Type className={cn(size, col)} />;
    case "folder":   return <Folder className={cn(size, col)} />;
    case "link":     return <Link2 className={cn(size, col)} />;
    default:         return <FileText className={cn(size, col)} />;
  }
}

function genId() { 
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; 
}

function saveToLocalStorage(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save to localStorage", e);
  }
}

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

/* ─── RichTextEditor ─────────────────────────────────────────── */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

export function RichTextEditor({ value, onChange, readOnly = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  const exec = (command: string, val?: string, range?: Range) => {
    editorRef.current?.focus();
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
    const savedRange = range && editorRef.current?.contains(range.commonAncestorContainer) ? range : undefined;
    const url = window.prompt("Enter URL")?.trim();
    if (!url) return;
    try {
      const protocol = new URL(url, document.baseURI).protocol;
      if (protocol === "javascript:" || protocol === "data:") return;
    } catch {
      return;
    }
    exec("createLink", url, savedRange);
  };

  const ToolBtn = ({ cmd, val, title, children }: { cmd: string; val?: string; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!readOnly && (
        <div className="flex flex-wrap gap-0.5 p-2 border-b border-border bg-card sticky top-0 z-10">
          <ToolBtn cmd="undo" title="Undo"><RotateCcw className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="redo" title="Redo"><RotateCw className="icon-sm" /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1 self-center" />
          <ToolBtn cmd="bold" title="Bold"><Bold className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="italic" title="Italic"><Italic className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="underline" title="Underline"><Underline className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="strikeThrough" title="Strikethrough"><Strikethrough className="icon-sm" /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1 self-center" />
          <ToolBtn cmd="formatBlock" val="h2" title="Heading 1"><span className="text-2xs font-bold">H1</span></ToolBtn>
          <ToolBtn cmd="formatBlock" val="h3" title="Heading 2"><span className="text-2xs font-bold">H2</span></ToolBtn>
          <ToolBtn cmd="formatBlock" val="p" title="Paragraph"><span className="text-2xs">P</span></ToolBtn>
          <div className="w-px h-5 bg-border mx-1 self-center" />
          <ToolBtn cmd="insertUnorderedList" title="Bullet list"><List className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="insertOrderedList" title="Numbered list"><ListOrdered className="icon-sm" /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1 self-center" />
          <ToolBtn cmd="justifyLeft" title="Align left"><AlignLeft className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="justifyCenter" title="Align center"><AlignCenter className="icon-sm" /></ToolBtn>
          <ToolBtn cmd="justifyRight" title="Align right"><AlignRight className="icon-sm" /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1 self-center" />
          <button
            type="button"
            title="Insert link"
            aria-label={bilingualAria("Insert link", "Εισαγωγή συνδέσμου")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertLink}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="icon-sm" />
          </button>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder={bilingualInline("Start writing your research notes…", "Ξεκινήστε να γράφετε τις σημειώσεις έρευνας…")}
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        className={cn(
          "flex-1 p-4 outline-none overflow-y-auto text-sm text-foreground leading-relaxed",
          "prose prose-sm max-w-none",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5",
          "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
          "[&_a]:text-primary-accessible [&_a]:underline",
          !readOnly && "cursor-text"
        )}
      />
    </div>
  );
}

/* ─── DocumentViewer ─────────────────────────────────────────── */
interface DocumentViewerProps {
  node: CanvasNodeData;
  onClose: () => void;
  onSave: (id: string, content: string, title: string, tags?: string[]) => void;
}

function DocumentViewer({ node, onClose, onSave }: DocumentViewerProps) {
  const [editTitle, setEditTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [tags, setTags] = useState<string[]>(node.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saved, setSaved] = useState(true);
  const [imgZoom, setImgZoom] = useState(1);

  const handleSave = useCallback(() => {
    onSave(node.id, content, editTitle, tags);
    setSaved(true);
  }, [node.id, content, editTitle, tags, onSave]);

  useEffect(() => { setSaved(false); }, [content, editTitle, tags]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { 
        e.preventDefault(); 
        handleSave(); 
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, onClose]);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const isImage = node.type === "image";
  const isPdf = node.type === "pdf";
  const isText = node.type === "text" || node.type === "note";
  const isDoc = node.type === "document" && !isPdf && !isImage;
  const viewerRef = useModalA11y<HTMLDivElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Escape was handled by hand here; the rest of what a dialog owes a
          keyboard user was not. `useModalA11y` adds the semantics, the focus
          move, the trap and the scroll lock — it was written for exactly this
          kind of overlay, welded into a canvas with exit animations. */}
      <motion.div
        ref={viewerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Node viewer"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          isImage ? "max-w-5xl" : "max-w-4xl",
          "h-[90vh] w-full"
        )}
      >
        {/* Header */}
        <div className="flex-none px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex-none">{nodeIcon(node.type, node.colorKey, "w-5 h-5")}</div>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none truncate placeholder:text-muted-foreground"
              placeholder={bilingualInline("Untitled", "Χωρίς τίτλο")}
            />
            <div className="flex items-center gap-2 flex-none">
              {!saved && (
                <span className="text-2xs text-status-warning flex items-center gap-1">
                  <AlertCircle className="icon-sm" /> Unsaved
                </span>
              )}
              {(isText || isDoc) && (
                <button
                  onClick={handleSave}
                  className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <Save className="icon-sm" /> Save
                </button>
              )}
              {node.url && (
                <a
                  href={node.url}
                  download={node.title}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                  title="Download"
                >
                  <Download className="icon-sm" />
                </a>
              )}
              <button aria-label="Close"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
              >
                <X className="icon-sm" />
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary-accessible text-2xs font-medium"
              >
                <Tag className="icon-sm" />
                {tag}
                <button aria-label={`Remove ${tag}`}
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-primary/70 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder={bilingualInline("Add tag…", "Προσθήκη ετικέτας…")}
                className="h-6 px-2 rounded bg-secondary text-2xs outline-none placeholder:text-muted-foreground min-w-[80px]"
              />
              <button aria-label="Add tag"
                onClick={addTag}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10 hover:bg-primary/20 text-primary-accessible transition-colors"
              >
                <Plus className="icon-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto bg-background">
          {isImage && node.url && (
            <div className="flex flex-col items-center min-h-full p-4 gap-3">
              <div className="flex items-center gap-2">
                <button aria-label="Zoom out" onClick={() => setImgZoom(z => Math.max(0.2, z - 0.15))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors">
                  <ZoomOut className="icon-sm" />
                </button>
                <span className="text-xs text-muted-foreground min-w-[44px] text-center">{Math.round(imgZoom * 100)}%</span>
                <button aria-label="Zoom in" onClick={() => setImgZoom(z => Math.min(4, z + 0.15))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors">
                  <ZoomIn className="icon-sm" />
                </button>
                <button aria-label="Reset zoom" onClick={() => setImgZoom(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors">
                  <Maximize2 className="icon-sm" />
                </button>
              </div>
              <div className="overflow-auto flex-1 flex items-start justify-center w-full">
                <img
                  src={node.url}
                  alt={node.title}
                  style={{ transform: `scale(${imgZoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
                  className="max-w-full rounded-lg shadow-md"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {isPdf && node.url && (
            <iframe
              src={node.url}
              title={node.title}
              className="w-full h-full border-none"
              style={{ minHeight: "75vh" }}
            />
          )}

          {(isText || isDoc) && (
            <RichTextEditor
              value={content}
              onChange={(html) => { setContent(html); setSaved(false); }}
            />
          )}

          {!isImage && !isPdf && !isText && !isDoc && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="w-16 h-16 opacity-20" />
              <p className="text-sm">Preview not available for this file type.</p>
              {node.url && (
                <a href={node.url} download={node.title}
                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                  <Download className="icon-sm" /> Download
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer with metadata */}
        <div className="flex-none px-4 py-2 border-t border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>
              {node.createdAt && `Created ${new Date(node.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}`}
            </span>
            {node.fileSize && <span>{fmtSize(node.fileSize)}</span>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Canvas Component ──────────────────────────────────── */
export default function ResearchCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectionCanvasRef = useRef<HTMLCanvasElement>(null);

  // Core state
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [folders, setFolders] = useState<CanvasFolder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewerNode, setViewerNode] = useState<CanvasNodeData | null>(null);
  
  // Transform state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  // UI state
  const [dragState, setDragState] = useState<DragState>({
    active: false,
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0,
    startPanX: 0,
    startPanY: 0,
    mode: "pan"
  });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useModalA11y<HTMLDivElement>(showShortcuts, () => setShowShortcuts(false));
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Connection drawing
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);

  /* ─── Initialization & Auto-save ──────────────────────────── */
  useEffect(() => {
    const saved = loadFromLocalStorage<CanvasState>("research-canvas-v1", {
      nodes: [],
      connections: [],
      folders: [
        { id: "f1", name: "Research Papers", color: "blue" },
        { id: "f2", name: "Ideas", color: "purple" },
        { id: "f3", name: "References", color: "green" }
      ],
      version: 1,
      timestamp: Date.now()
    });
    setNodes(saved.nodes);
    setConnections(saved.connections);
    setFolders(saved.folders);
  }, []);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      const state: CanvasState = {
        nodes,
        connections,
        folders,
        version: 1,
        timestamp: Date.now()
      };
      saveToLocalStorage("research-canvas-v1", state);
    }, AUTO_SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [nodes, connections, folders]);

  /* ─── History Management ───────────────────────────────────── */
  const pushToHistory = useCallback((state: CanvasState, action: string) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ state, action });
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1].state;
      setNodes(prevState.nodes);
      setConnections(prevState.connections);
      setFolders(prevState.folders);
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1].state;
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setFolders(nextState.folders);
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, history]);

  /* ─── Node Operations ──────────────────────────────────────── */
  const createNode = useCallback((type: NodeType, x: number, y: number, data?: Partial<CanvasNodeData>) => {
    const node: CanvasNodeData = {
      id: genId(),
      type,
      title: data?.title || "New " + type,
      content: data?.content || "",
      x,
      y,
      width: data?.width || 280,
      height: data?.height || 200,
      colorKey: data?.colorKey || "blue",
      url: data?.url,
      mimeType: data?.mimeType,
      fileSize: data?.fileSize,
      tags: data?.tags || [],
      connections: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...data
    };
    setNodes(prev => [...prev, node]);
    pushToHistory({ nodes: [...nodes, node], connections, folders, version: 1, timestamp: Date.now() }, "Create Node");
    return node;
  }, [nodes, connections, folders, pushToHistory]);

  const updateNode = useCallback((id: string, updates: Partial<CanvasNodeData>) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n);
      pushToHistory({ nodes: updated, connections, folders, version: 1, timestamp: Date.now() }, "Update Node");
      return updated;
    });
  }, [connections, folders, pushToHistory]);

  const deleteNodes = useCallback((ids: string[]) => {
    setNodes(prev => {
      const filtered = prev.filter(n => !ids.includes(n.id));
      pushToHistory({ nodes: filtered, connections, folders, version: 1, timestamp: Date.now() }, "Delete Nodes");
      return filtered;
    });
    setConnections(prev => prev.filter(c => !ids.includes(c.from) && !ids.includes(c.to)));
    setSelected(new Set());
  }, [connections, folders, pushToHistory]);

  const duplicateNodes = useCallback((ids: string[]) => {
    const toDuplicate = nodes.filter(n => ids.includes(n.id));
    const duplicated = toDuplicate.map(n => ({
      ...n,
      id: genId(),
      x: n.x + 30,
      y: n.y + 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
    setNodes(prev => [...prev, ...duplicated]);
    pushToHistory({ nodes: [...nodes, ...duplicated], connections, folders, version: 1, timestamp: Date.now() }, "Duplicate Nodes");
  }, [nodes, connections, folders, pushToHistory]);

  /* ─── Connection Operations ────────────────────────────────── */
  const startConnection = useCallback((nodeId: string) => {
    setConnectionStart(nodeId);
  }, []);

  const completeConnection = useCallback((toId: string) => {
    if (!connectionStart || connectionStart === toId) {
      setConnectionStart(null);
      return;
    }
    const conn: CanvasConnection = {
      id: genId(),
      from: connectionStart,
      to: toId,
      color: "slate",
      style: "solid"
    };
    setConnections(prev => [...prev, conn]);
    setConnectionStart(null);
    setTempConnection(null);
    pushToHistory({ nodes, connections: [...connections, conn], folders, version: 1, timestamp: Date.now() }, "Create Connection");
  }, [connectionStart, nodes, connections, folders, pushToHistory]);

  /* ─── File Upload ───────────────────────────────────────────── */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        const type = detectType(file.type, file.name);
        createNode(type, 100 + idx * 50, 100 + idx * 50, {
          title: file.name,
          url,
          mimeType: file.type,
          fileSize: file.size,
          content: type === "text" || type === "document" ? "" : url
        });
      };
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("text/")) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
    e.target.value = "";
  }, [createNode]);

  /* ─── Mouse/Touch Handlers ──────────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement> | React.MouseEvent<HTMLElement>, nodeId?: string) => {
    if ('button' in e && e.button === 2) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    if (nodeId) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      if (e.shiftKey) {
        setSelected(prev => {
          const next = new Set(prev);
          if (next.has(nodeId)) next.delete(nodeId);
          else next.add(nodeId);
          return next;
        });
        return;
      }

      if (!selected.has(nodeId)) setSelected(new Set([nodeId]));

      setDragState({
        active: true,
        nodeId,
        startMouseX: mouseX,
        startMouseY: mouseY,
        startNodeX: node.x,
        startNodeY: node.y,
        startPanX: panX,
        startPanY: panY,
        mode: "node"
      });
    } else {
      if (e.shiftKey) {
        const canvasX = (mouseX - rect.left - panX) / zoom;
        const canvasY = (mouseY - rect.top - panY) / zoom;
        setSelectionBox({ startX: canvasX, startY: canvasY, currentX: canvasX, currentY: canvasY });
        setDragState({
          active: true,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startNodeX: 0,
          startNodeY: 0,
          startPanX: panX,
          startPanY: panY,
          mode: "select"
        });
      } else {
        setSelected(new Set());
        setDragState({
          active: true,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startNodeX: 0,
          startNodeY: 0,
          startPanX: panX,
          startPanY: panY,
          mode: "pan"
        });
      }
    }
  }, [nodes, selected, panX, panY, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.active) {
      if (connectionStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setTempConnection({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      return;
    }

    const dx = e.clientX - dragState.startMouseX;
    const dy = e.clientY - dragState.startMouseY;

    if (dragState.mode === "node" && dragState.nodeId) {
      const newX = dragState.startNodeX + dx / zoom;
      const newY = dragState.startNodeY + dy / zoom;
      
      if (selected.size > 1 && selected.has(dragState.nodeId)) {
        const deltaX = newX - dragState.startNodeX;
        const deltaY = newY - dragState.startNodeY;
        setNodes(prev => prev.map(n => 
          selected.has(n.id) ? { ...n, x: n.x + deltaX, y: n.y + deltaY } : n
        ));
        setDragState(prev => ({ ...prev, startNodeX: newX, startNodeY: newY, startMouseX: e.clientX, startMouseY: e.clientY }));
      } else {
        updateNode(dragState.nodeId, { x: newX, y: newY });
      }
    } else if (dragState.mode === "pan") {
      setPanX(dragState.startPanX + dx);
      setPanY(dragState.startPanY + dy);
    } else if (dragState.mode === "select" && selectionBox && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - panX) / zoom;
      const canvasY = (e.clientY - rect.top - panY) / zoom;
      setSelectionBox(prev => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
    }
  }, [dragState, selected, zoom, panX, panY, updateNode, selectionBox, connectionStart]);

  const handleMouseUp = useCallback(() => {
    if (dragState.mode === "select" && selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.currentX);
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
      const minY = Math.min(selectionBox.startY, selectionBox.currentY);
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

      const inBox = nodes.filter(n => 
        n.x >= minX && n.x + (n.width || 280) <= maxX &&
        n.y >= minY && n.y + (n.height || 200) <= maxY
      ).map(n => n.id);
      
      setSelected(new Set(inBox));
      setSelectionBox(null);
    }
    
    setDragState({
      active: false,
      startMouseX: 0,
      startMouseY: 0,
      startNodeX: 0,
      startNodeY: 0,
      startPanX: 0,
      startPanY: 0,
      mode: "pan"
    });
  }, [dragState, selectionBox, nodes]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement> | React.MouseEvent<HTMLElement>, nodeId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  /* ─── Zoom ───────────────────────────────────────────────────── */
  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      if (centerX !== undefined && centerY !== undefined && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;
        const factor = next / prev;
        setPanX(p => mouseX - (mouseX - p) * factor);
        setPanY(p => mouseY - (mouseY - p) * factor);
      }
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(delta, e.clientX, e.clientY);
    }
  }, [handleZoom]);

  /* ─── Keyboard Shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        deleteNodes(Array.from(selected));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        if (selected.size > 0) duplicateNodes(Array.from(selected));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setSelected(new Set(nodes.map(n => n.id)));
      }
      if (e.key === "Escape") {
        setSelected(new Set());
        setConnectionStart(null);
        setTempConnection(null);
        setContextMenu(null);
      }
      if (selected.size > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setNodes(prev => prev.map(n => 
          selected.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
        ));
      }
      if (e.key === "?" && e.shiftKey) {
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, undo, redo, deleteNodes, duplicateNodes, nodes]);

  /* ─── Export/Import ──────────────────────────────────────────── */
  const exportCanvas = useCallback(() => {
    const state: CanvasState = { nodes, connections, folders, version: 1, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-canvas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, connections, folders]);

  const importCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const state = JSON.parse(ev.target?.result as string) as CanvasState;
          setNodes(state.nodes);
          setConnections(state.connections);
          setFolders(state.folders || []);
          pushToHistory(state, "Import");
        } catch (err) {
          console.error("Failed to import", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [pushToHistory]);

  /* ─── Draw Connections ───────────────────────────────────────── */
  useEffect(() => {
    const canvas = connectionCanvasRef.current;
    if (!canvas || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    connections.forEach(conn => {
      const from = nodes.find(n => n.id === conn.from);
      const to = nodes.find(n => n.id === conn.to);
      if (!from || !to) return;
      
      const x1 = from.x * zoom + panX + ((from.width || 280) * zoom) / 2;
      const y1 = from.y * zoom + panY + ((from.height || 200) * zoom) / 2;
      const x2 = to.x * zoom + panX + ((to.width || 280) * zoom) / 2;
      const y2 = to.y * zoom + panY + ((to.height || 200) * zoom) / 2;
      
      ctx.strokeStyle = NODE_COLORS[conn.color || "slate"]?.solid || "#64748b";
      ctx.lineWidth = 2;
      if (conn.style === "dashed") ctx.setLineDash([5, 5]);
      else if (conn.style === "dotted") ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLen = 10;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowLen * Math.cos(angle - Math.PI / 6), y2 - arrowLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowLen * Math.cos(angle + Math.PI / 6), y2 - arrowLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    });
    
    if (tempConnection && connectionStart) {
      const from = nodes.find(n => n.id === connectionStart);
      if (from) {
        const x1 = from.x * zoom + panX + ((from.width || 280) * zoom) / 2;
        const y1 = from.y * zoom + panY + ((from.height || 200) * zoom) / 2;
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(tempConnection.x, tempConnection.y);
        ctx.stroke();
      }
    }
  }, [nodes, connections, zoom, panX, panY, tempConnection, connectionStart]);

  /* ─── Filtered Nodes ─────────────────────────────────────────── */
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.content.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterFolder) {
      result = result.filter(n => n.folderId === filterFolder);
    }
    return result.filter(n => !n.hidden);
  }, [nodes, searchQuery, filterFolder]);

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex-none px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="icon-md text-muted-foreground" />
            Research Canvas
          </h1>
          <span className="text-xs text-muted-foreground">
            {nodes.length} nodes · {connections.length} connections
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={bilingualInline("Search nodes…", "Αναζήτηση κόμβων…")}
              className="h-8 pl-8 pr-3 rounded-lg bg-secondary text-sm outline-none placeholder:text-muted-foreground min-w-[200px]"
            />
          </div>

          <select
            value={filterFolder || ""}
            onChange={(e) => setFilterFolder(e.target.value || null)}
            className="h-8 px-3 rounded-lg bg-secondary text-sm outline-none"
          >
            <option value="">All folders</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <div className="w-px h-5 bg-border" />

          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="icon-sm" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="icon-sm" />
          </button>

          <div className="w-px h-5 bg-border" />

          <button
            onClick={() => handleZoom(-ZOOM_STEP)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="icon-sm" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom(ZOOM_STEP)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="icon-sm" />
          </button>
          <button
            onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Reset view"
            aria-label="Reset view"
          >
            <Maximize2 className="icon-sm" />
          </button>

          <div className="w-px h-5 bg-border" />

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
              showGrid ? "bg-primary/10 text-primary-accessible" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
            )}
            title="Toggle grid"
          >
            <Grid3x3 className="icon-sm" />
          </button>
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
              showMinimap ? "bg-primary/10 text-primary-accessible" : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
            )}
            title="Toggle minimap"
          >
            <Layout className="icon-sm" />
          </button>

          <div className="w-px h-5 bg-border" />

          <button
            onClick={() => createNode("note", 100, 100)}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="icon-sm" /> Note
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Upload className="icon-sm" /> Upload
          </button>

          <div className="w-px h-5 bg-border" />

          <button
            onClick={exportCanvas}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Export canvas"
          >
            <Download className="icon-sm" />
          </button>
          <button
            onClick={importCanvas}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Import canvas"
          >
            <FileOutput className="icon-sm" />
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="icon-sm" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => handleMouseDown(e)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {showGrid && (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
              backgroundPosition: `${panX}px ${panY}px`
            }}
          />
        )}

        <canvas
          ref={connectionCanvasRef}
          className="absolute inset-0 pointer-events-none"
        />

        {filteredNodes.map(node => {
          const colorConf = NODE_COLORS[node.colorKey] || NODE_COLORS.blue;
          const isSelected = selected.has(node.id);
          
          return (
            <motion.div
              key={node.id}
              layout
              className={cn(
                "absolute rounded-xl border-2 shadow-lg overflow-hidden flex flex-col cursor-move transition-shadow",
                colorConf.bg,
                colorConf.border,
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl"
              )}
              style={{
                left: `${node.x * zoom + panX}px`,
                top: `${node.y * zoom + panY}px`,
                width: `${(node.width || 280) * zoom}px`,
                height: `${(node.height || 200) * zoom}px`
              }}
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, node.id); }}
              onDoubleClick={() => setViewerNode(node)}
              onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, node.id); }}
            >
              <div className="flex-none px-3 py-2 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {nodeIcon(node.type, node.colorKey, "w-4 h-4 flex-none")}
                  <span className="text-sm font-medium text-foreground truncate">
                    {node.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-none">
                  {node.pinned && <Pin className="icon-sm text-muted-foreground" />}
                  {node.starred && <Star className="icon-sm text-status-warning" fill="currentColor" />}
                  {node.locked && <Lock className="icon-sm text-muted-foreground" />}
                </div>
              </div>

              <div className="flex-1 p-3 overflow-hidden text-xs text-muted-foreground leading-relaxed">
                {node.type === "image" && node.url && (
                  <img src={node.url} alt={node.title} className="w-full h-full object-cover rounded" />
                )}
                {node.type === "pdf" && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <FileType className={cn("w-10 h-10", colorConf.icon)} />
                    <span className="text-2xs">PDF Document</span>
                  </div>
                )}
                {(node.type === "note" || node.type === "text" || node.type === "document") && (
                  <SanitizedHtml
                    className="prose prose-sm max-w-none line-clamp-6"
                    html={node.content || "<p class='text-muted-foreground/40'>Empty note...</p>"}
                  />
                )}
              </div>

              {node.tags && node.tags.length > 0 && (
                <div className="flex flex-none flex-wrap gap-x-2 border-t border-border px-3 py-1.5">
                  {node.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-2xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                  {node.tags.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-2xs text-muted-foreground">
                      +{node.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {!connectionStart && (
                <button
                  onClick={(e) => { e.stopPropagation(); startConnection(node.id); }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity shadow-md"
                  title="Create connection"
                >
                  <GitBranch className="icon-sm" />
                </button>
              )}
              {connectionStart && connectionStart !== node.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); completeConnection(node.id); }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-status-success-mark text-ink flex items-center justify-center shadow-md animate-pulse"
                  title="Complete connection"
                >
                  <Check className="icon-sm" />
                </button>
              )}
            </motion.div>
          );
        })}

        {selectionBox && (
          <div
            className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
            style={{
              left: `${Math.min(selectionBox.startX, selectionBox.currentX) * zoom + panX}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY) * zoom + panY}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX) * zoom}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY) * zoom}px`
            }}
          />
        )}
      </div>

      {showMinimap && nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 w-48 h-32 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="relative w-full h-full">
            {nodes.map(n => {
              const minX = Math.min(...nodes.map(x => x.x));
              const maxX = Math.max(...nodes.map(x => x.x + (x.width || 280)));
              const minY = Math.min(...nodes.map(x => x.y));
              const maxY = Math.max(...nodes.map(x => x.y + (x.height || 200)));
              const rangeX = maxX - minX || 1;
              const rangeY = maxY - minY || 1;
              const mapX = ((n.x - minX) / rangeX) * 100;
              const mapY = ((n.y - minY) / rangeY) * 100;
              const mapW = ((n.width || 280) / rangeX) * 100;
              const mapH = ((n.height || 200) / rangeY) * 100;
              
              return (
                <div
                  key={n.id}
                  className={cn(
                    "absolute rounded border",
                    NODE_COLORS[n.colorKey]?.border || "border-border",
                    selected.has(n.id) ? "bg-primary/30" : "bg-secondary/50"
                  )}
                  style={{
                    left: `${mapX}%`,
                    top: `${mapY}%`,
                    width: `${mapW}%`,
                    height: `${mapH}%`
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md"
        className="hidden"
        onChange={handleFileUpload}
      />

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 w-56 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
          >
            {contextMenu.nodeId ? (
              <>
                <button
                  onClick={() => { setViewerNode(nodes.find(n => n.id === contextMenu.nodeId) || null); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Eye className="icon-sm" /> Open
                </button>
                <button
                  onClick={() => { duplicateNodes([contextMenu.nodeId!]); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Copy className="icon-sm" /> Duplicate
                </button>
                <button
                  onClick={() => { updateNode(contextMenu.nodeId!, { pinned: !nodes.find(n => n.id === contextMenu.nodeId)?.pinned }); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Pin className="icon-sm" /> {nodes.find(n => n.id === contextMenu.nodeId)?.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  onClick={() => { updateNode(contextMenu.nodeId!, { starred: !nodes.find(n => n.id === contextMenu.nodeId)?.starred }); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Star className="icon-sm" /> {nodes.find(n => n.id === contextMenu.nodeId)?.starred ? "Unstar" : "Star"}
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => { deleteNodes([contextMenu.nodeId!]); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive-accessible transition-colors flex items-center gap-2"
                >
                  <Trash className="icon-sm" /> Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { createNode("note", (contextMenu.x - panX) / zoom, (contextMenu.y - panY) / zoom); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <StickyNote className="icon-sm" /> New Note
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); setContextMenu(null); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center gap-2"
                >
                  <Upload className="icon-sm" /> Upload File
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewerNode && (
          <DocumentViewer
            node={viewerNode}
            onClose={() => setViewerNode(null)}
            onSave={(id, content, title, tags) => {
              updateNode(id, { content, title, tags });
              setViewerNode(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              ref={shortcutsRef}
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Keyboard className="icon-md text-muted-foreground" />
                  Keyboard Shortcuts
                </h2>
                <button aria-label="Close shortcuts"
                  onClick={() => setShowShortcuts(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="icon-sm" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                {[
                  { keys: ["Ctrl/⌘", "Z"], desc: "Undo" },
                  { keys: ["Ctrl/⌘", "Y"], desc: "Redo" },
                  { keys: ["Ctrl/⌘", "A"], desc: "Select all" },
                  { keys: ["Ctrl/⌘", "D"], desc: "Duplicate selection" },
                  { keys: ["Delete"], desc: "Delete selection" },
                  { keys: ["Shift", "Click"], desc: "Multi-select" },
                  { keys: ["Shift", "Drag"], desc: "Box select" },
                  { keys: ["Arrow keys"], desc: "Move selected" },
                  { keys: ["Shift", "Arrow"], desc: "Move 10px" },
                  { keys: ["Ctrl/⌘", "Scroll"], desc: "Zoom" },
                  { keys: ["Esc"], desc: "Clear selection" },
                  { keys: ["?"], desc: "Show shortcuts" }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <span className="text-sm text-muted-foreground">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <kbd key={j} className="px-2 py-1 text-xs font-mono bg-secondary border border-border rounded">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-none px-4 py-2 border-t border-border bg-card/30 backdrop-blur-sm flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{filteredNodes.length} nodes visible</span>
          {selected.size > 0 && <span className="text-primary-accessible">{selected.size} selected</span>}
          {connectionStart && <span className="text-status-warning">Drawing connection...</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Pan: {Math.round(panX)}, {Math.round(panY)}</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>History: {historyIndex + 1}/{history.length}</span>
        </div>
      </div>
    </div>
  );
}
