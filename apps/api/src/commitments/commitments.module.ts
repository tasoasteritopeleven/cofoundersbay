import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { CommitmentsController } from './commitments.controller';
import { CommitmentsService } from './commitments.service';

@Module({
  imports: [PrismaModule, NotificationsModule, VerificationModule],
  controllers: [CommitmentsController],
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
