import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedPostComposer } from './FeedPostComposer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const box = () => screen.getByRole('textbox', { name: /Write a post/ }) as HTMLTextAreaElement;

describe('FeedPostComposer', () => {
  it('offers all five types with bilingual names and posts the chosen one', async () => {
    const onPost = vi.fn();
    render(<FeedPostComposer onPost={onPost} />);
    fireEvent.focus(box());
    for (const n of [/Update/, /Milestone/, /Question/, /Announcement/, /Achievement/]) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    const q = screen.getByRole('button', { name: /Question\. Ερώτηση/ });
    fireEvent.click(q);
    expect(q.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(box(), { target: { value: 'Anyone tried Stripe Atlas?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }));
    await waitFor(() => expect(onPost).toHaveBeenCalledWith('Anyone tried Stripe Atlas?', 'question'));
    await waitFor(() => expect(box().value).toBe(''));
  });

  it('keeps the draft and shows inline feedback when onPost throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<FeedPostComposer onPost={() => { throw new Error('boom'); }} />);
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value: 'Draft text' } });
    fireEvent.click(screen.getByRole('button', { name: /^Post/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/draft is still here/));
    expect(box().value).toBe('Draft text');
  });

  it('wraps the toolbar and keeps a visible focus ring', () => {
    render(<FeedPostComposer onPost={vi.fn()} />);
    fireEvent.focus(box());
    expect(box().className).toMatch(/focus-visible:ring-2/);
    expect(box().className).not.toMatch(/focus-visible:ring-0/);
    expect(screen.getByRole('group', { name: /Post type/ }).parentElement?.className).toMatch(/flex-wrap/);
    expect((screen.getByRole('button', { name: /Attach an image/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
