import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasDrawToolbar } from './CanvasDrawToolbar';

afterEach(cleanup);

describe('CanvasDrawToolbar', () => {
  it('exposes a toolbar of named tools and reports the active one', () => {
    const onToolChange = vi.fn();
    render(<CanvasDrawToolbar activeTool="select" onToolChange={onToolChange} />);

    expect(screen.getByRole('toolbar', { name: 'Drawing tools' })).toBeTruthy();
    const select = screen.getByRole('button', { name: 'Select (V)' });
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(pan.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Rectangle (R)' }));
    expect(onToolChange).toHaveBeenCalledExactlyOnceWith('shape_rect');
  });

  it('toggles the shape library from a labelled control', () => {
    const onToggleLibrary = vi.fn();
    render(
      <CanvasDrawToolbar
        activeTool="hand"
        onToolChange={vi.fn()}
        onToggleLibrary={onToggleLibrary}
        libraryOpen
      />,
    );

    const library = screen.getByRole('button', { name: 'Shape Library' });
    expect(library.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(library);
    expect(onToggleLibrary).toHaveBeenCalledTimes(1);
  });

  it('lays out as a horizontal strip that becomes a vertical rail from sm', () => {
    const { container } = render(<CanvasDrawToolbar activeTool="select" onToolChange={vi.fn()} />);
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar?.className).toContain('flex-row');
    expect(toolbar?.className).toContain('sm:flex-col');
    expect(toolbar?.className).toContain('overflow-x-auto');
  });
});
