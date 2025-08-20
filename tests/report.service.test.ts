import { describe, it, expect } from "vitest";
import { ReportService } from "../src/modules/report/report.service";

describe("ReportService", () => {
  it("loads service module", () => {
    expect(ReportService).toBeTruthy();
  });
});
