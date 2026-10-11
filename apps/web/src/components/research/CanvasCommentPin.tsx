'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, X, Send, CheckCircle2, ChevronDown,
  ChevronRight, Loader2, CornerDownRight, Pin,
} from 'lucide-react';
import { cn, initialsOf } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { bilingualInline } from '@/lib/i18n/format';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanvasComment {
  id: string;
  nodeId: string;
  authorId: string;
  body: string;
  commentType: 'general' | 'suggestion' | 'question' | 'resolved' | 'pin';
  resolved: boolean;
  posX?: number;
  posY?: number;
  parentId?: string | null;
  replies?: CanvasComment[];
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function listNodeComments(nodeId: string): Promise<CanvasComment[]> {
  const result = await apiRequest<{ comments?: CanvasComment[] }>(
    `/api/research/nodes/${nodeId}/comments`,
  );
  return result?.comments ?? [];
}

async function createComment(
  nodeId: string,
  body: string,
  opts?: { posX?: number; posY?: number; commentType?: string; parentId?: string },
): Promise<CanvasComment> {
  const result = await apiRequest<{ comment?: CanvasComment }>(
    `/api/research/nodes/${nodeId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({
        body,
        commentType: opts?.commentType ?? 'pin',
        posX: opts?.posX,
        posY: opts?.posY,
        parentId: opts?.parentId,
      }),
    },
  );
  if (!result?.comment) throw new Error('Failed to add comment');
  return result.comment;
}

async function resolveComment(commentId: string): Promise<CanvasComment> {
  const result = await apiRequest<{ comment?: CanvasComment }>(
    `/api/research/comments/${commentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ resolved: true }),
    },
  );
  if (!result?.comment) throw new Error('Failed to resolve comment');
  return result.comment;
}

// ── Helpers ────────────────────────────────────────────────────────────────────


function typeColor(type: string) {
  switch (type) {
    case 'suggestion': return 'bg-status-accent-mark';
    case 'question':   return 'bg-status-info-mark';
    case 'resolved':   return 'bg-status-success-mark';
    default:           return 'bg-primary';
  }
}

// ── Single Pin Popover ──────────────────────────────────────────────────────────

interface PinPopoverProps {
  comment: CanvasComment;
  zoom: number;
  onResolve: (id: string) => void;
  onReply: (parentId: string, body: string) => void;
}

