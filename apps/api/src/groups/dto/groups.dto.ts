import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(5000).optional(),
  privacy: z.enum(['public', 'private', 'secret']).default('public'),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  coverImageUrl: z.string().url().optional(),
  avatarUrl: z.string().url().optional(),
  rules: z
    .array(
      z.object({
        title: z.string().max(100),
        description: z.string().max(500),
      }),
    )
    .max(10)
    .optional(),
});
export type CreateGroupDto = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(5000).optional(),
  privacy: z.enum(['public', 'private', 'secret']).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  rules: z
    .array(
      z.object({
        title: z.string().max(100),
        description: z.string().max(500),
      }),
    )
    .max(10)
    .optional(),
});
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

export const createGroupPostSchema = z.object({
  content: z.string().min(1).max(10000),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  isPinned: z.boolean().optional().default(false),
});
export type CreateGroupPostDto = z.infer<typeof createGroupPostSchema>;

export const createGroupCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type CreateGroupCommentDto = z.infer<typeof createGroupCommentSchema>;

export const groupFiltersSchema = z.object({
  category: z.string().optional(),
  privacy: z.enum(['public', 'private', 'secret']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'popular', 'trending']).default('popular'),
  myGroups: z.coerce.boolean().optional(),
});
export type GroupFiltersDto = z.infer<typeof groupFiltersSchema>;

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationDto = z.infer<typeof paginationSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member']),
});
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
