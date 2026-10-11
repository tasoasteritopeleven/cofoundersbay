import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  IsUUID,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (matching Prisma schema)
// ─────────────────────────────────────────────────────────────────────────────

export enum BuilderWorkspaceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
}

export enum BuilderWorkspaceVisibility {
  PRIVATE = 'private',
  TEAM = 'team',
  ORGANIZATION = 'organization',
  PUBLIC = 'public',
}

export enum BuilderDocumentType {
  // Existing types (preserved)
  IDEA_CORE = 'idea_core',
  BUSINESS_MODEL_CANVAS = 'business_model_canvas',
  MARKET_ANALYSIS = 'market_analysis',
  PITCH_DECK = 'pitch_deck',
  MVP_PLAN = 'mvp_plan',
  FINANCIAL_PLAN = 'financial_plan',
  TECHNICAL_ARCHITECTURE = 'technical_architecture',
  PRD = 'prd',
  BRANDING_KIT = 'branding_kit',
  APPLICATION = 'application',
  CUSTOM = 'custom',

  // Phase 1 additions — Strategy & Analysis
  SWOT_ANALYSIS = 'swot_analysis',
  LEAN_CANVAS = 'lean_canvas',
  COMPETITIVE_ANALYSIS = 'competitive_analysis',
  CUSTOMER_PERSONAS = 'customer_personas',
  GO_TO_MARKET = 'go_to_market',

  // Phase 1 additions — Fundraising & Investor
  FUNDRAISING_MEMO = 'fundraising_memo',
  VENTURE_MEMO = 'venture_memo',
  INVESTOR_UPDATE = 'investor_update',

  // Phase 1 additions — Feedback & Evaluation
  MENTOR_FEEDBACK = 'mentor_feedback',
  EVALUATOR_SCORECARD = 'evaluator_scorecard',

  // Phase 1 additions — Operations & Legal
  STRATEGY_DOC = 'strategy_doc',
  MEETING_NOTES = 'meeting_notes',
  BOARD_MINUTES = 'board_minutes',
  TERM_SHEET = 'term_sheet',
  CAP_TABLE = 'cap_table',
  TEAM_CHARTER = 'team_charter',
  PARTNERSHIP_AGREEMENT = 'partnership_agreement',
  FOUNDER_AGREEMENT = 'founder_agreement',
  VESTING_SCHEDULE = 'vesting_schedule',

  // Phase 1 additions — Product & Growth
  PRODUCT_ROADMAP = 'product_roadmap',
  SPRINT_PLAN = 'sprint_plan',
  RETROSPECTIVE = 'retrospective',
  USER_RESEARCH = 'user_research',
  AB_TEST_PLAN = 'ab_test_plan',
  GROWTH_MODEL = 'growth_model',
  UNIT_ECONOMICS = 'unit_economics',
  COHORT_ANALYSIS = 'cohort_analysis',
}

export enum BuilderDocumentStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  APPROVED = 'approved',
  ARCHIVED = 'archived',
}

export enum BuilderCollaboratorRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
}

export enum BuilderCommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}

export enum BuilderReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
  REJECTED = 'rejected',
}

export enum ApplicationTemplateType {
  YC = 'yc',
  TECHSTARS = 'techstars',
  UNIVERSITY_INCUBATOR = 'university_incubator',
  GRANT = 'grant',
  CUSTOM = 'custom',
}

export enum ReadinessDimension {
  TEAM = 'team',
  MARKET = 'market',
  PRODUCT = 'product',
  BUSINESS = 'business',
  FUNDING = 'funding',
  EXECUTION = 'execution',
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  startupName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  targetMarket?: string;

  @IsOptional()
  @IsEnum(BuilderWorkspaceVisibility)
  visibility?: BuilderWorkspaceVisibility;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(BuilderWorkspaceStatus)
  status?: BuilderWorkspaceStatus;

  @IsOptional()
  @IsEnum(BuilderWorkspaceVisibility)
  visibility?: BuilderWorkspaceVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  startupName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  targetMarket?: string;

  @IsOptional()
  @IsDateString()
  foundingDate?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class WorkspaceQueryDto {
  @IsOptional()
  @IsEnum(BuilderWorkspaceStatus)
  status?: BuilderWorkspaceStatus;

  @IsOptional()
  @IsEnum(BuilderWorkspaceVisibility)
  visibility?: BuilderWorkspaceVisibility;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─────────────────────────────────────────────────────────────────────────────
// Document DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateDocumentDto {
  @IsUUID()
  workspaceId!: string;

  @IsEnum(BuilderDocumentType)
  type!: BuilderDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsEnum(BuilderDocumentStatus)
  status?: BuilderDocumentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercent?: number;
}

export class UpdateDocumentSectionDto {
  @IsOptional()
  @IsString()
  sectionTitle?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isComplete?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collaborator DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class AddCollaboratorDto {
  @IsUUID()
  userId!: string;

  @IsEnum(BuilderCollaboratorRole)
  role!: BuilderCollaboratorRole;

  @IsOptional()
  @IsBoolean()
  notifyOnComments?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnChanges?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnReviews?: boolean;
}

export class UpdateCollaboratorDto {
  @IsOptional()
  @IsEnum(BuilderCollaboratorRole)
  role?: BuilderCollaboratorRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnComments?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnChanges?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnReviews?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateCommentDto {
  @IsUUID()
  documentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  sectionKey?: string;

  @IsOptional()
  @IsString()
  anchorText?: string;

  @IsOptional()
  @IsInt()
  anchorStart?: number;

  @IsOptional()
  @IsInt()
  anchorEnd?: number;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsEnum(BuilderCommentStatus)
  status?: BuilderCommentStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateReviewDto {
  @IsUUID()
  documentId!: string;

  @IsUUID()
  reviewerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class SubmitReviewDto {
  @IsEnum(BuilderReviewStatus)
  status!: BuilderReviewStatus;

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
// AI Generation DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class GenerateContentDto {
  @IsUUID()
  workspaceId!: string;

  @IsEnum(BuilderDocumentType)
  documentType!: BuilderDocumentType;

  @IsOptional()
  @IsString()
  sectionKey?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsString()
  customPrompt?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  temperature?: number;
}

export class RegenerateContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @IsOptional()
  @IsObject()
  additionalContext?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Readiness DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class AssessReadinessDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ReadinessDimension, { each: true })
  dimensions?: ReadinessDimension[];
}

export class UpdateReadinessCriterionDto {
  @IsEnum(ReadinessDimension)
  dimension!: ReadinessDimension;

