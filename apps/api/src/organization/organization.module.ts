import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { ProgramService } from './program.service';
import { ProgramController } from './program.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController, ProgramController],
  providers: [OrganizationService, ProgramService],
  exports: [OrganizationService, ProgramService],
})
export class OrganizationModule {}
