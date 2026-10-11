import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolvePreviewApi } from '@/lib/preview-api';
import { resetDemoCommitments } from '@/lib/demo/commitments-world';
import { demoBaseRole, demoRoleCleared, resetDemoVerification } from '@/lib/demo/verification-world';

/**
 * Role verification for investor and organisation accounts (LinkedIn
 * comparison §6.13), as the demo applies it: the same rule as the API, so
 * an investor account without a workplace signal is refused an
 * investor-introduction card and nobody else is affected.
 */

const setRole = (role: string) => {
  document.cookie = `cfb_primary_role=${role}; path=/`;
};

beforeEach(() => {
  resetDemoVerification();
  resetDemoCommitments();
});
afterEach(() => setRole('existing_founder'));

describe('the role rule in the demo', () => {
  it('reads the demo role into the API’s role enum', () => {
    setRole('angel_investor');
    expect(demoBaseRole()).toBe('investor');
    setRole('incubator_admin');
    expect(demoBaseRole()).toBe('org');
    setRole('existing_founder');
    expect(demoBaseRole()).toBe('founder');
  });

  it('clears an investor with a work email, and not once it is removed', () => {
    setRole('angel_investor');
    expect(demoRoleCleared()).toBe(true);
    resolvePreviewApi('/api/verification/work_email', { method: 'DELETE' });
    expect(demoRoleCleared()).toBe(false);
    // A founder is unaffected by the stricter rule.
    setRole('existing_founder');
    expect(demoRoleCleared()).toBe(true);
  });

  it('refuses an unverified investor answering an investor-introduction card, with the reason', () => {
    setRole('angel_investor');
    resolvePreviewApi('/api/verification/work_email', { method: 'DELETE' });
    const board = resolvePreviewApi('/api/commitments/cards') as { cards: Array<{ id: string; kind: string; isMine: boolean; outcome: string }> };
    const intro = board.cards.find((c) => c.id === 'need-orion-angel');
    expect(intro).toMatchObject({ kind: 'investor_intro', isMine: false, outcome: 'open' });
    let reason: unknown = null;
    try {
      resolvePreviewApi(`/api/commitments/cards/${intro!.id}/interest`, { method: 'POST', body: JSON.stringify({ note: 'I back B2B SaaS at pre-seed.' }) });
    } catch (err) {
      reason = (err as { details?: { reason?: string } }).details?.reason;
    }
    expect(reason).toBe('role_verification_required');
  });
});
