import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProgramService } from './program.service';

function setup(prismaOverrides: Record<string, any> = {}, organizationOverrides: Record<string, any> = {}) {
  const prisma: Record<string, any> = {
    program: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
    programParticipant: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    programMilestone: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    organizationMembership: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    ...prismaOverrides,
  };
  const organizationService = {
    checkAdminAccess: vi.fn().mockResolvedValue({ role: 'admin' }),
    checkMemberAccess: vi.fn().mockResolvedValue({ role: 'member' }),
    ...organizationOverrides,
  };
  return {
    prisma,
    organizationService,
    service: new ProgramService(prisma as never, organizationService as never),
  };
}

describe('program read boundaries', () => {
  it('uses a public projection without participants, emails, settings, or creator identifiers', async () => {
    const publicProgram = { id: 'program-1', name: 'Public program' };
    const program = {
      findUnique: vi.fn()
        .mockResolvedValueOnce({
          organizationId: 'org-1', isPublic: true, status: 'active', organization: { isActive: true },
        })
        .mockResolvedValueOnce(publicProgram),
    };
    const organizationMembership = { findUnique: vi.fn().mockResolvedValue(null) };
    const { service } = setup({ program, organizationMembership });

    await expect(service.findById('program-1', 'outsider')).resolves.toEqual(publicProgram);
    const publicQuery = program.findUnique.mock.calls[1][0];
    expect(publicQuery.select).not.toHaveProperty('participants');
    expect(publicQuery.select).not.toHaveProperty('settings');
    expect(publicQuery.select).not.toHaveProperty('tenantId');
    expect(publicQuery.select).not.toHaveProperty('createdById');
    expect(JSON.stringify(publicQuery.select)).not.toContain('email');
  });

  it('makes a private program indistinguishable from a missing program to a non-member', async () => {
    const program = {
      findUnique: vi.fn().mockResolvedValue({
        organizationId: 'org-1', isPublic: false, status: 'active', organization: { isActive: true },
      }),
    };
    const organizationMembership = { findUnique: vi.fn().mockResolvedValue(null) };
    const { service } = setup({ program, organizationMembership });

    await expect(service.findById('program-1', 'outsider')).rejects.toBeInstanceOf(NotFoundException);
    expect(program.findUnique).toHaveBeenCalledTimes(1);
  });

  it('blocks participant-profile reads before querying participants for a non-member', async () => {
    const program = { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) };
    const programParticipant = { findMany: vi.fn() };
    const { service } = setup(
      { program, programParticipant },
      { checkMemberAccess: vi.fn().mockRejectedValue(new ForbiddenException()) },
    );

    await expect(service.getParticipants('program-1', 'outsider')).rejects.toBeInstanceOf(ForbiddenException);
    expect(programParticipant.findMany).not.toHaveBeenCalled();
  });

  it('forces non-member organization listings onto active public programs and a public projection', async () => {
    const program = { findMany: vi.fn().mockResolvedValue([]) };
    const organizationMembership = { findUnique: vi.fn().mockResolvedValue(null) };
    const { service } = setup({ program, organizationMembership });

    await service.findByOrganization('org-1', 'outsider');

    const query = program.findMany.mock.calls[0][0];
    expect(query.where).toEqual(expect.objectContaining({
      organizationId: 'org-1',
      organization: { isActive: true },
      isPublic: true,
      status: { in: ['upcoming', 'active', 'completed'] },
    }));
    expect(query).toHaveProperty('select');
    expect(query).not.toHaveProperty('include');
    expect(query.select).not.toHaveProperty('participants');
  });
});

describe('program write boundaries', () => {
  it('requires organization owner/admin access before creating a program', async () => {
    const { service, prisma } = setup({}, {
      checkAdminAccess: vi.fn().mockRejectedValue(new ForbiddenException()),
    });

    await expect(service.create('ordinary-member', 'org-1', {
      name: 'Program', slug: 'program', programType: 'accelerator',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.program.findFirst).not.toHaveBeenCalled();
  });

  it('scopes participant updates to the program from the route', async () => {
    const program = { findUnique: vi.fn().mockResolvedValue({ id: 'program-a', organizationId: 'org-1' }) };
    const programParticipant = { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() };
    const { service } = setup({ program, programParticipant });

    await expect(service.updateParticipant('program-a', 'admin-1', 'participant-from-program-b', {
      status: 'accepted',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(programParticipant.findFirst).toHaveBeenCalledWith({
      where: { id: 'participant-from-program-b', programId: 'program-a' },
      select: { id: true },
    });
    expect(programParticipant.update).not.toHaveBeenCalled();
  });

  it('allowlists participant fields and cannot re-parent or replace the participant user', async () => {
    const program = { findUnique: vi.fn().mockResolvedValue({ id: 'program-1', organizationId: 'org-1' }) };
    const programParticipant = {
      findFirst: vi.fn().mockResolvedValue({ id: 'participant-1' }),
      update: vi.fn().mockResolvedValue({ id: 'participant-1' }),
    };
    const { service } = setup({ program, programParticipant });

    await service.updateParticipant('program-1', 'admin-1', 'participant-1', {
      notes: 'Reviewed',
      programId: 'attacker-program',
      userId: 'attacker-user',
    } as never);

    expect(programParticipant.update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { notes: 'Reviewed' },
    });
  });

  it('allowlists program update fields and requires owner/admin access', async () => {
    const program = {
      findUnique: vi.fn().mockResolvedValue({ id: 'program-1', organizationId: 'org-1' }),
      update: vi.fn().mockResolvedValue({ id: 'program-1' }),
    };
    const { service, organizationService } = setup({ program });

    await service.update('program-1', 'admin-1', {
      name: 'Renamed',
      organizationId: 'attacker-org',
      createdById: 'attacker-user',
      tenantId: 'attacker-tenant',
    } as never);

    expect(organizationService.checkAdminAccess).toHaveBeenCalledWith('org-1', 'admin-1');
    expect(program.update).toHaveBeenCalledWith({
      where: { id: 'program-1' },
      data: { name: 'Renamed' },
    });
  });

  it('requires owner/admin access for milestone changes', async () => {
    const programMilestone = {
      findUnique: vi.fn().mockResolvedValue({ id: 'milestone-1', program: { organizationId: 'org-1' } }),
      update: vi.fn(),
    };
    const { service } = setup(
      { programMilestone },
      { checkAdminAccess: vi.fn().mockRejectedValue(new ForbiddenException()) },
    );

    await expect(service.updateMilestone('milestone-1', 'ordinary-member', { title: 'Changed' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(programMilestone.update).not.toHaveBeenCalled();
  });
});
