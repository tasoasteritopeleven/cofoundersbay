import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsUUID,
  IsDateString,
  IsArray,
  IsEmail,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (matching Prisma schema Phase 1 additions)
// ─────────────────────────────────────────────────────────────────────────────

export enum ArtifactBranchStatus {
  OPEN = 'open',
  REVIEW = 'review',
  MERGED = 'merged',
  CLOSED = 'closed',
  ABANDONED = 'abandoned',
}

export enum ChangeProposalStatus {
  OPEN = 'open',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
  MERGED = 'merged',
  CLOSED = 'closed',
}

export enum ShareLinkPermission {
  VIEW = 'view',
  COMMENT = 'comment',
  SUGGEST = 'suggest',
}

export enum VersionTrigger {
  EXPLICIT = 'explicit',
  AUTOSAVE = 'autosave',
  PRE_MERGE = 'pre_merge',
  MERGE = 'merge',
  REVIEW_SNAPSHOT = 'review_snapshot',
  PUBLISHED = 'published',
  RESTORE = 'restore',
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateBranchDto {
  @IsUUID()
  documentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ArtifactBranchStatus)
  status?: ArtifactBranchStatus;
}

export class ListBranchesQueryDto {
  @IsOptional()
  @IsEnum(ArtifactBranchStatus)
  status?: ArtifactBranchStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Proposal DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateProposalDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  reviewerIds?: string[];
}

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(ChangeProposalStatus)
  status?: ChangeProposalStatus;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  reviewerIds?: string[];
}

export class ListProposalsQueryDto {
  @IsOptional()
  @IsEnum(ChangeProposalStatus)
  status?: ChangeProposalStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Request DTOs (for proposals)
// ─────────────────────────────────────────────────────────────────────────────

export class RequestReviewDto {
  @IsUUID()
  proposalId!: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  reviewerIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class SubmitProposalReviewDto {
  @IsEnum(ChangeProposalStatus)
  decision!: ChangeProposalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Link DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateShareLinkDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsUUID()
  versionId?: string;

  @IsOptional()
  @IsEnum(ShareLinkPermission)
  permissions?: ShareLinkPermission;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxViews?: number;
}

export class UpdateShareLinkDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxViews?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Version Restore DTO
// ─────────────────────────────────────────────────────────────────────────────

export class RestoreVersionDto {
  @IsUUID()
  documentId!: string;

  @IsInt()
  @Min(1)
  targetVersion!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface BranchResponseDto {
  id: string;
  documentId: string;
  name: string;
  description?: string;
  status: ArtifactBranchStatus;
  baseVersionNum: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
  proposalCount?: number;
}

export interface ProposalResponseDto {
  id: string;
  branchId: string;
  documentId: string;
  title: string;
  description?: string;
  status: ChangeProposalStatus;
  changedSections: string[];
  reviewerIds: string[];
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
}

export interface ShareLinkResponseDto {
  id: string;
  documentId?: string;
  workspaceId?: string;
  versionId?: string;
  token: string;
  permissions: ShareLinkPermission;
  label?: string;
  recipientEmail?: string;
  expiresAt?: Date;
  maxViews?: number;
  viewCount: number;
  isActive: boolean;
  createdAt: Date;
  lastAccessedAt?: Date;
  createdBy: { id: string; displayName: string; avatarUrl?: string };
}
