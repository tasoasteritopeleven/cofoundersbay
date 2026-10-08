import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CsrfMiddleware } from './auth/csrf.middleware';
import { resolve, join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { SearchModule } from './search/search.module';
import { MessagingModule } from './messaging/messaging.module';
import { UploadsModule } from './uploads/uploads.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { MentoringModule } from './mentoring/mentoring.module';
import { ModerationModule } from './moderation/moderation.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GraphModule } from './graph/graph.module';
import { PollsModule } from './polls/polls.module';
import { JobsModule } from './jobs/jobs.module';
import { ConnectionsModule } from './connections/connections.module';
import { GroupsModule } from './groups/groups.module';
import { CommonModule } from './common/common.module';
import { CacheModule } from './common/cache/cache.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ServicesModule } from './services/services.module';
import { ExpertReviewsModule } from './expert-reviews/expert-reviews.module';
import { SecurityModule } from './security/security.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { CommitmentsModule } from './commitments/commitments.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { FeedModule } from './feed/feed.module';
import { PitchModule } from './pitch/pitch.module';
import { VerificationModule } from './verification/verification.module';
import { ProfileImportModule } from './profile-import/profile-import.module';
import { FounderUpdatesModule } from './founder-updates/founder-updates.module';
import { OpenToModule } from './open-to/open-to.module';
import { IntrosModule } from './intros/intros.module';
import { SkillEvidenceModule } from './skill-evidence/skill-evidence.module';
import { ScoutModule } from './scout/scout.module';
import { PublicModule } from './public/public.module';
import { TransparencyModule } from './transparency/transparency.module';
import { LearningModule } from './learning/learning.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { AdminModule } from './admin/admin.module';
import { OrgModule } from './org/org.module';
import { MatchingModule } from './matching/matching.module';
import { AIModule } from './ai/ai.module';
import { TenantModule } from './tenant/tenant.module';
import { SSOModule } from './sso/sso.module';
import { AutomationModule } from './automation/automation.module';
import { MilestonesModule } from './milestones/milestones.module';
import { InvestorModule } from './investor/investor.module';
import { ShortlistModule } from './shortlist/shortlist.module';
import { SavedItemsModule } from './saved-items/saved-items.module';
import { EndorsementsModule } from './endorsements/endorsements.module';
import { AccountExportModule } from './account-export/account-export.module';
import { ResearchModule } from './research/research.module';
import { BuilderModule } from './builder/builder.module';
import { RolesModule } from './roles/roles.module';
import { OrganizationModule } from './organization/organization.module';
import { MentorshipModule } from './mentorship/mentorship.module';
import { DigestsModule } from './digests/digests.module';
import { GamificationModule } from './gamification/gamification.module';
import { BehavioralOptimizerModule } from './behavioral-optimizer/behavioral-optimizer.module';
import { AppController } from './app.controller';
import appConfig from './common/config/app.config';

// Find the monorepo root .env file
function findEnvFiles(): string[] {
  const paths: string[] = [];
  // Current working directory
  paths.push(resolve(process.cwd(), '.env'));
  // One level up (for running from apps/api)
  paths.push(resolve(process.cwd(), '..', '.env'));
  // Two levels up (for running from apps/api/src)
  paths.push(resolve(process.cwd(), '..', '..', '.env'));
  // Absolute path based on __dirname (most reliable)
  paths.push(resolve(__dirname, '..', '..', '..', '..', '.env'));
  return paths;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: findEnvFiles(),
      load: [appConfig],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 minute window
      limit: 60,   // 60 requests per minute (global default)
    }]),
    CommonModule,
    CacheModule,
    PrismaModule,
    AuthModule,
    ProfileModule,
    SearchModule,
    MessagingModule,
    UploadsModule,
    MailerModule,
    NotificationsModule,
    BillingModule,
    HealthModule,
    EventsModule,
    MentoringModule,
    ModerationModule,
    DashboardModule,
    GraphModule,
    PollsModule,
    JobsModule,
    ConnectionsModule,
    GroupsModule,
    AnalyticsModule,
    ServicesModule,
    ExpertReviewsModule,
    SecurityModule,
    MonitoringModule,
    OpportunitiesModule,
    CommitmentsModule,
    SavedSearchesModule,
    FeedModule,
    PitchModule,
    VerificationModule,
    ProfileImportModule,
    FounderUpdatesModule,
    OpenToModule,
    IntrosModule,
    SkillEvidenceModule,
    ScoutModule,
    PublicModule,
    TransparencyModule,
    LearningModule,
    MarketplaceModule,
    AdminModule,
    OrgModule,
    MatchingModule,
    AIModule,
    TenantModule,
    SSOModule,
    AutomationModule,
    MilestonesModule,
    InvestorModule,
    ShortlistModule,
    SavedItemsModule,
    EndorsementsModule,
    AccountExportModule,
    ResearchModule,
    BuilderModule,
    RolesModule,
    OrganizationModule,
    MentorshipModule,
    DigestsModule,
    GamificationModule,
    BehavioralOptimizerModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        customProps: () => ({ context: 'HTTP' }),
        serializers: {
          req(req) {
            return { method: req.method, url: req.url, id: req.id };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        quietReqLogger: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Endpoint timing interceptor — dev only, logs request duration + DB metrics
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
