import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueService } from './email-queue.service';
import { MailerService } from './mailer.service';

@Module({
  imports: [ConfigModule],
  providers: [MailerService, EmailQueueService],
  exports: [MailerService, EmailQueueService],
})
export class MailerModule {}

