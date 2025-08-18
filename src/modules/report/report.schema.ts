import { z } from "zod";

export class ReportSchemas {
  static createReport = z
    .object({
      gistId: z.string().uuid("Invalid gist ID"),
      reason: z.string().min(1, "Reason is required"),
    })
    .strict();

  static updateReport = z
    .object({
      status: z
        .enum(["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"])
        .optional(),
      actionTaken: z.string().nullable().optional(),
    })
    .strict();
}
