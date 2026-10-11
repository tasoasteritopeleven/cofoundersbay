'use client';

import * as React from 'react';
import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { toastEl } from '@/lib/i18n/strings-toasts';
import { BilingualText } from '@/components/common/BilingualText';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type ToastOptions = {
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
};

type ToastContextType = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, description?: string, options?: ToastOptions) => void;
  error: (title: string, description?: string, options?: ToastOptions) => void;
  warning: (title: string, description?: string, options?: ToastOptions) => void;
  info: (title: string, description?: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

/** More than this on screen at once is noise; the oldest are dropped. */
const MAX_VISIBLE_TOASTS = 4;

const toastIcons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-status-success-border/40 bg-status-success-bg text-status-success',
  error: 'border-status-danger-border/40 bg-status-danger-bg text-status-danger',
  warning: 'border-status-warning-border/40 bg-status-warning-bg text-status-warning',
  info: 'border-status-info-border/40 bg-status-info-bg text-status-info',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = toastIcons[toast.type];
  const { primary } = useLanguagePreference();
  const urgent = toast.type === 'error' || toast.type === 'warning';
  const dismissLabel = primary === 'el'
    ? bilingualAria('Κλείσιμο ειδοποίησης', 'Dismiss notification')
    : bilingualAria('Dismiss notification', 'Κλείσιμο ειδοποίησης');
  const remove = React.useRef(onRemove);
  remove.current = onRemove;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = React.useRef(0);
  const remaining = React.useRef(0);
  const timed = React.useRef(false);
  const paused = React.useRef({ hover: false, focus: false });

  const stopTimer = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
  }, []);

  const startTimer = useCallback(() => {
    const { hover, focus } = paused.current;
    if (!timed.current || timer.current !== null || hover || focus) return;
    started.current = Date.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      remove.current();
    }, remaining.current);
  }, []);

  useEffect(() => {
    remaining.current = toast.duration ?? 5000;
    timed.current = remaining.current > 0;
    startTimer();
    return stopTimer;
  }, [toast.duration, startTimer, stopTimer]);

  return (
    <div
      onMouseEnter={() => { paused.current.hover = true; stopTimer(); }}
      onMouseLeave={() => { paused.current.hover = false; startTimer(); }}
      onFocusCapture={() => { paused.current.focus = true; stopTimer(); }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        paused.current.focus = false;
        startTimer();
      }}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-lg backdrop-blur-xl animate-slide-in-right motion-reduce:animate-none',
        toastStyles[toast.type]
      )}
    >
      <Icon className="icon-md flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} aria-atomic="true" className="space-y-1 break-words">
          {/* Call sites pass English; the catalog supplies the Greek, so a
              toast reads in both languages without touching ~360 callers. */}
          <p className="text-sm font-semibold text-foreground">
            <BilingualText en={toast.title} el={toastEl(toast.title)} stacked wrap />
          </p>
          {toast.description && (
            <p className="text-sm text-muted-foreground">
              <BilingualText en={toast.description} el={toastEl(toast.description)} />
            </p>
          )}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-2 min-h-11 rounded-xl text-sm font-medium underline underline-offset-2 focus-ring"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={onRemove}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary transition-colors focus-ring"
      >
        <X className="icon-sm" aria-hidden="true" />
      </button>
    </div>
  );
}

function ToastPortal({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.body);
  }, []);

  if (!container) return null;

  return createPortal(
    /* The region is named and live *before* any toast exists. A live region
       inserted into the DOM at the same moment as its content is generally
       not announced — screen readers watch regions they already know about —
       so a viewport that only mounts alongside the first toast silently drops
       that first announcement. The per-toast `role="status"`/`alert` below
       stays: it is what escalates an error from polite to assertive. */
    <div
      role="region"
      aria-label={bilingualAria('Notifications', 'Ειδοποιήσεις')}
      aria-live="polite"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none sm:left-auto sm:right-4 sm:bottom-4"
    >
      {/* More than a handful on screen at once is noise rather than feedback,
          and the stack grows off the top of the viewport. The oldest go. */}
      {toasts.slice(-MAX_VISIBLE_TOASTS).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>,
    container
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, description?: string, options?: ToastOptions) => 
      addToast({ type: 'success', title, description, ...options }),
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string, options?: ToastOptions) => 
      addToast({ type: 'error', title, description, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string, options?: ToastOptions) => 
      addToast({ type: 'warning', title, description, ...options }),
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string, options?: ToastOptions) => 
      addToast({ type: 'info', title, description, ...options }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastPortal toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}
