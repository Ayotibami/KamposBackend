import { z } from "zod";

export class ReactionSchemas {
  static createReaction = z
    .object({
      entityType: z.enum(["GIST", "COMMENT"]),
      entityId: z.string().uuid("Invalid entity ID"),
      type: z.enum(["LIKE", "LOVE", "FIRE", "SAD", "WOW"]),
    })
    .strict();
}
