import { z } from "zod";

export class EventSchemas {
  static createEvent = z
    .object({
      title: z.string().min(1, "Title is required"),
      hostAviTags: z.array(z.string().uuid()).max(3, "Maximum 3 hosts allowed"),
      location: z.string().min(1, "Location is required"),
      description: z.string().min(1, "Description is required"),
      eventDate: z.string().datetime("Invalid date format"),
    })
    .strict();

  static updateEvent = z
    .object({
      title: z.string().min(1).optional(),
      hostAviTags: z.array(z.string().uuid()).max(3).optional(),
      location: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      eventDate: z.string().datetime().optional(),
    })
    .strict();
}
