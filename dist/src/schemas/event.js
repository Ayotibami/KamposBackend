import { z } from 'zod';
export const createEventSchema = z.object({
    title: z.string().min(1).max(255),
    host_avi_tags: z.array(z.string().min(1)).min(1).max(3),
    location: z.string().min(1),
    description: z.string().min(1),
    event_date: z.coerce.date(),
});
export const updateEventSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    host_avi_tags: z.array(z.string().min(1)).min(1).max(3).optional(),
    location: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    event_date: z.coerce.date().optional(),
});
