-- Persisted activity-digest cadence and granular notification channels were
-- present in schema.prisma but missing from the migration history. Keep this
-- migration idempotent so environments previously bootstrapped with db push
-- can safely adopt migrate deploy.
DO $$ BEGIN
  CREATE TYPE "DigestFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'never');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "DigestFrequency" ADD VALUE IF NOT EXISTS 'monthly' BEFORE 'never';

CREATE TABLE IF NOT EXISTS "ActivityDigestPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "frequency" "DigestFrequency" NOT NULL DEFAULT 'weekly',
  "lastSentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityDigestPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ActivityDigestPreference_userId_key"
  ON "ActivityDigestPreference"("userId");

DO $$ BEGIN
  ALTER TABLE "ActivityDigestPreference"
    ADD CONSTRAINT "ActivityDigestPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('in_app', 'email', 'push', 'sms');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserNotificationChannel" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "category" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "frequency" TEXT NOT NULL DEFAULT 'instant',
  "quietFrom" TEXT,
  "quietUntil" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserNotificationChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationChannel_userId_channel_category_key"
  ON "UserNotificationChannel"("userId", "channel", "category");
CREATE INDEX IF NOT EXISTS "UserNotificationChannel_userId_idx"
  ON "UserNotificationChannel"("userId");
CREATE INDEX IF NOT EXISTS "UserNotificationChannel_userId_channel_idx"
  ON "UserNotificationChannel"("userId", "channel");
CREATE INDEX IF NOT EXISTS "UserNotificationChannel_userId_isEnabled_idx"
  ON "UserNotificationChannel"("userId", "isEnabled");

DO $$ BEGIN
  ALTER TABLE "UserNotificationChannel"
    ADD CONSTRAINT "UserNotificationChannel_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
