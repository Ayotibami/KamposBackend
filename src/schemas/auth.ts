import { z } from 'zod';

// Mirrors the frontend's PASSWORD_RULES (kampos-web/src/lib/validation.ts)
// exactly, so a password accepted by the UI is never rejected here and
// vice versa. This is the actual enforcement — the frontend's version is
// just UX guidance; without this, nothing stopped a weak/empty password
// via direct API access (Postman, a script, a modified client).
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const googleOAuthSchema = z.object({
  id_token: z.string().min(10),
  refresh_token: z.string().optional().nullable(),
  refresh_expires_at: z.union([z.coerce.date(), z.string()]).optional().nullable(),
});

export const facebookOAuthSchema = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().optional().nullable(),
  refresh_expires_at: z.union([z.coerce.date(), z.string()]).optional().nullable(),
});

export const appleOAuthSchema = z.object({
  identity_token: z.string().min(10),
  refresh_token: z.string().optional().nullable(),
  refresh_expires_at: z.union([z.coerce.date(), z.string()]).optional().nullable(),
});
