import type { ActionOutcome } from '@cofounderbay/shared';
import { isCanvasCommandOp, type CanvasCommandOp } from '@cofounderbay/shared';

/**
 * The live canvas and the assistant share one bus.
 *
 * Executors cannot reach React Query. Readiness solved that with
 * `cfb:readiness-updated`. The canvas needs the inverse as well: the
 * assistant must ask the open board to move nodes, not only tell it that
 * something changed. A CustomEvent carries the command; the board page
 * registers as the live handler; when nobody is listening the executor
 * parks the command and navigates to Research so the same step can land.
 */

export const CANVAS_COMMAND_EVENT = 'cfb:canvas-command';
export const CANVAS_COMMAND_RESULT_EVENT = 'cfb:canvas-command-result';
const PENDING_KEY = 'cfb:pending-canvas-command';
const HANDLER_COUNT_KEY = '__cfbCanvasHandlerCount';

export type CanvasCommandRequest = {
  requestId: string;
  op: CanvasCommandOp;
  payload: Record<string, unknown>;
};

export type CanvasCommandResult = {
  requestId: string;
  outcome: ActionOutcome;
};

export type PendingCanvasCommand = {
  op: CanvasCommandOp;
  payload: Record<string, unknown>;
  applied?: boolean;
  ts: number;
};

type Handler = (request: CanvasCommandRequest) => Promise<ActionOutcome>;

function handlerCount(): number {
  if (typeof window === 'undefined') return 0;
  const n = (window as unknown as Record<string, unknown>)[HANDLER_COUNT_KEY];
  return typeof n === 'number' ? n : 0;
}

function setHandlerCount(n: number): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[HANDLER_COUNT_KEY] = n;
}

export function hasLiveCanvasHandler(): boolean {
  return handlerCount() > 0;
}

export function persistPendingCanvasCommand(pending: PendingCanvasCommand): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Private mode or quota — the navigation href is still useful.
  }
}

export function consumePendingCanvasCommand(): PendingCanvasCommand | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PENDING_KEY);
    const parsed = JSON.parse(raw) as PendingCanvasCommand;
    if (!parsed?.op || !isCanvasCommandOp(parsed.op)) return null;
    if (Date.now() - (parsed.ts || 0) > 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function registerCanvasCommandHandler(handler: Handler): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onCommand = (event: Event) => {
    const detail = (event as CustomEvent<CanvasCommandRequest>).detail;
    if (!detail?.requestId || !isCanvasCommandOp(detail.op)) return;
    void handler(detail).then((outcome) => {
      window.dispatchEvent(
        new CustomEvent<CanvasCommandResult>(CANVAS_COMMAND_RESULT_EVENT, {
          detail: { requestId: detail.requestId, outcome },
        }),
      );
    });
  };

  window.addEventListener(CANVAS_COMMAND_EVENT, onCommand as EventListener);
  setHandlerCount(handlerCount() + 1);

  return () => {
    window.removeEventListener(CANVAS_COMMAND_EVENT, onCommand as EventListener);
    setHandlerCount(Math.max(0, handlerCount() - 1));
  };
}

function liveOutcome(op: CanvasCommandOp, payload: Record<string, unknown>): Promise<ActionOutcome> {
  return new Promise((resolve) => {
    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `canvas-${Date.now()}`;

    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<CanvasCommandResult>).detail;
      if (detail?.requestId !== requestId) return;
      window.removeEventListener(CANVAS_COMMAND_RESULT_EVENT, onResult as EventListener);
      window.clearTimeout(timer);
      resolve(detail.outcome);
    };

    const timer = window.setTimeout(() => {
      window.removeEventListener(CANVAS_COMMAND_RESULT_EVENT, onResult as EventListener);
      resolve({ ok: false, error: 'Canvas command timed out' });
    }, 8000);

    window.addEventListener(CANVAS_COMMAND_RESULT_EVENT, onResult as EventListener);
    window.dispatchEvent(
      new CustomEvent<CanvasCommandRequest>(CANVAS_COMMAND_EVENT, {
        detail: { requestId, op, payload },
      }),
    );
  });
}

function boardHref(payload: Record<string, unknown>): string {
  const boardId = typeof payload.boardId === 'string' ? payload.boardId.trim() : '';
  return boardId ? `/research/${boardId}` : '/research';
}

/**
 * Runs a canvas op. Live handler first; otherwise park + navigate.
 *
 * Creating nodes from chat while the board is closed still lands: the
 * pending command is consumed when `/research/[boardId]` mounts.
 */
export async function runCanvasCommand(
  op: CanvasCommandOp,
  payload: Record<string, unknown>,
): Promise<ActionOutcome> {
  if (typeof window !== 'undefined' && hasLiveCanvasHandler()) {
    return liveOutcome(op, payload);
  }

  persistPendingCanvasCommand({ op, payload, ts: Date.now() });
  return { ok: true, href: boardHref(payload) };
}
