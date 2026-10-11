import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from '@/lib/api-origin';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = getSocketOrigin(),
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setState((prev) => ({ ...prev, connecting: true, error: null }));

    const socket = io(url, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setState({ connected: true, connecting: false, error: null });
      onConnect?.();
    });

    socket.on('disconnect', () => {
      setState({ connected: false, connecting: false, error: null });
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      setState({ connected: false, connecting: false, error });
      onError?.(error);
    });

    socketRef.current = socket;
  }, [url, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState({ connected: false, connecting: false, error: null });
  }, []);

  // Socket payloads are opaque to this hook; `unknown` keeps callers honest
  // without pretending we know the shape.
  const emit = useCallback((event: string, data?: unknown) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket not connected, cannot emit:', event);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  /**
   * Generic in the handler's arguments so each caller declares the payload it
   * expects, instead of the hook asserting `any` on everyone's behalf. The one
   * cast is at the socket.io boundary, where the payload really is untyped.
   */
  const on = useCallback(
    <TArgs extends unknown[] = unknown[]>(event: string, handler: (...args: TArgs) => void) => {
      if (!socketRef.current) return;
      const listener = handler as (...args: unknown[]) => void;
      socketRef.current.on(event, listener);
      return () => {
        socketRef.current?.off(event, listener);
      };
    },
    [],
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    ...state,
    connect,
    disconnect,
    emit,
    on,
  };
}
