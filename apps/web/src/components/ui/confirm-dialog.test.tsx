import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, ConfirmProvider, useConfirm } from './confirm-dialog';

let confirm: ReturnType<typeof useConfirm>;

function Launcher() {
  confirm = useConfirm();
  return <button onClick={() => void confirm({ title: 'Delete record?', description: 'Remove this record.' })}>Open confirmation</button>;
}

function setup() {
  return render(<StrictMode><ConfirmProvider><Launcher /></ConfirmProvider></StrictMode>);
}

afterEach(cleanup);

describe('ConfirmProvider', () => {
  it('queues simultaneous requests without losing either result', async () => {
    setup();
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      void confirm({ title: 'First request', description: 'First consequence' }).then(first);
      void confirm({ title: 'Second request', description: 'Second consequence' }).then(second);
    });
    expect(screen.getByRole('dialog').textContent).toContain('First request');
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await waitFor(() => expect(first).toHaveBeenCalledWith(true));
    expect(second).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('Second request');
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(second).toHaveBeenCalledWith(false));
    expect(first).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('settles active and queued requests as cancelled when the provider unmounts', async () => {
    const view = setup();
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      void confirm({ title: 'First', description: 'First' }).then(first);
      void confirm({ title: 'Second', description: 'Second' }).then(second);
    });
    view.unmount();
    await waitFor(() => {
      expect(first).toHaveBeenCalledWith(false);
      expect(second).toHaveBeenCalledWith(false);
    });
  });

  it('focuses Cancel and returns keyboard focus to the launcher after Escape', async () => {
    setup();
    const launcher = screen.getByRole('button', { name: 'Open confirmation' });
    launcher.focus();
    fireEvent.click(launcher);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Cancel/ })));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  });

  it('resolves cancellation when the close control is used', async () => {
    setup();
    const result = vi.fn();
    act(() => { void confirm({ title: 'Close test', description: 'Consequence' }).then(result); });
    fireEvent.click(screen.getByRole('button', { name: /Close dialog/ }));
    await waitFor(() => expect(result).toHaveBeenCalledWith(false));
  });
});

describe('ConfirmDialog', () => {
  it('does not dismiss or confirm while a mutation is loading', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Saving" description="Please wait" loading onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(screen.queryByRole('button', { name: /Close dialog/ })).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the default action keyboard-focused for non-destructive confirmations', async () => {
    render(<ConfirmDialog open title="Archive" description="Can be restored" variant="default" onOpenChange={() => {}} onConfirm={() => {}} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Confirm/ })));
  });
});
