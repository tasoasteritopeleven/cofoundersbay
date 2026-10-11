import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_CODE, demoMeVerified, previewVerificationApi, resetDemoVerification } from '@/lib/demo/verification-world';
import { resetDemoCommitments, previewCommitmentsApi } from '@/lib/demo/commitments-world';
import { VerificationCard } from './VerificationCard';
import { ThreadWorkspace } from '@/components/commitments/ThreadWorkspace';

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ success: mocks.success, error: mocks.error }) }));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('cfb_demo_data', '1');
  resetDemoVerification();
  resetDemoCommitments();
});
afterEach(cleanup);

describe('VerificationCard (demo world)', () => {
  it('lists the work-email signal, removes it, refuses a personal address in both languages, and verifies again with a code', async () => {
    renderWithQuery(<VerificationCard />);
    expect(await screen.findByText(/harbor-founders\.example/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Remove/ }));
    await waitFor(() => expect(demoMeVerified()).toBe(false));

    const email = await screen.findByLabelText(/Work email/);
    fireEvent.change(email, { target: { value: 'alex@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send code/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/personal mail providers[\s\S]*domain της εταιρείας/);

    fireEvent.change(email, { target: { value: 'alex@harbor.example' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send code/ }));
    expect(await screen.findByText(new RegExp(`the code is ${DEMO_CODE}`))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: DEMO_CODE } });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$|^Verify ·|^Verify\b/ }));
    await waitFor(() => expect(demoMeVerified()).toBe(true));
    expect(mocks.success).toHaveBeenCalledWith('Work email verified');
  });

  it('keeps Verified on LinkedIn disabled, with a reason, when the server has not set it up', async () => {
    renderWithQuery(<VerificationCard />);
    const button = await screen.findByRole('button', { name: /Continue with LinkedIn/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('title')).toMatch(/not set up/);
  });
});

describe('the ladder’s verification gate (demo world)', () => {
  const NOW = Date.now();
  it('lets an unverified reader read terms but not accept or propose them, and says where to verify', async () => {
    previewVerificationApi('/api/verification/work_email', 'DELETE', {}, NOW);
    renderWithQuery(<ThreadWorkspace threadId="thr-harbor-alex" />);
    expect(await screen.findAllByText(/Verify yourself once to propose or accept terms/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Verify in Settings/ }).getAttribute('href')).toBe('/settings#verification');
    let error: any;
    try {
      previewCommitmentsApi('/api/commitments/threads/thr-harbor-alex/terms', '/api/commitments/threads/thr-harbor-alex/terms', 'POST', { role: 'Co-founder', equityPct: 9, vestingMonths: 48, cliffMonths: 12, hoursPerWeek: 40, scope: 'Sales' }, NOW);
    } catch (e) {
      error = e;
    }
    expect(error?.details?.reason).toBe('verification_required');
    expect(error?.details?.messageEl).toMatch(/Επαληθευτείτε/);
  });

  it('shows the other side’s verification as a badge', async () => {
    renderWithQuery(<ThreadWorkspace threadId="thr-harbor-alex" />);
    expect(await screen.findByTitle(/Verified: Work email, Identity, verified on LinkedIn/)).toBeTruthy();
  });
});
