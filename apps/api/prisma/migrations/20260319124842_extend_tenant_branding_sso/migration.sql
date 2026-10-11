-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "aboutText" TEXT,
ADD COLUMN     "shortDescription" TEXT;

-- AlterTable
ALTER TABLE "TenantBranding" ADD COLUMN     "aboutText" TEXT,
ADD COLUMN     "backgroundStyle" TEXT,
ADD COLUMN     "bodyFont" TEXT,
ADD COLUMN     "communityNaming" TEXT,
ADD COLUMN     "cookiePolicyUrl" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "emailFooterText" TEXT,
ADD COLUMN     "emailFromName" TEXT,
ADD COLUMN     "headingFont" TEXT,
ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "roleLabels" JSONB,
ADD COLUMN     "websiteFooterUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
