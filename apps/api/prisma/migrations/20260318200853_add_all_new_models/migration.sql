/*
  Warnings:

  - You are about to drop the column `priceId` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[linkedinId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `planId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Made the column `currentPeriodEnd` on table `Subscription` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `slug` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProfileViewSource" AS ENUM ('direct', 'search', 'recommendation', 'group', 'event', 'external');

-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('profile_view', 'connection_sent', 'connection_accepted', 'message_sent', 'event_created', 'event_rsvp', 'group_joined', 'post_created', 'login', 'profile_updated');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('job', 'cofounder', 'investment', 'partnership', 'mentorship', 'other');

-- CreateEnum
CREATE TYPE "LearningResourceType" AS ENUM ('article', 'video', 'course', 'podcast', 'book', 'tool', 'template');

-- CreateEnum
CREATE TYPE "LearningDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "MarketplaceCategory" AS ENUM ('legal', 'finance', 'marketing', 'development', 'design', 'consulting', 'coaching', 'other');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('draft', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "SSOProviderType" AS ENUM ('saml', 'oidc', 'oauth2');

-- CreateEnum
CREATE TYPE "SSOMode" AS ENUM ('disabled', 'optional', 'required');

-- CreateEnum
CREATE TYPE "TenantDomainType" AS ENUM ('subdomain', 'custom');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('free', 'individual_premium', 'organization', 'enterprise');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'admin';
ALTER TYPE "Role" ADD VALUE 'super_admin';

-- DropIndex
DROP INDEX "Subscription_stripeCustomerId_key";

-- DropIndex
DROP INDEX "Subscription_stripeSubscriptionId_key";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "focus" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "mission" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "resolutionNote" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "priceId",
ADD COLUMN     "activeSeatCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "planId" TEXT NOT NULL,
ADD COLUMN     "seatLimit" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "trialEnd" TIMESTAMP(3),
ADD COLUMN     "trialStart" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'trialing',
ALTER COLUMN "currentPeriodEnd" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "linkedinId" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "viewerId" TEXT,
    "source" "ProfileViewSource" NOT NULL DEFAULT 'direct',
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserActivityType" NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "OpportunityType" NOT NULL DEFAULT 'job',
    "company" TEXT,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "tags" JSONB,
    "deadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LearningResourceType" NOT NULL DEFAULT 'article',
    "category" TEXT,
    "url" TEXT NOT NULL,
    "author" TEXT,
    "duration" INTEGER,
    "difficulty" "LearningDifficulty" NOT NULL DEFAULT 'beginner',
    "tags" JSONB,
    "imageUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceService" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "MarketplaceCategory" NOT NULL DEFAULT 'other',
    "providerName" TEXT NOT NULL,
    "providerLogo" TEXT,
    "pricing" TEXT,
    "contactUrl" TEXT,
    "websiteUrl" TEXT,
    "tags" JSONB,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "organizerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "capacity" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMember" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "ctaLabel" TEXT DEFAULT 'Get Started',
    "onboardingIntroText" TEXT,
    "dashboardWelcomeText" TEXT,
    "supportEmail" TEXT,
    "privacyPolicyUrl" TEXT,
    "termsUrl" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "emailSignature" TEXT,
    "emailLogoUrl" TEXT,
    "isBrandingActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityProvider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerType" "SSOProviderType" NOT NULL,
    "providerName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "samlEntryPoint" TEXT,
    "samlIssuer" TEXT,
    "samlCert" TEXT,
    "samlMetadataUrl" TEXT,
    "oidcIssuerUrl" TEXT,
    "oidcClientId" TEXT,
    "oidcClientSecret" TEXT,
    "oidcScopes" TEXT DEFAULT 'openid profile email',
    "oidcAuthorizationUrl" TEXT,
    "oidcTokenUrl" TEXT,
    "oidcUserInfoUrl" TEXT,
    "loginButtonText" TEXT DEFAULT 'Continue with SSO',
    "loginButtonColor" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSSOConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identityProviderId" TEXT,
    "ssoMode" "SSOMode" NOT NULL DEFAULT 'disabled',
    "allowedDomains" TEXT[],
    "enforceEmailDomain" BOOLEAN NOT NULL DEFAULT true,
    "autoProvisionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRole" TEXT NOT NULL DEFAULT 'founder',
    "autoAssignToTenant" BOOLEAN NOT NULL DEFAULT true,
    "roleMappingRules" JSONB,
    "postLoginRedirect" TEXT,
    "requireProfileCompletion" BOOLEAN NOT NULL DEFAULT true,
    "sessionDurationHours" INTEGER NOT NULL DEFAULT 24,
    "allowPasswordFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSSOConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityProviderId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "rawClaims" JSONB,
    "isLinked" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "provisionedViaSSO" BOOLEAN NOT NULL DEFAULT false,
    "lastSSOLoginAt" TIMESTAMP(3),

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainMapping" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "autoRedirectToSSO" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainType" "TenantDomainType" NOT NULL,
    "domainName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sslStatus" TEXT,
    "sslExpiresAt" TIMESTAMP(3),
    "verificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'pending',
    "verificationToken" TEXT,
    "verificationMethod" TEXT,
    "dnsInstructions" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastVerificationCheck" TIMESTAMP(3),
    "redirectBehavior" TEXT DEFAULT 'none',
    "customLandingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "planType" "PlanType" NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "priceAnnual" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "seatLimit" INTEGER,
    "storageGb" INTEGER NOT NULL DEFAULT 1,
    "features" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stripeProductId" TEXT,
    "stripePriceIdMonthly" TEXT,
    "stripePriceIdAnnual" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAllocation" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "allocatedBy" TEXT,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "amountDue" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "billingName" TEXT,
    "billingEmail" TEXT,
    "billingAddress" JSONB,
    "taxId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "hostedInvoiceUrl" TEXT,
    "invoicePdf" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "currency" TEXT DEFAULT 'USD',
    "maxRedemptions" INTEGER,
    "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "applicablePlans" TEXT[],
    "firstTimeOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOAuthEvent" (
    "id" TEXT NOT NULL,
    "identityProviderId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "email" TEXT,
    "externalId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SSOAuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileView_profileId_createdAt_idx" ON "ProfileView"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileView_viewerId_idx" ON "ProfileView"("viewerId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_type_createdAt_idx" ON "UserActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_entityId_idx" ON "UserActivity"("entityId");

-- CreateIndex
CREATE INDEX "Opportunity_type_isActive_idx" ON "Opportunity"("type", "isActive");

-- CreateIndex
CREATE INDEX "Opportunity_createdById_idx" ON "Opportunity"("createdById");

-- CreateIndex
CREATE INDEX "Opportunity_createdAt_idx" ON "Opportunity"("createdAt");

-- CreateIndex
CREATE INDEX "LearningResource_type_isActive_idx" ON "LearningResource"("type", "isActive");

-- CreateIndex
CREATE INDEX "LearningResource_category_idx" ON "LearningResource"("category");

-- CreateIndex
CREATE INDEX "LearningResource_isFeatured_idx" ON "LearningResource"("isFeatured");

-- CreateIndex
CREATE INDEX "LearningResource_createdAt_idx" ON "LearningResource"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceService_category_isActive_idx" ON "MarketplaceService"("category", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceService_isFeatured_idx" ON "MarketplaceService"("isFeatured");

-- CreateIndex
CREATE INDEX "MarketplaceService_createdAt_idx" ON "MarketplaceService"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_slug_key" ON "Cohort"("slug");

-- CreateIndex
CREATE INDEX "Cohort_slug_idx" ON "Cohort"("slug");

-- CreateIndex
CREATE INDEX "Cohort_organizerId_idx" ON "Cohort"("organizerId");

-- CreateIndex
CREATE INDEX "Cohort_isPublic_isActive_idx" ON "Cohort"("isPublic", "isActive");

-- CreateIndex
CREATE INDEX "CohortMember_cohortId_idx" ON "CohortMember"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMember_userId_idx" ON "CohortMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMember_cohortId_userId_key" ON "CohortMember"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE INDEX "IdentityProvider_tenantId_idx" ON "IdentityProvider"("tenantId");

-- CreateIndex
CREATE INDEX "IdentityProvider_isActive_idx" ON "IdentityProvider"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityProvider_tenantId_providerType_key" ON "IdentityProvider"("tenantId", "providerType");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSSOConfig_tenantId_key" ON "TenantSSOConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSSOConfig_identityProviderId_key" ON "TenantSSOConfig"("identityProviderId");

-- CreateIndex
CREATE INDEX "TenantSSOConfig_tenantId_idx" ON "TenantSSOConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSSOConfig_ssoMode_idx" ON "TenantSSOConfig"("ssoMode");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE INDEX "UserIdentity_identityProviderId_idx" ON "UserIdentity"("identityProviderId");

-- CreateIndex
CREATE INDEX "UserIdentity_email_idx" ON "UserIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_identityProviderId_externalId_key" ON "UserIdentity"("identityProviderId", "externalId");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");

-- CreateIndex
CREATE INDEX "TenantMembership_isActive_idx" ON "TenantMembership"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainMapping_domain_key" ON "DomainMapping"("domain");

-- CreateIndex
CREATE INDEX "DomainMapping_domain_idx" ON "DomainMapping"("domain");

-- CreateIndex
CREATE INDEX "DomainMapping_tenantId_idx" ON "DomainMapping"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_domainName_key" ON "TenantDomain"("domainName");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDomain_domainName_idx" ON "TenantDomain"("domainName");

-- CreateIndex
CREATE INDEX "TenantDomain_domainType_idx" ON "TenantDomain"("domainType");

-- CreateIndex
CREATE INDEX "TenantDomain_isActive_idx" ON "TenantDomain"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_name_key" ON "BillingPlan"("name");

-- CreateIndex
CREATE INDEX "BillingPlan_planType_idx" ON "BillingPlan"("planType");

-- CreateIndex
CREATE INDEX "BillingPlan_isActive_idx" ON "BillingPlan"("isActive");

-- CreateIndex
CREATE INDEX "SeatAllocation_subscriptionId_idx" ON "SeatAllocation"("subscriptionId");

-- CreateIndex
CREATE INDEX "SeatAllocation_userId_idx" ON "SeatAllocation"("userId");

-- CreateIndex
CREATE INDEX "SeatAllocation_isActive_idx" ON "SeatAllocation"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_subscriptionId_userId_key" ON "SeatAllocation"("subscriptionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCode_code_key" ON "PromotionCode"("code");

-- CreateIndex
CREATE INDEX "PromotionCode_code_idx" ON "PromotionCode"("code");

-- CreateIndex
CREATE INDEX "PromotionCode_isActive_idx" ON "PromotionCode"("isActive");

-- CreateIndex
CREATE INDEX "SSOAuthEvent_identityProviderId_idx" ON "SSOAuthEvent"("identityProviderId");

-- CreateIndex
CREATE INDEX "SSOAuthEvent_userId_idx" ON "SSOAuthEvent"("userId");

-- CreateIndex
CREATE INDEX "SSOAuthEvent_eventType_idx" ON "SSOAuthEvent"("eventType");

-- CreateIndex
CREATE INDEX "SSOAuthEvent_createdAt_idx" ON "SSOAuthEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_idx" ON "AdminAuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Event_isFeatured_idx" ON "Event"("isFeatured");

-- CreateIndex
CREATE INDEX "Group_isFeatured_idx" ON "Group"("isFeatured");

-- CreateIndex
CREATE INDEX "JobPosting_isFeatured_idx" ON "JobPosting"("isFeatured");

-- CreateIndex
CREATE INDEX "Profile_location_idx" ON "Profile"("location");

-- CreateIndex
CREATE INDEX "Profile_createdAt_idx" ON "Profile"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_linkedinId_key" ON "User"("linkedinId");

-- CreateIndex
CREATE INDEX "User_role_moderationStatus_idx" ON "User"("role", "moderationStatus");

-- CreateIndex
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceService" ADD CONSTRAINT "MarketplaceService_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityProvider" ADD CONSTRAINT "IdentityProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSSOConfig" ADD CONSTRAINT "TenantSSOConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSSOConfig" ADD CONSTRAINT "TenantSSOConfig_identityProviderId_fkey" FOREIGN KEY ("identityProviderId") REFERENCES "IdentityProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_identityProviderId_fkey" FOREIGN KEY ("identityProviderId") REFERENCES "IdentityProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainMapping" ADD CONSTRAINT "DomainMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOAuthEvent" ADD CONSTRAINT "SSOAuthEvent_identityProviderId_fkey" FOREIGN KEY ("identityProviderId") REFERENCES "IdentityProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSOAuthEvent" ADD CONSTRAINT "SSOAuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
