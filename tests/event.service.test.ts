import { describe, it, expect } from "vitest";
import { EventService } from "../src/modules/event/event.service";

describe("EventService", () => {
  it("loads service module", () => {
    expect(EventService).toBeTruthy();
  });
});
