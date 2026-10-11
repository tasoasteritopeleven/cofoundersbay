'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle, Github, Linkedin, Mail, Shield, Briefcase } from 'lucide-react';
import {
  OPEN_TO_COPY,
  OPEN_TO_VISIBILITY_COPY,
  VERIFICATION_COPY,
  type VerificationMethod,
} from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { getMyOpenTo, type MyOpenTo } from '@/lib/open-to-api';
import { getMyVerification, type MyVerification } from '@/lib/verification-api';
import { profileEl, profileEn } from '@/lib/i18n/strings-profile';
import { qk } from '@/lib/query-keys';

/**
 * The signed-in person's own trust marks on `/profile`, read from the same
 * endpoints Settings writes (`/verification/me`, `/open-to/me`) and cached
 * under the same keys, so a change in Settings shows here without a reload.
 *
 * Before this, the profile drew a "Verified member" check on every avatar,
 * an "Open to work" pill on every header and "LinkedIn: not connected" in
 * the rail, whatever the person had actually done.
 */
export function useMyTrust() {
  const verification = useQuery({ queryKey: qk('verification', 'me'), queryFn: getMyVerification, staleTime: 60_000, retry: 0 });
  const openTo = useQuery({ queryKey: qk('open-to', 'me'), queryFn: getMyOpenTo, staleTime: 60_000, retry: 0 });
  const methods: VerificationMethod[] = (verification.data?.signals ?? []).map((s) => s.method);
  return { verification: verification.data, openTo: openTo.data, methods };
}

const verifiedLabel = (methods: readonly VerificationMethod[]) => {
  const how = methods.map((m) => VERIFICATION_COPY[m]);
  return `Verified: ${how.map((h) => h.en).join(', ')} · Επαληθευμένο προφίλ: ${how.map((h) => h.el).join(', ')}`;
};

/** The check on the avatar, only for someone with a verification signal. */
export function AvatarVerifiedMark({ methods }: { methods: readonly VerificationMethod[] }) {
  if (!methods.length) return null;
  const label = verifiedLabel(methods);
  return (
    <div className="absolute bottom-2 right-2 rounded-full bg-background p-1 shadow-sm" title={label} data-keep-icon="">
      <BadgeCheck className="icon-lg text-status-info" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * What the person said they are open to, as Settings holds it. With nothing
 * set it offers the setting instead of claiming "Open to work". The pill
 * names who sees the signal, because "Matching only" (the default) means
 * other members do not.
 */
export function OwnOpenToPill({ openTo }: { openTo: MyOpenTo | undefined }) {
  const signal = openTo?.active ? openTo.signal : null;
  const kinds = signal?.kinds ?? [];
  if (!signal || !kinds.length) {
    return (
      <Link
        href="/settings#open-to"
        className="inline-flex items-center rounded-md border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BilingualText en="Set what you are open to" el="Ορίστε σε τι είστε ανοιχτός/ή" compact />
      </Link>
    );
  }
  const who = OPEN_TO_VISIBILITY_COPY[signal.visibility];
  return (
    <Link
      href="/settings#open-to"
      title={`${who.en}: ${who.hintEn} · ${who.el}: ${who.hintEl}`}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-status-success-border bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-status-success-mark" aria-hidden="true" />
      <BilingualText
        en={`Open to: ${kinds.map((k) => OPEN_TO_COPY[k].en.toLowerCase()).join(', ')}`}
        el={`Ανοιχτός/ή σε: ${kinds.map((k) => OPEN_TO_COPY[k].el.toLowerCase()).join(', ')}`}
        compact
      />
      <span className="sr-only">{`${who.en} · ${who.el}`}</span>
    </Link>
  );
}

type Row = { key: string; en: string; el: string; verified: boolean; icon: React.ElementType; pendingEn: string; pendingEl: string };

/**
 * The profile rail's verification list. Email and GitHub are as before;
 * the rest are the four platform methods (work email, identity and workplace
 * on LinkedIn, the team), each true only when Settings holds that signal.
 */
export function VerificationPanel({ email, verification }: { email?: string | null; verification: MyVerification | undefined }) {
  const has = (m: VerificationMethod) => (verification?.signals ?? []).some((s) => s.method === m);
  const notYet = { pendingEn: 'Not verified', pendingEl: 'Δεν έχει επαληθευτεί' };
  const rows: Row[] = [
    { key: 'email', en: profileEn('email_verified'), el: profileEl('email_verified'), verified: !!email, icon: Mail, pendingEn: profileEn('not_connected'), pendingEl: profileEl('not_connected') },
    { key: 'work_email', ...VERIFICATION_COPY.work_email, verified: has('work_email'), icon: Briefcase, ...notYet },
    { key: 'linkedin_identity', ...VERIFICATION_COPY.linkedin_identity, verified: has('linkedin_identity'), icon: Linkedin, ...notYet },
    { key: 'linkedin_workplace', ...VERIFICATION_COPY.linkedin_workplace, verified: has('linkedin_workplace'), icon: Linkedin, ...notYet },
    { key: 'admin', ...VERIFICATION_COPY.admin, verified: has('admin'), icon: Shield, ...notYet },
    { key: 'github', en: profileEn('github_connected'), el: profileEl('github_connected'), verified: false, icon: Github, pendingEn: profileEn('not_connected'), pendingEl: profileEl('not_connected') },
  ];
  const verifiedAny = rows.slice(1, 5).some((r) => r.verified);
  return (
    <div className="space-y-2.5">
      {rows.map(({ key, en, el, verified, icon: Icon, pendingEn, pendingEl }) => (
        /* The status sits under the label, not beside it: in a 320px rail a
           bilingual status beside a bilingual label left the label 17px. */
        <div key={key} className="flex items-start gap-2.5 text-xs">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${verified ? 'bg-status-success-bg' : 'bg-secondary/60'}`}>
            <Icon className={`icon-sm ${verified ? 'text-status-success' : 'text-muted-foreground'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <span className={`block leading-snug ${verified ? 'text-foreground' : 'text-muted-foreground'}`}>
              <BilingualText en={en} el={el} compact wrap />
            </span>
            {/* No alpha on the muted token: at 0.6 it measures 3.27:1, under AA. */}
            {!verified && (
              <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
                <BilingualText en={pendingEn} el={pendingEl} compact wrap />
              </span>
            )}
          </div>
          {verified && <CheckCircle className="mt-0.5 shrink-0 icon-sm text-status-success" />}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href="/settings#verification">
          {verifiedAny
            ? <BilingualText en="Manage verification" el="Διαχείριση επαλήθευσης" compact />
            : <BilingualText en="Verify in Settings" el="Επαλήθευση στις Ρυθμίσεις" compact />}
        </Link>
      </Button>
    </div>
  );
}
