'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isApiCircuitOpen } from '@/lib/api';
import { getSocketOrigin } from '@/lib/api-origin';

export interface CollaboratorPresence {
  userId: string;
  status: 'online' | 'offline';
  displayName: string | null;
  avatarUrl: string | null;
  cursor?: { x: number; y: number };
  color: string;
}

export interface NodeMovedEvent {
  nodeId: string;
  posX?: number;
  posY?: number;
  movedBy: string;
}

export interface NodeUpdatedEvent {
  nodeId: string;
  changes: {
    title?: string;
    content?: string;
    color?: string;
    tags?: string[];
    width?: number;
    height?: number;
  };
  updatedBy: string;
}

export interface CommentEvent {
  commentId: string;
  nodeId: string;
  boardId: string;
  authorId?: string;
  body?: string;
  resolvedBy?: string;
}

const CURSOR_COLORS = [
  '#22D3EE', '#A855F7', '#F97316', '#22C55E', '#EC4899', '#EAB308', '#3B82F6',
];

function pickColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface UseResearchCollaborationOptions {
  boardId: string | null;
  enabled?: boolean;
  onNodeMoved?: (event: NodeMovedEvent) => void;
  onNodeUpdated?: (event: NodeUpdatedEvent) => void;
  onCommentCreated?: (event: CommentEvent) => void;
  onCommentResolved?: (event: CommentEvent) => void;
}

export function useResearchCollaboration({
  boardId,
  enabled = true,
  onNodeMoved,
  onNodeUpdated,
  onCommentCreated,
  onCommentResolved,
}: UseResearchCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const updatePresence = useCallback((userId: string, data: Partial<CollaboratorPresence> & { status: 'online' | 'offline' }) => {
    setCollaborators((prev) => {
      if (data.status === 'offline') {
        return prev.filter((c) => c.userId !== userId);
      }
      const existing = prev.find((c) => c.userId === userId);
      if (existing) {
        return prev.map((c) => c.userId === userId ? { ...c, ...data } : c);
      }
      return [...prev, { userId, color: pickColor(userId), cursor: undefined, displayName: null, avatarUrl: null, ...data } as CollaboratorPresence];
    });
  }, []);

  const updateCursor = useCallback((userId: string, x: number, y: number) => {
    setCollaborators((prev) =>
      prev.map((c) => c.userId === userId ? { ...c, cursor: { x, y } } : c),
    );
  }, []);

  useEffect(() => {
    if (!enabled || !boardId) return;

    const socket = io(`${getSocketOrigin()}/research`, {
      withCredentials: true,
      transports: ['websocket'] as string[],
      autoConnect: !isApiCircuitOpen(),
      reconnection: !isApiCircuitOpen(),
      reconnectionAttempts: isApiCircuitOpen() ? 0 : 8,
      reconnectionDelay: 3_000,
      reconnectionDelayMax: 60_000,
      randomizationFactor: 0.4,
      timeout: 10_000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('board:join', { boardId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCollaborators([]);
    });

    socket.on('board:presence', (data: { userId: string; status: 'online' | 'offline'; boardId: string; displayName?: string; avatarUrl?: string }) => {
      updatePresence(data.userId, {
        status: data.status,
        displayName: data.displayName ?? null,
        avatarUrl: data.avatarUrl ?? null,
        color: pickColor(data.userId),
      });
    });

    socket.on('board:cursor', (data: { userId: string; x: number; y: number }) => {
      updateCursor(data.userId, data.x, data.y);
    });

    socket.on('node:moved', (event: NodeMovedEvent) => {
      onNodeMoved?.(event);
    });

    socket.on('node:updated', (event: NodeUpdatedEvent) => {
      onNodeUpdated?.(event);
    });

    socket.on('comment:created', (event: CommentEvent) => {
      onCommentCreated?.(event);
    });

    socket.on('comment:resolved', (event: CommentEvent) => {
      onCommentResolved?.(event);
    });

    return () => {
      socket.emit('board:leave', { boardId });
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
    };
  }, [boardId, enabled]);

  const emitCursor = useCallback((x: number, y: number) => {
    if (!boardId || !socketRef.current?.connected) return;
    socketRef.current.emit('board:cursor', { boardId, x, y });
  }, [boardId]);

  const emitNodeMove = useCallback((nodeId: string, posX: number, posY: number) => {
    if (!boardId || !socketRef.current?.connected) return;
    socketRef.current.emit('node:move', { boardId, nodeId, posX, posY });
  }, [boardId]);

  const emitNodeUpdate = useCallback((nodeId: string, changes: NodeUpdatedEvent['changes']) => {
    if (!boardId || !socketRef.current?.connected) return;
    socketRef.current.emit('node:update', { boardId, nodeId, ...changes });
  }, [boardId]);

  const emitComment = useCallback((nodeId: string, commentId: string, body: string) => {
    if (!boardId || !socketRef.current?.connected) return;
    socketRef.current.emit('comment:new', { boardId, nodeId, commentId, body });
  }, [boardId]);

  return {
    isConnected,
    collaborators,
    emitCursor,
    emitNodeMove,
    emitNodeUpdate,
    emitComment,
  };
}
