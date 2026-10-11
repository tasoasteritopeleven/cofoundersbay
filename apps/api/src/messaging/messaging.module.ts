import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [MessagingController],
  providers: [MessagingService, PresenceService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}

