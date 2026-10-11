import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommitmentsModule } from '../commitments/commitments.module';
import { VerificationModule } from '../verification/verification.module';
import { IntrosController } from './intros.controller';
import { IntrosService } from './intros.service';

@Module({
  imports: [PrismaModule, NotificationsModule, CommitmentsModule, VerificationModule],
  controllers: [IntrosController],
  providers: [IntrosService],
  exports: [IntrosService],
})
export class IntrosModule {}
