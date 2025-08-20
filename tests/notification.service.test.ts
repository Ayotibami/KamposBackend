import { describe, it, expect } from "vitest";
import { NotificationService } from "../src/modules/notification/notification.service";

describe("NotificationService", () => {
  it("loads service module", () => {
    expect(NotificationService).toBeTruthy();
  });
});
