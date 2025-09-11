import { z } from 'zod';

export const upsertReactionSchema = z.object({
  entity_type: z.enum(['GIST','COMMENT']),
  entity_id: z.string().uuid(),
  type: z.enum(['LIKE','LOVE','FIRE','SAD','WOW']),
});

export const removeByEntitySchema = z.object({
  entity_type: z.enum(['GIST','COMMENT']),
  entity_id: z.string().uuid(),
});
