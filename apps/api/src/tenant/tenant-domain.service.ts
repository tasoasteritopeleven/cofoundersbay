import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import * as dns from 'dns';

@Injectable()
export class TenantDomainService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Domain Listing ──────────────────────────────────────────────────────────

  async listDomainsForTenant(tenantId: string) {
    const domains = await this.prisma.tenantDomain.findMany({
      where: { tenantId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    return { domains };
  }

  async getDomainById(tenantId: string, domainId: string) {
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
      include: { tenant: true },
    });
    if (!domain || domain.tenantId !== tenantId) throw new NotFoundException('Domain not found');
    return { domain };
  }

  // ── Domain Resolution ───────────────────────────────────────────────────────

  async resolveTenantFromDomain(domainName: string) {
    // Try exact match first
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { domainName },
      include: {
        tenant: {
          include: { branding: true },
        },
      },
    });

    if (domain && domain.isActive && domain.tenant.status === 'active') {
      return {
        tenant: domain.tenant,
        domain,
        branding: domain.tenant.branding,
      };
    }

    // Try subdomain pattern (e.g., "athens" from "athens.cofounderbay.com")
    const subdomainMatch = domainName.match(/^([^.]+)\.cofounderbay\.com$/i);
    if (subdomainMatch) {
      const slug = subdomainMatch[1].toLowerCase();
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug },
        include: { branding: true },
      });

      if (tenant && tenant.status === 'active') {
        return {
          tenant,
          domain: null,
          branding: tenant.branding,
        };
      }
    }

    return null;
  }

  // ── Subdomain Management ────────────────────────────────────────────────────

  async createSubdomain(tenantId: string, subdomain: string) {
    // Validate subdomain format
    const cleanSubdomain = subdomain.toLowerCase().trim();
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(cleanSubdomain)) {
      throw new BadRequestException('Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.');
    }

    // Reserved subdomains
    const reserved = ['www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets'];
    if (reserved.includes(cleanSubdomain)) {
      throw new BadRequestException('This subdomain is reserved');
    }

    const domainName = `${cleanSubdomain}.cofounderbay.com`;

    // Check if already exists
    const existing = await this.prisma.tenantDomain.findUnique({
      where: { domainName },
    });
    if (existing) {
      throw new ConflictException('This subdomain is already taken');
    }

    // Check if tenant slug matches
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const domain = await this.prisma.tenantDomain.create({
      data: {
        tenantId,
        domainType: 'subdomain',
        domainName,
        isPrimary: true,
        isActive: true,
        verificationStatus: 'verified', // Subdomains are auto-verified
        verifiedAt: new Date(),
        sslStatus: 'active', // Covered by wildcard cert
      },
    });

    return { domain };
  }

  // ── Custom Domain Management ────────────────────────────────────────────────

  async addCustomDomain(tenantId: string, customDomain: string) {
    // Validate domain format
    const cleanDomain = customDomain.toLowerCase().trim();
    if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(cleanDomain)) {
      throw new BadRequestException('Invalid domain format');
    }

    // Prevent adding cofounderbay.com domains as custom
    if (cleanDomain.endsWith('.cofounderbay.com') || cleanDomain === 'cofounderbay.com') {
      throw new BadRequestException('Cannot add CoFounderBay domains as custom domains');
    }

    // Check if already exists
    const existing = await this.prisma.tenantDomain.findUnique({
      where: { domainName: cleanDomain },
    });
    if (existing) {
      throw new ConflictException('This domain is already registered');
    }

    // Generate verification token
    const verificationToken = `cfb-verify-${randomBytes(16).toString('hex')}`;

    const domain = await this.prisma.tenantDomain.create({
      data: {
        tenantId,
        domainType: 'custom',
        domainName: cleanDomain,
        isPrimary: false,
        isActive: false,
        verificationStatus: 'pending',
        verificationToken,
        verificationMethod: 'dns_txt',
        dnsInstructions: JSON.stringify({
          type: 'TXT',
          name: '_cofounderbay-verification',
          value: verificationToken,
          ttl: 3600,
          instructions: [
            `Add a TXT record to your DNS configuration:`,
            `Host/Name: _cofounderbay-verification.${cleanDomain}`,
            `Value: ${verificationToken}`,
            `TTL: 3600 (or your provider's minimum)`,
            ``,
            `After adding the record, click "Verify Domain" to complete setup.`,
          ],
        }),
        sslStatus: 'pending',
      },
    });

    return { domain };
  }

  async verifyCustomDomain(tenantId: string, domainId: string): Promise<{ verified: boolean; message: string }> {
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.tenantId !== tenantId) throw new NotFoundException('Domain not found');
    if (domain.domainType !== 'custom') {
      throw new BadRequestException('Only custom domains need verification');
    }
    if (domain.verificationStatus === 'verified') {
      return { verified: true, message: 'Domain is already verified' };
    }

    // In production, this would do actual DNS lookup
    // For now, we'll simulate verification
    const dnsVerified = await this.checkDnsRecord(domain.domainName, domain.verificationToken!);

    if (dnsVerified) {
      await this.prisma.tenantDomain.update({
        where: { id: domainId },
        data: {
          verificationStatus: 'verified',
          verifiedAt: new Date(),
          lastVerificationCheck: new Date(),
          isActive: true,
          sslStatus: 'pending', // Would trigger SSL provisioning
        },
      });
      return { verified: true, message: 'Domain verified successfully' };
    }

    await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: {
        verificationStatus: 'failed',
        lastVerificationCheck: new Date(),
      },
    });

    return {
      verified: false,
      message: 'DNS verification failed. Please ensure the TXT record is properly configured.',
    };
  }

  private async checkDnsRecord(domain: string, expectedToken: string): Promise<boolean> {
    const verificationHost = `_cofounderbay-verification.${domain}`;
    try {
      const records = await dns.promises.resolveTxt(verificationHost);
      const flat = records.flat();
      return flat.includes(expectedToken);
    } catch (err: unknown) {
      // ENODATA / ENOTFOUND = record not present (expected before setup)
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'ESERVFAIL') {
        return false;
      }
      // Network / resolver errors — don't fail hard, just return false
      return false;
    }
  }

  // ── Domain Updates ──────────────────────────────────────────────────────────

  async setPrimaryDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) throw new NotFoundException('Domain not found');
    if (domain.tenantId !== tenantId) throw new BadRequestException('Domain does not belong to this tenant');
    if (!domain.isActive) throw new BadRequestException('Cannot set inactive domain as primary');

    // Remove primary from all other domains
    await this.prisma.tenantDomain.updateMany({
      where: { tenantId, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set this domain as primary
    const updated = await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: { isPrimary: true },
    });

    return { domain: updated };
  }

  async toggleDomainActive(tenantId: string, domainId: string, isActive: boolean) {
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.tenantId !== tenantId) throw new NotFoundException('Domain not found');
    if (domain.verificationStatus !== 'verified' && isActive) {
      throw new BadRequestException('Cannot activate unverified domain');
    }

    const updated = await this.prisma.tenantDomain.update({
      where: { id: domainId },
      data: { isActive },
    });

    return { domain: updated };
  }

  async deleteDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.tenantDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.tenantId !== tenantId) throw new NotFoundException('Domain not found');

    await this.prisma.tenantDomain.delete({
      where: { id: domainId },
    });

    return { success: true };
  }

  // ── DNS Instructions ────────────────────────────────────────────────────────

  getDnsInstructions(domain: { domainName: string; verificationToken: string | null }) {
    return {
      verification: {
        type: 'TXT',
        name: `_cofounderbay-verification.${domain.domainName}`,
        value: domain.verificationToken,
        ttl: 3600,
      },
      cname: {
        type: 'CNAME',
        name: domain.domainName,
        value: 'custom.cofounderbay.com',
        ttl: 3600,
      },
      instructions: [
        '1. Add the TXT record for domain verification',
        '2. Add the CNAME record to point your domain to CoFounderBay',
        '3. Wait for DNS propagation (can take up to 48 hours)',
        '4. Click "Verify Domain" to complete setup',
      ],
    };
  }
}
