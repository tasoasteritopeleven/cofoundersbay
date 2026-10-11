import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageRail, type PageRailSection } from './PageRail';
import { PageRailProvider, currentRailSections } from './PageRailContext';
import { executeAction } from '@/lib/action-registry';

/**
 * The assistant's way into a page's rail, end to end: a mounted rail lists
 * its sections, `open_rail_section` opens one of them, and asking for a
 * section the page does not have says which ones it does.
 *
 * What this cannot show: the peek's position and the panel's layout, which
 * need a real browser (the live sweep covers them).
 */

const SECTIONS: PageRailSection[] = [
  { id: 'totals', glyph: 'chart', labelEn: 'User totals', labelEl: 'Σύνολα χρηστών', badge: 2, content: <p>Totals body</p> },
  { id: 'filters', glyph: 'target', labelEn: 'Narrow the list', labelEl: 'Φιλτράρισμα λίστας', content: <p>Filters body</p> },
];

function mount() {
  return render(
    <PageRailProvider>
      <PageRail sections={SECTIONS} />
    </PageRailProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the assistant and a mounted rail', () => {
  it('lists the rail’s sections without their content', () => {
    mount();
    expect(currentRailSections()).toEqual([
      { id: 'totals', labelEn: 'User totals', labelEl: 'Σύνολα χρηστών', badge: 2 },
      { id: 'filters', labelEn: 'Narrow the list', labelEl: 'Φιλτράρισμα λίστας', badge: null },
    ]);
  });

  it('opens the named section as a sheet below the desktop width', async () => {
    // The test setup evaluates width queries against innerWidth.
    vi.stubGlobal('innerWidth', 390);
    mount();
    expect(screen.queryByText('Filters body')).toBeNull();

    let outcome: Awaited<ReturnType<typeof executeAction>> | undefined;
    await act(async () => {
      outcome = await executeAction('open_rail_section', { section: 'filters' });
    });

    expect(outcome).toEqual({ ok: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Filters body')).toBeTruthy();
  });

  it('peeks on the desktop without also opening the phone sheet', async () => {
    // The sheet is portaled, so its `lg:hidden` wrapper never hid it: opening
    // both put a modal sheet over the desktop peek.
    vi.stubGlobal('innerWidth', 1280);
    mount();

    await act(async () => {
      await executeAction('open_rail_section', { section: 'filters' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Filters body')).toBeTruthy();
  });

  it('opens the focused section rather than the first one for keyboard users', () => {
    vi.stubGlobal('innerWidth', 1280);
    mount();
    act(() => screen.getByRole('button', { name: /Narrow the list/ }).focus());
    expect(screen.getByRole('region', { name: /Narrow the list/ })).toBeTruthy();
    expect(screen.getByText('Filters body')).toBeTruthy();
    expect(screen.queryByText('Totals body')).toBeNull();
  });

  it('says which sections exist when asked for one that does not', async () => {
    mount();
    const outcome = await executeAction('open_rail_section', { section: 'export' });
    expect(outcome).toEqual({
      ok: false,
      error: 'This page has no "export" section. Its tools are: User totals, Narrow the list.',
    });
  });

  it('forgets the sections once the rail is gone', async () => {
    const view = mount();
    view.unmount();
    expect(currentRailSections()).toEqual([]);
    await expect(executeAction('open_rail_section', { section: 'filters' })).resolves.toEqual({
      ok: false,
      error: 'This page has no tools panel.',
    });
  });
});
