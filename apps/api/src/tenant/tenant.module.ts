import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantDomainService } from './tenant-domain.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantAdminGuard } from './tenant-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [TenantController],
  providers: [TenantService, TenantDomainService, TenantAdminGuard],
  exports: [TenantService, TenantDomainService],
})
export class TenantModule {}
