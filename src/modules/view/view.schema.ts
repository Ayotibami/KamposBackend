import { z } from "zod";

export class ViewSchemas {
  static createView = z
    .object({
      gistId: z.string().uuid("Invalid gist ID"),
    })
    .strict();
}
