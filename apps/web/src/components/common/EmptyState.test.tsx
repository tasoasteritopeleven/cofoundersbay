import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

describe('calm, actionable empty states', () => {
  it.each(['search', 'connection', 'message', 'rocket', 'profile', 'calendar', 'default'] as const)('preserves %s illustration and hides decorative graphics from assistive technology', (illustration) => {
    const action = vi.fn();
    const { container } = render(<EmptyState illustration={illustration} title="No results / Δεν υπάρχουν αποτελέσματα" description="Change the filters to broaden your search." action={<button onClick={action}>Reset filters</button>} />);
    expect(screen.getByText('No results / Δεν υπάρχουν αποτελέσματα')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(action).toHaveBeenCalledOnce();
  });

  it('centres illustrations and limits text width without perpetual decoration', () => {
    const { container } = render(<EmptyState title="Start here" description="An explanation" />);
    const svg = container.querySelector('svg')!;
    expect(svg.parentElement?.className).toContain('mx-auto');
    expect(container.innerHTML).not.toMatch(/animate-(float|pulse|spin|bounce)/);
    expect(screen.getByText('An explanation').className).toContain('max-w-prose');
  });

  it('keeps all sizes, custom styling, and optional content', () => {
    const { container } = render(<EmptyState title="Ready" size="sm" className="custom-empty" />);
    expect(container.firstElementChild?.className).toContain('custom-empty');
    expect(container.firstElementChild?.className).toContain('p-4');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
