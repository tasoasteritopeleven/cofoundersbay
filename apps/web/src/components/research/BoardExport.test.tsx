import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BoardExport } from './BoardExport';

const { loadImage, toPng } = vi.hoisted(() => ({ loadImage: vi.fn(), toPng: vi.fn() }));
vi.mock('html-to-image', () => {
  loadImage();
  return { toPng };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

afterEach(cleanup);

it('loads the renderer on PNG export, not when the board or menu opens', async () => {
  const canvas = document.createElement('div');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  toPng.mockResolvedValue('data:image/png;base64,');
  render(<BoardExport board={{ title: 'Research' } as never} canvasRef={{ current: canvas }} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Export' }), { key: 'Enter' });
  expect(loadImage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Export as PNG' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(loadImage).toHaveBeenCalledOnce();
  expect(toPng).toHaveBeenCalledExactlyOnceWith(canvas, { cacheBust: true, pixelRatio: 2 });
});
