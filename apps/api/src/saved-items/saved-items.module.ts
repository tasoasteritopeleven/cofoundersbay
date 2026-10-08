import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SavedItemsController } from './saved-items.controller';
import { SavedItemsService } from './saved-items.service';

@Module({
  imports: [PrismaModule],
  controllers: [SavedItemsController],
  providers: [SavedItemsService],
})
export class SavedItemsModule {}
