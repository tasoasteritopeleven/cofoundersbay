import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEndorsement } from '@/lib/api';
import { GiveEndorsementDialog } from './GiveEndorsementDialog';

/**
 * The rules this dialog enforces are the server's, restated in the browser so a
 * rejection is something the writer can see and fix before losing what they
 * wrote: `content` is 10–1000 characters and `toUserId` must be a real id.
 *
 * Queries are synchronous throughout — the recipient is passed in rather than
 * searched for, because the async testing-library helpers cost ~20s each in
 * this config and the validation being tested has nothing to do with search.
 */

vi.mock('@/lib/api', () => ({
  createEndorsement: vi.fn(),
  searchProfiles: vi.fn().mockResolvedValue({ hits: [], total: 0 }),
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/components/common/BilingualText', () => ({
  BilingualText: ({ en }: { en: string }) => <>{en}</>,
}));
vi.mock('@/lib/i18n/LanguagePreferenceContext', () => ({
  useBilingualString: () => (en: string) => en,
}));

const create = vi.mocked(createEndorsement);
const recipient = { userId: 'user-elena', displayName: 'Elena Papadopoulos', skillNames: ['Fundraising', 'Hiring'] };
const clients: QueryClient[] = [];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <GiveEndorsementDialog open onOpenChange={vi.fn()} recipient={recipient} />
    </QueryClientProvider>,
  );
}

const submitButton = () => screen.getByRole('button', { name: /Send endorsement/i }) as HTMLButtonElement;

/**
 * React Query defers `mutationFn` to a microtask, so a click and an assertion
 * in the same tick sees zero calls. One flushed tick is enough — far cheaper
 * than `waitFor`, which costs ~20s in this config.
 */
async function clickSubmit() {
  await act(async () => {
    fireEvent.click(submitButton());
    await Promise.resolve();
  });
}
const contentBox = () => screen.getByLabelText(/What you saw them do/i);

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ endorsement: {} } as Awaited<ReturnType<typeof createEndorsement>>);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});

describe('writing an endorsement', () => {
  it('refuses to send until the content clears the server’s own minimum', () => {
    mount();
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(contentBox(), { target: { value: 'short' } });
    expect(submitButton().disabled).toBe(true);
    // The gap is named rather than left for the API to reject.
    expect(screen.getByText(/5 more characters needed/i)).toBeTruthy();

    fireEvent.change(contentBox(), { target: { value: 'Rebuilt onboarding in two weeks.' } });
    expect(submitButton().disabled).toBe(false);
  });

  it('counts what will be sent, not what was typed', () => {
    mount();
    fireEvent.change(contentBox(), { target: { value: '   Rebuilt onboarding.   ' } });
    // 19 characters once trimmed, which is what the API will measure.
    expect(screen.getByText('19 / 1000')).toBeTruthy();
  });

  it('sends the trimmed content and omits the optional fields left blank', async () => {
    mount();
    fireEvent.change(contentBox(), { target: { value: '  Rebuilt onboarding in two weeks.  ' } });
    await clickSubmit();

    expect(create).toHaveBeenCalledExactlyOnceWith({
      toUserId: 'user-elena',
      content: 'Rebuilt onboarding in two weeks.',
    });
  });

  it('carries the skill and the relationship when they are given', async () => {
    mount();
    fireEvent.change(contentBox(), { target: { value: 'Rebuilt onboarding in two weeks.' } });
    fireEvent.change(screen.getByLabelText(/For what/i), { target: { value: '  Hiring  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Co-founder' }));
    await clickSubmit();

    expect(create).toHaveBeenCalledExactlyOnceWith({
      toUserId: 'user-elena',
      content: 'Rebuilt onboarding in two weeks.',
      skill: 'Hiring',
      relationship: 'Co-founder',
    });
  });

  it('offers the recipient’s own skills as one tap each', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Fundraising' }));
    fireEvent.change(contentBox(), { target: { value: 'Rebuilt onboarding in two weeks.' } });
    await clickSubmit();

    expect(create.mock.calls[0][0].skill).toBe('Fundraising');
  });

  it('lets a chosen relationship be taken back', async () => {
    mount();
    fireEvent.change(contentBox(), { target: { value: 'Rebuilt onboarding in two weeks.' } });
    const chip = screen.getByRole('button', { name: 'Client' });
    fireEvent.click(chip);
    fireEvent.click(chip);
    await clickSubmit();

    expect(create.mock.calls[0][0]).not.toHaveProperty('relationship');
  });

  it('does not offer to change a recipient the page fixed', () => {
    mount();
    expect(screen.queryByRole('button', { name: /Choose someone else/i })).toBeNull();
    expect(screen.getByText('Elena Papadopoulos')).toBeTruthy();
  });
});
