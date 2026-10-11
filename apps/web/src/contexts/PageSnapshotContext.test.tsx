import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { useState } from 'react';
import {
  PageSnapshotProvider,
  usePageSnapshot,
  usePublishPageSnapshot,
  type PageSnapshot,
} from './PageSnapshotContext';

/**
 * The channel between a page and the assistant.
 *
 * The risk this carries is not correctness but a render loop: a page publishes
 * an object literal, which is a new reference every render, so storing it
 * naively sets state on every render for as long as the page is mounted. This
 * project has been bitten by exactly that, so the comparison is by value and
 * these cases pin it down.
 */

afterEach(cleanup);

function Reader() {
  const snapshot = usePageSnapshot();
  return <div data-testid="read">{snapshot ? JSON.stringify(snapshot) : 'none'}</div>;
}

let renders = 0;
function Publisher({ route, snapshot }: { route: string; snapshot: PageSnapshot | null }) {
  renders++;
  // A fresh literal each render, the way a real page writes it.
  usePublishPageSnapshot(route, snapshot ? { ...snapshot } : null);
  return null;
}

describe('publishing what is on screen', () => {
  it('hands the page’s snapshot to whoever reads it, tagged with the route', () => {
    render(
      <PageSnapshotProvider>
        <Publisher route="/readiness" snapshot={{ title: 'Readiness Score', state: 'ready' }} />
        <Reader />
      </PageSnapshotProvider>,
    );
    const read = JSON.parse(screen.getByTestId('read').textContent || '{}');
    expect(read).toEqual({ route: '/readiness', title: 'Readiness Score', state: 'ready' });
  });

  it('reads as nothing outside a provider, so the assistant simply learns less', () => {
    render(<Reader />);
    expect(screen.getByTestId('read').textContent).toBe('none');
  });

  it('does not re-render on a new object with identical contents', () => {
    // The loop guard. Without it this component would publish, set state, be
    // re-rendered, publish a new literal, and never settle.
    function Harness() {
      const [tick, setTick] = useState(0);
      return (
        <PageSnapshotProvider>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            bump {tick}
          </button>
          <Publisher route="/analytics" snapshot={{ title: 'Analytics', state: 'ready' }} />
          <Reader />
        </PageSnapshotProvider>
      );
    }
    renders = 0;
    render(<Harness />);
    const settled = renders;

    act(() => { screen.getByRole('button').click(); });
    act(() => { screen.getByRole('button').click(); });

    // Two parent re-renders means at most two more publisher renders; a loop
    // would put this in the hundreds before the test even returned.
    expect(renders).toBeLessThanOrEqual(settled + 4);
    expect(JSON.parse(screen.getByTestId('read').textContent || '{}').title).toBe('Analytics');
  });

  it('replaces the snapshot when the page’s own figures change', () => {
    function Harness() {
      const [pct, setPct] = useState(64);
      return (
        <PageSnapshotProvider>
          <button type="button" onClick={() => setPct(68)}>change</button>
          <Publisher route="/readiness" snapshot={{ figures: { Overall: `${pct}%` } }} />
          <Reader />
        </PageSnapshotProvider>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('read').textContent).toContain('64%');
    act(() => { screen.getByRole('button').click(); });
    expect(screen.getByTestId('read').textContent).toContain('68%');
  });

  it('clears on unmount, so a screen the reader has left is not described', () => {
    function Harness() {
      const [showing, setShowing] = useState(true);
      return (
        <PageSnapshotProvider>
          <button type="button" onClick={() => setShowing(false)}>leave</button>
          {showing && <Publisher route="/matches" snapshot={{ title: 'Matches' }} />}
          <Reader />
        </PageSnapshotProvider>
      );
    }
    render(<Harness />);
    expect(screen.getByTestId('read').textContent).toContain('Matches');
    act(() => { screen.getByRole('button').click(); });
    expect(screen.getByTestId('read').textContent).toBe('none');
  });

  it('publishes nothing while the page has nothing true to say', () => {
    // A half-filled snapshot during a load would have the assistant report
    // zero matches to someone whose matches have not arrived.
    render(
      <PageSnapshotProvider>
        <Publisher route="/jobs" snapshot={null} />
        <Reader />
      </PageSnapshotProvider>,
    );
    expect(screen.getByTestId('read').textContent).toBe('none');
  });
});
