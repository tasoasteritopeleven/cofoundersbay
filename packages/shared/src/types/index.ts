// Shared domain types (API + Web)

export * from './api';
export type UserRole = 'founder' | 'mentor' | 'investor' | 'org';

// Re-export commonly used types for convenience
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  StandardErrorResponse,
  StandardSuccessResponse,
  RequestMetadata,
  HealthCheckResponse,
} from './api';

export { ErrorCode } from './api';

export interface UserProfileBase {
  id: string;
  role: UserRole;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export type VisibilityLevel = 'public' | 'connections' | 'private';

export interface ProfileVisibilityRules {
  email?: VisibilityLevel;
  phone?: VisibilityLevel;
  location?: VisibilityLevel;
  /** `hidden`: out of other people's search, directory, recommendations and scout (shared/visibility). */
  search?: 'visible' | 'hidden';
  /** `members`: the profile is not readable without signing in. */
  profile?: 'public' | 'members';
}

export interface PublicProfile {
  id: string;
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  languages: string[] | null;
  avatarUrl: string | null;
  role: UserRole;
  rolePayload: Record<string, unknown> | null;
  skills: { skillId: string; skillName: string; level: string | null }[];
  createdAt: string;
  updatedAt: string;
}
