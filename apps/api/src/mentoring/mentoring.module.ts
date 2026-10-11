import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailerModule } from '../mailer/mailer.module';
import { MentoringController } from './mentoring.controller';
import { MentoringService } from './mentoring.service';

@Module({
  imports: [AuthModule, NotificationsModule, MailerModule],
  controllers: [MentoringController],
  providers: [MentoringService],
  exports: [MentoringService],
})
export class MentoringModule {}
