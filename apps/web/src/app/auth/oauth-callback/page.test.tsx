import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OAuthCallbackPage from './page';
import { getMe } from '@/lib/api';
import { PREVIEW_DEMO_USER } from '@/lib/preview-demo';

const push = vi.fn();
let params = new URLSearchParams('provider=google');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));
vi.mock('@/lib/api', () => ({ getMe: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
  document.cookie = 'cfb_preview_demo=; Max-Age=0; path=/';
  document.cookie = 'cfb_session=; Max-Age=0; path=/';
  params = new URLSearchParams('provider=google');
});

describe('OAuth callback', () => {
  it('does not announce a second login for the already-restored preview session', async () => {
    document.cookie = 'cfb_session=preview-demo; path=/';
    localStorage.setItem('user', JSON.stringify(PREVIEW_DEMO_USER));
    // The preview getMe response has fewer display fields than the restored
    // demo user; comparing serialized objects would falsely broadcast login.
    vi.mocked(getMe).mockResolvedValue({ user: { id: PREVIEW_DEMO_USER.id, email: PREVIEW_DEMO_USER.email, role: 'founder', emailVerified: true } } as Awaited<ReturnType<typeof getMe>>);
    const login = vi.fn();
    window.addEventListener('cfb:login', login);
    render(<OAuthCallbackPage />);
    await screen.findByText('Welcome');
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
    expect(localStorage.getItem('user')).toBe(JSON.stringify(PREVIEW_DEMO_USER));
    window.removeEventListener('cfb:login', login);
  });

  it('still announces a real OAuth sign-in and navigates after verification', async () => {
    const user = { ...PREVIEW_DEMO_USER, id: 'real-oauth-user' };
    localStorage.setItem('user', JSON.stringify(user));
    vi.mocked(getMe).mockResolvedValue({ user } as Awaited<ReturnType<typeof getMe>>);
    const login = vi.fn();
    window.addEventListener('cfb:login', login);
    render(<OAuthCallbackPage />);
    await screen.findByText('Welcome');
    expect(login).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(user));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1250)); });
    expect(push).toHaveBeenCalledWith('/');
    window.removeEventListener('cfb:login', login);
  });

  it('shows provider errors without attempting session verification', async () => {
    params = new URLSearchParams('error=Access%20denied');
    render(<OAuthCallbackPage />);
    await waitFor(() => expect(screen.getByText('Access denied')).toBeTruthy());
    expect(getMe).not.toHaveBeenCalled();
  });
});