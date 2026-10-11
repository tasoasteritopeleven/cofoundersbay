import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolvePreviewApi } from '@/lib/preview-api';
import { resetDemoVerification } from '@/lib/demo/verification-world';
import { toCommitmentCard, toPublicCommitmentCard, verifiedMethodsOf } from '@/lib/commitments-api';
import { NeedCard } from './NeedCard';
import { PersonVerifiedBadge } from './PersonVerifiedBadge';

/**
 * "Verified" beside the author on the profile, the need card and the public
 * card (LinkedIn comparison §6.1). Methods only, read live, never the work
 * domain; nothing at all for someone with no signal.
 */

// The badge reads through the API client; here the demo world answers it.
vi.mock('@/lib/verification-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/verification-api')>()),
  getVerifiedMethods: async (userId: string) => (resolvePreviewApi(`/api/verification/of/${userId}`) as { methods: string[] }).methods,
}));

afterEach(cleanup);
beforeEach(() => resetDemoVerification());

describe('the badge on a need card', () => {
  it('shows how the author is verified, from the board and from the public link', () => {
    const board = resolvePreviewApi('/api/commitments/cards') as { cards: unknown[] };
    const cards = board.cards.map(toCommitmentCard);
    const elena = cards.find((c) => c.owner.id === 'user-elena');
    expect(elena?.owner.verifiedMethods).toEqual(['work_email', 'linkedin_identity']);
    render(<NeedCard card={elena!} />);
    expect(screen.getByTitle(/Verified: Work email, Identity, verified on LinkedIn/)).toBeTruthy();
  });

  it('renders nothing for an author with no signal', () => {
    const card = toPublicCommitmentCard({ title: 'T', owner: { displayName: 'No One', headline: null, verifiedMethods: [] } });
    render(<NeedCard card={card} />);
    expect(screen.queryByTitle(/Verified:/)).toBeNull();
  });

  it('drops methods the client does not know rather than inventing a badge', () => {
    expect(verifiedMethodsOf(['work_email', 'passport_scan', 42])).toEqual(['work_email']);
  });
});

describe('the badge on a profile', () => {
  const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

  it('reads the person’s methods by id', async () => {
    expect(resolvePreviewApi('/api/verification/of/user-elena')).toEqual({ methods: ['work_email', 'linkedin_identity'] });
    wrap(<PersonVerifiedBadge userId="user-elena" />);
    await waitFor(() => expect(screen.getByTitle(/Verified:/)).toBeTruthy());
  });

  it('follows the demo founder’s own Settings: removing the signal removes the badge', () => {
    expect(resolvePreviewApi('/api/verification/of/preview-demo-user')).toEqual({ methods: ['work_email'] });
    resolvePreviewApi('/api/verification/work_email', { method: 'DELETE' });
    expect(resolvePreviewApi('/api/verification/of/preview-demo-user')).toEqual({ methods: [] });
  });

  it('shows the page’s own fallback, not a badge, when nothing was checked', async () => {
    wrap(<PersonVerifiedBadge userId="user-marcus" fallback={<span>self-declared</span>} />);
    await waitFor(() => expect(screen.getByText('self-declared')).toBeTruthy());
    expect(screen.queryByTitle(/Verified:/)).toBeNull();
  });
});
