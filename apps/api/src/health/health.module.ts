import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from '../search/search.module';
import { ProductionHealthController } from './production-health.controller';

@Module({
  imports: [ConfigModule, SearchModule],
  controllers: [ProductionHealthController],
})
export class HealthModule {}

