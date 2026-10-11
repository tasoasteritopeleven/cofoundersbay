import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';
import { getActionSpec } from '@/lib/action-registry';
import type { CopilotAction, CopilotActionStatus, CopilotActionTool } from '@/lib/copilot-types';
import { ActionCard } from './ActionCard';

/**
 * The registry knows which writes can be taken back. This asserts the user is
 * told before committing, rather than discovering it afterwards -- the case
 * that matters being `send_connection`, which notifies the recipient
 * immediately and has no sender-side withdraw route.
 */

function action(
  tool: CopilotActionTool,
  status: CopilotActionStatus = 'pending',
  payload: Record<string, unknown> = {},
): CopilotAction {
  return {
    id: `a-${tool}`,
    tool,
    title: `Title for ${tool}`,
    description: '',
    confirmLabel: 'Confirm',
    payload,
    status,
    href: '/somewhere',
  };
}

function renderCard(a: CopilotAction, onUndo?: (x: CopilotAction) => void) {
  return render(
    <LanguagePreferenceProvider>
      <ActionCard action={a} onConfirm={vi.fn()} onDismiss={vi.fn()} onUndo={onUndo} />
    </LanguagePreferenceProvider>,
  );
}

afterEach(cleanup);

describe('ActionCard reversibility', () => {
  it('warns, before confirming, that an intro cannot be taken back', () => {
    renderCard(action('send_connection', 'pending', { receiverId: 'u1' }));

    const expected = getActionSpec('send_connection')?.reversal?.explanation;
    expect(expected?.en).toBeTruthy();
    expect(screen.getByText(expected!.en)).toBeTruthy();

    // Still offers the action: this is a warning, not a removal of capability.
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeTruthy();
  });

  it('states the reversible case without dressing it as a warning', () => {
    renderCard(action('shortlist_add', 'pending', { userId: 'u1' }));

    const expected = getActionSpec('shortlist_add')?.reversal?.explanation;
    expect(screen.getByText(expected!.en)).toBeTruthy();
  });

  it('says nothing about reversal for an action that writes nothing', () => {
    renderCard(action('navigate', 'pending', { href: '/matches' }));

    const navReversal = getActionSpec('navigate')?.reversal?.explanation;
    expect(navReversal?.en).toBeTruthy();
    // Declared in the registry, deliberately not rendered: `navigate` does not
    // write, so the line would appear on every card carrying no information.
    expect(screen.queryByText(navReversal!.en)).toBeNull();
  });

  it('offers Undo once an undoable action has run', () => {
    const onUndo = vi.fn();
    renderCard(action('shortlist_add', 'done', { userId: 'u1' }), onUndo);

    const undo = screen.getByRole('button', { name: /Undo|Αναίρεση/ });
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('offers no Undo for a write that cannot be reversed', () => {
    // A sent message is read the moment it lands and a direct conversation
    // cannot be deleted, so this one is honestly irreversible. An intro is not
    // on this list any more: the sender can withdraw it.
    renderCard(action('start_or_send_message', 'done', { userId: 'u1' }), vi.fn());

    expect(screen.queryByRole('button', { name: /Undo|Αναίρεση/ })).toBeNull();
    // The completed state is still reported.
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('offers Undo for an intro, which the sender can now withdraw', () => {
    const onUndo = vi.fn();
    renderCard(action('send_connection', 'done', { receiverId: 'u1' }), onUndo);

    fireEvent.click(screen.getByRole('button', { name: /Undo|Αναίρεση/ }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('offers no Undo when the caller supplies no handler', () => {
    renderCard(action('shortlist_add', 'done', { userId: 'u1' }));
    expect(screen.queryByRole('button', { name: /Undo|Αναίρεση/ })).toBeNull();
  });

  it('reports an undone action distinctly from a dismissed one', () => {
    renderCard(action('shortlist_add', 'undone', { userId: 'u1' }), vi.fn());
    expect(screen.getByText('Undone')).toBeTruthy();
    expect(screen.queryByText('Dismissed')).toBeNull();

    cleanup();

    renderCard(action('shortlist_add', 'dismissed', { userId: 'u1' }), vi.fn());
    expect(screen.getByText('Dismissed')).toBeTruthy();
    expect(screen.queryByText('Undone')).toBeNull();
  });

  it('keeps the intro note visible so the user confirms what is actually sent', () => {
    renderCard(action('send_connection', 'pending', { receiverId: 'u1', message: 'Hi there' }));
    expect(screen.getByText('“Hi there”')).toBeTruthy();
  });
});

/**
 * The three ways a confirmed card can end that are not "done": the reader
 * declined the page's own confirmation, the write failed, or another card is
 * still running. Each says so on the card, in both languages, and offers only
 * what can still be done.
 */
describe('ActionCard outcomes', () => {
  function renderWith(a: CopilotAction, busyId: string | null = null) {
    const onConfirm = vi.fn();
    const onUndo = vi.fn();
    render(
      <LanguagePreferenceProvider>
        <ActionCard action={a} busyId={busyId} onConfirm={onConfirm} onDismiss={vi.fn()} onUndo={onUndo} />
      </LanguagePreferenceProvider>,
    );
    return { onConfirm, onUndo };
  }

  it('says a declined command was cancelled and offers nothing further', () => {
    renderWith(action('run_page_command', 'cancelled', { control: 'delete_rule', value: 'r1' }));
    expect(screen.getByText('Cancelled — no changes made')).toBeTruthy();
    expect(screen.getByText('Ακυρώθηκε — δεν έγιναν αλλαγές')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('puts the reason for a failure on the card and still lets the reader retry', () => {
    const { onConfirm } = renderWith({ ...action('shortlist_add', 'error', { userId: 'u1' }), error: 'Network unreachable' });
    expect(screen.getByRole('alert').textContent).toContain('Network unreachable');
    expect(screen.getByText('Not applied:', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps a done card undoable when its undo failed, and says why', () => {
    const { onUndo } = renderWith({ ...action('shortlist_add', 'done', { userId: 'u1' }), error: 'Already removed' });
    expect(screen.getByRole('alert').textContent).toContain('Already removed');
    fireEvent.click(screen.getByRole('button', { name: /Undo|Αναίρεση/ }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('waits while another card runs, instead of offering a button that would do nothing', () => {
    const { onConfirm } = renderWith(action('shortlist_add', 'pending', { userId: 'u1' }), 'some-other-card');
    const confirm = screen.getByRole('button', { name: /Confirm/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows its own run as busy, and is free again once nothing runs', () => {
    renderWith(action('shortlist_add', 'pending', { userId: 'u1' }), 'a-shortlist_add');
    const busy = screen.getByRole('button', { name: /Confirm/ });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');

    cleanup();

    renderWith(action('shortlist_add', 'pending', { userId: 'u1' }), null);
    expect((screen.getByRole('button', { name: /Confirm/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
