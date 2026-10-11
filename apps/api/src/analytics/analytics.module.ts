import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ProfileViewService } from './profile-view.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ProfileViewService],
  exports: [AnalyticsService, ProfileViewService],
})
export class AnalyticsModule {}
