'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, AlignLeft,
  AlignCenter, AlignRight, Strikethrough, Quote, Code2, Undo2, Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  toolbarClassName?: string;
  disabled?: boolean;
  showWordCount?: boolean;
}

type ToolbarButton = {
  icon: React.ElementType;
  title: string;
  command: string;
  arg?: string;
  active?: () => boolean;
};

const TOOLBAR_GROUPS: ToolbarButton[][] = [
  [
    { icon: Bold, title: 'Bold (Ctrl+B)', command: 'bold' },
    { icon: Italic, title: 'Italic (Ctrl+I)', command: 'italic' },
    { icon: Underline, title: 'Underline (Ctrl+U)', command: 'underline' },
    { icon: Strikethrough, title: 'Strikethrough', command: 'strikeThrough' },
  ],
  [
    { icon: List, title: 'Bullet List', command: 'insertUnorderedList' },
    { icon: ListOrdered, title: 'Numbered List', command: 'insertOrderedList' },
    { icon: Quote, title: 'Blockquote', command: 'formatBlock', arg: 'blockquote' },
    { icon: Code2, title: 'Inline Code', command: 'formatBlock', arg: 'pre' },
  ],
  [
    { icon: AlignLeft, title: 'Align Left', command: 'justifyLeft' },
    { icon: AlignCenter, title: 'Align Center', command: 'justifyCenter' },
    { icon: AlignRight, title: 'Align Right', command: 'justifyRight' },
  ],
  [
    { icon: Undo2, title: 'Undo (Ctrl+Z)', command: 'undo' },
    { icon: Redo2, title: 'Redo (Ctrl+Y)', command: 'redo' },
  ],
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = 120,
  maxHeight = 500,
  className,
  toolbarClassName,
  disabled = false,
  showWordCount = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const isInternalChange = useRef(false);

  // Sync external value → editor (only when not focused to avoid cursor jump)
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isFocused) return;
    if (el.innerHTML !== value) {
      isInternalChange.current = true;
      el.innerHTML = value;
    }
  }, [value, isFocused]);

  const exec = useCallback((command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
  }, [disabled, onChange]);

  const handleInput = useCallback(() => {
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  const openLinkDialog = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      setSavedSelection(range.cloneRange());
      setLinkText(sel.toString());
    }
    setLinkUrl('');
    setLinkDialogOpen(true);
  };

  const insertLink = () => {
    if (!linkUrl) return;
    if (savedSelection) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection);
    }
    editorRef.current?.focus();
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    if (linkText) {
      exec('insertHTML', `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
    } else {
      exec('createLink', url);
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
    setSavedSelection(null);
  };

  const isActive = (command: string): boolean => {
    try { return document.queryCommandState(command); } catch { return false; }
  };

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  const wordCount = value
    ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
    : 0;

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className={cn('flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30', toolbarClassName)}>
        {TOOLBAR_GROUPS.map((group, gi) => (
          <span key={gi} className="flex items-center">
            {gi > 0 && <span className="w-px h-5 bg-border/60 mx-1" />}
            {group.map((btn) => (
              <button
                key={btn.command + (btn.arg ?? '')}
                title={btn.title}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); exec(btn.command, btn.arg); }}
                className={cn(
                  'p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  isActive(btn.command) && 'bg-accent text-accent-foreground',
                )}
              >
                <btn.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </span>
        ))}
        <span className="w-px h-5 bg-border/60 mx-1" />
        <button
          type="button"
          title="Insert Link"
          disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }}
          className="p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Link2 className="icon-sm" />
        </button>

        {showWordCount && (
          <span className="ml-auto text-xs text-muted-foreground pr-1">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        )}
      </div>

      {/* Editable area */}
      <div className="relative">
        {isEmpty && !isFocused && (
          <div className="absolute top-3 left-3 text-muted-foreground text-sm pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          style={{ minHeight, maxHeight, overflowY: 'auto' }}
          className={cn(
            'p-3 text-sm outline-none',
            'prose prose-sm max-w-none dark:prose-invert',
            '[&_a]:text-primary-accessible [&_a]:underline',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
            '[&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      </div>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription className="sr-only">{bilingualInline('Insert a link into the text.', 'Εισαγωγή συνδέσμου στο κείμενο.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="rte-f1" className="text-sm font-medium mb-1 block">URL</label>
              <Input id="rte-f1"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); }}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="rte-f2" className="text-sm font-medium mb-1 block">Link text (optional)</label>
              <Input id="rte-f2"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder={bilingualInline("Link text…", "Κείμενο συνδέσμου…")}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={insertLink}>Insert</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
