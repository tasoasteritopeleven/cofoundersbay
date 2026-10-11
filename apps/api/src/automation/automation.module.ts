import { Global, Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationScheduler } from './automation.scheduler';
import { AutomationSeeder } from './automation.seeder';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailerModule } from '../mailer/mailer.module';
import { MatchingModule } from '../matching/matching.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MailerModule,
    MatchingModule,
  ],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationScheduler, AutomationSeeder],
  exports: [AutomationService],
})
export class AutomationModule {}
