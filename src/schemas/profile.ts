import { z } from 'zod';

export const studentCreateSchema = z.object({
  avitag: z.string().min(2),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  display_name: z.string().optional().nullable(),
  campus_tag: z.string().optional().nullable(),
  major_tag: z.string().optional().nullable(),
  level: z.union([z.coerce.number().int(), z.string()]).optional().nullable(),
  bio: z.string().optional().nullable(),
  hobbies: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  degree: z.enum(['BACHELORS','MASTERS','PHD']).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const kreatorCreateSchema = z.object({
  avitag: z.string().min(2),
  display_name: z.string().min(1),
  campustag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const kompanyCreateSchema = z.object({
  avitag: z.string().min(2),
  display_name: z.string().min(1),
  email: z.string().email(),
  phone_number: z.string().min(3),
  website: z.string().url(),
  social_links: z.any().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

export const schoolCreateSchema = z.object({
  avitag: z.string().min(2),
  display_name: z.string().min(1),
  campus_tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});
