import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PitchController } from './pitch.controller';
import { PitchService } from './pitch.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PitchController],
  providers: [PitchService],
})
export class PitchModule {}
