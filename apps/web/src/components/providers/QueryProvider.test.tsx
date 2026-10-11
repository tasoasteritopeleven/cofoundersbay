import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { dehydrate, QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from './QueryProvider';

const { getMe } = vi.hoisted(() => ({ getMe: vi.fn() }));
vi.mock('@/lib/api', () => ({
  getMe,
  ApiError: class ApiError extends Error { constructor(public status: number) { super('API error'); } },
  ApiNetworkError: class ApiNetworkError extends Error {},
}));

let client: QueryClient;
function Probe() {
  client = useQueryClient();
  const { data } = useQuery({ queryKey: ['private'], queryFn: () => 'fresh', enabled: false });
  return <span>{data ?? 'empty'}</span>;
}

function setup() {
  return render(<StrictMode><QueryProvider><Probe /></QueryProvider></StrictMode>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = 'cfb_session=1; path=/';
  document.cookie = 'cfb_preview_demo=; max-age=0; path=/';
  document.cookie = 'cfb_primary_role=; max-age=0; path=/';
  getMe.mockReset().mockResolvedValue({ user: { id: 'server-user-a', role: 'founder' } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.cookie = 'cfb_session=; max-age=0; path=/';
  sessionStorage.clear();
  localStorage.clear();
});

describe('QueryProvider identity boundaries', () => {
  it('never restores an unscoped snapshot, even when display storage still names the old account', async () => {
    const previous = new QueryClient();
    previous.setQueryData(['private'], 'previous-account-secret');
    sessionStorage.setItem('cfb:rq-v1', JSON.stringify({
      timestamp: Date.now(), buster: '2026-03-b', clientState: dehydrate(previous),
    }));
    localStorage.setItem('user', JSON.stringify({ id: 'old-display-user' }));
    setup();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(screen.queryByText('previous-account-secret')).toBeNull();
    expect(sessionStorage.getItem('cfb:rq-v1')).toBeNull();
    expect(getMe).toHaveBeenCalled();
    previous.clear();
  });

  it.each(['cfb:login', 'cfb:logout'])('retires all queries and mutations on %s and rejects late fetch results', async (event) => {
    setup();
    await act(async () => {});
    const oldClient = client;
    const pending = deferred<string>();
    let signal!: AbortSignal;
    const result = oldClient.fetchQuery({ queryKey: ['pending'], queryFn: (context) => {
      signal = context.signal;
      return pending.promise;
    } }).catch(() => undefined);
    act(() => {
      oldClient.setQueryData(['private'], 'previous-account-secret');
      oldClient.getMutationCache().build(oldClient, { mutationKey: ['save'], mutationFn: async () => 'saved' });
      sessionStorage.setItem('cfb:rq-v1', 'stale snapshot');
      window.dispatchEvent(new Event(event));
    });
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    expect(oldClient.getMutationCache().getAll()).toHaveLength(0);
    expect(signal.aborted).toBe(true);
    expect(sessionStorage.getItem('cfb:rq-v1')).toBeNull();
    expect(client).not.toBe(oldClient);
    await act(async () => { pending.resolve('late secret'); await result; });
    expect(client.getQueryData(['pending'])).toBeUndefined();
    expect(screen.queryByText('previous-account-secret')).toBeNull();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
    expect(sessionStorage.getItem('cfb:rq-v1')).toBeNull();
  });

  it('uses the server identity on focus even if session presence and display storage are unchanged', async () => {
    setup();
    await act(async () => {});
    const oldClient = client;
    act(() => { oldClient.setQueryData(['private'], 'account-a'); });
    getMe.mockResolvedValue({ user: { id: 'server-user-b', role: 'founder' } });
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(client).not.toBe(oldClient));
    expect(screen.queryByText('account-a')).toBeNull();
  });

  it('keeps the client and data on ordinary rerenders and successful same-identity focus checks', async () => {
    const view = setup();
    await act(async () => {});
    const sameClient = client;
    act(() => { sameClient.setQueryData(['private'], 'current data'); });
    view.rerender(<StrictMode><QueryProvider><Probe /></QueryProvider></StrictMode>);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => {});
    expect(client).toBe(sameClient);
    expect(client.getQueryData(['private'])).toBe('current data');
  });

  it('clears rather than preserving an unverifiable identity after a failed focus check', async () => {
    setup();
    await act(async () => {});
    const oldClient = client;
    act(() => { oldClient.setQueryData(['private'], 'account-a'); });
    getMe.mockRejectedValue(new Error('identity unavailable'));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(client).not.toBe(oldClient));
    expect(client.getQueryData(['private'])).toBeUndefined();
  });

  it('ignores identity checks from a retired session', async () => {
    setup();
    await act(async () => {});
    const pending = deferred<{ user: { id: string; role: string } }>();
    getMe.mockReturnValueOnce(pending.promise);
    act(() => { window.dispatchEvent(new Event('focus')); });
    getMe.mockResolvedValue({ user: { id: 'server-user-b', role: 'founder' } });
    act(() => { window.dispatchEvent(new Event('cfb:login')); });
    await act(async () => {});
    const newClient = client;
    await act(async () => { pending.resolve({ user: { id: 'server-user-a', role: 'founder' } }); });
    expect(client).toBe(newClient);
  });

  it('clears on cross-tab session storage changes but ignores unrelated preferences', async () => {
    setup();
    await act(async () => {});
    const oldClient = client;
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'cfb:primary-language', newValue: 'el' })); });
    expect(client).toBe(oldClient);
    act(() => {
      localStorage.setItem('cfb_demo_data', '1');
      window.dispatchEvent(new StorageEvent('storage', { key: 'cfb_demo_data', newValue: '1' }));
    });
    expect(client).not.toBe(oldClient);
  });

  it('detects same-tab demo changes that emit no event', async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => {});
    const oldClient = client;
    localStorage.setItem('cfb_demo_data', '1');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(client).not.toBe(oldClient);
  });

  it('clears when a resolved membership tenant or its role changes, not its display name', async () => {
    setup();
    await act(async () => {});
    const membership = (id: string, name: string, role = 'member') => ({ memberships: [
      { id: 'membership', isActive: true, role, tenant: { id, name } },
    ] });
    act(() => { client.setQueryData(['tenant', 'memberships'], membership('a', 'Alpha')); });
    const oldClient = client;
    act(() => { client.setQueryData(['tenant', 'memberships'], membership('a', 'Renamed')); });
    expect(client).toBe(oldClient);
    act(() => { client.setQueryData(['tenant', 'memberships'], membership('b', 'Beta')); });
    expect(client).not.toBe(oldClient);
    const tenantClient = client;
    act(() => { client.setQueryData(['tenant', 'memberships'], membership('b', 'Beta')); });
    act(() => { client.setQueryData(['tenant', 'memberships'], membership('b', 'Beta', 'admin')); });
    expect(client).not.toBe(tenantClient);
  });

  it.each(['by-domain', 'by-slug'])('clears when a resolved tenant changes for %s', async (kind) => {
    setup();
    await act(async () => {});
    const data = (id: string) => kind === 'by-domain' ? { tenant: { id } } : { id };
    act(() => { client.setQueryData(['tenant', kind, 'community'], data('a')); });
    const oldClient = client;
    act(() => { client.setQueryData(['tenant', kind, 'community'], data('b')); });
    expect(client).not.toBe(oldClient);
  });

  it('remains usable when browser storage is blocked', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setup()).not.toThrow();
    await act(async () => {});
    act(() => { window.dispatchEvent(new Event('cfb:logout')); });
    expect(screen.getByText('empty')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('retains persistence only after server identity and tenant context resolve, and removes it on logout', async () => {
    setup();
    await act(async () => {});
    act(() => { client.setQueryData(['private'], 'verified data'); });
    expect(Object.keys(sessionStorage).filter(key => key.startsWith('cfb:rq-v2:'))).toHaveLength(0);
    await act(async () => { client.setQueryData(['tenant', 'memberships'], { memberships: [] }); });
    act(() => { client.setQueryData(['private'], 'persisted data'); });
    await waitFor(() => expect(Object.keys(sessionStorage).filter(key => key.startsWith('cfb:rq-v2:'))).toHaveLength(1));
    const key = Object.keys(sessionStorage).find(key => key.startsWith('cfb:rq-v2:'))!;
    expect(decodeURIComponent(key)).toContain('server-user-a');
    expect(sessionStorage.getItem(key)).toContain('persisted data');
    act(() => { window.dispatchEvent(new Event('cfb:logout')); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('restores a scoped snapshot only after the same server identity and tenant resolve', async () => {
    const view = setup();
    await act(async () => {});
    await act(async () => { client.setQueryData(['tenant', 'memberships'], { memberships: [] }); });
    act(() => { client.setQueryData(['private'], 'restored scoped data'); });
    await waitFor(() => expect(Object.keys(sessionStorage).some(key => key.startsWith('cfb:rq-v2:'))).toBe(true));
    view.unmount();
    setup();
    await act(async () => {});
    expect(screen.queryByText('restored scoped data')).toBeNull();
    await act(async () => { client.setQueryData(['tenant', 'memberships'], { memberships: [] }); });
    await screen.findByText('restored scoped data');
  });

  it('retains API-online recovery and retry defaults', async () => {
    setup();
    await act(async () => {});
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    act(() => { window.dispatchEvent(new Event('cfb:api-online')); });
    expect(invalidate).toHaveBeenCalled();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(300000);
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });
});
