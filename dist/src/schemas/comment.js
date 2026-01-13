import { z } from 'zod';
export const createCommentSchema = z.object({
    gist_id: z.string().uuid(),
    text: z.string().min(1).max(500),
});
export const updateCommentSchema = z.object({
    text: z.string().min(1).max(500),
});
