import { z } from "zod";

export const createSpotCommentSchema = z.object({
  spot_id: z.string().uuid(),
  text: z.string().min(1).max(500),
});
