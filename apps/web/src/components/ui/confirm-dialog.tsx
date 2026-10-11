'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BilingualText } from '@/components/common/BilingualText';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCloseAutoFocus?: React.ComponentPropsWithoutRef<typeof DialogContent>['onCloseAutoFocus'];
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'destructive',
  loading = false,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!loading) onOpenChange(nextOpen); }}>
      <DialogContent
        className="max-w-md"
        hideClose={loading}
        aria-busy={loading}
        {...(!description && { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (variant === 'destructive' ? cancelRef : confirmRef).current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => { if (loading) event.preventDefault(); }}
        onInteractOutside={(event) => { if (loading) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel ?? <BilingualText en="Cancel" el="Άκυρο" compact />}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={variant}
            size="sm"
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel ?? <BilingualText en="Confirm" el="Επιβεβαίωση" compact secondaryClassName={variant === 'destructive' ? 'text-destructive-foreground' : 'text-primary-foreground'} />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Imperative API ─────────────────────────────────────────────────────────
 *
 * `const confirm = useConfirm(); if (await confirm({...})) doIt();`
 *
 * Drop-in replacement for the native `window.confirm()`, which the app used
 * for every destructive action. The native dialog cannot be styled or
 * translated, gives screen-reader users an unlabelled OK/Cancel, and its
 * one-line message ("Delete this domain?") never said what would actually be
 * lost. This renders the app's ConfirmDialog with a real title, a description
 * that explains the consequence, and bilingual buttons.
 */

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

type ConfirmRequest = ConfirmOptions & {
  resolve: (value: boolean) => void;
  returnFocus: HTMLElement | null;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmRequest | null>(null);
  const requests = React.useRef<ConfirmRequest[]>([]);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requests.current.splice(0).forEach((request) => request.resolve(false));
    };
  }, []);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    if (!mounted.current) return Promise.resolve(false);
    const returnFocus = requests.current[0]?.returnFocus ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    return new Promise<boolean>((resolve) => {
      const request = { ...options, resolve, returnFocus };
      requests.current.push(request);
      if (requests.current.length === 1) setState(request);
    });
  }, []);

  const close = (request: ConfirmRequest, value: boolean) => {
    if (requests.current[0] !== request) return;
    requests.current.shift();
    setState(requests.current[0] ?? null);
    request.resolve(value);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) close(state, false); }}
          title={state.title}
          description={state.description}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          variant={state.variant ?? 'destructive'}
          onConfirm={() => close(state, true)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (requests.current.length === 0 && state.returnFocus?.isConnected) {
              state.returnFocus.focus();
            }
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Returns a promise-based confirm. Falls back to `window.confirm` when used
 * outside a ConfirmProvider so a missing provider degrades, never breaks.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  return React.useMemo<ConfirmFn>(() => {
    if (ctx) return ctx;
    return async ({ title, description }) =>
      typeof window !== 'undefined' &&
      window.confirm([toText(title), toText(description)].filter(Boolean).join('\n\n'));
  }, [ctx]);
}

function toText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (React.isValidElement<{ en?: string; children?: React.ReactNode }>(node)) {
    return node.props?.en ?? toText(node.props.children);
  }
  return '';
}

/** Ready-made bilingual copy for the common "delete X" case. */
export function deleteConfirmCopy(what: { en: string; el: string }, name?: string): ConfirmOptions {
  const quoted = name ? ` “${name}”` : '';
  return {
    title: <BilingualText en={`Delete ${what.en}${quoted}?`} el={`Διαγραφή ${what.el}${quoted};`} />,
    description: (
      <BilingualText
        en="This permanently removes it for everyone who has access. It cannot be undone."
        el="Αφαιρείται οριστικά για όλους όσοι έχουν πρόσβαση. Δεν μπορεί να αναιρεθεί."
      />
    ),
    confirmLabel: <BilingualText en="Delete" el="Διαγραφή" compact secondaryClassName="text-destructive-foreground" />,
    variant: 'destructive',
  };
}
