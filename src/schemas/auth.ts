import { z } from 'zod';

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
