'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Check, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  listNodeComments,
  createNodeComment,
  updateNodeComment,
  deleteNodeComment,
  type ResearchComment,
} from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { RelativeTime } from '@/components/common/RelativeTime';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';

interface CommentsPanelProps {
  nodeId: string;
  nodeTitle?: string | null;
  currentUserId: string;
  onClose: () => void;
  className?: string;
}

function CommentBubble({
  comment,
  isOwn,
  onResolve,
  onDelete,
}: {
  comment: ResearchComment;
  isOwn: boolean;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={cn('group flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
        {comment.authorAvatar ? (
          <img src={comment.authorAvatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-2xs font-semibold text-primary-accessible">
            {(comment.authorName ?? 'U')[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className={cn('flex-1 max-w-[85%]', isOwn ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
        <div className={cn(
          'flex items-center gap-2 text-xs text-muted-foreground',
          isOwn ? 'flex-row-reverse' : 'flex-row',
        )}>
          <span className="font-medium">{comment.authorName}</span>
          <RelativeTime date={comment.createdAt} />
        </div>
        <div className={cn(
          'relative px-3 py-2 rounded-xl text-sm leading-relaxed',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-secondary text-foreground rounded-tl-sm',
          comment.resolved && 'surface-inactive',
        )}>
          {comment.body}
          {comment.resolved && (
            <span className="ml-2 text-xs opacity-70">✓ resolved</span>
          )}
        </div>
        <div className={cn(
          'flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
          isOwn ? 'flex-row-reverse' : 'flex-row',
        )}>
          {!comment.resolved && (
            <button
              onClick={() => onResolve(comment.id)}
              className="p-0.5 rounded text-muted-foreground hover:text-status-success transition-colors"
              title="Mark as resolved"
            >
              <Check className="icon-sm" />
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="p-0.5 rounded text-muted-foreground hover:text-destructive-accessible transition-colors"
              title="Delete comment"
            >
              <Trash2 className="icon-sm" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentsPanel({ nodeId, nodeTitle, currentUserId, onClose, className }: CommentsPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const { apiAvailable, pollInterval } = usePollingGuards();

  const { data, isLoading } = useQuery({
    queryKey: qk('research-boards', 'node-comments', nodeId),
    queryFn: () => listNodeComments(nodeId),
    enabled: apiAvailable && !!nodeId,
    refetchInterval: pollInterval(15_000),
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => createNodeComment(nodeId, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) });
      setDraft('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (commentId: string) => updateNodeComment(commentId, { resolved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteNodeComment(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) }),
  });

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(trimmed);
  }, [draft, createMutation]);

  const comments = data?.comments ?? [];
  const active = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);
  const displayed = showResolved ? comments : active;

  return (
    <div className={cn('flex flex-col bg-card border rounded-xl shadow-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageCircle className="icon-sm text-muted-foreground" />
          <span className="text-sm font-semibold truncate max-w-[180px]">
            {nodeTitle ? `Comments: ${nodeTitle}` : 'Comments'}
          </span>
          {active.length > 0 && (
            <span className="text-xs bg-primary/15 text-primary-accessible px-1.5 py-0.5 rounded-full font-medium">
              {active.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {resolved.length > 0 && (
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              {showResolved ? 'Hide resolved' : `+${resolved.length} resolved`}
            </button>
          )}
          <Button aria-label="Close comments" variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="icon-sm" />
          </Button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: '360px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="icon-md animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="icon-xl text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start the conversation below</p>
          </div>
        ) : (
          displayed.map((comment) => (
            <CommentBubble
              key={comment.id}
              comment={comment}
              isOwn={comment.authorId === currentUserId}
              onResolve={(id) => resolveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-card/60">
        <div className="flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={bilingualInline("Write a comment… (Enter to send)", "Γράψτε ένα σχόλιο… (Enter για αποστολή)")}
            className="flex-1 resize-none text-sm bg-secondary/50 border-0 rounded-xl px-3 py-2 outline-none min-h-[36px] max-h-[120px] placeholder:text-muted-foreground/60"
            rows={1}
            style={{ height: 'auto' }}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!draft.trim() || createMutation.isPending}
            className="h-9 w-9 p-0 shrink-0"
            aria-label={bilingualAria('Post comment', 'Δημοσίευση σχολίου')}
          >
            {createMutation.isPending
              ? <Loader2 className="icon-sm animate-spin" />
              : <Send className="icon-sm" />
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
