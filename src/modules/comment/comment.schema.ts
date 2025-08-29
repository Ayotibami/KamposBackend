import { z } from "zod";

export class CommentSchemas {
  static createComment = z
    .object({
      gistId: z.string().uuid("Invalid gist ID"),
      text: z
        .string({ required_error: "Comment text is required" })
        .min(1, "Comment text cannot be empty"),
    })
    .strict();

  static updateComment = z
    .object({
      text: z
        .string({ required_error: "Comment text is required" })
        .min(1, "Comment text cannot be empty"),
    })
    .strict();
}
