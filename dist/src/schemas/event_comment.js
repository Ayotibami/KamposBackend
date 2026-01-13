import { z } from 'zod';
export const createEventCommentSchema = z.object({
    event_id: z.string().uuid(),
    text: z.string().min(1).max(500),
});
export const updateEventCommentSchema = z.object({
    text: z.string().min(1).max(500),
});
