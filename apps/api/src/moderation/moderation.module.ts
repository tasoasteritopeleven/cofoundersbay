import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationAdminController, ReportsController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ReportsController, ModerationAdminController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
