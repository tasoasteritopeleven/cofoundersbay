import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BehavioralStateService } from './behavioral-state.service';
import { NextActionRecommenderService } from './next-action-recommender.service';
import { NudgeFatigueService } from './nudge-fatigue.service';
import { BehavioralOptimizerController } from './behavioral-optimizer.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BehavioralOptimizerController],
  providers: [BehavioralStateService, NextActionRecommenderService, NudgeFatigueService],
  exports: [BehavioralStateService, NextActionRecommenderService, NudgeFatigueService],
})
export class BehavioralOptimizerModule {}
