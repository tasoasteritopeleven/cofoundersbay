import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsController, FounderUpdatesController } from './founder-updates.controller';
import { FounderUpdatesService } from './founder-updates.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [FollowsController, FounderUpdatesController],
  providers: [FounderUpdatesService],
  exports: [FounderUpdatesService],
})
export class FounderUpdatesModule {}