function PinPopover({ comment, zoom, onResolve, onReply }: PinPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const replies = comment.replies ?? [];
  const pinBg = comment.resolved ? 'bg-status-success-mark' : typeColor(comment.commentType);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSubmittingReply(true);
    try {
      await onReply(comment.id, replyBody.trim());
      setReplyBody('');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="relative" style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}>
      {/* Pin icon */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shadow-md',
          'border-2 border-white transition-transform hover:scale-110',
          pinBg,
          open && 'ring-2 ring-offset-1 ring-primary',
        )}
        title={comment.body}
      >
        {comment.resolved
          ? <CheckCircle2 className="icon-sm text-ink" />
          : <MessageSquare className="icon-sm text-ink" />
        }
      </button>

      {/* Reply count badge */}
      {replies.length > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 bg-primary text-primary-foreground text-2xs font-bold rounded-full flex items-center justify-center shadow">
          {replies.length}
        </span>
      )}

      {/* Popover */}
      {open && (
        <div
          className="absolute left-8 top-0 z-50 w-64 bg-card border border-border rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-2 p-3 border-b border-border">
            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
              <AvatarImage src={comment.author?.avatarUrl} />
              <AvatarFallback className="text-2xs">
                {initialsOf(comment.author?.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium truncate">
                  {comment.author?.displayName ?? 'Anonymous'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-2xs text-muted-foreground"><RelativeTime date={comment.createdAt} short /></span>
                  <Button aria-label="Close"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                    onClick={() => setOpen(false)}
                  >
                    <X className="icon-sm" />
                  </Button>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn('text-2xs px-1 py-0 mt-0.5 capitalize', {
                  'border-status-accent-border text-status-accent': comment.commentType === 'suggestion',
                  'border-status-info-border text-status-info': comment.commentType === 'question',
                  'border-status-success-border text-status-success': comment.resolved,
                })}
              >
                {comment.resolved ? 'resolved' : comment.commentType}
              </Badge>
            </div>
          </div>

          {/* Body */}
          <div className="p-3">
            <p className="text-xs text-foreground whitespace-pre-wrap">{comment.body}</p>
          </div>

          {/* Replies */}
          {replies.length > 0 && (
            <div className="border-t border-border px-3 py-1.5">
              <button
                className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowReplies((v) => !v)}
              >
                {showReplies
                  ? <ChevronDown className="icon-sm" />
                  : <ChevronRight className="icon-sm" />
                }
                {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
              </button>
              {showReplies && (
                <div className="mt-1.5 space-y-2">
                  {replies.map((r) => (
                    <div key={r.id} className="flex gap-1.5">
                      <CornerDownRight className="icon-sm text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-2xs font-medium">{r.author?.displayName ?? 'User'}</span>
                        <p className="text-2xs text-muted-foreground">{r.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-border p-2 space-y-2">
            {/* Reply input */}
            <div className="flex gap-1.5">
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={bilingualInline("Reply…", "Απάντηση…")}
                rows={1}
                className="text-2xs min-h-0 py-1.5 px-2 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <Button
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={handleReply}
                disabled={submittingReply || !replyBody.trim()}
                aria-label={bilingualAria('Send reply', 'Αποστολή απάντησης')}
              >
                {submittingReply
                  ? <Loader2 className="icon-sm animate-spin" />
                  : <Send className="icon-sm" />
                }
              </Button>
            </div>

            {/* Resolve */}
            {!comment.resolved && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-2xs text-status-success border-status-success-border hover:bg-status-success-bg"
                onClick={() => { onResolve(comment.id); setOpen(false); }}
              >
                <CheckCircle2 className="icon-sm mr-1.5" />
                Resolve
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CanvasCommentPins ──────────────────────────────────────────────────────

interface CanvasCommentPinsProps {
  nodeId: string;
  zoom: number;
  nodeWidth?: number;
  nodeHeight?: number;
  enabled?: boolean;
  placingPin?: boolean;
  onPinPlaced?: () => void;
}

export function CanvasCommentPins({
  nodeId,
  zoom,
  nodeWidth = 280,
  nodeHeight = 200,
  enabled = true,
  placingPin = false,
  onPinPlaced,
}: CanvasCommentPinsProps) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [newPinBody, setNewPinBody] = useState('');
  const [newPinType, setNewPinType] = useState<'general' | 'suggestion' | 'question'>('general');
  const [submitting, setSubmitting] = useState(false);
  const { apiAvailable, pollInterval } = usePollingGuards();

  const { data, isLoading } = useQuery({
    queryKey: qk('research-boards', 'node-comments', nodeId),
    queryFn: () => listNodeComments(nodeId),
    enabled: enabled && !!nodeId && apiAvailable,
    refetchInterval: pollInterval(30_000),
    refetchIntervalInBackground: false,
    retry: 0,
  });

  const comments: CanvasComment[] = (data ?? []).filter(
    (c) => c.posX !== undefined && c.posX !== null,
  );

  // Group comments into threaded structure
  const topLevel = comments.filter((c) => !c.parentId);
  const byParent: Record<string, CanvasComment[]> = {};
  for (const c of comments) {
    if (c.parentId) {
      if (!byParent[c.parentId]) byParent[c.parentId] = [];
      byParent[c.parentId].push(c);
    }
  }
  const threaded = topLevel.map((c) => ({ ...c, replies: byParent[c.id] ?? [] }));

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!placingPin) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / zoom / nodeWidth) * 100;
    const y = ((e.clientY - rect.top) / zoom / nodeHeight) * 100;
    setPendingPin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  const handleSubmitPin = async () => {
    if (!pendingPin || !newPinBody.trim()) return;
    setSubmitting(true);
    try {
      await createComment(nodeId, newPinBody.trim(), {
        posX: pendingPin.x,
        posY: pendingPin.y,
        commentType: newPinType,
      });
      success('Comment pinned');
      setPendingPin(null);
      setNewPinBody('');
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) });
      onPinPlaced?.();
    } catch {
      showError('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await resolveComment(commentId);
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) });
      success('Comment resolved');
    } catch {
      showError('Failed to resolve comment');
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    try {
      await createComment(nodeId, body, { parentId, commentType: 'general' });
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'node-comments', nodeId) });
      success('Reply added');
    } catch {
      showError('Failed to add reply');
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 pointer-events-none', placingPin && 'pointer-events-auto cursor-crosshair')}
      onClick={handleContainerClick}
    >
      {/* Existing pins */}
      {threaded.map((comment) => {
        if (comment.posX === undefined || comment.posY === undefined) return null;
        return (
          <div
            key={comment.id}
            className="absolute pointer-events-auto"
            style={{
              left: `${comment.posX}%`,
              top: `${comment.posY}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PinPopover
              comment={comment}
              zoom={zoom}
              onResolve={handleResolve}
              onReply={handleReply}
            />
          </div>
        );
      })}

      {/* Pending pin placement */}
      {pendingPin && (
        <div
          className="absolute pointer-events-auto z-50"
          style={{
            left: `${pendingPin.x}%`,
            top: `${pendingPin.y}%`,
            transform: 'translate(-50%, -100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl p-3 w-56"
            style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Pin className="icon-sm text-muted-foreground" />
                Add Pin Comment
              </div>
              <Button aria-label="Cancel comment"
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setPendingPin(null)}
              >
                <X className="icon-sm" />
              </Button>
            </div>

            {/* Type selector */}
            <div className="flex gap-1 mb-2">
              {(['general', 'suggestion', 'question'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewPinType(t)}
                  className={cn(
                    'text-2xs px-1.5 py-0.5 rounded border capitalize transition-colors',
                    newPinType === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <Textarea
              value={newPinBody}
              onChange={(e) => setNewPinBody(e.target.value)}
              placeholder={bilingualInline("Add a comment…", "Προσθήκη σχολίου…")}
              rows={2}
              className="text-xs min-h-0 resize-none mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitPin(); }
                if (e.key === 'Escape') setPendingPin(null);
              }}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleSubmitPin}
                disabled={submitting || !newPinBody.trim()}
              >
                {submitting ? <Loader2 className="icon-sm animate-spin mr-1" /> : null}
                Pin
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPendingPin(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