  @IsString()
  criterionId!: string;

  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @IsString()
  evidence?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateApplicationDto {
  @IsUUID()
  workspaceId!: string;

  @IsEnum(ApplicationTemplateType)
  templateType!: ApplicationTemplateType;

  @IsString()
  @MaxLength(200)
  templateName!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercent?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  submissionUrl?: string;
}

export class GenerateApplicationAnswersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionIds?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Export DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class ExportDocumentDto {
  @IsUUID()
  documentId!: string;

  @IsString()
  format!: 'pdf' | 'pptx' | 'docx' | 'json' | 'markdown';

  @IsOptional()
  @IsObject()
  options?: {
    includeComments?: boolean;
    includeVersionHistory?: boolean;
    template?: string;
  };
}

export class ExportWorkspaceDto {
  @IsUUID()
  workspaceId!: string;

  @IsString()
  format!: 'pdf' | 'zip' | 'json';

  @IsOptional()
  @IsArray()
  @IsEnum(BuilderDocumentType, { each: true })
  documentTypes?: BuilderDocumentType[];

  @IsOptional()
  @IsObject()
  options?: {
    includeComments?: boolean;
    includeVersionHistory?: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template DTOs
// ─────────────────────────────────────────────────────────────────────────────

export class CreateTemplateDto {
  @IsEnum(BuilderDocumentType)
  type!: BuilderDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  content!: Record<string, any>;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Types (interfaces for type safety without class instantiation)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  status: BuilderWorkspaceStatus;
  visibility: BuilderWorkspaceVisibility;
  startupName?: string;
  industry?: string;
  stage?: string;
  targetMarket?: string;
  foundingDate?: Date;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  documentCount?: number;
  collaboratorCount?: number;
  overallReadiness?: number;
}

export interface DocumentResponseDto {
  id: string;
  workspaceId: string;
  type: BuilderDocumentType;
  title: string;
  description?: string;
  content: Record<string, any>;
  status: BuilderDocumentStatus;
  completionPercent: number;
  aiGenerated: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  sections?: DocumentSectionResponseDto[];
  commentCount?: number;
  reviewCount?: number;
}

export interface DocumentSectionResponseDto {
  id: string;
  sectionKey: string;
  sectionTitle: string;
  sortOrder: number;
  content: Record<string, any>;
  isComplete: boolean;
  confidence?: number;
  aiGenerated: boolean;
  aiSuggestions?: Record<string, any>;
}

export interface CollaboratorResponseDto {
  id: string;
  userId: string;
  role: BuilderCollaboratorRole;
  isActive: boolean;
  invitedAt: Date;
  acceptedAt?: Date;
  lastAccessAt?: Date;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
}

export interface CommentResponseDto {
  id: string;
  documentId: string;
  body: string;
  sectionKey?: string;
  anchorText?: string;
  status: BuilderCommentStatus;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  replies?: CommentResponseDto[];
}

export interface ReviewResponseDto {
  id: string;
  documentId: string;
  title?: string;
  instructions?: string;
  status: BuilderReviewStatus;
  feedback?: string;
  rating?: number;
  requestedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  requestedBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  reviewer: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ReadinessResponseDto {
  workspaceId: string;
  overallScore: number;
  overallStatus: string;
  readinessLevel: string;
  dimensions: {
    dimension: ReadinessDimension;
    score: number;
    maxScore: number;
    status: string;
    criteria: {
      id: string;
      name: string;
      description: string;
      completed: boolean;
      weight: number;
      evidence?: string;
    }[];
    recommendations: string[];
  }[];
  blockers: string[];
  nextMilestones: string[];
  assessedAt: Date;
}

export interface AIGenerationResponseDto {
  id: string;
  documentType: BuilderDocumentType;
  sectionKey?: string;
  status: string;
  content?: Record<string, any>;
  tokensUsed?: number;
  latencyMs?: number;
  model: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ApplicationResponseDto {
  id: string;
  workspaceId: string;
  templateType: ApplicationTemplateType;
  templateName: string;
  answers: Record<string, string>;
  status: string;
  completionPercent: number;
  deadline?: Date;
  submittedAt?: Date;
  submissionUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}
