'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendAIChat, getAgentIcon } from '@/lib/ai-api';
import { errorMessage } from '@/lib/utils';

interface AIQuickAskProps {
  agentId?: string;
  placeholder?: string;
  className?: string;
  onResponse?: (response: string) => void;
}

export function AIQuickAsk({
  agentId = 'general',
  placeholder = 'Ask AI anything...',
  className,
  onResponse,
}: AIQuickAskProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await sendAIChat({
        message: input,
        agentId,
      });
      setResponse(result.message);
      onResponse?.(result.message);
      setInput('');
    } catch (err: unknown) {
      setError(errorMessage(err) || 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  }, [input, agentId, isLoading, onResponse]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setResponse(null);
    setError(null);
    setInput('');
  }, []);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn('gap-1.5', className)}
      >
        <Sparkles className="icon-sm text-status-accent" />
        Ask AI
      </Button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-status-accent-bg border-b border-border">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <span>{getAgentIcon(agentId)}</span>
            Quick AI Ask
          </span>
          <button aria-label="Close"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="icon-sm" />
          </button>
        </div>

        {/* Response */}
        {response && (
          <div className="px-3 py-2 border-b border-border bg-muted/30 max-h-32 overflow-y-auto">
            <div className="text-sm">
              {response.split('**').map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2 text-xs text-destructive-accessible bg-destructive/10 border-b border-border">
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-2">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-8 text-sm border-0 bg-muted/50 focus-visible:outline-none focus-visible:ring-0"
              disabled={isLoading}
            />
            <Button aria-label="Send"
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="icon-sm animate-spin" />
              ) : (
                <Send className="icon-sm" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
