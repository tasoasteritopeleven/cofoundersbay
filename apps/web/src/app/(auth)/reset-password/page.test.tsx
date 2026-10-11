import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResetPasswordPage from './page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=valid-token'),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/components/brand/Logo', () => ({ Logo: () => <span>Logo</span> }));
vi.mock('@/components/common/BilingualText', () => ({ BilingualText: ({ en }: { en: string }) => <>{en}</> }));
vi.mock('@/lib/api', () => ({ resetPassword: vi.fn() }));

afterEach(cleanup);

describe('reset password validation', () => {
  it('associates the visible mismatch with the invalid confirmation field', () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'abcdefgh' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } });
    const confirm = screen.getByLabelText('Confirm password');
    expect(confirm.getAttribute('aria-invalid')).toBe('true');
    expect(confirm.getAttribute('aria-describedby')).toBe('confirm-mismatch');
    expect(screen.getByText("Passwords don't match").id).toBe('confirm-mismatch');
  });
});