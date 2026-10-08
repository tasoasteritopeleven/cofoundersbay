'use client';

import { useState, useEffect } from 'react';
import { errorMessage } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/Logo';
import { resetPassword } from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { MainLandmark } from '@/components/layout/AppShell';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') ?? null;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Reset link is invalid or missing. Please request a new one.');
  }, [token]);

  function getStrength(pw: string): { level: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: score, label: 'Weak', color: 'bg-status-danger-mark' };
    if (score <= 3) return { level: score, label: 'Fair', color: 'bg-status-warning-mark' };
    return { level: score, label: 'Strong', color: 'bg-status-success-mark' };
  }

  const strength = getStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Reset link is missing. Please request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: unknown) {
      setError(errorMessage(err, 'The reset link is invalid or has expired. Please request a new one.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLandmark className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="space-y-2">
          <Link href="/" className="inline-block mb-6 hover:opacity-80 transition-opacity">
            <Logo size="sm" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            <BilingualText en="Set a new password" el="Ορίστε νέο κωδικό" compact />
          </h1>
          <p className="text-muted-foreground text-sm">
            <BilingualText en="Choose a strong password to secure your account." el="Επιλέξτε ισχυρό κωδικό για την ασφάλεια του λογαριασμού σας." wrap />
          </p>
        </div>

        {done ? (
          <div className="rounded-xl border border-status-success-border bg-status-success-bg px-6 py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
              <CheckCircle2 className="icon-lg text-status-success " />
            </div>
            <h2 className="font-semibold text-foreground"><BilingualText en="Password updated!" el="Ο κωδικός ενημερώθηκε!" compact /></h2>
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Your password has been reset. Redirecting you to sign in…" el="Ο κωδικός σας επαναφέρθηκε. Μεταφέρεστε στη σύνδεση…" wrap />
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div id="reset-error" role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-accessible">
                <span className="mt-0.5 shrink-0 font-semibold">!</span>
                <span>{error}</span>
              </div>
            )}

            {!token ? (
              <div className="text-center py-4">
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <BilingualText en="Request a new reset link" el="Ζητήστε νέο σύνδεσμο επαναφοράς" compact />
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium"><BilingualText en="New password" el="Νέος κωδικός" compact /></label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      aria-invalid={error === 'Password must be at least 8 characters.' || undefined}
                      aria-describedby={error === 'Password must be at least 8 characters.' ? 'reset-error' : undefined}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      autoFocus
                      placeholder={bilingualInline("Min. 8 characters", "Τουλάχιστον 8 χαρακτήρες")}
                      className="pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i <= strength.level ? strength.color : 'bg-border'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Strength: <span className="font-medium text-foreground">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium"><BilingualText en="Confirm password" el="Επιβεβαίωση κωδικού" compact /></label>
                  <Input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    aria-invalid={Boolean(confirm && confirm !== password) || error === 'Passwords do not match.'}
                    aria-describedby={confirm && confirm !== password ? 'confirm-mismatch' : error === 'Passwords do not match.' ? 'reset-error' : undefined}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={bilingualInline("Repeat password", "Επανάληψη κωδικού")}
                    className={confirm && confirm !== password ? 'border-destructive focus-visible:ring-destructive/30' : undefined}
                  />
                  {confirm && confirm !== password && (
                    <p id="confirm-mismatch" className="text-xs text-destructive-accessible"><BilingualText en="Passwords don&apos;t match" el="Οι κωδικοί δεν ταιριάζουν" compact /></p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !password || !confirm || password !== confirm}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 icon-sm animate-spin" /><BilingualText en="Updating…" el="Ενημέρωση…" compact /></>
                  ) : 'Reset password'}
                </Button>
              </>
            )}
          </form>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            <BilingualText en="Back to sign in" el="Επιστροφή στη σύνδεση" compact />
          </Link>
        </div>
      </div>
    </MainLandmark>
  );
}
