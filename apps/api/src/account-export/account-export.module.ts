import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountExportController } from './account-export.controller';
import { AccountExportService } from './account-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountExportController],
  providers: [AccountExportService],
})
export class AccountExportModule {}
