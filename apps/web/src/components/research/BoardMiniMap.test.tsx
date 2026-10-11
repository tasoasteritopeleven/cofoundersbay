import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardMiniMap } from './BoardMiniMap';
import type { ResearchNode } from '@/lib/api';

afterEach(cleanup);

const nodes = [
  {
    id: 'n1',
    type: 'note',
    posX: 100,
    posY: 80,
    width: 200,
    height: 120,
    color: '#FDE68A',
  },
] as unknown as ResearchNode[];

describe('BoardMiniMap', () => {
  it('renders the desktop size by default and a compact phone size when asked', () => {
    const { rerender, container } = render(
      <BoardMiniMap
        nodes={nodes}
        pan={{ x: 0, y: 0 }}
        zoom={1}
        viewportWidth={800}
        viewportHeight={600}
        onNavigate={vi.fn()}
      />,
    );

    const frame = container.firstElementChild as HTMLElement;
    expect(frame.dataset.compact).toBe('false');
    expect(frame.style.width).toBe('182px');
    expect(screen.getByRole('img', { name: 'Canvas mini-map' }).getAttribute('width')).toBe('180');

    rerender(
      <BoardMiniMap
        nodes={nodes}
        pan={{ x: 0, y: 0 }}
        zoom={1}
        viewportWidth={800}
        viewportHeight={600}
        onNavigate={vi.fn()}
        compact
      />,
    );
    expect(frame.dataset.compact).toBe('true');
    expect(screen.getByRole('img', { name: 'Canvas mini-map' }).getAttribute('width')).toBe('112');
  });

  it('navigates the canvas when the map is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <BoardMiniMap
        nodes={nodes}
        pan={{ x: 0, y: 0 }}
        zoom={1}
        viewportWidth={400}
        viewportHeight={300}
        onNavigate={onNavigate}
      />,
    );

    const svg = screen.getByRole('img', { name: 'Canvas mini-map' });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 180, bottom: 120, width: 180, height: 120, x: 0, y: 0, toJSON: () => ({}),
    });
    fireEvent.click(svg, { clientX: 90, clientY: 60 });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
});
