import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { DMA_SNAPSHOT_DOMAINS, pickImportFields, type LinkedInRecord } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { readState, signState } from '../common/signed-state';

/**
 * "Bring your profile from LinkedIn" through the EU Digital Markets Act.
 *
 * LinkedIn, a DMA gatekeeper, offers members in the EU/EEA and Switzerland a
 * Member Data Portability API: with the member's consent
 * (`r_dma_portability_3rd_party`) a third party reads their snapshot. We read
 * four domains — PROFILE, POSITIONS, EDUCATION, SKILLS — keep only the
 * columns a profile uses (`LINKEDIN_IMPORT_FIELDS`), and hold them for 15
 * minutes until the person opens the profile form, which reads them once.
 * Nothing reaches the profile until they press Save there.
 *
 * Access needs LinkedIn's approval of the app for that product; until then
 * `LINKEDIN_DMA_ENABLED` stays off and the page offers the export upload,
 * which needs no approval at all.
 */

const AUTHORIZE = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
export const SNAPSHOT_URL = 'https://api.linkedin.com/rest/memberSnapshotData';
const DRAFT_MINUTES = 15;
const MAX_PAGES = 5;

type Records = { profile: LinkedInRecord[]; positions: LinkedInRecord[]; education: LinkedInRecord[]; skills: LinkedInRecord[] };

@Injectable()
export class ProfileImportService {
  private readonly logger = new Logger(ProfileImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private clientId(): string | undefined {
    return this.config.get<string>('LINKEDIN_DMA_CLIENT_ID') || this.config.get<string>('LINKEDIN_CLIENT_ID');
  }

  private clientSecret(): string | undefined {
    return this.config.get<string>('LINKEDIN_DMA_CLIENT_SECRET') || this.config.get<string>('LINKEDIN_CLIENT_SECRET');
  }

  available(): boolean {
    const id = this.clientId();
    return this.config.get<string>('LINKEDIN_DMA_ENABLED') === 'true' && !!id && id !== 'not-configured';
  }

  private secret(): string {
    return this.config.get<string>('JWT_SECRET') || 'dev-only-secret';
  }

  private callbackUrl(): string {
    return this.config.get<string>('LINKEDIN_DMA_CALLBACK_URL') || 'http://localhost:3001/api/profile-import/linkedin/callback';
  }

  authorizeUrl(userId: string): string {
    if (!this.available()) throw new ServiceUnavailableException('Importing from LinkedIn is not set up on this server');
    const url = new URL(AUTHORIZE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId() as string);
    url.searchParams.set('redirect_uri', this.callbackUrl());
    url.searchParams.set('scope', 'r_dma_portability_3rd_party');
    url.searchParams.set('state', signState(this.secret(), userId));
    return url.toString();
  }

  /** One domain's rows, following `paging.links` rel=next for a few pages. */
  private async snapshot(token: string, domain: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let next: string | null = `${SNAPSHOT_URL}?q=criteria&domain=${encodeURIComponent(domain)}`;
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const res: Response = await fetch(next, {
        headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': this.config.get<string>('LINKEDIN_DMA_VERSION') || '202312', 'X-Restli-Protocol-Version': '2.0.0' },
      });
      if (res.status === 404) break; // a domain the member has no data in
      if (!res.ok) throw new Error(`memberSnapshotData ${domain} ${res.status}`);
      const body = (await res.json()) as { elements?: Array<{ snapshotData?: unknown }>; paging?: { links?: Array<{ rel?: string; href?: string }> } };
      for (const element of body.elements ?? []) {
        if (Array.isArray(element.snapshotData)) rows.push(...(element.snapshotData as Record<string, unknown>[]));
      }
      const href = body.paging?.links?.find((l) => l.rel === 'next')?.href;
      next = href ? new URL(href, 'https://api.linkedin.com').toString() : null;
    }
    return rows;
  }

  /** Exchanges the code, reads the four domains, keeps the allowlisted columns, and says where to send the browser. */
  async callback(code: string, state: string): Promise<string> {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const back = (status: string) => `${frontend}/profile/edit?import=${status}`;
    const userId = readState(this.secret(), state);
    if (!userId || !code || !this.available()) return back('failed');
    try {
      const tokenRes = await fetch(TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.callbackUrl(), client_id: this.clientId() as string, client_secret: this.clientSecret() as string }),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
      if (!token) throw new Error('no access token');
      const records: Records = { profile: [], positions: [], education: [], skills: [] };
      for (const [domain, kind] of Object.entries(DMA_SNAPSHOT_DOMAINS)) {
        records[kind] = (await this.snapshot(token, domain)).map((row) => pickImportFields(kind, row)).filter((r) => Object.keys(r).length > 0);
      }
      await this.prisma.profileImportDraft.upsert({
        where: { userId },
        create: { userId, records: records as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + DRAFT_MINUTES * 60_000) },
        update: { records: records as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + DRAFT_MINUTES * 60_000) },
      });
      return back('linkedin');
    } catch (err) {
      this.logger.warn(`LinkedIn DMA import failed: ${String(err)}`);
      return back('failed');
    }
  }

  /** The waiting records, once: reading deletes them. */
  async takeDraft(userId: string, now = new Date()): Promise<{ records: Records | null }> {
    const row = await this.prisma.profileImportDraft.findUnique({ where: { userId } });
    if (!row) return { records: null };
    await this.prisma.profileImportDraft.delete({ where: { userId } });
    if (row.expiresAt <= now) return { records: null };
    return { records: row.records as unknown as Records };
  }
}
