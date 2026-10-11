'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  /** Storage key for persisting position */
  storageKey?: string;
  /** Initial position if no stored position exists */
  initialPosition?: Position;
  /** Boundary padding from screen edges */
  boundaryPadding?: number;
  /**
   * Hold this many ms before a press becomes a drag. 0 (default) starts
   * dragging immediately — used by the chat popup title bar. The floating
   * bubble uses a short delay so a normal click still opens messages.
   */
  activationDelayMs?: number;
  /** Pointer travel that starts a drag even before the delay fires. */
  moveThresholdPx?: number;
  /** When false, mousedown does not preventDefault — needed so click still fires. */
  preventDefaultOnDown?: boolean;
}

interface UseDraggableReturn {
  position: Position;
  isDragging: boolean;
  dragHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    style: React.CSSProperties;
  };
  resetPosition: () => void;
  /** Call from onClick; returns true when the pointer sequence was a drag. */
  consumeSuppressClick: () => boolean;
}

/** Arrow-key step, and the larger step Shift asks for. */
const KEYBOARD_STEP = 10;
const KEYBOARD_STEP_LARGE = 50;

/**
 * Hook to make an element draggable with position persistence
 */
export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const {
    storageKey,
    initialPosition = { x: 0, y: 0 },
    boundaryPadding = 10,
    activationDelayMs = 0,
    moveThresholdPx = 6,
    preventDefaultOnDown = true,
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            setPosition(parsed);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined' && (position.x !== 0 || position.y !== 0)) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey, position]);

  const constrainPosition = useCallback((x: number, y: number): Position => {
    if (typeof window === 'undefined') return { x, y };

    const maxX = window.innerWidth - boundaryPadding - 60;
    const maxY = window.innerHeight - boundaryPadding - 60;

    return {
      x: Math.max(-maxX + 100, Math.min(maxX - 100, x)),
      y: Math.max(-maxY + 100, Math.min(maxY - 100, y)),
    };
  }, [boundaryPadding]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const beginDrag = useCallback(() => {
    clearTimer();
    setArmed(false);
    setIsDragging(true);
  }, [clearTimer]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    const dist = Math.hypot(deltaX, deltaY);

    if (!isDraggingRef.current) {
      if (dist < moveThresholdPx) return;
      // Only a real move steals the click — a slow press must still open chat.
      suppressClickRef.current = true;
      beginDrag();
    }

    const newPos = constrainPosition(
      dragStartRef.current.posX + deltaX,
      dragStartRef.current.posY + deltaY,
    );

    setPosition(newPos);
  }, [beginDrag, constrainPosition, moveThresholdPx]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleEnd = useCallback(() => {
    clearTimer();
    setArmed(false);
    setIsDragging(false);
    dragStartRef.current = null;
  }, [clearTimer]);

  useEffect(() => {
    if (!isDragging && !armed) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, armed, handleMouseMove, handleTouchMove, handleEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (preventDefaultOnDown) e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    suppressClickRef.current = false;
    if (activationDelayMs <= 0) {
      setIsDragging(true);
      return;
    }
    setArmed(true);
    clearTimer();
  }, [activationDelayMs, clearTimer, position, preventDefaultOnDown]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      posX: position.x,
      posY: position.y,
    };
    suppressClickRef.current = false;
    if (activationDelayMs <= 0) {
      setIsDragging(true);
      return;
    }
    setArmed(true);
    clearTimer();
  }, [activationDelayMs, clearTimer, position]);

  const resetPosition = useCallback(() => {
    setPosition(initialPosition);
    if (storageKey && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  }, [initialPosition, storageKey]);

  /**
   * Moves the element with the arrow keys, and returns it home with Home or
   * Escape.
   *
   * Shift multiplies the step, the way a keyboard-resizable control usually
   * behaves, and the same `constrainPosition` keeps it on screen.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      setPosition((current) => constrainPosition(current.x + dx, current.y + dy));
    };

    switch (e.key) {
      case 'ArrowLeft': return move(-step, 0);
      case 'ArrowRight': return move(step, 0);
      case 'ArrowUp': return move(0, -step);
      case 'ArrowDown': return move(0, step);
      case 'Home':
      case 'Escape':
        e.preventDefault();
        return resetPosition();
      default:
        return undefined;
    }
  }, [constrainPosition, resetPosition]);

  const consumeSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    position,
    isDragging,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      onKeyDown: handleKeyDown,
      style: {
        cursor: isDragging ? 'grabbing' : (activationDelayMs > 0 ? undefined : 'grab'),
        userSelect: 'none' as const,
        touchAction: 'none' as const,
      },
    },
    resetPosition,
    consumeSuppressClick,
  };
}
