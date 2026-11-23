import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageRail, type PageRailSection } from './PageRail';
import { PageRailProvider, closePageTools, currentRailSections } from './PageRailContext';
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
  // A pin is remembered; one test's must not open the next one's rail.
  try {
    window.localStorage.clear();
  } catch {
    // storage blocked: nothing was remembered
  }
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

describe('a link in a section asking the tools to step aside', () => {
  it('returns focus to the thread tools opener after Escape', async () => {
    vi.stubGlobal('innerWidth', 390);
    mount();
    render(<button type="button" onClick={(event) => window.dispatchEvent(new CustomEvent('cfb-open-page-tools', { detail: event.currentTarget }))}>Thread tools</button>);
    const opener = screen.getByRole('button', { name: 'Thread tools' });
    fireEvent.click(opener);
    const sheet = screen.getByRole('dialog');
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('closes the sheet on a phone, so the place that was asked for is in view', async () => {
    vi.stubGlobal('innerWidth', 390);
    mount();
    await act(async () => {
      await executeAction('open_rail_section', { section: 'filters' });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => closePageTools());

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes a peek on the desktop', async () => {
    vi.stubGlobal('innerWidth', 1280);
    mount();
    await act(async () => {
      await executeAction('open_rail_section', { section: 'filters' });
    });
    expect(screen.getByText('Filters body')).toBeTruthy();

    act(() => closePageTools());

    expect(screen.queryByText('Filters body')).toBeNull();
  });

  it('leaves a pinned rail where the reader put it', async () => {
    vi.stubGlobal('innerWidth', 1280);
    mount();
    await act(async () => {
      await executeAction('open_rail_section', { section: 'filters' });
    });
    // The strip's pin button keeps the rail open (a preference, not a glance).
    act(() => screen.getAllByRole('button', { name: /Keep page tools open/ })[0].click());
    expect(screen.getByText('Filters body')).toBeTruthy();

    act(() => closePageTools());

    expect(screen.getByText('Filters body')).toBeTruthy();
  });

  it('does nothing when no rail is on the page', () => {
    expect(() => closePageTools()).not.toThrow();
  });

  describe('under a pointer that rests on the panel', () => {
    // Closing the panel reflows the rail, and the browser answers with a fresh
    // `mouseenter`: without a hold it reopened at once, over the right edge of
    // the card the reader had just asked for.
    const rail = () => document.querySelector('aside[data-page-rail]') as HTMLElement;

    it('stays closed until the pointer leaves, then peeks as before', () => {
      vi.stubGlobal('innerWidth', 1280);
      mount();
      fireEvent.mouseEnter(rail());
      expect(screen.getByText('Totals body')).toBeTruthy();

      act(() => closePageTools());
      expect(screen.queryByText('Totals body')).toBeNull();

      // The reflow's fresh enter is not a new visit.
      fireEvent.mouseEnter(rail());
      expect(screen.queryByText('Totals body')).toBeNull();

      // Leaving ends the hold; the next visit peeks again.
      fireEvent.mouseLeave(rail());
      fireEvent.mouseEnter(rail());
      expect(screen.getByText('Totals body')).toBeTruthy();
    });

    it('holds after Escape the same way', () => {
      vi.stubGlobal('innerWidth', 1280);
      mount();
      fireEvent.mouseEnter(rail());
      expect(screen.getByText('Totals body')).toBeTruthy();

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(screen.queryByText('Totals body')).toBeNull();

      fireEvent.mouseEnter(rail());
      expect(screen.queryByText('Totals body')).toBeNull();
    });

    it('never holds off keyboard focus: a reader tabbing back in still gets the panel', () => {
      vi.stubGlobal('innerWidth', 1280);
      mount();
      fireEvent.mouseEnter(rail());
      act(() => closePageTools());
      expect(screen.queryByText('Filters body')).toBeNull();

      act(() => screen.getByRole('button', { name: /Narrow the list/ }).focus());

      expect(screen.getByText('Filters body')).toBeTruthy();
    });

    it('does not hold anything when the panel was not open', () => {
      vi.stubGlobal('innerWidth', 1280);
      mount();
      // A jump from a rail that was never opened (a keyboard link in the
      // sheet, an assistant command) must not swallow the first real visit.
      act(() => closePageTools());
      fireEvent.mouseEnter(rail());
      expect(screen.getByText('Totals body')).toBeTruthy();
    });
  });
});
