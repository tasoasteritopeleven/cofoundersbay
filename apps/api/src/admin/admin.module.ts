import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { ScoringInspectorService } from './scoring-inspector.service';
import { AbuseDetectionService } from './abuse-detection.service';
import { ExperimentationService } from './experimentation.service';

@Module({
  imports: [PrismaModule, MailerModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminAuditService,
    ScoringInspectorService,
    AbuseDetectionService,
    ExperimentationService,
  ],
  exports: [
    AdminService,
    AdminAuditService,
    ScoringInspectorService,
    AbuseDetectionService,
    ExperimentationService,
  ],
})
export class AdminModule {}
