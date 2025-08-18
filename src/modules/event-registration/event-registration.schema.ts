import { z } from "zod";

export class EventRegistrationSchemas {
  static createRegistration = z
    .object({
      eventId: z.string().uuid("Invalid event ID"),
    })
    .strict();
}
