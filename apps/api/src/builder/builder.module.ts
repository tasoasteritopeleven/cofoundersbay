import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BuilderController } from './builder.controller';
import { BuilderService } from './builder.service';
import { BuilderAIService } from './builder-ai.service';
import { BuilderOrgService } from './builder-org.service';
import { BuilderGateway } from './builder.gateway';
import { BuilderCollabController } from './builder-collab.controller';
import { BuilderCollabService } from './builder-collab.service';
import { BuilderCollabPolicy } from './builder-collab.policy';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    GamificationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [BuilderController, BuilderCollabController],
  providers: [
    BuilderService,
    BuilderAIService,
    BuilderOrgService,
    BuilderGateway,
    BuilderCollabService,
    BuilderCollabPolicy,
  ],
  exports: [
    BuilderService,
    BuilderAIService,
    BuilderOrgService,
    BuilderGateway,
    BuilderCollabService,
    BuilderCollabPolicy,
  ],
})
export class BuilderModule {}
