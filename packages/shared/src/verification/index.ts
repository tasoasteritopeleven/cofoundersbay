/**
 * Who someone is, as far as the platform can tell, and what that unlocks.
 *
 * Verification is asked for progressively: anyone may show interest and talk
 * in the protected conversation, but proposing or accepting terms (which is
 * what opens the deal room) needs at least one signal from
 * `LADDER_TERMS_METHODS`. The rules live here so the API, the demo world and
 * the pages say the same thing.
 */

export const VERIFICATION_METHODS = ['work_email', 'linkedin_identity', 'linkedin_workplace', 'admin'] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/** Any one of these lets a person propose or accept terms. */
export const LADDER_TERMS_METHODS: readonly VerificationMethod[] = VERIFICATION_METHODS;

export interface VerificationSignal {
  method: VerificationMethod;
  /** The verified work domain for `work_email`; nothing for the others. */
  detail?: string | null;
  verifiedAt: string;
  expiresAt?: string | null;
}

export const VERIFICATION_COPY: Record<VerificationMethod, { en: string; el: string; hintEn: string; hintEl: string }> = {
  work_email: {
    en: 'Work email',
    el: 'Εταιρικό email',
    hintEn: 'A code sent to an address at your company’s domain.',
    hintEl: 'Κωδικός σε διεύθυνση στο domain της εταιρείας σας.',
  },
  linkedin_identity: {
    en: 'Identity, verified on LinkedIn',
    el: 'Ταυτότητα, επαληθευμένη στο LinkedIn',
    hintEn: 'LinkedIn checked a government ID; we receive only that it did.',
    hintEl: 'Το LinkedIn έλεγξε κρατικό έγγραφο· λαμβάνουμε μόνο ότι το έκανε.',
  },
  linkedin_workplace: {
    en: 'Workplace, verified on LinkedIn',
    el: 'Χώρος εργασίας, επαληθευμένος στο LinkedIn',
    hintEn: 'LinkedIn checked a work email or Microsoft Entra ID.',
    hintEl: 'Το LinkedIn έλεγξε εταιρικό email ή Microsoft Entra ID.',
  },
  admin: {
    en: 'Verified by the platform team',
    el: 'Επαληθευμένο από την ομάδα της πλατφόρμας',
    hintEn: 'A role the platform team checked by hand.',
    hintEl: 'Ρόλος που έλεγξε χειροκίνητα η ομάδα της πλατφόρμας.',
  },
};

/**
 * Mail providers anyone can sign up to. An address there proves an inbox,
 * not a workplace, so it cannot be a work-email verification.
 */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.gr', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'outlook.com.gr', 'hotmail.com', 'hotmail.gr',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de',
  'web.de', 'yandex.com', 'yandex.ru', 'mail.ru', 'mail.com', 'zoho.com', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hey.com', 'qq.com', '163.com',
  // Greek consumer ISPs and portals: personal inboxes, not employers.
  'otenet.gr', 'hol.gr', 'forthnet.gr', 'windtools.gr', 'in.gr', 'freemail.gr', 'cosmotemail.gr', 'vodafone.gr', 'nova.gr',
]);

const EMAIL = /^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/;

/** The domain of an address that can prove a workplace, or why it cannot. */
export function workEmailDomain(email: string): { ok: true; domain: string } | { ok: false; reason: 'invalid' | 'free_mail' } {
  const match = email.trim().toLowerCase().match(EMAIL);
  if (!match) return { ok: false, reason: 'invalid' };
  const domain = match[1];
  if (FREE_MAIL_DOMAINS.has(domain)) return { ok: false, reason: 'free_mail' };
  return { ok: true, domain };
}

/** `name@acme.example` → `n···@acme.example`, for "we sent a code to…". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}···@${domain}`;
}

/** Signals that still count: not revoked and not expired. */
export function activeSignals<T extends { method: string; expiresAt?: string | Date | null }>(signals: readonly T[], now = Date.now()): T[] {
  return signals.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now);
}

export function meetsLadderPolicy(signals: ReadonlyArray<{ method: string; expiresAt?: string | Date | null }>, now = Date.now()): boolean {
  return activeSignals(signals, now).some((s) => (LADDER_TERMS_METHODS as readonly string[]).includes(s.method));
}

/** LinkedIn's `verificationReport` categories, as our methods. */
export function methodsFromLinkedInReport(report: { verifications?: unknown }): VerificationMethod[] {
  const list = Array.isArray(report?.verifications) ? report.verifications : [];
  const out: VerificationMethod[] = [];
  if (list.includes('IDENTITY')) out.push('linkedin_identity');
  if (list.includes('WORKPLACE')) out.push('linkedin_workplace');
  return out;
}

export const VERIFICATION_REQUIRED_COPY = {
  en: 'Verify yourself once to propose or accept terms. Interest and the first conversation do not need it.',
  el: 'Επαληθευτείτε μία φορά για να προτείνετε ή να αποδεχτείτε όρους. Το ενδιαφέρον και η πρώτη συζήτηση δεν το χρειάζονται.',
} as const;

/**
 * Role verification for the roles founders trust with their raise.
 *
 * LinkedIn has required workplace verification for recruiter and executive
 * titles since 2025. Here, an account whose role is investor or
 * organisation (incubators, accelerators) needs a workplace-grade signal -
 * a work email, Verified on LinkedIn for the workplace, or a role the
 * platform team checked - before it accepts an introduction or answers a
 * founder's investor-introduction card. Identity alone is not enough: it
 * proves a person, not the fund or programme they claim. Everyone else
 * keeps the ordinary progressive rule (`meetsLadderPolicy`).
 *
 * Data rooms are not gated here: a founder shares one by link, with an
 * optional password, often with people who have no account at all, so the
 * founder's choice of link is the control.
 */
export const SENSITIVE_ROLES = ['investor', 'org'] as const;
export const ROLE_VERIFICATION_METHODS: readonly VerificationMethod[] = ['work_email', 'linkedin_workplace', 'admin'];

export function isSensitiveRole(role: string | null | undefined): boolean {
  return (SENSITIVE_ROLES as readonly string[]).includes(String(role ?? ''));
}

/** Whether this person may take part in introductions to investors, given their role and signals. */
export function meetsRolePolicy(role: string | null | undefined, signals: ReadonlyArray<{ method: string; expiresAt?: string | Date | null }>, now = Date.now()): boolean {
  if (!isSensitiveRole(role)) return true;
  return activeSignals(signals, now).some((s) => (ROLE_VERIFICATION_METHODS as readonly string[]).includes(s.method));
}

export const ROLE_VERIFICATION_COPY = {
  en: 'Investor and organisation accounts verify their workplace once - a work email or Verified on LinkedIn - before taking part in introductions to investors.',
  el: 'Οι λογαριασμοί επενδυτών και οργανισμών επαληθεύουν μία φορά τον χώρο εργασίας τους - με εταιρικό email ή Verified on LinkedIn - πριν συμμετάσχουν σε συστάσεις προς επενδυτές.',
} as const;
