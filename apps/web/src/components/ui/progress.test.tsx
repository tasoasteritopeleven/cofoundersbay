import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Progress } from './progress';

afterEach(cleanup);

describe('Progress', () => {
  it('exposes the same percentage visually and to assistive technology', () => {
    render(<Progress value={42} aria-label="Readiness" />);
    const bar = screen.getByRole('progressbar', { name: 'Readiness' });
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(-58%)');
  });

  it('respects a custom maximum in the visual fill', () => {
    render(<Progress value={3} max={5} aria-label="Steps" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(-40%)');
  });

  it.each([0, 100])('exposes determinate progress at %s', (value) => {
    render(<Progress value={value} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(value));
  });

  it.each([undefined, null, -1, 101, NaN, Infinity])('keeps invalid or missing values indeterminate: %s', (value) => {
    render(<Progress value={value} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(bar.getAttribute('data-state')).toBe('indeterminate');
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(-100%)');
  });

  it.each([0, -5, NaN, Infinity])('uses the default maximum for an invalid max: %s', (max) => {
    render(<Progress value={50} max={max} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe('translateX(-50%)');
  });
});
