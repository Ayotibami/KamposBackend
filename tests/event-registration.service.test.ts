import { describe, it, expect } from "vitest";
import { EventRegistrationService } from "../src/modules/event-registration/event-registration.service";

describe("EventRegistrationService", () => {
  it("loads service module", () => {
    expect(EventRegistrationService).toBeTruthy();
  });
});
