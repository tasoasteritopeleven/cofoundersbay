import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { readState, signState } from '../common/signed-state';
import {
  maskEmail,
  meetsLadderPolicy,
  meetsRolePolicy,
  methodsFromLinkedInReport,
  workEmailDomain,
  type VerificationMethod,
  type VerificationSignal,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

/**
 * Who someone is, as far as the platform can tell.
 *
 * Three sources, any one of which meets the ladder's policy for terms and the
 * deal room (`meetsLadderPolicy` in `@cofounderbay/shared`):
 *
 * - **Work email**: a six-digit code sent to an address at a non-consumer
 *   domain. The code is stored hashed, expires in 15 minutes and allows five
 *   attempts; the signal lasts a year.
 * - **Verified on LinkedIn**: with the member's consent (`r_verify`), LinkedIn's
 *   `verificationReport` says whether it checked their identity or workplace.
 *   We store only those categories, never the documents. Off until
 *   `LINKEDIN_VERIFY_ENABLED=true` and the LinkedIn app has the product.
 * - **Platform team**: a role an admin verified (`UserRoleFacet.isVerified`).
 */

export const WORK_EMAIL = { codeMinutes: 15, attempts: 5, validMonths: 12 } as const;
const LINKEDIN_AUTHORIZE = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_VERIFICATION_REPORT = 'https://api.linkedin.com/rest/verificationReport';

function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  /** Every active signal for a person, the admin one included. */
  async signals(userId: string, now = new Date()): Promise<VerificationSignal[]> {
    const [rows, roles] = await Promise.all([
      this.prisma.userVerification.findMany({ where: { userId } }),
      this.prisma.userRoleFacet.findMany({ where: { userId, isVerified: true }, select: { verifiedAt: true } }).catch(() => [] as Array<{ verifiedAt: Date | null }>),
    ]);
    const out: VerificationSignal[] = rows
      .filter((r) => !r.expiresAt || r.expiresAt > now)
      .map((r) => ({ method: r.method as VerificationMethod, detail: r.detail, verifiedAt: r.verifiedAt.toISOString(), expiresAt: r.expiresAt?.toISOString() ?? null }));
    if (roles.length && !out.some((s) => s.method === 'admin')) {
      out.push({ method: 'admin', verifiedAt: (roles[0].verifiedAt ?? now).toISOString(), expiresAt: null });
    }
    return out;
  }

  async isVerified(userId: string): Promise<boolean> {
    return meetsLadderPolicy(await this.signals(userId));
  }

  /**
   * Whether an investor or organisation account has the workplace-grade
   * signal the role asks for (`meetsRolePolicy`); always true for other roles.
   */
  async roleCleared(userId: string, now = new Date()): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return meetsRolePolicy(user?.role ?? null, await this.signals(userId, now), now.getTime());
  }

  /** Methods only, for showing someone else's badge: no domains, no dates. */
  async publicMethods(userId: string): Promise<VerificationMethod[]> {
    return (await this.signals(userId)).map((s) => s.method);
  }

  linkedInAvailable(): boolean {
    const id = this.config.get<string>('LINKEDIN_CLIENT_ID');
    return this.config.get<string>('LINKEDIN_VERIFY_ENABLED') === 'true' && !!id && id !== 'not-configured';
  }

  async me(userId: string) {
    const signals = await this.signals(userId);
    const pending = await this.prisma.workEmailChallenge.findUnique({ where: { userId } });
    return {
      signals,
      verified: meetsLadderPolicy(signals),
      linkedinAvailable: this.linkedInAvailable(),
      pendingWorkEmail: pending && pending.expiresAt > new Date() ? maskEmail(pending.email) : null,
    };
  }

  async startWorkEmail(userId: string, body: unknown) {
    const email = typeof (body as { email?: unknown })?.email === 'string' ? (body as { email: string }).email.trim().toLowerCase() : '';
    const check = workEmailDomain(email);
    if (!check.ok) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: check.reason === 'free_mail' ? 'Use an address at your company’s own domain; personal mail providers cannot prove a workplace.' : 'That is not an email address.',
          details: {
            reason: check.reason,
            messageEl: check.reason === 'free_mail' ? 'Χρησιμοποιήστε διεύθυνση στο domain της εταιρείας σας· οι προσωπικοί πάροχοι δεν αποδεικνύουν χώρο εργασίας.' : 'Αυτή δεν είναι διεύθυνση email.',
          },
        },
      });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + WORK_EMAIL.codeMinutes * 60_000);
    await this.prisma.workEmailChallenge.upsert({
      where: { userId },
      create: { userId, email, codeHash: hashCode(userId, code), expiresAt },
      update: { email, codeHash: hashCode(userId, code), expiresAt, attempts: 0 },
    });
    await this.mailer.sendEmail({
      to: email,
      subject: `Your CoFounderBay code: ${code} · Ο κωδικός σας`,
      text: `Your code is ${code}. It expires in ${WORK_EMAIL.codeMinutes} minutes.\n\nΟ κωδικός σας είναι ${code}. Λήγει σε ${WORK_EMAIL.codeMinutes} λεπτά.\n\nIf you did not ask for it, ignore this message.`,
    });
    return { ok: true, sentTo: maskEmail(email), expiresInMinutes: WORK_EMAIL.codeMinutes };
  }

  async confirmWorkEmail(userId: string, body: unknown, now = new Date()) {
    const code = typeof (body as { code?: unknown })?.code === 'string' ? (body as { code: string }).code.replace(/\s/g, '') : '';
    const challenge = await this.prisma.workEmailChallenge.findUnique({ where: { userId } });
    if (!challenge || challenge.expiresAt <= now) throw new BadRequestException('The code expired; ask for a new one');
    if (challenge.attempts >= WORK_EMAIL.attempts) throw new BadRequestException('Too many attempts; ask for a new code');
    if (!/^\d{6}$/.test(code) || !sameHash(hashCode(userId, code), challenge.codeHash)) {
      await this.prisma.workEmailChallenge.update({ where: { userId }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('That code is not right');
    }
    const domain = challenge.email.split('@')[1];
    await this.prisma.userVerification.upsert({
      where: { userId_method: { userId, method: 'work_email' } },
      create: { userId, method: 'work_email', detail: domain, verifiedAt: now, expiresAt: addMonths(now, WORK_EMAIL.validMonths) },
      update: { detail: domain, verifiedAt: now, expiresAt: addMonths(now, WORK_EMAIL.validMonths) },
    });
    await this.prisma.workEmailChallenge.delete({ where: { userId } });
    return this.me(userId);
  }

  /** A person may withdraw any signal they gave; the admin one is the team's to change. */
  async remove(userId: string, method: string) {
    if (!['work_email', 'linkedin_identity', 'linkedin_workplace'].includes(method)) throw new BadRequestException('That verification cannot be removed here');
    await this.prisma.userVerification.deleteMany({ where: { userId, method: method as VerificationMethod } });
    return this.me(userId);
  }

  // ── Verified on LinkedIn ──────────────────────────────────────────────────

  private stateSecret(): string {
    return this.config.get<string>('JWT_SECRET') || 'dev-only-secret';
  }

  /** A signed, short-lived `state` binding the LinkedIn round trip to this person. */
  signState(userId: string, now = Date.now()): string {
    return signState(this.stateSecret(), userId, 10 * 60_000, now);
  }

  readState(state: string, now = Date.now()): string | null {
    return readState(this.stateSecret(), state, now);
  }

  private callbackUrl(): string {
    return this.config.get<string>('LINKEDIN_VERIFY_CALLBACK_URL') || 'http://localhost:3001/api/verification/linkedin/callback';
  }

  linkedInAuthorizeUrl(userId: string): string {
    if (!this.linkedInAvailable()) throw new ServiceUnavailableException('Verified on LinkedIn is not set up on this server');
    const url = new URL(LINKEDIN_AUTHORIZE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.get<string>('LINKEDIN_CLIENT_ID') as string);
    url.searchParams.set('redirect_uri', this.callbackUrl());
    url.searchParams.set('scope', 'r_verify');
    url.searchParams.set('state', this.signState(userId));
    return url.toString();
  }

  /** Exchanges the code, reads the report, stores the categories. Returns where to send the browser. */
  async linkedInCallback(code: string, state: string): Promise<string> {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const back = (status: string) => `${frontend}/settings?verification=${status}#verification`;
    const userId = this.readState(state);
    if (!userId || !code || !this.linkedInAvailable()) return back('failed');
    try {
      const tokenRes = await fetch(LINKEDIN_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.callbackUrl(),
          client_id: this.config.get<string>('LINKEDIN_CLIENT_ID') as string,
          client_secret: this.config.get<string>('LINKEDIN_CLIENT_SECRET') as string,
        }),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
      if (!accessToken) throw new Error('no access token');
      const reportRes = await fetch(LINKEDIN_VERIFICATION_REPORT, {
        headers: { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': this.config.get<string>('LINKEDIN_API_VERSION') || '202510' },
      });
      if (!reportRes.ok) throw new Error(`verificationReport ${reportRes.status}`);
      const methods = methodsFromLinkedInReport((await reportRes.json()) as { verifications?: unknown });
      await this.recordLinkedIn(userId, methods);
      return back(methods.length ? 'linkedin' : 'linkedin-none');
    } catch (err) {
      this.logger.warn(`Verified on LinkedIn failed: ${String(err)}`);
      return back('failed');
    }
  }

  /** Replaces the LinkedIn signals with what the latest report says. */
  async recordLinkedIn(userId: string, methods: VerificationMethod[], now = new Date()) {
    const linkedin: VerificationMethod[] = ['linkedin_identity', 'linkedin_workplace'];
    await this.prisma.userVerification.deleteMany({ where: { userId, method: { in: linkedin.filter((m) => !methods.includes(m)) } } });
    for (const method of methods.filter((m) => linkedin.includes(m))) {
      await this.prisma.userVerification.upsert({
        where: { userId_method: { userId, method } },
        create: { userId, method, verifiedAt: now },
        update: { verifiedAt: now },
      });
    }
  }
}
