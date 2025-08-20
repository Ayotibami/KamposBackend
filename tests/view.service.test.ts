import { describe, it, expect } from "vitest";
import { ViewService } from "../src/modules/view/view.service";

describe("ViewService", () => {
  it("loads service module", () => {
    expect(ViewService).toBeTruthy();
  });
});
