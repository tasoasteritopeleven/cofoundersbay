import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';
import { SavedSearchesScheduler } from './saved-searches.scheduler';

@Module({
  imports: [PrismaModule, SearchModule, NotificationsModule],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService, SavedSearchesScheduler],
  exports: [SavedSearchesService],
})
export class SavedSearchesModule {}
