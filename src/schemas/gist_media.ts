import { z } from 'zod';

export const updateGistMediaSchema = z.object({
  order_index: z.number().int().min(0).optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  media_url: z.string().url().optional(),
});

export const reorderGistMediaSchema = z.object({
  media_ids: z.array(z.string().uuid()).min(1),
});
