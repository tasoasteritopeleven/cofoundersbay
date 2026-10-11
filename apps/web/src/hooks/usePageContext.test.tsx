import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { usePageContext } from './usePageContext';
import { PageSnapshotProvider, usePublishPageSnapshot } from '@/contexts/PageSnapshotContext';

/**
 * The assistant's floor of page context.
 *
 * Snapshot publishing is opt-in per page, and three pages had opted in — on
 * the other 152 the assistant received a bare path string. `usePageContext`
 * now falls back to the page registry, which already names and describes
 * every route in both languages, so a page that publishes nothing still hands
 * the assistant its identity. These tests are the gate the plan asked for:
 * a non-null `screen` on a sample of routes across sections, and proof that a
 * page's own snapshot still wins over the floor.
 */

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

let locale = 'en';
vi.mock('@/components/common/I18nProvider', () => ({
  useI18n: () => ({ locale }),
}));

afterEach(cleanup);
beforeEach(() => {
  pathname = '/';
  locale = 'en';
});

function Reader() {
  const ctx = usePageContext();
  return <div data-testid="ctx">{JSON.stringify(ctx)}</div>;
}

function read() {
  return JSON.parse(screen.getByTestId('ctx').textContent || '{}');
}

describe('the registry floor', () => {
  // One route per section: Work, Explore, Admin, Account, Community, and the
  // role dashboards that were among the 49 the registry did not know.
  const sample = [
    '/matches',
    '/fundraising',
    '/mentor/dashboard',
    '/provider/services',
    '/investor/portfolio',
    '/admin/audit-log',
    '/settings/ai',
    '/groups',
  ];

  it.each(sample)('gives the assistant a screen for %s without the page publishing anything', (route) => {
    pathname = route;
    render(<Reader />);
    const ctx = read();
    expect(ctx.screen).toBeTruthy();
    expect(ctx.screen.route).toBe(route);
    expect(ctx.screen.title).toBeTruthy();
    expect(ctx.screen.summary).toBeTruthy();
  });

  it('speaks the reader’s language when the registry carries both', () => {
    pathname = '/mentor/dashboard';
    locale = 'el';
    render(<Reader />);
    expect(read().screen.title).toBe('Πίνακας μέντορα');
  });

  it('does not claim a state it cannot know', () => {
    // A floor that said `ready` would be lying exactly on the pages where the
    // assistant most needs the truth — loading, empty, error.
    pathname = '/matches';
    render(<Reader />);
    expect(read().screen.state).toBeUndefined();
  });

  it('yields to the snapshot a page publishes itself', () => {
    pathname = '/readiness';
    function Publisher() {
      usePublishPageSnapshot('/readiness', { title: 'Readiness Score', state: 'ready', figures: { Overall: '64%' } });
      return null;
    }
    render(
      <PageSnapshotProvider>
        <Publisher />
        <Reader />
      </PageSnapshotProvider>,
    );
    const ctx = read();
    expect(ctx.screen.state).toBe('ready');
    expect(ctx.screen.figures).toEqual({ Overall: '64%' });
  });

  it('ignores a published snapshot that belongs to another route', () => {
    // Navigation can outrun the leaving page's cleanup for a frame; the
    // assistant must not describe the screen the reader just left.
    pathname = '/jobs';
    function StalePublisher() {
      usePublishPageSnapshot('/matches', { title: 'Matches', state: 'ready' });
      return null;
    }
    render(
      <PageSnapshotProvider>
        <StalePublisher />
        <Reader />
      </PageSnapshotProvider>,
    );
    const ctx = read();
    // The floor for /jobs, not the stale /matches snapshot.
    expect(ctx.screen.route).toBe('/jobs');
    expect(ctx.screen.title).not.toBe('Matches');
  });
});
