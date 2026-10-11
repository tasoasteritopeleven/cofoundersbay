import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScoutController } from './scout.controller';
import { ScoutScheduler } from './scout.scheduler';
import { ScoutService } from './scout.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ScoutController],
  providers: [ScoutService, ScoutScheduler],
  exports: [ScoutService],
})
export class ScoutModule {}
