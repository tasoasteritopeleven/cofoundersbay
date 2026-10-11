import { BadRequestException, Controller, ForbiddenException, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { EmailDigestService, DigestType } from './email-digest.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DIGEST_TYPES, SendTestDigestDto, UpdateDigestPreferencesDto } from './dto/digest.dto';

const CONTENT_CATEGORIES = ['connections', 'messages', 'opportunities', 'events', 'updates'] as const;

function digestType(value: string): DigestType {
  if (!(DIGEST_TYPES as readonly string[]).includes(value)) throw new BadRequestException('Invalid digest type');
  return value as DigestType;
}

@Controller('digests')
@UseGuards(JwtAuthGuard)
export class DigestsController {
  constructor(
    private readonly emailDigestService: EmailDigestService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('test/:userId')
  async sendTestDigest(
    @Param('userId') userId: string,
    @Body() body: SendTestDigestDto,
    @CurrentUser() currentUser: { id: string; role: string },
  ) {
    const type = body.type ?? 'daily';
    if (currentUser.id !== userId && !['admin', 'super_admin'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only send test digests to yourself');
    }

    await this.emailDigestService.sendTestDigest(userId, type);
    return { message: `Test ${type} digest sent successfully` };
  }

  @Post('trigger/:type')
  async triggerDigest(
    @Param('type') rawType: string,
    @CurrentUser() currentUser: { role: string },
  ) {
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      throw new ForbiddenException('Only administrators can trigger digest generation');
    }
    const type = digestType(rawType);
    const summary = await this.emailDigestService.generateDigests(type);
    return { message: `${type} digest generation completed`, summary };
  }

  @Get('preferences')
  async getDigestPreferences(@CurrentUser() currentUser: { id: string }) {
    const [digest, channels] = await Promise.all([
      this.prisma.activityDigestPreference.findUnique({ where: { userId: currentUser.id } }),
      this.prisma.userNotificationChannel.findMany({
        where: { userId: currentUser.id, channel: 'email', category: { in: [...CONTENT_CATEGORIES] } },
      }),
    ]);
    const enabled = new Map(channels.map((channel) => [channel.category, channel.isEnabled]));
    const frequency = digest?.frequency ?? 'never';
    return { preferences: {
      daily: frequency === 'daily', weekly: frequency === 'weekly', monthly: frequency === 'monthly',
      connections: enabled.get('connections') ?? true,
      messages: enabled.get('messages') ?? true,
      opportunities: enabled.get('opportunities') ?? true,
      events: enabled.get('events') ?? true,
      updates: enabled.get('updates') ?? false,
    } };
  }

  @Post('preferences')
  async updateDigestPreferences(
    @Body() preferences: UpdateDigestPreferencesDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    const requested = DIGEST_TYPES.filter((type) => preferences[type] === true);
    if (requested.length > 1) throw new BadRequestException('Choose only one digest frequency');
    const frequencyWasProvided = DIGEST_TYPES.some((type) => preferences[type] !== undefined);
    const operations: ReturnType<PrismaService['activityDigestPreference']['upsert']>[] = [];
    if (frequencyWasProvided) {
      const frequency = requested[0] ?? 'never';
      operations.push(this.prisma.activityDigestPreference.upsert({
        where: { userId: currentUser.id },
        create: { userId: currentUser.id, frequency },
        update: { frequency },
      }));
    }
    for (const category of CONTENT_CATEGORIES) {
      const isEnabled = preferences[category];
      if (isEnabled === undefined) continue;
      operations.push(this.prisma.userNotificationChannel.upsert({
        where: { userId_channel_category: { userId: currentUser.id, channel: 'email', category } },
        create: { userId: currentUser.id, channel: 'email', category, isEnabled, frequency: 'digest' },
        update: { isEnabled, frequency: 'digest' },
      }) as never);
    }
    if (operations.length) await this.prisma.$transaction(operations);
    return { message: 'Digest preferences updated successfully' };
  }
}
