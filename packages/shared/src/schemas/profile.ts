import { z } from 'zod';

const visibilityLevel = z.enum(['public', 'connections', 'private']);
const skillLevel = z.enum(['beginner', 'intermediate', 'expert']).optional();

export const profileVisibilitySchema = z.object({
  email: visibilityLevel.optional(),
  phone: visibilityLevel.optional(),
  location: visibilityLevel.optional(),
  // Read by search, matching, the scout and the profile read (shared/visibility).
  search: z.enum(['visible', 'hidden']).optional(),
  profile: z.enum(['public', 'members']).optional(),
});

// Role-specific payloads (flexible for search/filters later)
export const founderPayloadSchema = z.object({
  industry: z.string().max(200).optional(),
  stage: z.string().max(100).optional(), // idea | mvp | traction | scaling
  commitment: z.string().max(100).optional(), // full-time | part-time
  rolesSought: z.array(z.string().max(100)).max(10).optional(),
}).passthrough();

export const mentorPayloadSchema = z.object({
  expertiseAreas: z.array(z.string().max(200)).max(20).optional(),
  availability: z.string().max(500).optional(),
  meetingPreferences: z.string().max(500).optional(),
}).passthrough();

export const investorPayloadSchema = z.object({
  investmentFocus: z.array(z.string().max(200)).max(20).optional(),
  stages: z.array(z.string().max(100)).max(10).optional(),
  geography: z.array(z.string().max(100)).max(10).optional(),
  typicalCheckSize: z.string().max(100).optional(),
}).passthrough();

export const orgPayloadSchema = z.object({
  organizationType: z.string().max(100).optional(),
  programTypes: z.array(z.string().max(100)).max(10).optional(),
}).passthrough();

export const rolePayloadSchema = z.union([
  founderPayloadSchema,
  mentorPayloadSchema,
  investorPayloadSchema,
  orgPayloadSchema,
]);

export const createProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name required').max(200),
  headline: z.string().max(300).optional(),
  bio: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  timezone: z.string().max(100).optional(),
  languages: z.array(z.string().max(20)).max(20).optional(),
  avatarUrl: z.string().url().max(2000).optional().or(z.literal('')),
  rolePayload: rolePayloadSchema.optional(),
  visibilityRules: profileVisibilitySchema.optional(),
  skillIds: z.array(z.string().uuid()).max(50).optional(),
  skillLevels: z.record(z.string().uuid(), skillLevel).optional(), // skillId -> level
});

export const updateProfileSchema = createProfileSchema.partial();

export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;
export type FounderPayload = z.infer<typeof founderPayloadSchema>;
export type MentorPayload = z.infer<typeof mentorPayloadSchema>;
export type InvestorPayload = z.infer<typeof investorPayloadSchema>;
export type OrgPayload = z.infer<typeof orgPayloadSchema>;
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
