import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShellFrame } from './AppShell';

/**
 * During a cross-section navigation React holds the outgoing segment's
 * AppShellFrame and the incoming one in the DOM at once. Both render
 * <main id="main-content">, and axe caught the pair once on /discover.
 * The frame settles it: the newest commit strips any other landmark's id
 * before asserting its own, so the accessibility tree never sees two.
 */

// The real chrome pulls in router, role and query machinery; the landmark
// rule this guards lives on the frame's <main>, so the chrome is a stand-in.
vi.mock('./SideNav', () => ({ SideNav: () => <nav aria-label="Primary" /> }));
vi.mock('./TopBar', () => ({ TopBar: () => <header /> }));
vi.mock('./MobileBottomNav', () => ({ MobileBottomNav: () => <nav aria-label="Sections" /> }));
vi.mock('./CommandPaletteHost', () => ({ CommandPaletteHost: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./PageRail', () => ({ PageRail: () => null }));

const mains = () => document.querySelectorAll('main#main-content');

afterEach(cleanup);

describe('one main landmark, even across a route transition', () => {
  it('a lone frame renders main#main-content, focusable for the skip link', () => {
    render(<AppShellFrame><p>Page</p></AppShellFrame>);
    expect(mains()).toHaveLength(1);
    expect(mains()[0].getAttribute('tabindex')).toBe('-1');
  });

  it('while two frames overlap, the newest commit owns the id', () => {
    render(
      <>
        <AppShellFrame><p>Outgoing page</p></AppShellFrame>
        <AppShellFrame><p>Incoming page</p></AppShellFrame>
      </>,
    );
    expect(mains()).toHaveLength(1);
    expect(mains()[0].textContent).toContain('Incoming page');
  });

  it('after the outgoing frame unmounts, exactly one landmark remains', () => {
    const { rerender } = render(
      <>
        <AppShellFrame><p>Outgoing page</p></AppShellFrame>
        <AppShellFrame><p>Incoming page</p></AppShellFrame>
      </>,
    );
    rerender(<AppShellFrame><p>Incoming page</p></AppShellFrame>);
    expect(mains()).toHaveLength(1);
    expect(mains()[0].textContent).toContain('Incoming page');
  });
});
