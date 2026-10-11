'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/Logo';
import { forgotPassword } from '@/lib/api';
import { MainLandmark } from '@/components/layout/AppShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email.trim().toLowerCase());
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setSent(true);
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
            Reset your password
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-status-success-border bg-status-success-bg px-6 py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
              <MailCheck className="icon-lg text-status-success " />
            </div>
            <h2 className="font-semibold text-foreground">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{email}</span> is registered,
              you&apos;ll receive a reset link within a few minutes.
            </p>
            <p className="text-xs text-muted-foreground">Check your spam folder if you don&apos;t see it.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-accessible">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email address</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@startup.com"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </MainLandmark>
  );
}
