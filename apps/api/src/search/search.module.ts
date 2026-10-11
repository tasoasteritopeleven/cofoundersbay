import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeilisearchService } from './meilisearch.service';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [SearchController],
  providers: [MeilisearchService, SearchService],
  exports: [MeilisearchService, SearchService],
})
export class SearchModule {}
