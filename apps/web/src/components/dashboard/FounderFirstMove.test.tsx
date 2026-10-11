import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listCommitmentCards } from '@/lib/commitments-api';
import {
  FIRST_MOVE_LATER_KEY,
  FounderFirstMove,
  RestOfDashboardToggle,
  firstMoveLayout,
  useFirstMoveState,
  useStoredFlag,
} from './FounderFirstMove';

vi.mock('@/lib/commitments-api', () => ({ listCommitmentCards: vi.fn() }));

/**
 * The founder's first screen: one move (who the startup needs) instead of the
 * whole dashboard, and nothing removed - the rest is one remembered press away.
 */

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.mocked(listCommitmentCards).mockReset();
});

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

function StateProbe() {
  const { state, count, settled } = useFirstMoveState();
  return <p>{`${state}:${count ?? '-'}:${settled ? 'settled' : 'waiting'}`}</p>;
}

describe('first move state', () => {
  it('is "first" only when the list answers with no card', async () => {
    vi.mocked(listCommitmentCards).mockResolvedValue([]);
    wrap(<StateProbe />);
    await screen.findByText('first:0:settled');
    expect(listCommitmentCards).toHaveBeenCalledWith({ mine: true });
  });

  it('is "posted" once a card exists', async () => {
    vi.mocked(listCommitmentCards).mockResolvedValue([{ id: 'c1', isMine: true } as never]);
    wrap(<StateProbe />);
    await screen.findByText('posted:1:settled');
  });

  it('never reads a failure as "no cards", and still lets the tour go', async () => {
    vi.mocked(listCommitmentCards).mockRejectedValue(new Error('500'));
    wrap(<StateProbe />);
    await screen.findByText('unknown:-:settled');
  });
});

describe('first move layout', () => {
  const base = { state: 'first' as const, later: false, checklistDone: false, checklistDismissed: false, full: false };

  it('folds the rest for a founder with no card who is just starting', () => {
    expect(firstMoveLayout(base)).toEqual({ showFirstMove: true, restFoldable: true, restFolded: true });
  });

  it('opens the rest once asked, and keeps the toggle', () => {
    expect(firstMoveLayout({ ...base, full: true })).toEqual({ showFirstMove: true, restFoldable: true, restFolded: false });
  });

  it('never folds the dashboard of a founder past getting started', () => {
    expect(firstMoveLayout({ ...base, checklistDone: true }).restFoldable).toBe(false);
    expect(firstMoveLayout({ ...base, checklistDismissed: true }).restFoldable).toBe(false);
    expect(firstMoveLayout({ ...base, checklistDone: true }).showFirstMove).toBe(true);
  });

  it('shows nothing new once a card exists, after "Not now", or while anything is unknown', () => {
    expect(firstMoveLayout({ ...base, state: 'posted' })).toEqual({ showFirstMove: false, restFoldable: false, restFolded: false });
    expect(firstMoveLayout({ ...base, later: true }).showFirstMove).toBe(false);
    expect(firstMoveLayout({ ...base, state: 'unknown' }).showFirstMove).toBe(false);
    expect(firstMoveLayout({ ...base, later: undefined }).showFirstMove).toBe(false);
    expect(firstMoveLayout({ ...base, checklistDismissed: undefined }).restFolded).toBe(false);
    expect(firstMoveLayout({ ...base, full: undefined }).restFolded).toBe(false);
  });
});

describe('first move card', () => {
  it('offers the three kinds, each opening the guide set to that kind', () => {
    wrap(<FounderFirstMove onLater={() => {}} />);
    expect(screen.getByRole('heading', { name: /Who does your startup need/ })).toBeTruthy();
    const kinds = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(kinds).toEqual(
      expect.arrayContaining([
        '/commitments/new?kind=cofounder',
        '/commitments/new?kind=equity_role',
        '/commitments/new?kind=investor_intro',
        '/opportunities',
      ]),
    );
    expect(screen.getByText(/Nothing is promised until both of you confirm the terms/)).toBeTruthy();
  });

  it('"Not now" hands the choice back to the page', () => {
    const onLater = vi.fn();
    wrap(<FounderFirstMove onLater={onLater} />);
    fireEvent.click(screen.getByRole('button', { name: /Not now/ }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('names what the fold holds and reports whether it is open', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<RestOfDashboardToggle open={false} onToggle={onToggle} controls="rest" stepsDone={2} stepsTotal={5} />);
    const button = screen.getByRole('button', { name: /Show the rest of the dashboard/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('rest');
    expect(button.textContent).toMatch(/Getting started 2 of 5/);
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
    rerender(<RestOfDashboardToggle open onToggle={onToggle} controls="rest" stepsDone={2} stepsTotal={5} />);
    expect(screen.getByRole('button', { name: /Hide the rest of the dashboard/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('remembered choices', () => {
  function Flag() {
    const [on, set] = useStoredFlag(FIRST_MOVE_LATER_KEY);
    return <button type="button" onClick={() => set(!on)}>{on === undefined ? 'unread' : on ? 'on' : 'off'}</button>;
  }

  it('reads after mount and writes through to storage', async () => {
    localStorage.setItem(FIRST_MOVE_LATER_KEY, '1');
    render(<Flag />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('on'));
    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(screen.getByRole('button').textContent).toBe('off');
    expect(localStorage.getItem(FIRST_MOVE_LATER_KEY)).toBeNull();
  });
});
