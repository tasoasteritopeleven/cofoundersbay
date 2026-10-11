import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from './button';

afterEach(cleanup);

describe('shared button interaction contract', () => {
  it.each(['disabled', 'loading'] as const)('prevents activation of an asChild link while %s', (state) => {
    const activate = vi.fn();
    render(<Button asChild {...{ [state]: true }}><a href="#destination" onClick={activate}>Continue</a></Button>);
    const link = screen.getByRole('link', { name: 'Continue' });
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
    expect(fireEvent.click(link)).toBe(false);
    expect(activate).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
    if (state === 'loading') expect(link.getAttribute('aria-busy')).toBe('true');
  });

  it('preserves child and caller handlers, destination, and focus when enabled', () => {
    const child = vi.fn();
    const parent = vi.fn();
    render(<Button asChild onClick={parent}><a href="#destination" onClick={child}>Continue</a></Button>);
    const link = screen.getByRole('link', { name: 'Continue' });
    fireEvent.click(link);
    expect(child).toHaveBeenCalledOnce();
    expect(parent).toHaveBeenCalledOnce();
    expect(link.getAttribute('href')).toBe('#destination');
    expect(link.getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps explicit submit semantics and accessible loading labels', () => {
    const submit = vi.fn((event) => event.preventDefault());
    const { rerender } = render(<form onSubmit={submit}><Button type="submit">Save</Button></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submit).toHaveBeenCalledOnce();
    rerender(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
