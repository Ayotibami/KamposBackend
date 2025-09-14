import { z } from 'zod';

export const createGistSchema = z.object({
  gist_text: z.string().min(1),
});

export const updateGistSchema = z.object({
  gist_text: z.string().min(1).optional(),
});

export const reportGistSchema = z.object({
  reason: z.string().min(1).max(500).optional().nullable(),
});
