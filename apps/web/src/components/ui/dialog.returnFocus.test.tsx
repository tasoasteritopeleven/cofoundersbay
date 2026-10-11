import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

/**
 * Controlled dialogs (a button sets `open`, no DialogTrigger) are almost every
 * dialog in the product. Radix returns focus only to a DialogTrigger, so these
 * left a keyboard user on <body> after Escape - 66 of 78 dialogs measured.
 */
function Harness({ autoFocusField = false }: { autoFocusField?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open settings</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Change things</DialogDescription>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input aria-label="Name" autoFocus={autoFocusField} />
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('DialogContent returns focus to its opener', () => {
  afterEach(cleanup);
  it.each([
    ['a plain controlled dialog', false],
    // Radix skips its open event when an autoFocus field already holds focus,
    // so the opener has to come from the outside-focus tracker.
    ['a dialog whose field autofocuses', true],
  ])('%s', async (_, autoFocusField) => {
    render(<Harness autoFocusField={autoFocusField} />);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
