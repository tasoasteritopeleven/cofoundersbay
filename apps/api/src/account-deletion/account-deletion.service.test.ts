import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDeletionService } from './account-deletion.service';

vi.mock('argon2', () => ({ verify: vi.fn(async (_hash: string, password: string) => password === 'right') }));

/** A member deleting their own account: confirmed, never under anyone else's feet, and with the files (docs §112). */

const member = (over: Record<string, unknown> = {}) => ({
  id: 'me', email: 'me@example.com', role: 'founder', passwordHash: 'hash', googleId: null, linkedinId: null, twoFactorEnabled: false, ...over,
});

function setup() {
  const tx = {
    group: { findMany: vi.fn(async () => [] as unknown[]), update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    groupMember: { updateMany: vi.fn(async () => ({})) },
    user: { delete: vi.fn(async () => ({})) },
    event: { findMany: vi.fn(async () => [] as Array<{ id: string }>) },
    notification: { deleteMany: vi.fn(async () => ({})) },
  };
  const prisma: Record<string, any> = {
    user: { findUnique: vi.fn(async () => member() as unknown), count: vi.fn(async () => 0) },
    organization: { findMany: vi.fn(async () => [] as unknown[]) },
    dataRoomDocument: { count: vi.fn(async () => 0), findMany: vi.fn(async () => [] as unknown[]) },
    upload: { count: vi.fn(async () => 0), findMany: vi.fn(async () => [] as unknown[]) },
    group: { count: vi.fn(async () => 0) },
    builderWorkspace: { count: vi.fn(async () => 0) },
    fundraisingRound: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (run: (t: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const uploads = { deletePrivateFile: vi.fn(async () => undefined), deletePublicFile: vi.fn(async () => undefined) };
  const twoFactor = { verify: vi.fn(async () => true) };
  const mailer = { sendEmail: vi.fn(async () => undefined) };
  return { service: new AccountDeletionService(prisma as never, uploads as never, twoFactor as never, mailer as never), prisma, tx, uploads, twoFactor, mailer };
}

let t: ReturnType<typeof setup>;
beforeEach(() => { t = setup(); });

describe('confirming', () => {
  it('needs the password, and changes nothing without it', async () => {
    await expect(t.service.delete('me', { password: 'wrong' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(t.service.delete('me', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('takes the address from a social sign-in, which has no password to type', async () => {
    t.prisma.user.findUnique.mockResolvedValue(member({ googleId: 'g1' }));
    await expect(t.service.delete('me', { email: 'someone@else.com' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(t.service.delete('me', { email: 'ME@example.com' })).resolves.toEqual({ deleted: true });
  });

  it('asks for the authenticator code when two-factor is on', async () => {
    t.prisma.user.findUnique.mockResolvedValue(member({ twoFactorEnabled: true }));
    await expect(t.service.delete('me', { password: 'right' })).rejects.toBeInstanceOf(BadRequestException);
    t.twoFactor.verify.mockResolvedValueOnce(false);
    await expect(t.service.delete('me', { password: 'right', code: '000000' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(t.service.delete('me', { password: 'right', code: '123456' })).resolves.toEqual({ deleted: true });
  });
});

describe('what stands in the way', () => {
  it('stops at an organization with other members, and names it', async () => {
    t.prisma.organization.findMany.mockResolvedValue([{ name: 'Aegean Venture Lab' }]);
    await expect(t.service.delete('me', { password: 'right' })).rejects.toBeInstanceOf(ConflictException);
    expect(t.tx.user.delete).not.toHaveBeenCalled();
    const preview = await t.service.preview('me');
    expect(preview.blockers).toEqual([{ code: 'organization_has_members', organizations: ['Aegean Venture Lab'] }]);
  });

  it('keeps the last super admin, and lets one of two go', async () => {
    t.prisma.user.findUnique.mockResolvedValue(member({ role: 'super_admin' }));
    await expect(t.service.delete('me', { password: 'right' })).rejects.toBeInstanceOf(ConflictException);
    t.prisma.user.count.mockResolvedValue(1);
    await expect(t.service.delete('me', { password: 'right' })).resolves.toEqual({ deleted: true });
  });
});

describe('deleting', () => {
  it('hands a group on to its next member, and removes an empty one', async () => {
    t.tx.group.findMany.mockResolvedValue([
      { id: 'shared', members: [{ userId: 'next' }] },
      { id: 'alone', members: [] },
    ]);
    await t.service.delete('me', { password: 'right' });
    expect(t.tx.group.update).toHaveBeenCalledWith({ where: { id: 'shared' }, data: { createdById: 'next' } });
    expect(t.tx.groupMember.updateMany).toHaveBeenCalledWith({ where: { groupId: 'shared', userId: 'next' }, data: { role: 'owner' } });
    expect(t.tx.group.delete).toHaveBeenCalledWith({ where: { id: 'alone' } });
    expect(t.tx.user.delete).toHaveBeenCalledWith({ where: { id: 'me' } });
  });

  it('removes the data room and uploaded files, after the rows', async () => {
    t.prisma.dataRoomDocument.findMany.mockResolvedValue([{ fileUrl: 'dataroom_1.pdf' }]);
    t.prisma.upload.findMany.mockResolvedValue([{ key: 'avatar_1.png' }]);
    await t.service.delete('me', { password: 'right' });
    expect(t.uploads.deletePrivateFile).toHaveBeenCalledWith('dataroom_1.pdf');
    expect(t.uploads.deletePublicFile).toHaveBeenCalledWith('avatar_1.png');
    expect(t.tx.user.delete.mock.invocationCallOrder[0]).toBeLessThan(t.uploads.deletePrivateFile.mock.invocationCallOrder[0]);
  });

  it('leaves every file alone when the rows could not go', async () => {
    t.prisma.dataRoomDocument.findMany.mockResolvedValue([{ fileUrl: 'dataroom_1.pdf' }]);
    t.prisma.$transaction.mockRejectedValueOnce(new Error('database down'));
    await expect(t.service.delete('me', { password: 'right' })).rejects.toThrow('database down');
    expect(t.uploads.deletePrivateFile).not.toHaveBeenCalled();
  });

  it('retries a stuck file, and still finishes', async () => {
    t.prisma.dataRoomDocument.findMany.mockResolvedValue([{ fileUrl: 'dataroom_1.pdf' }]);
    t.uploads.deletePrivateFile.mockRejectedValueOnce(new Error('s3')).mockRejectedValueOnce(new Error('s3'));
    await expect(t.service.delete('me', { password: 'right' })).resolves.toEqual({ deleted: true });
    expect(t.uploads.deletePrivateFile).toHaveBeenCalledTimes(3);
  });

  it('says so by email, and a mail failure does not undo it', async () => {
    t.mailer.sendEmail.mockRejectedValueOnce(new Error('smtp'));
    await expect(t.service.delete('me', { password: 'right' })).resolves.toEqual({ deleted: true });
    expect(t.mailer.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@example.com' }));
  });
});

describe('the schema', () => {
  it('lets a user row go: every relation to User says what happens to it', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const silent: string[] = [];
    for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      for (const line of body.split('\n')) {
        const field = line.match(/^\s*(\w+)\s+User\??\s+@relation\((.*)\)/);
        if (field && !field[2].includes('onDelete')) silent.push(`${model}.${field[1]}`);
      }
    }
    // A group passes to its next member before the row goes (see `delete`).
    expect(silent).toEqual(['Group.createdBy']);
  });
});
