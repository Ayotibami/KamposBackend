import { z } from "zod";

export class MediaSchemas {
  static uploadMedia = z
    .object({
      entityType: z.enum(["gist", "event"]),
      entityId: z.string().uuid(),
      mediaType: z.enum(["image", "video"]),
    })
    .strict();

  static updateMedia = z
    .object({
      mediaUrl: z.string().url().optional(),
      thumbnailUrl: z.string().url().nullable().optional(),
    })
    .strict();
}
