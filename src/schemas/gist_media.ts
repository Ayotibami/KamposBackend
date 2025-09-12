import { z } from 'zod';

export const updateGistMediaSchema = z.object({
  order_index: z.number().int().min(0).optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  media_url: z.string().url().optional(),
});
