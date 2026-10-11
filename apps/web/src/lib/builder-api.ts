// Builder API client — routes all requests through the shared apiRequest helper
// so builder endpoints benefit from the circuit breaker, 6s timeout,
// cfb:api-offline events, 401→token-refresh retry, and proper error classes.
import { apiRequest } from '@/lib/api';

const api = {
  get: <T>(endpoint: string) =>
    apiRequest<T>(`/api${endpoint}`),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(`/api${endpoint}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(`/api${endpoint}`, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(`/api${endpoint}`, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(`/api${endpoint}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BuilderWorkspaceStatus = 'draft' | 'active' | 'archived' | 'completed';
export type BuilderWorkspaceVisibility = 'private' | 'team' | 'organization' | 'public';
export type BuilderDocumentType =
  | 'idea_core'
  | 'business_model_canvas'
  | 'market_analysis'
  | 'pitch_deck'
  | 'mvp_plan'
  | 'financial_plan'
  | 'technical_architecture'
  | 'prd'
  | 'branding_kit'
  | 'application'
  | 'custom';
export type BuilderDocumentStatus = 'draft' | 'in_progress' | 'review' | 'approved' | 'archived';
export type BuilderCollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type BuilderCommentStatus = 'open' | 'resolved' | 'archived';
export type BuilderReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';
export type ApplicationTemplateType = 'yc' | 'techstars' | 'university_incubator' | 'grant' | 'custom';
export type ReadinessDimension = 'team' | 'market' | 'product' | 'business' | 'funding' | 'execution';

export interface BuilderWorkspace {
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
  foundingDate?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  documentCount?: number;
  collaboratorCount?: number;
  overallReadiness?: number;
  documents?: BuilderDocument[];
  collaborators?: BuilderCollaborator[];
  readinessScores?: BuilderReadinessScore[];
}

export interface BuilderDocument {
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
  createdAt: string;
  updatedAt: string;
  sections?: BuilderDocumentSection[];
  commentCount?: number;
  reviewCount?: number;
}

export interface BuilderDocumentSection {
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

export interface BuilderCollaborator {
  id: string;
  userId: string;
  role: BuilderCollaboratorRole;
  isActive: boolean;
  invitedAt: string;
  acceptedAt?: string;
  lastAccessAt?: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
}

export interface BuilderComment {
  id: string;
  documentId: string;
  body: string;
  sectionKey?: string;
  anchorText?: string;
  status: BuilderCommentStatus;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  replies?: BuilderComment[];
}

export interface BuilderReview {
  id: string;
  documentId: string;
  title?: string;
  instructions?: string;
  status: BuilderReviewStatus;
  feedback?: string;
  rating?: number;
  requestedAt: string;
  dueDate?: string;
  completedAt?: string;
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

export interface BuilderReadinessScore {
  id: string;
  workspaceId: string;
  dimension: ReadinessDimension;
  score: number;
  maxScore: number;
  status: string;
  criteria: ReadinessCriterion[];
  recommendations?: string[];
  assessedAt: string;
}

export interface ReadinessCriterion {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  weight: number;
  evidence?: string;
}

export interface ReadinessAssessment {
  workspaceId: string;
  overallScore: number;
  overallStatus: string;
  readinessLevel: string;
  dimensions: {
    dimension: ReadinessDimension;
    score: number;
    maxScore: number;
    status: string;
    criteria: ReadinessCriterion[];
    recommendations: string[];
  }[];
  blockers: string[];
  nextMilestones: string[];
  assessedAt: string;
}

export interface BuilderApplication {
  id: string;
  workspaceId: string;
  templateType: ApplicationTemplateType;
  templateName: string;
  answers: Record<string, string>;
  status: string;
  completionPercent: number;
  deadline?: string;
  submittedAt?: string;
  submissionUrl?: string;
  createdAt: string;
  updatedAt: string;
  template?: ApplicationTemplate;
}

export interface ApplicationTemplate {
  name: string;
  questions: {
    id: string;
    question: string;
    maxLength?: number;
    tips?: string;
    required: boolean;
  }[];
  deadline?: string;
  website?: string;
}

export interface AIGenerationResult {
  content: Record<string, any>;
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

export interface BuilderActivityLog {
  id: string;
  workspaceId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace API
// ─────────────────────────────────────────────────────────────────────────────

export async function createWorkspace(data: {
  name: string;
  description?: string;
  startupName?: string;
  industry?: string;
  stage?: string;
  targetMarket?: string;
  visibility?: BuilderWorkspaceVisibility;
  settings?: Record<string, any>;
}): Promise<BuilderWorkspace> {
  return api.post('/builder/workspaces', data);
}

export async function getWorkspaces(params?: {
  status?: BuilderWorkspaceStatus;
  visibility?: BuilderWorkspaceVisibility;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<PaginatedResponse<BuilderWorkspace>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
  }
  const query = searchParams.toString();
  return api.get(`/builder/workspaces${query ? `?${query}` : ''}`);
}

export async function getWorkspace(workspaceId: string): Promise<BuilderWorkspace> {
  return api.get(`/builder/workspaces/${workspaceId}`);
}

export async function updateWorkspace(
  workspaceId: string,
  data: {
    name?: string;
    description?: string;
    logoUrl?: string;
    status?: BuilderWorkspaceStatus;
    visibility?: BuilderWorkspaceVisibility;
    startupName?: string;
    industry?: string;
    stage?: string;
    targetMarket?: string;
    foundingDate?: string;
    settings?: Record<string, any>;
  },
): Promise<BuilderWorkspace> {
  return api.put(`/builder/workspaces/${workspaceId}`, data);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  return api.delete(`/builder/workspaces/${workspaceId}`);
}

export async function archiveWorkspace(workspaceId: string): Promise<BuilderWorkspace> {
  return api.post(`/builder/workspaces/${workspaceId}/archive`);
}

export async function getWorkspaceActivity(
  workspaceId: string,
  limit?: number,
): Promise<BuilderActivityLog[]> {
  const query = limit ? `?limit=${limit}` : '';
  return api.get(`/builder/workspaces/${workspaceId}/activity${query}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document API
// ─────────────────────────────────────────────────────────────────────────────

export async function createDocument(data: {
  workspaceId: string;
  type: BuilderDocumentType;
  title: string;
  description?: string;
  content?: Record<string, any>;
  templateId?: string;
}): Promise<BuilderDocument> {
  return api.post('/builder/documents', data);
}

export async function getDocument(documentId: string): Promise<BuilderDocument> {
  return api.get(`/builder/documents/${documentId}`);
}

export async function updateDocument(
  documentId: string,
  data: {
    title?: string;
    description?: string;
    content?: Record<string, any>;
    status?: BuilderDocumentStatus;
    completionPercent?: number;
  },
): Promise<BuilderDocument> {
  return api.put(`/builder/documents/${documentId}`, data);
}

export async function updateDocumentSection(
  documentId: string,
  sectionKey: string,
  data: {
    sectionTitle?: string;
    content?: Record<string, any>;
    isComplete?: boolean;
    confidence?: number;
  },
): Promise<BuilderDocumentSection> {
  return api.patch(`/builder/documents/${documentId}/sections/${sectionKey}`, data);
}

export async function deleteDocument(documentId: string): Promise<void> {
  return api.delete(`/builder/documents/${documentId}`);
}

export async function getDocumentVersions(
  documentId: string,
): Promise<{ id: string; version: number; versionLabel?: string; createdAt: string }[]> {
  return api.get(`/builder/documents/${documentId}/versions`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Collaborator API
// ─────────────────────────────────────────────────────────────────────────────

export async function getCollaborators(workspaceId: string): Promise<BuilderCollaborator[]> {
  return api.get(`/builder/workspaces/${workspaceId}/collaborators`);
}

export async function addCollaborator(
  workspaceId: string,
  data: {
    userId: string;
    role: BuilderCollaboratorRole;
    notifyOnComments?: boolean;
    notifyOnChanges?: boolean;
    notifyOnReviews?: boolean;
  },
): Promise<BuilderCollaborator> {
  return api.post(`/builder/workspaces/${workspaceId}/collaborators`, data);
}

export async function updateCollaborator(
  workspaceId: string,
  collaboratorId: string,
  data: {
    role?: BuilderCollaboratorRole;
    isActive?: boolean;
    notifyOnComments?: boolean;
    notifyOnChanges?: boolean;
    notifyOnReviews?: boolean;
  },
): Promise<BuilderCollaborator> {
  return api.patch(`/builder/workspaces/${workspaceId}/collaborators/${collaboratorId}`, data);
}

export async function removeCollaborator(
  workspaceId: string,
  collaboratorId: string,
): Promise<void> {
  return api.delete(`/builder/workspaces/${workspaceId}/collaborators/${collaboratorId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment API
// ─────────────────────────────────────────────────────────────────────────────

export async function createComment(data: {
  documentId: string;
  body: string;
  sectionKey?: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  parentId?: string;
}): Promise<BuilderComment> {
  return api.post('/builder/comments', data);
}

export async function getDocumentComments(documentId: string): Promise<BuilderComment[]> {
  return api.get(`/builder/documents/${documentId}/comments`);
}

export async function updateComment(
  commentId: string,
  data: {
    body?: string;
    status?: BuilderCommentStatus;
  },
): Promise<BuilderComment> {
  return api.patch(`/builder/comments/${commentId}`, data);
}

export async function deleteComment(commentId: string): Promise<void> {
  return api.delete(`/builder/comments/${commentId}`);
}

export async function resolveComment(commentId: string): Promise<BuilderComment> {
  return updateComment(commentId, { status: 'resolved' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Review API
// ─────────────────────────────────────────────────────────────────────────────

export async function createReview(data: {
  documentId: string;
  reviewerId: string;
  title?: string;
  instructions?: string;
  dueDate?: string;
}): Promise<BuilderReview> {
  return api.post('/builder/reviews', data);
}

export async function getDocumentReviews(documentId: string): Promise<BuilderReview[]> {
  return api.get(`/builder/documents/${documentId}/reviews`);
}

export async function submitReview(
  reviewId: string,
  data: {
    status: BuilderReviewStatus;
    feedback?: string;
    rating?: number;
  },
): Promise<BuilderReview> {
  return api.post(`/builder/reviews/${reviewId}/submit`, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Readiness API
// ─────────────────────────────────────────────────────────────────────────────

export async function assessReadiness(data: {
  workspaceId: string;
  dimensions?: ReadinessDimension[];
}): Promise<ReadinessAssessment> {
  return api.post('/builder/readiness/assess', data);
}

export async function updateReadinessCriterion(
  workspaceId: string,
  data: {
    dimension: ReadinessDimension;
    criterionId: string;
    completed: boolean;
    evidence?: string;
  },
): Promise<BuilderReadinessScore> {
  return api.patch(`/builder/workspaces/${workspaceId}/readiness/criterion`, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Application API
// ─────────────────────────────────────────────────────────────────────────────

export async function createApplication(data: {
  workspaceId: string;
  templateType: ApplicationTemplateType;
  templateName: string;
  deadline?: string;
}): Promise<BuilderApplication> {
  return api.post('/builder/applications', data);
}

export async function getApplications(workspaceId: string): Promise<BuilderApplication[]> {
  return api.get(`/builder/workspaces/${workspaceId}/applications`);
}

export async function getApplication(applicationId: string): Promise<BuilderApplication> {
  return api.get(`/builder/applications/${applicationId}`);
}

export async function updateApplication(
  applicationId: string,
  data: {
    answers?: Record<string, string>;
    status?: string;
    completionPercent?: number;
    deadline?: string;
    submissionUrl?: string;
  },
): Promise<BuilderApplication> {
  return api.put(`/builder/applications/${applicationId}`, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Generation API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateContent(data: {
  workspaceId: string;
  documentType: BuilderDocumentType;
  sectionKey?: string;
  context?: Record<string, any>;
  customPrompt?: string;
  model?: string;
  temperature?: number;
}): Promise<AIGenerationResult> {
  return api.post('/builder/ai/generate', data);
}

export async function generateSection(data: {
  workspaceId: string;
  documentType: BuilderDocumentType;
  sectionKey: string;
  context?: Record<string, any>;
}): Promise<Record<string, any>> {
  return api.post('/builder/ai/generate-section', data);
}

export async function generateApplicationAnswer(data: {
  workspaceId: string;
  question: string;
  context?: Record<string, any>;
}): Promise<{ answer: string }> {
  return api.post('/builder/ai/generate-application-answer', data);
}

export async function improveContent(data: {
  content: string;
  documentType: BuilderDocumentType;
  feedback?: string;
}): Promise<{ improved: string }> {
  return api.post('/builder/ai/improve', data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export default object for convenience
// ─────────────────────────────────────────────────────────────────────────────

export const builderApi = {
  // Workspaces
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  archiveWorkspace,
  getWorkspaceActivity,
  // Documents
  createDocument,
  getDocument,
  updateDocument,
  updateDocumentSection,
  deleteDocument,
  getDocumentVersions,
  // Collaborators
  getCollaborators,
  addCollaborator,
  updateCollaborator,
  removeCollaborator,
  // Comments
  createComment,
  getDocumentComments,
  updateComment,
  deleteComment,
  resolveComment,
  // Reviews
  createReview,
  getDocumentReviews,
  submitReview,
  // Readiness
  assessReadiness,
  updateReadinessCriterion,
  // Applications
  createApplication,
  getApplications,
  getApplication,
  updateApplication,
  // AI
  generateContent,
  generateSection,
  generateApplicationAnswer,
  improveContent,
};

export default builderApi;
