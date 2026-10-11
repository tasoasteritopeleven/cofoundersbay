import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCopilotAction, runCopilotTurn } from '@/lib/copilot-engine';
import { undoAction as runUndo } from '@/lib/action-registry';
import { recordAIAction } from '@/lib/ai-api';
import type { CopilotAction } from '@/lib/copilot-types';
import { useAIChat } from './useAIChat';

/**
 * What the chat does once the reader presses an action card's button.
 *
 * The page's handler can answer three ways - the write landed, the reader
 * said no in the page's own "Are you sure?", or it failed - and each must
 * reach the card, the audit trail and the cache refresh exactly once:
 * - landed: the card is done, the trail says "applied", the caches refresh;
 * - declined: the card says it was cancelled; nothing is filed or refreshed;
 * - failed: the card says why; the trail says "failed"; nothing refreshes.
 * The same for Undo, and a double press runs the write once.
 */

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ hasSession: true, mounted: true }) }));
vi.mock('@/hooks/useApiAvailability', () => ({ useApiAvailability: () => true }));
vi.mock('@/lib/ai-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-api')>()),
  // The model is offline, so the turn is the copilot's own - the path that
  // proposes page commands as cards.
  getAIHealth: vi.fn().mockResolvedValue({ available: false, models: [] }),
  getAIAgents: vi.fn().mockResolvedValue({ agents: [] }),
  recordAIAction: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/lib/copilot-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/copilot-engine')>()),
  runCopilotTurn: vi.fn(),
  executeCopilotAction: vi.fn(),
}));
vi.mock('@/lib/action-registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/action-registry')>()),
  undoAction: vi.fn(),
  undoAvailable: () => true,
}));

const turn = vi.mocked(runCopilotTurn);
const execute = vi.mocked(executeCopilotAction);
const undo = vi.mocked(runUndo);
const audit = vi.mocked(recordAIAction);

const CARD: CopilotAction = {
  id: 'card-1',
  tool: 'run_page_command',
  title: 'Delete automation rule',
  description: 'Weekly digest',
  confirmLabel: 'Run',
  payload: { control: 'delete_rule', value: 'rule-1' },
  status: 'pending',
};

/** A write that declares what it makes stale, so its refresh can be seen. */
const SAVE: CopilotAction = {
  ...CARD,
  id: 'card-2',
  tool: 'shortlist_add',
  title: 'Save Elena to your shortlist',
  payload: { userId: 'user-elena' },
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

async function chatWithCard(proposed: CopilotAction = CARD) {
  turn.mockResolvedValue({ message: 'I can do that.', actions: [{ ...proposed }], citations: [], usedTools: [] });
  const hook = renderHook(() => useAIChat({ enableCopilot: true }), { wrapper });
  // Let the availability check settle, so the turn takes the copilot path.
  await act(async () => {});
  await act(() => hook.result.current.sendMessage('delete the weekly digest rule'));
  const card = () => hook.result.current.messages.at(-1)?.actions?.[0];
  expect(card()?.id).toBe(proposed.id);
  return { ...hook, card };
}

beforeEach(() => {
  client = new QueryClient();
  vi.spyOn(client, 'invalidateQueries');
  turn.mockReset();
  execute.mockReset();
  undo.mockReset();
  audit.mockClear();
});

afterEach(cleanup);

describe('confirming an action card', () => {
  it('files "applied", refreshes and marks the card done once the write lands', async () => {
    execute.mockResolvedValue({ ok: true, undo: { savedUserId: 'user-elena' } });
    const { result, card } = await chatWithCard(SAVE);
    await act(() => result.current.confirmAction(card()!));
    expect(card()).toMatchObject({ status: 'done', undoContext: { savedUserId: 'user-elena' } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'shortlist_add', outcome: 'applied' }));
    expect(client.invalidateQueries).toHaveBeenCalled();
  });

  it('says "cancelled" and files nothing when the reader declines the page’s confirmation', async () => {
    execute.mockResolvedValue({ ok: false, cancelled: true });
    const { result, card } = await chatWithCard();
    await act(() => result.current.confirmAction(card()!));
    expect(card()?.status).toBe('cancelled');
    expect(card()?.error).toBeUndefined();
    expect(audit).not.toHaveBeenCalled();
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('files "failed" and puts the reason on the card when the write does not go through', async () => {
    execute.mockResolvedValue({ ok: false, error: 'The rule is in use by a running job.' });
    const { result, card } = await chatWithCard();
    await act(() => result.current.confirmAction(card()!));
    expect(card()).toMatchObject({ status: 'error', error: 'The rule is in use by a running job.' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failed' }));
    expect(client.invalidateQueries).not.toHaveBeenCalled();
  });

  it('runs the write once when the button is pressed twice in one tick', async () => {
    let release!: (value: { ok: true }) => void;
    execute.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result, card } = await chatWithCard();
    await act(async () => {
      const first = result.current.confirmAction(card()!);
      const second = result.current.confirmAction(card()!);
      release({ ok: true });
      await Promise.all([first, second]);
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('keeps the card pending until the write settles', async () => {
    let release!: (value: { ok: true }) => void;
    execute.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const { result, card } = await chatWithCard();
    let done!: Promise<unknown>;
    act(() => { done = result.current.confirmAction(card()!); });
    await act(async () => {});
    expect(result.current.pendingActionId).toBe(CARD.id);
    expect(card()?.status).toBe('pending');
    expect(audit).not.toHaveBeenCalled();
    await act(async () => { release({ ok: true }); await done; });
    expect(result.current.pendingActionId).toBeNull();
    expect(card()?.status).toBe('done');
  });
});

describe('undoing a done card', () => {
  async function doneCard() {
    execute.mockResolvedValue({ ok: true });
    const chat = await chatWithCard(SAVE);
    await act(() => chat.result.current.confirmAction(chat.card()!));
    audit.mockClear();
    vi.mocked(client.invalidateQueries).mockClear();
    return chat;
  }

  it('files "undone", refreshes and marks the card undone once the undo lands', async () => {
    const { result, card } = await doneCard();
    undo.mockResolvedValue({ ok: true });
    let answer: boolean | undefined;
    await act(async () => { answer = await result.current.undoAction(card()!); });
    expect(answer).toBe(true);
    expect(card()?.status).toBe('undone');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'undone' }));
    expect(client.invalidateQueries).toHaveBeenCalled();
  });

  it('leaves the card done, files nothing and refreshes nothing when the undo is declined', async () => {
    const { result, card } = await doneCard();
    undo.mockResolvedValue({ ok: false, cancelled: true });
    await act(async () => { await result.current.undoAction(card()!); });
    expect(card()?.status).toBe('done');
    expect(card()?.error).toBeUndefined();
    expect(audit).not.toHaveBeenCalled();
    expect(client.invalidateQueries).not.toHaveBeenCalled();
  });

  it('files "failed" and says why on the card, still undoable, when the undo fails', async () => {
    const { result, card } = await doneCard();
    undo.mockResolvedValue({ ok: false, error: 'The rule was deleted elsewhere.' });
    await act(async () => { await result.current.undoAction(card()!); });
    expect(card()).toMatchObject({ status: 'done', error: 'The rule was deleted elsewhere.' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failed' }));
    expect(client.invalidateQueries).not.toHaveBeenCalled();
  });
});
