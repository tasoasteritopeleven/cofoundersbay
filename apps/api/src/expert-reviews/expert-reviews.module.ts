import { Module } from '@nestjs/common';
import { ExpertReviewsController } from './expert-reviews.controller';
import { ExpertReviewsService } from './expert-reviews.service';

@Module({
  controllers: [ExpertReviewsController],
  providers: [ExpertReviewsService],
  exports: [ExpertReviewsService],
})
export class ExpertReviewsModule {}
