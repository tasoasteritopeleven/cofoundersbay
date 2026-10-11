import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { runCopilotTurn } from './copilot-engine';

/**
 * Wave E in the browser: the engine declines an admin-only read for a reader
 * whose role is known and is not admin, says so in their language, and lets
 * an unknown role through to the endpoint, which stays the real guard.
 */

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAdminStats: vi.fn(),
  listAdminReports: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(api.getAdminStats).mockReset();
  vi.mocked(api.listAdminReports).mockReset();
  vi.mocked(api.listAdminReports).mockResolvedValue({ reports: [] } as never);
});

const ask = (role: string | null) =>
  runCopilotTurn('What is in the moderation queue?', { route: '/dashboard', title: 'Dashboard', role, locale: 'en' } as never, {
    tools: [{ name: 'get_moderation_queue', args: {} }],
  });

describe('admin-only reads', () => {
  it('are declined for a founder without calling the endpoint', async () => {
    const result = await ask('existing_founder');
    expect(api.listAdminReports).not.toHaveBeenCalled();
    expect(result.message).toContain('only available to platform administrators');
    expect(result.usedTools).not.toContain('get_moderation_queue');
  });

  it('run for a platform admin', async () => {
    const result = await ask('platform_admin');
    expect(api.listAdminReports).toHaveBeenCalled();
    expect(result.message).toContain('The moderation queue is empty.');
  });

  it('run when the role is unknown, leaving the decision to the endpoint', async () => {
    await ask(null);
    expect(api.listAdminReports).toHaveBeenCalled();
  });

  it('decline in Greek for a Greek reader', async () => {
    const result = await runCopilotTurn('Τι υπάρχει στην ουρά ελέγχου;', { route: '/dashboard', title: 'x', role: 'mentor', locale: 'el' } as never, {
      tools: [{ name: 'get_moderation_queue', args: {} }],
    });
    expect(result.message).toContain('μόνο στους διαχειριστές');
  });
});
