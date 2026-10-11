import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransparencyController } from './transparency.controller';
import { TransparencyService } from './transparency.service';

/** Global so any module whose rules refuse something can record it without an import cycle. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [TransparencyController],
  providers: [TransparencyService],
  exports: [TransparencyService],
})
export class TransparencyModule {}
