import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareModal } from './share-modal';

const URL_ = 'https://example.test/p/1';

function setClipboard(writeText?: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: writeText ? { writeText } : undefined });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ShareModal', () => {
  it('announces success after the Clipboard API copies', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<ShareModal open onClose={() => {}} url={URL_} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Link copied/));
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it('reports failure when the fallback copy does not happen', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    (document as unknown as { execCommand: () => boolean }).execCommand = vi.fn(() => false);
    render(<ShareModal open onClose={() => {}} url={URL_} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Couldn't copy/));
    expect(screen.queryByText(/Copied!/)).toBeNull();
  });

  it('treats a successful fallback copy as success', async () => {
    setClipboard(undefined);
    (document as unknown as { execCommand: () => boolean }).execCommand = vi.fn(() => true);
    render(<ShareModal open onClose={() => {}} url={URL_} />);
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Link copied/));
  });

  it('keeps every channel and names the link field', () => {
    render(<ShareModal open onClose={() => {}} url={URL_} />);
    for (const n of [/Twitter/, /LinkedIn/, /Facebook/, /Email/]) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Link/ })).toBeTruthy();
  });
});
