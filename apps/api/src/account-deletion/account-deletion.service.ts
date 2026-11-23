import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TwoFactorService } from '../auth/two-factor.service';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import type { DeleteAccount } from './account-deletion.schemas';

export type DeletionBlocker =
  | { code: 'last_super_admin' }
  | { code: 'organization_has_members'; organizations: string[] };

type Account = {
  id: string;
  email: string;
  role: string;
  passwordHash: string | null;
  googleId: string | null;
  linkedinId: string | null;
  twoFactorEnabled: boolean;
};

const FILE_ATTEMPTS = 3;

/**
 * A member deleting their own account (docs §112).
 *
 * It used to be an email to privacy@, and the data room's private files then
 * had to be removed by hand. The rows go through the schema's cascades in one
 * transaction, so the account is either whole or gone. Two things a cascade
 * must not decide alone stop or redirect it:
 *
 * - An organization with other members would disappear under them, so it
 *   blocks the deletion until it is handed over, as GitHub does. The last
 *   super admin blocks too.
 * - A group with other members passes to the next one in line; an empty group
 *   goes with its creator.
 *
 * Files go after the commit: a failed delete must not leave an account whose
 * files are already gone. A file that will not delete is retried, then logged
 * with its key and no personal data, for removal by hand.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly twoFactor: TwoFactorService,
    // Optional so unit tests that build the service without it still work.
    @Optional() private readonly mailer?: MailerService,
  ) {}

  private async account(userId: string): Promise<Account> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, passwordHash: true, googleId: true, linkedinId: true, twoFactorEnabled: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  private async blockers(user: Account): Promise<DeletionBlocker[]> {
    const blockers: DeletionBlocker[] = [];
    if (user.role === 'super_admin') {
      const others = await this.prisma.user.count({ where: { role: 'super_admin', id: { not: user.id } } });
      if (others === 0) blockers.push({ code: 'last_super_admin' });
    }
    const organizations = await this.prisma.organization.findMany({
      where: { createdById: user.id, memberships: { some: { userId: { not: user.id } } } },
      select: { name: true },
    });
    if (organizations.length > 0) blockers.push({ code: 'organization_has_members', organizations: organizations.map((o) => o.name) });
    return blockers;
  }

  /** What deleting would do, shown before it is asked for. */
  async preview(userId: string) {
    const user = await this.account(userId);
    const [blockers, dataRoomFiles, uploads, groupsHandedOver, groupsRemoved, sharedWorkspaces, rounds] = await Promise.all([
      this.blockers(user),
      this.prisma.dataRoomDocument.count({ where: { uploadedById: userId, fileUrl: { not: null } } }),
      this.prisma.upload.count({ where: { userId } }),
      this.prisma.group.count({ where: { createdById: userId, members: { some: { userId: { not: userId } } } } }),
      this.prisma.group.count({ where: { createdById: userId, members: { none: { userId: { not: userId } } } } }),
      this.prisma.builderWorkspace.count({ where: { ownerId: userId, collaborators: { some: {} } } }),
      this.prisma.fundraisingRound.count({ where: { ownerId: userId } }),
    ]);
    return {
      confirmWith: this.confirmsWithEmail(user) ? ('email' as const) : ('password' as const),
      needsCode: user.twoFactorEnabled,
      blockers,
      counts: { dataRoomFiles, uploads, groupsHandedOver, groupsRemoved, sharedWorkspaces, rounds },
    };
  }

  /** A social sign-in has no password its owner knows, so typing the address stands in for it. */
  private confirmsWithEmail(user: Account) {
    return Boolean(user.googleId || user.linkedinId);
  }

  private async confirm(user: Account, input: DeleteAccount) {
    if (this.confirmsWithEmail(user)) {
      if (input.email?.toLowerCase() !== user.email.toLowerCase()) throw new ForbiddenException('That is not the address on this account');
    } else {
      const valid = Boolean(user.passwordHash && input.password) && (await argon2.verify(user.passwordHash as string, input.password as string));
      if (!valid) throw new ForbiddenException('That password is not correct');
    }
    if (user.twoFactorEnabled) {
      if (!input.code) throw new BadRequestException('Enter the code from your authenticator app');
      if (!(await this.twoFactor.verify(user.id, input.code))) throw new ForbiddenException('That code is not correct');
    }
  }

  private async removeWithRetry(remove: () => Promise<void>) {
    for (let attempt = 1; attempt <= FILE_ATTEMPTS; attempt += 1) {
      try {
        await remove();
        return true;
      } catch (err) {
        if (attempt === FILE_ATTEMPTS) this.logger.error(`File left behind: ${String(err)}`);
      }
    }
    return false;
  }

  async delete(userId: string, input: DeleteAccount) {
    const user = await this.account(userId);
    await this.confirm(user, input);
    const blockers = await this.blockers(user);
    if (blockers.length > 0) throw new ConflictException({ message: 'This account cannot be deleted yet', blockers });

    // Read before the rows go: the keys are how the bytes are found.
    const [documents, uploads] = await Promise.all([
      this.prisma.dataRoomDocument.findMany({ where: { uploadedById: userId, fileUrl: { not: null } }, select: { fileUrl: true } }),
      this.prisma.upload.findMany({ where: { userId }, select: { key: true } }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      const groups = await tx.group.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          // The enum runs owner, admin, moderator, member: the most senior, then the longest there.
          members: { where: { userId: { not: userId } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }], take: 1, select: { userId: true } },
        },
      });
      for (const group of groups) {
        const heir = group.members[0]?.userId;
        if (heir) {
          await tx.group.update({ where: { id: group.id }, data: { createdById: heir } });
          await tx.groupMember.updateMany({ where: { groupId: group.id, userId: heir }, data: { role: 'owner' } });
        } else {
          await tx.group.delete({ where: { id: group.id } });
        }
      }
      const ownedEvents = await tx.event.findMany({ where: { creatorId: userId }, select: { id: true } });
      await tx.user.delete({ where: { id: userId } });
      await tx.notification.deleteMany({
        where: {
          type: 'system',
          OR: [
            { meta: { path: ['reconnectPair'], string_starts_with: `${userId}:` } },
            { meta: { path: ['reconnectPair'], string_ends_with: `:${userId}` } },
            {
              link: { in: ownedEvents.map(({ id }) => `/events/${id}#reconnect`) },
              OR: [
                { meta: { path: ['eventReconnect'], equals: 'match' } },
                { meta: { path: ['eventReconnect'], equals: 'nudge' } },
              ],
            },
          ],
        },
      });
    }, { timeout: 30_000 });

    const results = await Promise.all([
      ...documents.map((d) => this.removeWithRetry(() => this.uploads.deletePrivateFile(d.fileUrl as string))),
      ...uploads.map((u) => this.removeWithRetry(() => this.uploads.deletePublicFile(u.key))),
    ]);
    const left = results.filter((ok) => !ok).length;
    if (left > 0) this.logger.error(`Account deleted with ${left} of ${results.length} files left behind`);

    await this.mailer
      ?.sendEmail({
        to: user.email,
        subject: 'Your CoFounderBay account has been deleted',
        text: 'Your account and its data have been deleted, as you asked. If this was not you, write to privacy@cofounderbay.com.',
      })
      .catch((err: unknown) => this.logger.warn(`Deletion email not sent: ${String(err)}`));

    return { deleted: true };
  }
}
