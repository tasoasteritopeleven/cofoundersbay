import { describe, expect, it, vi } from 'vitest';
import { isPublicNetworkAddress, sendSafeWebhook } from './safe-webhook';

const publicLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);

describe('safe automation webhooks', () => {
  it.each([
    ['127.0.0.1', false],
    ['10.0.0.1', false],
    ['169.254.169.254', false],
    ['192.168.1.1', false],
    ['::1', false],
    ['fc00::1', false],
    ['::ffff:127.0.0.1', false],
    ['93.184.216.34', true],
    ['2606:2800:220:1:248:1893:25c8:1946', true],
  ])('classifies %s public=%s', (address, expected) => {
    expect(isPublicNetworkAddress(address)).toBe(expected);
  });

  it.each([
    'http://example.com/hook',
    'file:///etc/passwd',
    'https://localhost/hook',
    'https://metadata.google.internal/latest',
    'https://user:secret@example.com/hook',
    'https://127.0.0.1/hook',
  ])('rejects unsafe target %s before fetch', async (url) => {
    const fetchImpl = vi.fn();
    await expect(sendSafeWebhook({ url }, { lookupAll: publicLookup, fetchImpl: fetchImpl as never }))
      .rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects any hostname resolving to a private address', async () => {
    const fetchImpl = vi.fn();
    await expect(sendSafeWebhook({ url: 'https://hooks.example.com/run' }, {
      lookupAll: async () => [{ address: '10.2.3.4', family: 4 }],
      fetchImpl: fetchImpl as never,
    })).rejects.toThrow('non-public');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('honours an exact destination allowlist', async () => {
    await expect(sendSafeWebhook({ url: 'https://other.example.com/run' }, {
      allowedHosts: ['hooks.example.com'], lookupAll: publicLookup, fetchImpl: vi.fn() as never,
    })).rejects.toThrow('AUTOMATION_WEBHOOK_ALLOWED_HOSTS');
  });

  it('uses bounded non-redirecting fetch and redacts query secrets from its result', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 204, body: { cancel } });
    await expect(sendSafeWebhook({
      url: 'https://hooks.example.com/run?signature=secret',
      method: 'post',
      headers: { Authorization: 'Bearer token' },
      body: { event: 'updated' },
    }, { lookupAll: publicLookup, fetchImpl: fetchImpl as never, timeoutMs: 2500 })).resolves.toEqual({
      status: 204,
      method: 'POST',
      destination: 'https://hooks.example.com/run',
    });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      body: JSON.stringify({ event: 'updated' }),
      signal: expect.any(AbortSignal),
    }));
    expect(cancel).toHaveBeenCalled();
  });

  it('blocks dangerous methods, hop-by-hop headers, and oversized bodies', async () => {
    const options = { lookupAll: publicLookup, fetchImpl: vi.fn() as never };
    await expect(sendSafeWebhook({ url: 'https://hooks.example.com', method: 'CONNECT' }, options)).rejects.toThrow('not allowed');
    await expect(sendSafeWebhook({ url: 'https://hooks.example.com', headers: { Host: 'internal' } }, options)).rejects.toThrow('header');
    await expect(sendSafeWebhook({ url: 'https://hooks.example.com', body: { value: 'x'.repeat(300_000) } }, options)).rejects.toThrow('256 KiB');
  });

  it('does not persist or expose an unbounded remote error body', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    await expect(sendSafeWebhook({ url: 'https://hooks.example.com/run' }, {
      lookupAll: publicLookup,
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500, body: { cancel } }) as never,
    })).rejects.toThrow('Webhook returned HTTP 500');
    expect(cancel).toHaveBeenCalled();
  });
});
