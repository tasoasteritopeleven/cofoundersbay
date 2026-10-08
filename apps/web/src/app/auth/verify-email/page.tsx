'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { errorMessage as readErrorMessage } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { verifyEmail, resendVerification } from '@/lib/api';
import { MainLandmark } from '@/components/layout/AppShell';

type VerificationStatus = 'loading' | 'success' | 'error' | 'no-token';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  
  const token = searchParams?.get('token');
  const [status, setStatus] = useState<VerificationStatus>(token ? 'loading' : 'no-token');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    verifyEmail(token)
      .then((result) => {
        setStatus('success');
        setVerifiedEmail(result.email || null);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(readErrorMessage(err, 'Verification failed'));
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    try {
      await resendVerification(resendEmail.trim());
      setResendSent(true);
      success('Verification email sent', 'Check your inbox for the verification link.');
    } catch (err: unknown) {
      showError('Failed to send', readErrorMessage(err, 'Please try again later.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <MainLandmark className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-xl font-bold text-foreground">CoFounderBay</span>
          </Link>
        </div>

        <Card className="border-border">
          {status === 'loading' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Loader2 className="icon-xl text-primary-accessible animate-spin" />
                </div>
                <h1 className="text-base font-semibold leading-tight sm:text-lg"><BilingualText en="Verifying your email" el="Επαλήθευση του email σας" compact /></h1>
                <CardDescription><BilingualText en="Please wait while we verify your email address..." el="Περιμένετε όσο επαληθεύουμε τη διεύθυνση email σας…" wrap /></CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-2/3" />
                </div>
              </CardContent>
            </>
          )}

          {status === 'success' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg">
                  <CheckCircle2 className="icon-xl text-status-success" />
                </div>
                <h1 className="text-base font-semibold leading-tight text-status-success sm:text-lg"><BilingualText en="Email Verified!" el="Το email επαληθεύτηκε!" compact /></h1>
                <CardDescription>
                  {verifiedEmail ? (
                    <>Your email <strong className="text-foreground">{verifiedEmail}</strong> has been verified.</>
                  ) : (
                    'Your email address has been successfully verified.'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  <BilingualText en="You now have full access to all CoFounderBay features." el="Έχετε πλέον πλήρη πρόσβαση σε όλες τις δυνατότητες του CoFounderBay." wrap />
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => router.push('/')} className="w-full gap-2">
                    <BilingualText en="Go to Dashboard" el="Μετάβαση στον πίνακα" compact />
                    <ArrowRight className="icon-sm" />
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/profile')} className="w-full">
                    <BilingualText en="Complete Your Profile" el="Ολοκληρώστε το προφίλ σας" compact />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {status === 'error' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="icon-xl text-destructive-accessible" />
                </div>
                <h1 className="text-base font-semibold leading-tight text-destructive-accessible sm:text-lg"><BilingualText en="Verification Failed" el="Η επαλήθευση απέτυχε" compact /></h1>
                <CardDescription>
                  {errorMessage || 'The verification link is invalid or has expired.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground mb-3">Common reasons:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><BilingualText en="The link has expired (valid for 24 hours)" el="Ο σύνδεσμος έληξε (ισχύει 24 ώρες)" wrap /></li>
                    <li><BilingualText en="The link has already been used" el="Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί" compact /></li>
                    <li><BilingualText en="The link was copied incorrectly" el="Ο σύνδεσμος αντιγράφηκε λάθος" compact /></li>
                  </ul>
                </div>
                
                <div className="pt-2">
                  <p className="text-sm font-medium text-foreground mb-3">Request a new verification link:</p>
                  {resendSent ? (
                    <div className="rounded-lg border border-status-success-border bg-status-success-bg p-3 text-center">
                      <CheckCircle2 className="icon-md text-status-success mx-auto mb-2" />
                      <p className="text-sm text-status-success ">
                        <BilingualText en="Verification email sent! Check your inbox." el="Στάλθηκε email επαλήθευσης! Ελέγξτε τα εισερχόμενά σας." wrap />
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleResend} className="space-y-3">
                      <div>
                        <Label htmlFor="email" className="sr-only"><BilingualText en="Email" el="Email" compact /></Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={bilingualInline("Enter your email address", "Συμπληρώστε το email σας")}
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full gap-2" disabled={isResending}>
                        {isResending ? (
                          <Loader2 className="icon-sm animate-spin" />
                        ) : (
                          <Mail className="icon-sm" />
                        )}
                        Resend Verification Email
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {status === 'no-token' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-warning-bg">
                  <Mail className="icon-xl text-status-warning" />
                </div>
                <h1 className="text-base font-semibold leading-tight sm:text-lg"><BilingualText en="Verify Your Email" el="Επαληθεύστε το email σας" compact /></h1>
                <CardDescription>
                  <BilingualText en="Enter your email to receive a verification link" el="Εισάγετε το email σας για να λάβετε σύνδεσμο επαλήθευσης" wrap />
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {resendSent ? (
                  <div className="rounded-lg border border-status-success-border bg-status-success-bg p-4 text-center">
                    <CheckCircle2 className="icon-lg text-status-success mx-auto mb-2" />
                    <p className="text-sm font-medium text-status-success mb-1">
                      <BilingualText en="Verification email sent!" el="Στάλθηκε email επαλήθευσης!" compact />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <BilingualText en="Check your inbox and click the verification link." el="Ελέγξτε τα εισερχόμενα και πατήστε τον σύνδεσμο επαλήθευσης." wrap />
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleResend} className="space-y-3">
                    <div>
                      <Label htmlFor="email"><BilingualText en="Email address" el="Διεύθυνση email" compact /></Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        required
                        className="mt-1.5"
                      />
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={isResending}>
                      {isResending ? (
                        <Loader2 className="icon-sm animate-spin" />
                      ) : (
                        <Mail className="icon-sm" />
                      )}
                      Send Verification Email
                    </Button>
                  </form>
                )}
                
                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm text-primary-accessible hover:underline">
                    <BilingualText en="Back to Login" el="Επιστροφή στη σύνδεση" compact />
                  </Link>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Need help?{' '}
          <Link href="/help" className="text-primary-accessible hover:underline">
            <BilingualText en="Contact Support" el="Επικοινωνία με υποστήριξη" compact />
          </Link>
        </p>
      </div>
    </MainLandmark>
  );
}
