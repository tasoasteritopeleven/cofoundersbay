import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatePost } from './CreatePost';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function open(onSubmit: () => Promise<void>) {
  render(<CreatePost user={{ displayName: 'Eleni Markou' }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByText("What's on your mind?"));
}

describe('CreatePost', () => {
  it('labels content and tags durably', () => {
    open(vi.fn().mockResolvedValue(undefined));
    expect(screen.getByLabelText(/Post content/)).toBeTruthy();
    expect(screen.getByLabelText(/^Tags/)).toBeTruthy();
  });

  it('keeps attachment controls disabled with an explanation', () => {
    open(vi.fn().mockResolvedValue(undefined));
    const img = screen.getByRole('button', { name: /Add image/ }) as HTMLButtonElement;
    expect(img.disabled).toBe(true);
    expect(img.title).toMatch(/Not available yet/);
  });

  it('preserves the draft and shows an alert when submission fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSubmit = vi.fn().mockRejectedValue(new Error('500'));
    open(onSubmit);
    fireEvent.change(screen.getByLabelText(/Post content/), { target: { value: 'Looking for a CTO' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/draft is kept/));
    expect((screen.getByLabelText(/Post content/) as HTMLTextAreaElement).value).toBe('Looking for a CTO');
  });

  it('clears the draft after a successful submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    open(onSubmit);
    fireEvent.change(screen.getByLabelText(/Post content/), { target: { value: 'Shipped v1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ type: 'update', content: 'Shipped v1', tags: [] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
