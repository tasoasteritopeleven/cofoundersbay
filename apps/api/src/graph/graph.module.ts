import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileModule } from '../profile/profile.module';
import { RolesModule } from '../roles/roles.module';
import { ConnectionsModule } from '../connections/connections.module';
import { MessagingModule } from '../messaging/messaging.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';

@Module({
  imports: [PrismaModule, ProfileModule, RolesModule, ConnectionsModule, MessagingModule, DashboardModule],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
