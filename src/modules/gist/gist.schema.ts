import { z } from "zod";

export class GistSchemas {
  static createGist = z
    .object({
      gistText: z
        .string({ required_error: "Gist text is required" })
        .min(1, "Gist text cannot be empty"),
    })
    .strict();

  static updateGist = z
    .object({
      gistText: z.string().min(1, "Gist text cannot be empty").optional(),
    })
    .strict();

  static searchGists = z.object({
    query: z.string({ required_error: "Search query is required" }).min(1),
    page: z.number().int().positive().default(1).optional(),
    limit: z.number().int().positive().default(10).optional(),
  });
}
