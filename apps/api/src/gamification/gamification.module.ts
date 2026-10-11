import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GamificationService } from './gamification.service';
import { GamificationEventsService } from './gamification-events.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationEventsService],
  exports: [GamificationService, GamificationEventsService],
})
export class GamificationModule {}
