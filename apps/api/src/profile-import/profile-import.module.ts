import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileImportController } from './profile-import.controller';
import { ProfileImportService } from './profile-import.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ProfileImportController],
  providers: [ProfileImportService],
})
export class ProfileImportModule {}
