import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiRequest, ApiError } from './api';

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'cfb_session=1; path=/';
  document.cookie = 'cfb_preview_demo=; Max-Age=0; path=/';
  document.cookie = 'cfb_csrf=test-token; path=/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of ['cfb_session', 'cfb_preview_demo', 'cfb_csrf']) document.cookie = `${name}=; Max-Age=0; path=/`;
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('public authenticated API contract', () => {
  it('retains the named apiRequest export used by RoleContext and all existing clients', async () => {
    expect(typeof apiRequest).toBe('function');
    expect(typeof apiFetch).toBe('function');
    const context = { primaryRole: 'existing_founder', permissions: ['profile:read'], allRoles: [] };
    const fetch = vi.fn().mockResolvedValue(json({ success: true, data: context }));
    vi.stubGlobal('fetch', fetch);
    expect(await apiRequest('/api/roles/dashboard-context')).toEqual(context);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/roles\/dashboard-context$/);
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
  });

  it('preserves JSON writes, custom headers, and double-submit CSRF', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ saved: true }));
    vi.stubGlobal('fetch', fetch);
    expect(await apiRequest('/api/me/profile', { method: 'PATCH', body: '{"headline":"Founder"}', headers: { 'x-request-id': 'test' } })).toEqual({ saved: true });
    const init = fetch.mock.calls[0][1];
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('test-token');
    expect(new Headers(init.headers).get('x-request-id')).toBe('test');
    expect(init.body).toBe('{"headline":"Founder"}');
  });

  it('keeps multipart uploads free of an invented content type', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ uploaded: true }));
    vi.stubGlobal('fetch', fetch);
    const body = new FormData();
    body.append('label', 'test');
    await apiRequest('/api/uploads/avatar', { method: 'POST', body });
    expect(new Headers(fetch.mock.calls[0][1].headers).has('Content-Type')).toBe(false);
  });

  it('keeps a refreshed valid session when the resource returns forbidden', async () => {
    const onLogout = vi.fn();
    window.addEventListener('cfb:logout', onLogout);
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ refreshed: true }))
      .mockResolvedValueOnce(json({ message: 'Forbidden' }, 403));
    vi.stubGlobal('fetch', fetch);
    try {
      await expect(apiRequest('/api/roles/dashboard-context')).rejects.toMatchObject({ status: 403 });
      expect(onLogout).not.toHaveBeenCalled();
      expect(document.cookie).toContain('cfb_session=1');
    } finally {
      window.removeEventListener('cfb:logout', onLogout);
    }
  });

  it('preserves typed errors without treating missing data as a successful request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Not found' }, 404)));
    await expect(apiRequest('/api/roles/missing')).rejects.toBeInstanceOf(ApiError);
  });
});
