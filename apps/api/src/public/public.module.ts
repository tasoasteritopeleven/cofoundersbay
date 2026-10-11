import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicStatsController } from './public-stats.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicStatsController],
})
export class PublicModule {}
