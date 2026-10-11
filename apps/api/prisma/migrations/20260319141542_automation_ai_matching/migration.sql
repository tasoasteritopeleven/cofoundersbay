-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('user_signup', 'onboarding_incomplete', 'profile_incomplete', 'match_generated', 'match_not_viewed', 'connection_request_sent', 'connection_not_answered', 'connection_accepted', 'mentor_request_submitted', 'mentor_request_accepted', 'mentor_session_idle', 'community_join', 'community_inactive', 'content_reported_threshold', 'tenant_setup_incomplete', 'subscription_trial_ending', 'subscription_failed_payment', 'subscription_canceled', 'subscription_seat_limit', 'user_inactive', 'scheduled', 'manual');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('send_email', 'send_in_app_notification', 'generate_matches', 'flag_for_admin_review', 'send_admin_alert', 'update_user_field', 'trigger_another_rule', 'log_event', 'webhook_call');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchFeedbackType" AS ENUM ('accepted', 'declined', 'ignored', 'not_relevant', 'not_now', 'better_fit_wanted');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "conditionDef" JSONB,
    "actionDef" JSONB NOT NULL,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "scheduleExpression" TEXT,
    "status" "AutomationStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "maxFailures" INTEGER NOT NULL DEFAULT 10,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'pending',
    "runAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAutomationConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxEmailsPerUserPerDay" INTEGER NOT NULL DEFAULT 3,
    "maxNotificationsPerDay" INTEGER NOT NULL DEFAULT 10,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "onboardingAutomation" BOOLEAN NOT NULL DEFAULT true,
    "matchingAutomation" BOOLEAN NOT NULL DEFAULT true,
    "mentorshipAutomation" BOOLEAN NOT NULL DEFAULT true,
    "communityAutomation" BOOLEAN NOT NULL DEFAULT true,
    "billingAutomation" BOOLEAN NOT NULL DEFAULT true,
    "reEngagementAutomation" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFeatureVector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "bioKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goalKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expertiseKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avgResponseTimeHrs" DOUBLE PRECISION,
    "acceptanceRate" DOUBLE PRECISION,
    "profileQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFeatureVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchInferenceLog" (
    "id" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "roleScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "industryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "semanticScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "behavioralScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outcomePriorScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',
    "explanation" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "shownAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchInferenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchOutcome" (
    "id" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "feedback" "MatchFeedbackType" NOT NULL,
    "connectionStarted" BOOLEAN NOT NULL DEFAULT false,
    "conversationStarted" BOOLEAN NOT NULL DEFAULT false,
    "collaborationSignal" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBehaviorSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBehaviorSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchModelVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "avgAcceptanceRate" DOUBLE PRECISION,
    "avgResponseRate" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "evaluatedAt" TIMESTAMP(3),
    "weights" JSONB NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "controlVersion" TEXT NOT NULL,
    "treatmentVersion" TEXT NOT NULL,
    "trafficSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "controlAcceptRate" DOUBLE PRECISION,
    "treatmentAcceptRate" DOUBLE PRECISION,
    "controlConvRate" DOUBLE PRECISION,
    "treatmentConvRate" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");

-- CreateIndex
CREATE INDEX "AutomationRule_status_idx" ON "AutomationRule"("status");

-- CreateIndex
CREATE INDEX "AutomationRule_nextRunAt_idx" ON "AutomationRule"("nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_ruleId_idx" ON "AutomationExecution"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationExecution_targetUserId_idx" ON "AutomationExecution"("targetUserId");

-- CreateIndex
CREATE INDEX "AutomationExecution_status_idx" ON "AutomationExecution"("status");

-- CreateIndex
CREATE INDEX "AutomationExecution_scheduledAt_idx" ON "AutomationExecution"("scheduledAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_createdAt_idx" ON "AutomationExecution"("createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_executionId_idx" ON "AutomationLog"("executionId");

-- CreateIndex
CREATE INDEX "AutomationLog_level_idx" ON "AutomationLog"("level");

-- CreateIndex
CREATE INDEX "AutomationLog_createdAt_idx" ON "AutomationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_type_idx" ON "ScheduledJob"("type");

-- CreateIndex
CREATE INDEX "ScheduledJob_status_idx" ON "ScheduledJob"("status");

-- CreateIndex
CREATE INDEX "ScheduledJob_runAt_idx" ON "ScheduledJob"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");

-- CreateIndex
CREATE INDEX "NotificationTemplate_key_idx" ON "NotificationTemplate"("key");

-- CreateIndex
CREATE INDEX "NotificationTemplate_tenantId_idx" ON "NotificationTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_type_idx" ON "NotificationTemplate"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAutomationConfig_tenantId_key" ON "TenantAutomationConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAutomationConfig_tenantId_idx" ON "TenantAutomationConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchFeatureVector_userId_key" ON "MatchFeatureVector"("userId");

-- CreateIndex
CREATE INDEX "MatchFeatureVector_userId_idx" ON "MatchFeatureVector"("userId");

-- CreateIndex
CREATE INDEX "MatchFeatureVector_modelVersion_idx" ON "MatchFeatureVector"("modelVersion");

-- CreateIndex
CREATE INDEX "MatchInferenceLog_sourceUserId_idx" ON "MatchInferenceLog"("sourceUserId");

-- CreateIndex
CREATE INDEX "MatchInferenceLog_targetUserId_idx" ON "MatchInferenceLog"("targetUserId");

-- CreateIndex
CREATE INDEX "MatchInferenceLog_finalScore_idx" ON "MatchInferenceLog"("finalScore");

-- CreateIndex
CREATE INDEX "MatchInferenceLog_createdAt_idx" ON "MatchInferenceLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchInferenceLog_sourceUserId_targetUserId_modelVersion_key" ON "MatchInferenceLog"("sourceUserId", "targetUserId", "modelVersion");

-- CreateIndex
CREATE INDEX "MatchOutcome_sourceUserId_idx" ON "MatchOutcome"("sourceUserId");

-- CreateIndex
CREATE INDEX "MatchOutcome_targetUserId_idx" ON "MatchOutcome"("targetUserId");

-- CreateIndex
CREATE INDEX "MatchOutcome_feedback_idx" ON "MatchOutcome"("feedback");

-- CreateIndex
CREATE INDEX "MatchOutcome_createdAt_idx" ON "MatchOutcome"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchOutcome_sourceUserId_targetUserId_key" ON "MatchOutcome"("sourceUserId", "targetUserId");

-- CreateIndex
CREATE INDEX "UserBehaviorSignal_userId_idx" ON "UserBehaviorSignal"("userId");

-- CreateIndex
CREATE INDEX "UserBehaviorSignal_signalType_idx" ON "UserBehaviorSignal"("signalType");

-- CreateIndex
CREATE INDEX "UserBehaviorSignal_targetId_idx" ON "UserBehaviorSignal"("targetId");

-- CreateIndex
CREATE INDEX "UserBehaviorSignal_createdAt_idx" ON "UserBehaviorSignal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchModelVersion_version_key" ON "MatchModelVersion"("version");

-- CreateIndex
CREATE INDEX "MatchModelVersion_isActive_idx" ON "MatchModelVersion"("isActive");

-- CreateIndex
CREATE INDEX "MatchExperiment_status_idx" ON "MatchExperiment"("status");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAutomationConfig" ADD CONSTRAINT "TenantAutomationConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
