import { z } from "zod";

export const gistSchema = z.object({
  gist_text: z
    .string()
    .min(1, "Gist text is required")
    .max(1000, "Gist text too long"),
  media_ids: z.array(z.string().uuid()).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "FOLLOWERS"]).default("PUBLIC"),
});

export const approveSchema = z.object({
  approved: z.boolean(),
});
