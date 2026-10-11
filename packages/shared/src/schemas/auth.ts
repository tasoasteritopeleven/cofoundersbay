import { z } from 'zod';

const passwordMin = 8;
const passwordMax = 128;

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(passwordMin, `Password must be at least ${passwordMin} characters`)
    .max(passwordMax, `Password must be at most ${passwordMax} characters`),
  role: z.enum(['founder', 'mentor', 'investor', 'org']).optional().default('founder'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
