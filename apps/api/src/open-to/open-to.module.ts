import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VerificationModule } from '../verification/verification.module';
import { OpenToController } from './open-to.controller';
import { OpenToService } from './open-to.service';

@Module({
  imports: [PrismaModule, VerificationModule],
  controllers: [OpenToController],
  providers: [OpenToService],
  exports: [OpenToService],
})
export class OpenToModule {}
