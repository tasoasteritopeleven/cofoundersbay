'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Linkedin, Mail } from 'lucide-react';
import { ROLE_VERIFICATION_COPY, VERIFICATION_COPY, VERIFICATION_REQUIRED_COPY, type VerificationMethod } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { commitmentRefusal } from '@/lib/commitments-api';
import { qk } from '@/lib/query-keys';
import {
  confirmWorkEmailVerification,
  getMyVerification,
  removeVerification,
  startLinkedInVerification,
  startWorkEmailVerification,
} from '@/lib/verification-api';

/**
 * "Verification" in Settings: the ways this person has proved who they are,
 * and the two ways to add one — a code to a work address, or LinkedIn's own
 * verification (only when the server has it set up). Verification is what
 * opens terms and the deal room on the commitments ladder; nothing else
 * needs it.
 */
export function VerificationCard() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const status = useQuery({ queryKey: qk('verification', 'me'), queryFn: getMyVerification });
  const me = status.data;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  useEffect(() => {
    if (me?.pendingWorkEmail && !sentTo) setSentTo(me.pendingWorkEmail);
  }, [me?.pendingWorkEmail, sentTo]);

  // Back from LinkedIn: ?verification=linkedin | linkedin-none | failed
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('verification');
    if (result === 'linkedin') success('Verified on LinkedIn');
    else if (result === 'linkedin-none') showError('LinkedIn has not verified this account yet');
    else if (result === 'failed') showError('Verification did not complete');
  }, [success, showError]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk('verification') });
  // The server's refusal carries both languages (e.g. why a personal address
  // cannot prove a workplace); it is shown in place, beside the field.
  const [problem, setProblem] = useState<{ en: string; el: string } | null>(null);
  const reason = (err: unknown) => {
    const refusal = commitmentRefusal(err);
    setProblem({ en: refusal.en, el: refusal.el });
  };

  const start = useMutation({
    mutationFn: () => startWorkEmailVerification(email),
    onSuccess: (res) => {
      setProblem(null);
      setSentTo(res.sentTo);
      setDemoCode(typeof res.demoCode === 'string' ? res.demoCode : null);
      setCode('');
      success('Code sent');
    },
    onError: (err) => reason(err),
  });
  const confirm = useMutation({
    mutationFn: () => confirmWorkEmailVerification(code),
    onSuccess: () => {
      setProblem(null);
      setSentTo(null);
      setEmail('');
      setCode('');
      void refresh();
      success('Work email verified');
    },
    onError: (err) => reason(err),
  });
  const remove = useMutation({
    mutationFn: (method: VerificationMethod) => removeVerification(method),
    onSuccess: () => void refresh(),
    onError: () => showError('Could not remove it'),
  });
  const linkedin = useMutation({
    mutationFn: startLinkedInVerification,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => showError('Verified on LinkedIn is not available'),
  });

  const signals = me?.signals ?? [];
  const hasWorkEmail = signals.some((s) => s.method === 'work_email');

  return (
    <Card id="verification" className="scroll-mt-16">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="icon-md text-primary-accessible" aria-hidden="true" />
          <BilingualText en="Verification" el="Επαλήθευση" compact />
        </CardTitle>
        <CardDescription className="space-y-1">
          <span className="block"><BilingualText en={VERIFICATION_REQUIRED_COPY.en} el={VERIFICATION_REQUIRED_COPY.el} wrap /></span>
          <span className="block"><BilingualText en={ROLE_VERIFICATION_COPY.en} el={ROLE_VERIFICATION_COPY.el} wrap /></span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {signals.length ? (
          <ul className="card-rows" aria-label="Your verifications · Οι επαληθεύσεις σας">
            {signals.map((s) => (
              <li key={s.method} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <BilingualText en={VERIFICATION_COPY[s.method].en} el={VERIFICATION_COPY[s.method].el} compact />
                    {s.detail ? <span className="text-muted-foreground"> · {s.detail}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground"><BilingualText en={VERIFICATION_COPY[s.method].hintEn} el={VERIFICATION_COPY[s.method].hintEl} wrap /></p>
                </div>
                {s.method !== 'admin' ? (
                  <Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(s.method)}>
                    <BilingualText en="Remove" el="Αφαίρεση" compact />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : status.isLoading ? null : (
          <p className="text-sm text-muted-foreground"><BilingualText en="Not verified yet." el="Δεν έχετε επαληθευτεί ακόμη." compact /></p>
        )}

        {!hasWorkEmail ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="icon-sm" aria-hidden="true" />
              <BilingualText en={VERIFICATION_COPY.work_email.en} el={VERIFICATION_COPY.work_email.el} compact />
            </p>
            {!sentTo ? (
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) start.mutate();
                }}
              >
                <Label htmlFor="verify-work-email" className="sr-only">Work email · Εταιρικό email</Label>
                <Input id="verify-work-email" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button type="submit" disabled={!email.trim() || start.isPending}>
                  <BilingualText en="Send code" el="Αποστολή κωδικού" compact />
                </Button>
              </form>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) confirm.mutate();
                }}
              >
                <p className="text-xs text-muted-foreground">
                  <BilingualText en={`We sent a six-digit code to ${sentTo}. It expires in 15 minutes.`} el={`Στείλαμε εξαψήφιο κωδικό στο ${sentTo}. Λήγει σε 15 λεπτά.`} wrap />
                </p>
                {demoCode ? (
                  <p className="text-xs text-muted-foreground">
                    <BilingualText en={`Demo: no mail is sent; the code is ${demoCode}.`} el={`Demo: δεν στέλνεται email· ο κωδικός είναι ${demoCode}.`} wrap />
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Label htmlFor="verify-work-code" className="sr-only">Code · Κωδικός</Label>
                  <Input id="verify-work-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  <Button type="submit" disabled={code.length !== 6 || confirm.isPending}>
                    <BilingualText en="Verify" el="Επαλήθευση" compact />
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSentTo(null)}>
                    <BilingualText en="Use another address" el="Άλλη διεύθυνση" compact />
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {problem ? (
          <p role="alert" className="text-sm text-destructive-accessible"><BilingualText en={problem.en} el={problem.el} wrap /></p>
        ) : null}

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Linkedin className="icon-sm" aria-hidden="true" />
            <BilingualText en="Verified on LinkedIn" el="Επαλήθευση στο LinkedIn" compact />
          </p>
          <p className="text-xs text-muted-foreground">
            <BilingualText
              en={me?.linkedinAvailable ? 'LinkedIn tells us only whether it checked your identity or workplace. No documents reach us.' : 'Not set up on this server yet. A work email verifies you meanwhile.'}
              el={me?.linkedinAvailable ? 'Το LinkedIn μας λέει μόνο αν έλεγξε την ταυτότητα ή τον χώρο εργασίας σας. Κανένα έγγραφο δεν φτάνει σε εμάς.' : 'Δεν έχει ρυθμιστεί ακόμη σε αυτόν τον διακομιστή. Στο μεταξύ σας επαληθεύει ένα εταιρικό email.'}
              wrap
            />
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!me?.linkedinAvailable || linkedin.isPending}
            title={me?.linkedinAvailable ? undefined : 'Verified on LinkedIn is not set up on this server · Δεν έχει ρυθμιστεί σε αυτόν τον διακομιστή'}
            onClick={() => linkedin.mutate()}
          >
            <BilingualText en="Continue with LinkedIn" el="Συνέχεια με LinkedIn" compact />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
