import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventReconnectService } from './event-reconnect.service';
import { EventReconnectScheduler } from './event-reconnect.scheduler';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, EventReconnectService, EventReconnectScheduler],
  exports: [EventsService],
})
export class EventsModule {}
