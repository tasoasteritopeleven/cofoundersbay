import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TenantDomainService } from './tenant-domain.service';

describe('TenantDomainService tenant isolation', () => {
  it('does not disclose a domain that belongs to another tenant', async () => {
    const prisma: any = {
      tenantDomain: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'domain-2', tenantId: 'tenant-2', tenant: { id: 'tenant-2' },
        }),
      },
    };
    const service = new TenantDomainService(prisma);

    await expect(service.getDomainById('tenant-1', 'domain-2'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['verify', 'toggle', 'delete'])('blocks cross-tenant %s mutations', async (operation) => {
    const prisma: any = {
      tenantDomain: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'domain-2', tenantId: 'tenant-2', domainType: 'custom',
          verificationStatus: 'verified', isActive: true,
        }),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    const service = new TenantDomainService(prisma);

    const promise = operation === 'verify'
      ? service.verifyCustomDomain('tenant-1', 'domain-2')
      : operation === 'toggle'
        ? service.toggleDomainActive('tenant-1', 'domain-2', false)
        : service.deleteDomain('tenant-1', 'domain-2');

    await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tenantDomain.update).not.toHaveBeenCalled();
    expect(prisma.tenantDomain.delete).not.toHaveBeenCalled();
  });
});
